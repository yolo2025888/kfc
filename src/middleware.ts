import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
    // 1. Domain Check for qlei.com
    const hostname = request.headers.get('host') || '';
    const { pathname } = request.nextUrl;

    if (hostname === 'www.kfcv.com') {
        const url = request.nextUrl.clone();
        url.hostname = 'kfcv.com';
        return NextResponse.redirect(url, 301);
    }

    // If domain is qlei.com (or subdomains) and user visits root '/', redirect to login
    if (hostname.includes('qlei.com') && pathname === '/') {
        return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // 2. Standard Session Update
    return await updateSession(request)
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
