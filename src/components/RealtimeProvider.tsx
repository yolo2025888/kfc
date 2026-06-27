'use client';

import React, { useEffect, useRef } from 'react';
import { createSPASassClient, hasSupabaseBrowserConfig } from '@/lib/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { useGlobal } from "@/lib/context/GlobalContext";
import { Database } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
    const { toast } = useToast();
    const router = useRouter();
    const { user } = useGlobal();
    const userId = user?.id;
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);

    // 1. Preload Audio
    useEffect(() => {
        if (typeof window !== 'undefined' && !audioRef.current) {
            audioRef.current = new Audio('/tip.wav');
            audioRef.current.load();
        }
    }, []);

    // 2. Realtime Subscription
    useEffect(() => {
        // If user is not yet loaded or not logged in, don't setup
        if (!userId) return;
        if (!hasSupabaseBrowserConfig()) return;

        const setupRealtime = async () => {
            const client = await createSPASassClient();
            const supabase = client.getSupabaseClient();
            
            // Clean up previous subscription if any to avoid duplicates
            if (channelRef.current) {
                await supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }

            let isAdmin = false;
            let isAuditor = false;
            let visiblePlatforms: string[] | null = null;

            const { data: profile } = await client.getUserProfile(userId);
            const profileData = profile as Profile | null;
            
            if (profileData?.role === 'admin' || profileData?.role === 'super-admin') {
                isAdmin = true;
            } else if (profileData?.role === 'auditor') {
                isAuditor = true;
            }
            
            if (profileData?.visible_platforms) {
                visiblePlatforms = profileData.visible_platforms;
            } else if (profileData?.visible_platforms !== undefined) {
                visiblePlatforms = profileData.visible_platforms;
            }

            const playSound = () => {
                if (audioRef.current) {
                    const audio = audioRef.current;
                    audio.currentTime = 0;
                    audio.loop = true; // Enable loop
                    
                    const stopSound = () => {
                        audio.pause();
                        audio.currentTime = 0;
                        audio.loop = false;
                        window.removeEventListener('click', stopSound);
                        window.removeEventListener('keydown', stopSound);
                    };

                    // Add listeners to stop on interaction
                    window.addEventListener('click', stopSound);
                    window.addEventListener('keydown', stopSound);

                    audio.play().catch(e => {
                        console.warn("提示音播放失败 (请确保已点击页面以激活音频权限):", e);
                        // If failed, cleanup listeners to avoid memory leaks
                        stopSound();
                    });
                }
            };

            const channel = supabase.channel('system-global-updates')
                // 1. Tasks (INSERT)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'tasks' },
                    (payload) => {
                        const taskPlatform = payload.new.platform;
                        let hasAccess = true;

                        if (!isAdmin && visiblePlatforms !== null) {
                            if (visiblePlatforms.length === 0) hasAccess = false;
                            else hasAccess = visiblePlatforms.includes(taskPlatform);
                        }

                        // Only ordinary users should receive new task notifications
                        if (payload.new.status === 'open' && hasAccess && !isAuditor && !isAdmin) {
                            playSound();
                            toast({
                                title: "✨ 新任务发布！",
                                description: payload.new.title,
                                action: (
                                    <button 
                                        className="bg-white text-black px-3 py-1 rounded text-xs font-bold border hover:bg-gray-100 shadow-sm"
                                        onClick={() => router.push('/app/tasks')}
                                    >
                                        去看看
                                    </button>
                                )
                            });
                        }
                    }
                )
                // 2. User Tasks (INSERT) - Admin Only
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'user_tasks' },
                    (payload) => {
                        if (!isAdmin) return;
                        playSound();
                        toast({
                            title: "👤 有用户领取了任务",
                            description: "点击查看用户接单详情",
                            action: (
                                <button 
                                    className="bg-gray-900 text-white px-3 py-1 rounded text-xs font-bold hover:bg-gray-800 shadow-sm"
                                    onClick={() => router.push(`/app/admin/users/${payload.new.user_id}`)}
                                >
                                    查看用户
                                </button>
                            )
                        });
                    }
                )
                // 3. Leads (INSERT & UPDATE) - Mixed
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'leads' },
                    (payload) => {
                        // Admin: New Lead Submitted (INSERT) or Resubmitted (UPDATE -> pending)
                        if (isAdmin) {
                            const isInsert = payload.eventType === 'INSERT';
                            const isResubmit = payload.eventType === 'UPDATE' && 
                                             payload.new.status === 'pending' && 
                                             payload.old.status !== 'pending';

                            if (isInsert || isResubmit) {
                                try {
                                    playSound();
                                    window.dispatchEvent(new CustomEvent('new-lead-submitted'));
                                    toast({
                                        title: isInsert ? "💰 有新客资提交！" : "🔄 有客资重新提交！",
                                        description: `联系方式: ${payload.new.contact_info}`,
                                        className: "bg-green-50 border-green-200",
                                        action: (
                                            <button 
                                                className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 shadow-sm"
                                                onClick={() => router.push('/app/admin/reviews')}
                                            >
                                                去审核
                                            </button>
                                        )
                                    });
                                } catch (e) {
                                    console.error("Admin realtime error:", e);
                                }
                            }
                        }

                        // User: Lead Rejected (UPDATE pending -> rejected)
                        if (!isAdmin && !isAuditor && payload.eventType === 'UPDATE' && payload.new.status === 'rejected' && payload.new.user_id === userId) {
                            playSound();
                            toast({
                                title: "❌ 客资被驳回",
                                description: `您的客资 (${payload.new.contact_info}) 未通过审核，请查看原因并修改。`,
                                variant: "destructive",
                                action: (
                                    <button 
                                        className="bg-white text-red-600 px-3 py-1 rounded text-xs font-bold border hover:bg-red-50 shadow-sm"
                                        onClick={() => router.push(`/app/leads/${payload.new.id}`)}
                                    >
                                        去修改
                                    </button>
                                )
                            });
                        }

                        // Auditor: Lead Verified (UPDATE)
                        if (isAuditor && payload.eventType === 'UPDATE') {
                            const isVerified = payload.new.status === 'verified';
                            const wasNotVerified = payload.old.status !== 'verified';
                            
                            if (isVerified && wasNotVerified) {
                                playSound();
                                window.dispatchEvent(new CustomEvent('new-lead-verified'));
                                toast({
                                    title: "🔔 公海有新客资！",
                                    description: "有新客资进入公海池，请及时领取。",
                                    className: "bg-blue-50 border-blue-200 shadow-lg",
                                    duration: 5000,
                                    action: (
                                        <button 
                                            className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 shadow-sm"
                                            onClick={() => router.push('/app/admin/reviews')}
                                        >
                                            去领取
                                        </button>
                                    )
                                });
                            }
                        }
                    }
                )
                // 4. Chat Comments (INSERT) - Broadcast globally
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'lead_comments' },
                    (payload) => {
                        window.dispatchEvent(new CustomEvent('new-chat-message', { detail: payload.new }));
                    }
                )
                // 5. Read Status (UPSERT) - Broadcast
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'lead_reads' },
                    (payload) => {
                        window.dispatchEvent(new CustomEvent('user-read-chat', { detail: payload.new }));
                    }
                )
                .subscribe();
            
            channelRef.current = channel;
        };

        setupRealtime();

        return () => {
            if (channelRef.current) {
                channelRef.current.unsubscribe();
            }
        };
    }, [router, toast, userId]); // Re-subscribe only when the active user or notification dependencies change

    return <>{children}</>;
}
