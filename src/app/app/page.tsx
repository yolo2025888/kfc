'use client';

import React, { useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, TrendingUp, Users, Briefcase, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import { useRouter } from 'next/navigation';

type Platform = Database['public']['Tables']['platforms']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type LeadWithTaskPlatform = Database['public']['Tables']['leads']['Row'] & {
    user_tasks: { tasks: Pick<Task, 'platform'> | null } | null;
};

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [platforms, setPlatforms] = useState<Platform[]>([]); // New
    const [platformStats, setPlatformStats] = useState<Record<string, number>>({}); // New
    const [stats, setStats] = useState({
        pendingReview: 0,
        totalLeadsToday: 0
    });
    const [userStats, setUserStats] = useState({
        myActiveTasks: 0,
        myTotalEarnings: 0 // Placeholder for now
    });

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            
            if (user) {
                // Check Role
                const authRole = user.app_metadata?.role;
                let role = authRole;
                
                const { data: profile } = await c.getUserProfile(user.id);
                const dbRole = profile?.role;
                role = dbRole || authRole;

                if (role === 'auditor') {
                    router.replace('/app/admin/reviews');
                    return;
                }

                if (role === 'admin' || role === 'super-admin') {
                    setIsAdmin(true);
                    loadAdminStats(c);
                    c.getPlatforms().then(({ data }) => setPlatforms(data || []));
                } else {
                    loadUserStats(c, user.id);
                }
            }
        });
    }, [router]);

    const loadAdminStats = async (c: SassClient) => {
        setLoading(true);
        try {
            // 1. Today's Leads
            const { data: todayData } = await c.getTodayLeads();
            
            const pStats: Record<string, number> = {};
            
            const todayLeads = (todayData || []) as unknown as LeadWithTaskPlatform[];
            if (todayLeads.length > 0) {
                todayLeads.forEach((lead) => {
                    const platform = lead.user_tasks?.tasks?.platform;
                    if (platform) {
                        pStats[platform] = (pStats[platform] || 0) + 1;
                    }
                });
            }
            setPlatformStats(pStats);

            // 2. Pending Reviews
            const { count } = await c.getSupabaseClient()
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            setStats({
                totalLeadsToday: todayLeads.length,
                pendingReview: count || 0
            });

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadUserStats = async (c: SassClient, uid: string) => {
        setLoading(true);
        try {
            const { count } = await c.getSupabaseClient()
                .from('user_tasks')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', uid)
                .eq('status', 'in_progress');
            
            setUserStats({
                myActiveTasks: count || 0,
                myTotalEarnings: 0
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-rose-600" /></div>;

    if (isAdmin) {
        return (
            <div className="container mx-auto py-8 px-4 space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">管理后台首页</h1>
                    <p className="text-gray-500 mt-2">今日数据概览</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-t-4 border-t-rose-500 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">今日总客资</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-gray-900">{stats.totalLeadsToday}</div>
                            <p className="text-xs text-gray-400 mt-1">较昨日 --</p>
                        </CardContent>
                    </Card>

                    {platforms.map(p => (
                        <Link key={p.id} href={`/app/admin/reviews?platform=${p.id}&date=today`}>
                            <Card className={`border-t-4 shadow-sm cursor-pointer hover:bg-gray-50/50 transition-colors ${
                                p.color === 'red' ? 'border-t-red-500' :
                                p.color === 'blue' ? 'border-t-blue-500' :
                                p.color === 'slate' ? 'border-t-gray-800' :
                                p.color === 'indigo' ? 'border-t-indigo-500' :
                                p.color === 'green' ? 'border-t-green-500' :
                                'border-t-gray-400'
                            }`}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">{p.name}今日新增</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className={`text-3xl font-bold ${
                                        p.color === 'red' ? 'text-red-600' :
                                        p.color === 'blue' ? 'text-blue-600' :
                                        'text-gray-900'
                                    }`}>{platformStats[p.id] || 0}</div>
                                    <div className="flex items-center text-xs text-gray-400 mt-1">
                                        <TrendingUp className="h-3 w-3 mr-1 text-green-500" /> 实时统计
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}

                    <Card className="border-t-4 border-t-orange-500 shadow-sm cursor-pointer hover:bg-orange-50 transition-colors" onClick={() => window.location.href='/app/admin/reviews'}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">待审核客资</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-orange-600">{stats.pendingReview}</div>
                            <p className="text-xs text-orange-600/80 mt-1 font-medium">点击前往审核 &rarr;</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-gray-500" /> 快捷管理
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <Link href="/app/admin/tasks">
                                <Button variant="outline" className="w-full justify-start h-12">
                                    发布/管理任务
                                    <ExternalLink className="ml-auto h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="/app/admin/reviews">
                                <Button variant="outline" className="w-full justify-start h-12">
                                    审核中心
                                    <ExternalLink className="ml-auto h-4 w-4" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">欢迎回来!</h1>
                <p className="text-gray-500 mt-2">准备好赚取今天的佣金了吗？</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg transform hover:-translate-y-1 transition-transform">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5" /> 进行中的任务
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold mb-2">{userStats.myActiveTasks}</div>
                        <p className="opacity-90 text-sm">个任务正在进行中</p>
                        <Link href="/app/tasks">
                            <Button className="mt-6 w-full bg-white text-rose-600 hover:bg-gray-100 border-none">
                                前往任务大厅
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className="border-gray-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-gray-500" /> 帮助中心
                        </CardTitle>
                        <CardDescription>遇到问题？</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                            如果在任务执行过程中遇到问题，请直接联系您的专属运营经理。
                        </div>
                        <Button variant="outline" className="w-full">
                            联系客服
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
