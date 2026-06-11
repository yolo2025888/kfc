// src/lib/context/GlobalContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createSPASassClient } from '@/lib/supabase/client';

type User = {
    email: string;
    id: string;
    registered_at: Date;
};

interface GlobalContextType {
    loading: boolean;
    user: User | null | undefined;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null | undefined>(undefined);

    useEffect(() => {
        let authSubscription: { unsubscribe: () => void } | null = null;

        async function initAuth() {
            try {
                const sassClient = await createSPASassClient();
                const supabase = sassClient.getSupabaseClient();

                // 1. Initial check
                const { data: { user: initialUser } } = await supabase.auth.getUser();
                if (initialUser) {
                    setUser({
                        email: initialUser.email!,
                        id: initialUser.id,
                        registered_at: new Date(initialUser.created_at)
                    });
                } else {
                    setUser(null);
                }

                // 2. Listen for changes (Login, Logout, Token Refresh)
                const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                    if (session?.user) {
                        setUser({
                            email: session.user.email!,
                            id: session.user.id,
                            registered_at: new Date(session.user.created_at)
                        });
                    } else {
                        setUser(null);
                    }
                    setLoading(false);
                });
                
                authSubscription = subscription;

            } catch (error) {
                console.error('Auth initialization error:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        }

        initAuth();

        return () => {
            if (authSubscription) authSubscription.unsubscribe();
        };
    }, []);

    return (
        <GlobalContext.Provider value={{ loading, user }}>
            {children}
        </GlobalContext.Provider>
    );
}

export const useGlobal = () => {
    const context = useContext(GlobalContext);
    if (context === undefined) {
        throw new Error('useGlobal must be used within a GlobalProvider');
    }
    return context;
};
