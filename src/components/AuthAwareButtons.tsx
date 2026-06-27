"use client";
import { useState, useEffect } from 'react';
import { createSPASassClient, hasSupabaseBrowserConfig } from '@/lib/supabase/client';
import { ArrowRight, ChevronRight } from 'lucide-react';
import Link from "next/link";

export default function AuthAwareButtons({ variant = 'primary' }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            if (!hasSupabaseBrowserConfig()) {
                setIsAuthenticated(false);
                setLoading(false);
                return;
            }

            try {
                const supabase = await createSPASassClient();
                const { data: { user } } = await supabase.getSupabaseClient().auth.getUser();
                setIsAuthenticated(!!user);
            } catch (error) {
                if (process.env.NODE_ENV !== 'development') {
                    console.error('Error checking auth status:', error);
                }
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    if (loading) {
        return null;
    }

    // Navigation buttons for the header
    if (variant === 'nav') {
        return isAuthenticated ? (
            <Link
                href="/app"
                className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors"
            >
                我的后台
            </Link>
        ) : (
            <>
                <Link href="/auth/login" className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors">
                    登录
                </Link>
            </>
        );
    }

    if (variant === 'hero') {
        return (
            <Link 
                href={isAuthenticated ? "/app" : "/auth/login"} 
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-rose-600 text-white font-bold text-lg hover:bg-rose-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center"
            >
                {isAuthenticated ? '进入后台' : '立即加入'} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
        );
    }

    // Primary buttons for the hero section (default)
    return isAuthenticated ? (
        <Link
            href="/app"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
        >
            我的
            <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
    ) : (
        <>
            <Link
                href="/auth/register"
                className="inline-flex items-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
            >
                Start Building Free
                <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
                href="#features"
                className="inline-flex items-center px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
                Learn More
                <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
        </>
    );
}
