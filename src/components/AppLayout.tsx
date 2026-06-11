"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {
    Home,
    User,
    Menu,
    X,
    ChevronDown,
    LogOut,
    Briefcase, 
    ShieldCheck, 
    ClipboardCheck,
    UserPlus,
    Users,
    History,
    FileText,
    Settings2
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClient } from "@/lib/supabase/client";

type MenuItem = {
    code: string;
    icon: string | null;
    is_special: boolean | null;
    name: string;
    path: string;
    with_spacing: boolean | null;
};

type ProfileSummary = {
    full_name?: string | null;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isUserDropdownOpen, setUserDropdownOpen] = useState(false);
    const pathname = usePathname();
    const { user } = useGlobal();
    
    // The only source of truth for menu rendering
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoadingMenu, setIsLoadingMenu] = useState(true);
    const [profileName, setProfileName] = useState<string | null>(null);

    // Icon Mapping
    const ICON_MAP: Record<string, LucideIcon> = {
        Home, Briefcase, ShieldCheck, Users, Settings2, UserPlus, User, ClipboardCheck, FileText, History
    };

    useEffect(() => {
        const loadMenu = async () => {
            setIsLoadingMenu(true);
            setProfileName(null);

            if (user === undefined) return; // Initializing
            if (user === null) {
                setMenuItems([]); // No user, no menu (or guest menu)
                setIsLoadingMenu(false);
                return;
            }
            
            try {
                // 1. Get Profile Name (Client side cache is fast)
                const client = await createSPASassClient();
                const { data } = await client.getUserProfile(user.id);
                let profileData = data as ProfileSummary | null;
                if (Array.isArray(data)) profileData = (data[0] as ProfileSummary | undefined) ?? null;
                setProfileName(profileData?.full_name || null);

                // 2. Fetch Permissions (Menus)
                const res = await fetch('/api/auth/permissions');
                const permData = await res.json() as { permissions?: MenuItem[] };
                
                if (permData.permissions) {
                    setMenuItems(permData.permissions);
                }
            } catch (e) {
                console.error("Failed to load menu", e);
            } finally {
                setIsLoadingMenu(false);
            }
        };
        loadMenu();
    }, [user]);

    const handleLogout = async () => {
        try {
            const client = await createSPASassClient();
            await client.logout();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const getInitials = (email: string, name?: string | null) => {
        if (name) {
            const parts = name.trim().split(/\s+/);
            if (parts.length > 1) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return name.slice(0, 2).toUpperCase();
        }
        const parts = email.split('@')[0].split(/[._-]/);
        return parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase();
    };

    const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    return (
        <div className="min-h-screen bg-gray-100">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out z-30 
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

                <div className="h-16 flex items-center justify-between px-4 border-b">
                    <span className="text-xl font-semibold text-primary-600">{productName}</span>
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="mt-4 px-2 space-y-1">
                    {isLoadingMenu ? (
                        <div className="space-y-3 px-2 pt-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-9 w-full bg-gray-100 animate-pulse rounded-md"></div>
                            ))}
                        </div>
                    ) : (
                        menuItems.map((item) => {
                            const isActive = pathname === item.path;
                            const isSpecial = item.is_special;
                            const IconComponent = ICON_MAP[item.icon ?? ''] || Briefcase; // Fallback icon

                            return (
                                <React.Fragment key={item.code}>
                                    <Link
                                        href={item.path}
                                        className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                                            isActive
                                                ? isSpecial ? 'bg-rose-50 text-rose-600 shadow-sm' : 'bg-primary-50 text-primary-600'
                                                : isSpecial ? 'text-rose-600 hover:bg-rose-50' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                    >
                                        <IconComponent
                                            className={`mr-3 h-5 w-5 ${
                                                isActive 
                                                    ? isSpecial ? 'text-rose-500' : 'text-primary-500' 
                                                    : isSpecial ? 'text-rose-400' : 'text-gray-400 group-hover:text-gray-500'
                                            }`}
                                        />
                                        <span className={isSpecial ? 'font-bold' : ''}>{item.name}</span>
                                    </Link>
                                    {item.with_spacing && (
                                        <div className="my-4 border-t border-gray-300 mx-4 opacity-50" />
                                    )}
                                </React.Fragment>
                            );
                        })
                    )}
                </nav>

            </div>

            <div className="lg:pl-64">
                <div className="sticky top-0 z-10 flex items-center justify-between h-16 bg-white shadow-sm px-4">
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <Menu className="h-6 w-6"/>
                    </button>

                    <div className="relative ml-auto">
                        <button
                            onClick={() => setUserDropdownOpen(!isUserDropdownOpen)}
                            className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900"
                            disabled={isLoadingMenu || !user}
                        >
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-700 font-medium">
                                    {(isLoadingMenu || !user) ? '...' : getInitials(user.email, profileName)}
                                </span>
                            </div>
                            <span>{(isLoadingMenu || !user) ? '正在连接...' : (profileName || user.email?.split('@')[0])}</span>
                            <ChevronDown className="h-4 w-4"/>
                        </button>

                        {isUserDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border">
                                <div className="p-2 border-b border-gray-100">
                                    <p className="text-xs text-gray-500">当前登录</p>
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {profileName || user?.email?.split('@')[0]}
                                    </p>
                                </div>
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setUserDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                        <LogOut className="mr-3 h-4 w-4 text-red-400"/>
                                        退出登录
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <main className="p-2 sm:p-4">
                    {children}
                </main>
            </div>
        </div>
    );
}
