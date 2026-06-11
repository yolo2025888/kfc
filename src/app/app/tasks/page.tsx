'use client';

import React, { useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, ArrowRight, ExternalLink, RefreshCcw, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NProgress from 'nprogress';
import { cn, getErrorMessage } from "@/lib/utils"
import type { RealtimeChannel } from '@supabase/supabase-js';

type Task = Database['public']['Tables']['tasks']['Row'];
type UserTask = Database['public']['Tables']['user_tasks']['Row'] & { tasks: Task | null };
type Profile = Database['public']['Tables']['profiles']['Row'];
type Platform = Database['public']['Tables']['platforms']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

const colorMap: Record<string, string> = {
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    indigo: "bg-indigo-50 text-indigo-600",
    pink: "bg-pink-50 text-pink-600",
    slate: "bg-slate-900 text-white",
    gray: "bg-gray-100 text-gray-700"
};

export default function TasksPage() {
    const [client, setClient] = useState<SassClient | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [openTasks, setOpenTasks] = useState<Task[]>([]);
    const [myTasks, setMyTasks] = useState<UserTask[]>([]);
    const [platforms, setPlatforms] = useState<Platform[]>([]); 
    const [categories, setCategories] = useState<Category[]>([]); // New
    const [filterPlatform, setFilterPlatform] = useState('all'); // New
    const [filterCategory, setFilterCategory] = useState('all'); // New
    const [filterStatus, setFilterStatus] = useState('all'); // New
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [hasNewTasks, setHasNewTasks] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        let active = true;
        let cleanupSupabase: ReturnType<SassClient["getSupabaseClient"]> | null = null;
        let cleanupChannel: RealtimeChannel | null = null;

        createSPASassClientAuthenticated().then(async (c) => {
            if (!active) return;

            setClient(c);
            
            // Fetch everything in parallel
            const [platformsRes, categoriesRes, authRes] = await Promise.all([
                c.getPlatforms(),
                c.getCategories(),
                c.getSupabaseClient().auth.getUser()
            ]);

            const allPlatforms = platformsRes.data || [];
            const allCategories = categoriesRes.data || [];
            const user = authRes.data.user;

            let finalPlatforms = allPlatforms;
            let finalCategories = allCategories;

            if (user) {
                if (!active) return;

                setUserId(user.id);
                // Check Admin Role
                const authRole = user.app_metadata?.role;
                // Get profile for detailed permissions
                const { data: profileData } = await c.getUserProfile(user.id);
                const profile = profileData as Profile | null;
                const profileRole = profile?.role;

                if (authRole === 'admin' || authRole === 'super-admin' || profileRole === 'admin' || profileRole === 'super-admin') {
                    setIsAdmin(true);
                    loadAdminData(c);
                } else {
                    // Regular User Logic
                    loadTasks(c, user.id);
                    
                    // Filter dropdown options based on permissions
                    const vPlatforms = profile?.visible_platforms ?? null;
                    const vCategories = profile?.visible_categories ?? null;

                    if (vPlatforms !== null) {
                        finalPlatforms = allPlatforms.filter(p => vPlatforms.includes(p.id));
                    }
                    if (vCategories !== null) {
                        finalCategories = allCategories.filter(cat => vCategories.includes(cat.id));
                    }
                }

                // Setup Page-Level Realtime Listener
                const visiblePlatforms = profile?.visible_platforms ?? null;

                const supabase = c.getSupabaseClient();
                cleanupSupabase = supabase;

                const channel = supabase.channel('tasks-page-realtime')
                    .on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'tasks' },
                        (payload) => {
                            // Check permissions
                            let hasAccess = true;
                            if (visiblePlatforms !== null && visiblePlatforms !== undefined) {
                                if (visiblePlatforms.length === 0) {
                                    hasAccess = false;
                                } else {
                                    hasAccess = visiblePlatforms.includes(payload.new.platform);
                                }
                            }

                            if (payload.new.status === 'open' && hasAccess) {
                                setHasNewTasks(true);
                            }
                        }
                    )
                    .subscribe();

                if (!active) {
                    await supabase.removeChannel(channel);
                    return;
                }

                cleanupChannel = channel;
            }
            
            // Finally set the state
            if (!active) return;
            setPlatforms(finalPlatforms);
            setCategories(finalCategories);
        });

        return () => {
            active = false;
            if (cleanupSupabase && cleanupChannel) {
                void cleanupSupabase.removeChannel(cleanupChannel);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap auth + realtime subscription once per page mount
    }, []);

    const handleRefresh = () => {
        if (client && userId) {
            loadTasks(client, userId);
            setHasNewTasks(false);
        }
    };

    const filteredOpenTasks = openTasks.filter(task => {
        const matchesPlatform = filterPlatform === 'all' || task.platform === filterPlatform;
        const matchesCategory = filterCategory === 'all' || task.category_id === filterCategory;
        const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
        return matchesPlatform && matchesCategory && matchesStatus;
    });

    const loadAdminData = async (c: SassClient) => {
        setLoading(true);
        try {
            const { data } = await c.getAdminTasks();
            setOpenTasks(data || []);
        } catch (error) {
            console.error(error);
            toast({ title: "加载任务失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const loadTasks = async (c: SassClient, uid: string) => {
        setLoading(true);
        try {
            const [openRes, myRes] = await Promise.all([
                c.getTasksForUser(uid),
                c.getMyUserTasks(uid)
            ]);

            if (openRes.error) throw openRes.error;
            if (myRes.error) throw myRes.error;

            setOpenTasks(openRes.data || []);
            setMyTasks((myRes.data || []) as unknown as UserTask[]);
        } catch (error) {
            console.error(error);
            toast({ title: "加载任务失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleJoinTask = async (e: React.MouseEvent, taskId: string) => {
        e.stopPropagation();
        if (!client || !userId) return;
        
        try {
            const { data, error } = await client.joinTask(taskId, userId);
            if (error) throw error;
            
            // The RPC returns JSON; only use the id when it is present and string-like.
            const userTaskId = data && typeof data === 'object' && !Array.isArray(data) && 'id' in data
                ? String(data.id)
                : null;
            
            toast({ title: "领取任务成功", description: "正在前往工作台..." });
            
            if (userTaskId) {
                NProgress.start();
                router.push(`/app/tasks/${userTaskId}`);
            } else {
                // Fallback if ID is not returned directly
                loadTasks(client, userId);
            }
            
        } catch (error) {
            console.error(error);
            toast({ title: "领取失败", description: getErrorMessage(error, "请稍后再试"), variant: "destructive" });
        }
    };

    const navigateToDetail = (taskId: string) => {
        NProgress.start();
        router.push(`/app/tasks/view/${taskId}`);
    };

    if (loading && !client) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-rose-600" /></div>;
    }

    if (isAdmin) {
        return (
            <div className="max-w-7xl mx-auto py-4 sm:py-8 px-1 sm:px-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">所有任务监控 (管理员)</h1>
                        <p className="text-sm text-gray-500">查看平台内所有发布任务。</p>
                    </div>
                    <Link href="/app/admin/tasks" className="w-full sm:w-auto">
                        <Button variant="outline" className="w-full">前往任务管理后台 <ExternalLink className="ml-2 h-4 w-4" /></Button>
                    </Link>
                </div>

                <div className="flex gap-3 mb-6">
                    <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                        <SelectTrigger className="w-[120px] bg-white shadow-sm border-gray-200">
                            <SelectValue placeholder="平台" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">所有平台</SelectItem>
                            {platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="w-[120px] bg-white shadow-sm border-gray-200">
                            <SelectValue placeholder="类目" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">所有类目</SelectItem>
                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[120px] bg-white shadow-sm border-gray-200">
                            <SelectValue placeholder="状态" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">所有状态</SelectItem>
                            <SelectItem value="open">招募中</SelectItem>
                            <SelectItem value="ongoing">进行中</SelectItem>
                            <SelectItem value="closed">已关闭</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-4 relative min-h-[200px]">
                    {loading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg transition-opacity duration-200">
                            <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
                        </div>
                    )}
                    {filteredOpenTasks.map(task => (
                        <Card key={task.id} className="hover:shadow-md transition-all duration-300 border-gray-100 flex overflow-hidden cursor-pointer group" onClick={() => navigateToDetail(task.id)}>
                            <div className="flex items-center p-4 w-full gap-4">
                                {task.images && task.images.length > 0 ? (
                                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                        {task.images[0].match(/\.(mp4|webm|ogg|mov)$/i) ? (
                                            <video src={task.images[0]} className="w-full h-full object-cover" muted />
                                        ) : (
                                            <Image 
                                                src={task.images[0]} 
                                                alt={task.title} 
                                                fill 
                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
                                        无图
                                    </div>
                                )}
                                
                                <div className="flex-grow min-w-0">
                                                                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                                                                    <Badge variant="secondary" className={`flex-shrink-0 ${(() => {
                                                                                                                                        const p = platforms.find(p => p.id === task.platform) || { name: task.platform, color: 'gray' };
                                                                                                                                        // Simple color mapping
                                                                                                                                        const colorClass = colorMap[p.color ?? 'gray'] || colorMap.gray;
                                                                                                                                        return `${colorClass} text-[10px] px-1.5 py-0`;
                                                                                                                                    })()}`}>                                            {(() => {
                                                const p = platforms.find(p => p.id === task.platform);
                                                return p ? p.name : task.platform;
                                            })()}
                                        </Badge>
                                        <Badge variant={task.status === 'open' ? 'default' : 'secondary'} className={`flex-shrink-0 ${
                                            task.status === 'open' ? 'bg-green-600 text-white text-[10px] px-1.5 py-0' : 
                                            task.status === 'ongoing' ? 'bg-blue-600 text-white text-[10px] px-1.5 py-0' : 'text-[10px] px-1.5 py-0'
                                        }`}>
                                            {task.status === 'open' ? '招募中' : task.status === 'ongoing' ? '已接' : '已关闭'}
                                        </Badge>
                                        <h3 className="font-bold text-gray-900 group-hover:text-rose-600 transition-colors truncate">
                                            {task.title}
                                        </h3>
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-1">{task.content}</p>
                                    <div className="mt-2 text-[10px] text-gray-400">
                                        创建于: {new Date(task.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-4">
                                    <div className="text-rose-600 font-bold text-lg">
                                        {task.reward_amount}积分
                                    </div>
                                    <Button size="sm" variant="ghost" className="text-gray-400 group-hover:text-rose-600">
                                        查看详情 <ArrowRight className="ml-1 h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                    {filteredOpenTasks.length === 0 && (
                        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed">
                            暂无发布的任务。
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-4 sm:py-8 px-1 sm:px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">任务大厅</h1>
                    <p className="text-sm text-gray-500">领取任务，完成赚取佣金。</p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefresh}
                    disabled={loading}
                    className="gap-2"
                >
                    <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                    刷新
                </Button>
            </div>

            {hasNewTasks && !loading && (
                <div className="flex justify-center mb-6">
                    <Button 
                        onClick={handleRefresh} 
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-md animate-bounce duration-1000 rounded-full px-6"
                    >
                        <RefreshCcw className="mr-2 h-4 w-4" /> 
                        有新任务发布，点击刷新
                    </Button>
                </div>
            )}

            <Tabs defaultValue="open" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8">
                    <TabsTrigger value="open">可接任务 ({openTasks.length})</TabsTrigger>
                    <TabsTrigger value="my">我的任务 ({myTasks.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="open" className="space-y-4 relative min-h-[200px]">
                    {loading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg transition-opacity duration-200">
                            <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
                        </div>
                    )}
                    <div className="space-y-3 mb-4">
                        {/* Platforms Filter */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 w-[calc(100%+0.5rem)] sm:w-full sm:mx-0 sm:px-0">
                            <button
                                onClick={() => setFilterPlatform('all')}
                                style={{ flexShrink: 0, whiteSpace: 'nowrap', minWidth: 'max-content' }}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                    filterPlatform === 'all' 
                                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm' 
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                全部平台
                            </button>
                            {platforms.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setFilterPlatform(p.id)}
                                    style={{ flexShrink: 0, whiteSpace: 'nowrap', minWidth: 'max-content' }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                        filterPlatform === p.id 
                                        ? 'bg-gray-900 text-white border-gray-900 shadow-sm' 
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>

                        {/* Categories Filter */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 w-[calc(100%+0.5rem)] sm:w-full sm:mx-0 sm:px-0">
                            <button
                                onClick={() => setFilterCategory('all')}
                                style={{ flexShrink: 0, whiteSpace: 'nowrap', minWidth: 'max-content' }}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                    filterCategory === 'all' 
                                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm' 
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                全部类目
                            </button>
                            {categories.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setFilterCategory(c.id)}
                                    style={{ flexShrink: 0, whiteSpace: 'nowrap', minWidth: 'max-content' }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                        filterCategory === c.id 
                                        ? 'bg-gray-900 text-white border-gray-900 shadow-sm' 
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 px-4 py-3 bg-orange-50 border border-orange-100 rounded-lg text-sm sm:text-base text-orange-800 shadow-sm">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-orange-600" />
                        <span className="font-bold">
                            提醒：对应平台+类目接单 ➡️ 对应的素材，<span className="underline decoration-orange-300 underline-offset-4">乱接无效！</span>
                        </span>
                    </div>

                    {filteredOpenTasks.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            {openTasks.length === 0 ? "暂时没有可接任务。" : "没有找到匹配的任务。"}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredOpenTasks.map(task => {
                                const isJoined = myTasks.some(mt => mt.task_id === task.id && mt.status === 'in_progress');
                                return (
                                    <Card key={task.id} className="hover:shadow-md transition-all duration-300 border-gray-100 flex overflow-hidden cursor-pointer group" onClick={() => navigateToDetail(task.id)}>
                                        <div className="flex items-center p-4 w-full gap-4">
                                            {task.images && task.images.length > 0 ? (
                                                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                                    {task.images[0].match(/\.(mp4|webm|ogg|mov)$/i) ? (
                                                        <video src={task.images[0]} className="w-full h-full object-cover" muted />
                                                    ) : (
                                                        <Image 
                                                            src={task.images[0]} 
                                                            alt={task.title} 
                                                            fill 
                                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300">
                                                    无图
                                                </div>
                                            )}
                                            
                                            <div className="flex-grow min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <Badge variant="secondary" className={`flex-shrink-0 ${(() => {
                                                        const p = platforms.find(p => p.id === task.platform) || { name: task.platform, color: 'gray' };
                                                        const colorClass = colorMap[p.color ?? 'gray'] || colorMap.gray;
                                                        return `${colorClass} text-[10px] px-1.5 py-0`;
                                                    })()}`}>
                                                        {(() => {
                                                            const p = platforms.find(p => p.id === task.platform);
                                                            return p ? p.name : task.platform;
                                                        })()}
                                                    </Badge>
                                                    <Badge variant="outline" className="flex-shrink-0 text-[10px] px-1.5 py-0 bg-gray-50 text-gray-600 border-gray-200">
                                                        {(() => {
                                                            const c = categories.find(c => c.id === task.category_id);
                                                            return c ? c.name : '其他';
                                                        })()}
                                                    </Badge>
                                                </div>
                                                <h3 className="font-bold text-gray-900 group-hover:text-rose-600 transition-colors truncate mb-1 text-sm sm:text-base">
                                                    {task.title}
                                                </h3>
                                                <p className="text-xs text-gray-500 line-clamp-1">{task.content}</p>                                                <div className="mt-2 text-xs text-gray-400">
                                                    发布于: {new Date(task.created_at).toLocaleDateString()}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-4">
                                                <div className="text-rose-600 font-bold text-lg">
                                                    {task.reward_amount}积分
                                                </div>
                                                {isJoined ? (
                                                    <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">已领取</Badge>
                                                ) : (
                                                    <Button 
                                                        size="sm" 
                                                        className="bg-rose-600 hover:bg-rose-700 h-8"
                                                        onClick={(e) => handleJoinTask(e, task.id)}
                                                    >
                                                        立即接单
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="my" className="space-y-4 relative min-h-[200px]">
                    {loading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg transition-opacity duration-200">
                            <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
                        </div>
                    )}
                    {myTasks.length === 0 ? (
                         <div className="text-center py-12 text-gray-500">您还没有领取任何任务。快去“可接任务”看看吧！</div>
                    ) : (
                        <div className="space-y-3">
                            {myTasks.map(ut => (
                                <Card key={ut.id} className="hover:shadow-md transition-shadow border-l-4 border-l-rose-500">
                                    <div className="flex items-center p-4 w-full gap-4">
                                        {ut.tasks?.images?.[0] ? (
                                            <div className="relative h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                                                {ut.tasks.images[0].match(/\.(mp4|webm|ogg|mov)$/i) ? (
                                                    <video src={ut.tasks.images[0]} className="w-full h-full object-cover" muted />
                                                ) : (
                                                    <Image src={ut.tasks.images[0]} alt="thumb" fill className="object-cover" />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300">
                                                无图
                                            </div>
                                        )}

                                        <div className="flex-grow min-w-0">
                                            <div className="mb-1.5">
                                                <Badge className={`flex-shrink-0 ${
                                                    ut.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                    ut.status === 'dropped' ? 'bg-red-100 text-red-800' :
                                                    ut.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                                                    'bg-blue-100 text-blue-800'
                                                }`}>
                                                    {ut.status === 'in_progress' ? '进行中' : 
                                                     ut.status === 'dropped' ? '已放弃' : 
                                                     ut.status === 'closed' ? '任务关闭' : 
                                                     '已完成'}
                                                </Badge>
                                            </div>
                                            <h3 className="font-bold truncate text-sm sm:text-base mb-1">{ut.tasks?.title}</h3>
                                            <p className="text-xs text-gray-500 line-clamp-1">{ut.tasks?.content}</p>
                                        </div>

                                        <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-4">
                                            <div className="text-sm font-medium text-gray-700">奖励: {ut.tasks?.reward_amount}积分</div>
                                            <Link href={`/app/tasks/${ut.id}`} passHref>
                                                <Button size="sm" className="bg-rose-600 hover:bg-rose-700 h-8">
                                                    进入工作台
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
