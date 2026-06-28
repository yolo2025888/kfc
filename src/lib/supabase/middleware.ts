import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/types'

type MiddlewareSupabaseClient = ReturnType<typeof createServerClient<Database, "public">>;
type ProfileRole = {
    role: string | null
    custom_role_id: string | null
}
type RoleRow = {
    id: string
}
type PermissionRow = {
    path: string | null
    type: string | null
}
type RolePermissionRow = {
    permission: PermissionRow | PermissionRow[] | null
}

const LEGACY_ADMIN_ROLES = new Set(['admin', 'super-admin', 'super_admin'])
const LEGACY_AUDITOR_ROLES = new Set(['auditor'])

function hasSupabaseServerConfig() {
    return Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
}

function normalizeRoleCode(role: string | null | undefined) {
    return role === 'super-admin' ? 'super_admin' : role
}

function normalizePath(path: string) {
    if (path.length > 1 && path.endsWith('/')) {
        return path.slice(0, -1)
    }
    return path
}

function pathMatchesPermission(pathname: string, permissionPath: string | null) {
    if (!permissionPath) return false

    const currentPath = normalizePath(pathname)
    const allowedPath = normalizePath(permissionPath)

    if (allowedPath === '/app') {
        return currentPath === allowedPath
    }

    return currentPath === allowedPath || currentPath.startsWith(`${allowedPath}/`)
}

function getPermission(row: RolePermissionRow) {
    return Array.isArray(row.permission) ? row.permission[0] : row.permission
}

function legacyRoleCanAccessAdminPath(role: string | null | undefined, pathname: string) {
    const normalizedRole = normalizeRoleCode(role)

    if (normalizedRole && LEGACY_ADMIN_ROLES.has(normalizedRole)) return true

    return Boolean(
        normalizedRole &&
        LEGACY_AUDITOR_ROLES.has(normalizedRole) &&
        pathMatchesPermission(pathname, '/app/admin/reviews')
    )
}

async function canAccessAdminPath(
    supabase: MiddlewareSupabaseClient,
    userId: string,
    pathname: string
) {
    const { data: profileResult, error: profileError } = await supabase
        .from('profiles')
        .select('role, custom_role_id')
        .eq('id', userId)
        .maybeSingle()
    const profile = profileResult as ProfileRole | null

    if (profileError || !profile) {
        return false
    }

    if (legacyRoleCanAccessAdminPath(profile.role, pathname)) {
        return true
    }

    let roleId = profile.custom_role_id

    if (!roleId) {
        const roleCode = normalizeRoleCode(profile.role)
        if (!roleCode) return false

        const { data: roleResult, error: roleError } = await supabase
            .from('app_roles')
            .select('id')
            .eq('code', roleCode)
            .maybeSingle()
        const role = roleResult as RoleRow | null

        if (roleError || !role) {
            return false
        }

        roleId = role.id
    }

    const { data: rolePermissionResults, error: permissionsError } = await supabase
        .from('app_role_permissions')
        .select('permission:app_permissions(type, path)')
        .eq('role_id', roleId)

    if (permissionsError || !rolePermissionResults) {
        return false
    }

    return ((rolePermissionResults ?? []) as unknown as RolePermissionRow[]).some((row) => {
        const permission = getPermission(row)
        return (
            (permission?.type === 'menu' || permission?.type === 'page') &&
            pathMatchesPermission(pathname, permission.path)
        )
    })
}

function redirectWithSessionCookies(url: URL, supabaseResponse: NextResponse) {
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie)
    })
    return response
}

export async function updateSession(request: NextRequest) {
    const publicPaths = ['/', '/onboarding']
    const { pathname } = request.nextUrl

    // Public entry points do not need a Supabase session refresh before render.
    if (publicPaths.includes(pathname)) {
        return NextResponse.next();
    }

    if (!hasSupabaseServerConfig()) {
        if (pathname.startsWith('/app')) {
            const url = request.nextUrl.clone()
            url.pathname = '/auth/login'
            return NextResponse.redirect(url)
        }

        return NextResponse.next();
    }

    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: DO NOT REMOVE auth.getUser()

    const { data: { user } } = await supabase.auth.getUser()
    if (
        !user && pathname.startsWith('/app')
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return redirectWithSessionCookies(url, supabaseResponse)
    }

    if (user && pathname.startsWith('/app/admin')) {
        const isAllowed = await canAccessAdminPath(supabase, user.id, pathname)

        if (!isAllowed) {
            const url = request.nextUrl.clone()
            url.pathname = '/app'
            url.search = ''
            return redirectWithSessionCookies(url, supabaseResponse)
        }
    }

    // IMPORTANT: You *must* return the supabaseResponse object as it is.
    // If you're creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    return supabaseResponse
}
