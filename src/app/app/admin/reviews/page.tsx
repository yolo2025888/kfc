'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, Calendar as CalendarIcon, Search, Hand, Undo2, CheckCircle2, ChevronLeft, ChevronRight, Archive, RotateCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Input } from '@/components/ui/input';
import { cn, displayUserAccount, getErrorMessage, getUserInitials } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import NProgress from 'nprogress';
import Image from 'next/image';
import { Database } from '@/lib/types';

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

type Platform = Database['public']['Tables']['platforms']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type LeadRow = Database['public']['Tables']['leads']['Row'];
type LatestMessage = Pick<Database['public']['Views']['lead_latest_message_view']['Row'], 'lead_id' | 'content' | 'created_at'>;
type ReviewLead = LeadRow & {
    user_tasks: {
        tasks: {
            id: string;
            title: string;
            platform: string;
            task_no: string;
            category_id: string | null;
        } | null;
    } | null;
    profiles: {
        id: string;
        email: string | null;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
    auditor: { full_name: string | null } | null;
    lead_followups: Array<{ is_wechat_added: boolean | null }> | null;
    unread_count?: number;
    latest_message?: LatestMessage | null;
};

function LiveTimer({ startTime, endTime }: { startTime: string | null, endTime?: string | null }) {
    const [elapsed, setElapsed] = useState<string>('');

    useEffect(() => {
        if (!startTime) {
            setElapsed('-');
            return;
        }

        const update = () => {
            const start = new Date(startTime).getTime();
            const end = endTime ? new Date(endTime).getTime() : Date.now();
            const diff = Math.max(0, Math.floor((end - start) / 1000));
            
            const days = Math.floor(diff / 86400);
            const hours = Math.floor((diff % 86400) / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;

            if (days > 0) setElapsed(`${days}天 ${hours}小时`);
            else if (hours > 0) setElapsed(`${hours}小时 ${minutes}分`);
            else setElapsed(`${minutes}分 ${seconds}秒`);
        };

        update();
        if (!endTime) {
            const interval = setInterval(update, 1000);
            return () => clearInterval(interval);
        }
    }, [startTime, endTime]);

    return <span className="font-mono text-xs">{elapsed}</span>;
}

function ReviewsListContent() {
    const [client, setClient] = useState<SassClient | null>(null);
    const [leads, setLeads] = useState<ReviewLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const router = useRouter();
    const searchParams = useSearchParams();
    // const filterPlatform = searchParams.get('platform'); // Replaced by local state

    const urlTab = searchParams.get('tab');

    const [activeTab, setActiveTab] = useState(urlTab || 'pool');
    const [userId, setUserId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [hasNewData, setHasNewData] = useState(false);
    const [platforms, setPlatforms] = useState<Platform[]>([]); 
    const [categories, setCategories] = useState<Category[]>([]);
    const [filterPlatform, setFilterPlatform] = useState<string>('all'); 
    const [filterCategory, setFilterCategory] = useState<string>('all'); 
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined); // New

    useEffect(() => {
        // ... (events registration unchanged)
        const handleNewSubmission = () => {
            if (activeTab === 'pending') setHasNewData(true);
        };
        const handleNewVerified = () => {
            if (activeTab === 'pool') setHasNewData(true);
        };

        window.addEventListener('new-lead-submitted', handleNewSubmission);
        window.addEventListener('new-lead-verified', handleNewVerified);
        
        return () => {
            window.removeEventListener('new-lead-submitted', handleNewSubmission);
            window.removeEventListener('new-lead-verified', handleNewVerified);
        };
    }, [activeTab]);

    // Sync tab to URL
    const handleTabChange = useCallback((newTab: string) => {
        setActiveTab(newTab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', newTab);
        router.replace(`?${params.toString()}`);
    }, [router, searchParams]);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);

    const { toast } = useToast();

    const [userVisiblePlatforms, setUserVisiblePlatforms] = useState<string[] | null>(null); // New
    const [userVisibleCategories, setUserVisibleCategories] = useState<string[] | null>(null); // New

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            // Load platforms & categories
            c.getPlatforms().then(({ data }) => setPlatforms(data || []));
            c.getCategories().then(({ data }) => setCategories(data || []));

            const { data: { user } } = await c.getSupabaseClient().auth.getUser();

            if (user) {
                setUserId(user.id);
                const { data: profile } = await c.getSupabaseClient()
                    .from('profiles')
                    .select('role, visible_platforms, visible_categories')
                    .eq('id', user.id)
                    .single();
                
                const userRole = profile?.role || 'user';
                setRole(userRole);
                
                // Store permissions
                setUserVisiblePlatforms(profile?.visible_platforms || null);
                setUserVisibleCategories(profile?.visible_categories || null);

                if (!urlTab) {
                    if (userRole === 'admin' || userRole === 'super-admin') {
                        handleTabChange('pending');
                    } else {
                        handleTabChange('pool');
                    }
                }
            }
        });
    }, [handleTabChange, urlTab]);

    // Reset page when tab or filters change
    useEffect(() => {
        setPage(1);
    }, [activeTab, filterPlatform, filterCategory, filterDate, searchTerm]);

    const loadLeads = useCallback(async (c: SassClient, tab: string, uid?: string, userRole?: string) => {
        setLoading(true);
        try {
            // 1. Primary Query
            let query = c.getSupabaseClient()
                .from('leads')
                .select('*, user_tasks!inner(tasks!inner(id, title, platform, task_no, category_id)), profiles!user_id(id, email, full_name, avatar_url), auditor:profiles!auditor_id(full_name), lead_followups(is_wechat_added)', { count: 'exact' });
            
            if (tab === 'pending') {
                query = query.eq('status', 'pending');
            } else if (tab === 'pool') {
                query = query.eq('status', 'verified');
            } else if (tab === 'claimed') {
                query = query.eq('status', 'claimed');
            } else if (tab === 'to_archive') {
                query = query.eq('status', 'done');
            } else if (tab === 'completed') {
                query = query.eq('status', 'completed');
            } else if (tab === 'rejected') {
                query = query.eq('status', 'rejected');
            }
            
            if (filterPlatform && filterPlatform !== 'all') {
                query = query.eq('user_tasks.tasks.platform', filterPlatform);
            }

            if (filterCategory && filterCategory !== 'all') {
                query = query.eq('user_tasks.tasks.category_id', filterCategory);
            }

            // Permission Filtering for Non-Admins (Auditors)
            if (userRole !== 'admin' && userRole !== 'super-admin') {
                // Platform Permissions
                if (userVisiblePlatforms !== null) {
                    if (userVisiblePlatforms.length === 0) {
                        // Block access if empty
                        query = query.in('user_tasks.tasks.platform', ['__no_access__']); 
                    } else {
                        query = query.in('user_tasks.tasks.platform', userVisiblePlatforms);
                    }
                }
                
                // Category Permissions
                if (userVisibleCategories !== null) {
                     if (userVisibleCategories.length === 0) {
                        // Block access if empty
                        query = query.in('user_tasks.tasks.category_id', ['00000000-0000-0000-0000-000000000000']);
                     } else {
                        query = query.in('user_tasks.tasks.category_id', userVisibleCategories);
                     }
                }
            }

            if (filterDate) {
                const start = new Date(filterDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(filterDate);
                end.setHours(23, 59, 59, 999);
                query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
            }

            if (searchTerm) {
                 query = query.ilike('contact_info', `%${searchTerm}%`);
            }

            // Ordering: Newest first for all tabs
            if (tab === 'completed') {
                 query = query.order('updated_at', { ascending: false });
            } else {
                 query = query.order('created_at', { ascending: false });
            }

            // Pagination
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data: leadsData, error: leadsError, count } = await query;
            if (leadsError) throw leadsError;

            // 2. Secondary Query: Fetch unread counts for these leads for the current user
            // Initialize with 0
            let enrichedLeads: ReviewLead[] = ((leadsData || []) as unknown as ReviewLead[]).map(l => ({ ...l, unread_count: 0 }));
            
            if (leadsData && leadsData.length > 0 && uid) {
                const leadIds = leadsData.map(l => l.id);
                const { data: unreadData, error: unreadError } = await c.getSupabaseClient()
                    .from('lead_unread_view')
                    .select('lead_id, unread_count')
                    .in('lead_id', leadIds)
                    .eq('user_id', uid);
                 
                if (!unreadError && unreadData) {
                    const unreadRows = unreadData as Array<{ lead_id: string | null; unread_count: number | null }>;
                    // Merge unread counts into leadsData
                    enrichedLeads = leadsData.map(lead => ({
                        ...lead,
                        unread_count: unreadRows.find(u => u.lead_id === lead.id)?.unread_count || 0
                    }));
                }
            }

            // 3. Fetch latest chat message for 'claimed' tab
            if (leadsData && leadsData.length > 0 && tab === 'claimed') {
                const leadIds = leadsData.map(l => l.id);
                const { data: messagesData, error: messagesError } = await c.getSupabaseClient()
                    .from('lead_latest_message_view')
                    .select('lead_id, content, created_at')
                    .in('lead_id', leadIds);

                if (!messagesError && messagesData) {
                    const messageRows = messagesData as LatestMessage[];
                    enrichedLeads = enrichedLeads.map(lead => ({
                        ...lead,
                        latest_message: messageRows.find(m => m.lead_id === lead.id) || null
                    }));
                }
            }
            
            setLeads(enrichedLeads);
            setTotalCount(count || 0);

        } catch (error) {
            console.error('Fetch leads error:', error);
            toast({ title: "加载失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [filterCategory, filterDate, filterPlatform, page, pageSize, searchTerm, toast, userVisibleCategories, userVisiblePlatforms]);

    // Load data when page/tab/search/filters changes
    useEffect(() => {
        if (client && userId && role) {
            loadLeads(client, activeTab, userId, role);
        }
    }, [activeTab, client, loadLeads, role, userId]); 

    const handleClaim = async (leadId: string) => {
        if (!client || !userId) return;
        setProcessingId(leadId);
        try {
            const { error } = await client.getSupabaseClient()
                .from('leads')
                .update({ 
                    status: 'claimed', 
                    auditor_id: userId,
                    claimed_at: new Date().toISOString()
                })
                .eq('id', leadId);
            
            if (error) throw error;
            toast({ title: "领取成功", description: "正在进入对接详情..." });
            router.push(`/app/admin/reviews/${leadId}`);
        } catch (error) {
            toast({ title: "领取失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    };

    const handleArchive = async (leadId: string) => {
        if (!client) return;
        setProcessingId(leadId);
        try {
            const { error } = await client.getSupabaseClient()
                .from('leads')
                .update({ status: 'completed' })
                .eq('id', leadId);
            
            if (error) throw error;
            toast({ title: "已确认归档", className: "bg-green-600 text-white" });
            loadLeads(client, activeTab, userId!, role!);
        } catch {
            toast({ title: "操作失败", variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    }

    const handleUnclaim = async (leadId: string) => {
        if (!client) return;
        setProcessingId(leadId);
        try {
            // Use RPC for atomic cleanup
            const { error } = await client.unclaimLead(leadId);
            
            if (error) throw error;

            toast({ title: "已退回公海", description: "该客资已重置，对接信息与聊天记录已彻底清理。" });
            loadLeads(client, activeTab, userId!, role!);
        } catch (error) {
            console.error(error);
            toast({ title: "操作失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    }

    const maskContactInfo = (info: string) => {
        if (!info) return '-';
        if (info.length <= 4) return info[0] + '***' + info[info.length - 1];
        const start = info.slice(0, 3);
        const end = info.slice(-4);
        return `${start}****${end}`;
    };

    const renderTable = (actions?: (lead: ReviewLead) => React.ReactNode, showAuditor: boolean = false) => (
        <div className="space-y-4 relative min-h-[400px]">
            {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-all duration-200 rounded-lg">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-rose-600" />
                        <p className="text-sm text-gray-500 font-medium">数据加载中...</p>
                    </div>
                </div>
            )}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>编号</TableHead>
                        {isAdmin && <TableHead>任务信息</TableHead>}
                        {isAdmin && <TableHead>提交人</TableHead>}
                        {showAuditor && <TableHead>对接人</TableHead>}
                        <TableHead>联系方式 / 客资</TableHead>
                        <TableHead>{activeTab === 'pending' ? '提交时间' : '处理时间'}</TableHead>
                        {activeTab !== 'pending' && activeTab !== 'rejected' && <TableHead>等待时长</TableHead>}
                        {isAdmin && activeTab !== 'pending' && activeTab !== 'rejected' && <TableHead>未读消息</TableHead>}
                        {isAdmin && activeTab !== 'pending' && activeTab !== 'rejected' && <TableHead>微信对接</TableHead>}
                        {activeTab === 'rejected' && <TableHead>废除原因</TableHead>}
                        {isAdmin && activeTab === 'claimed' && <TableHead>最近消息</TableHead>}
                        <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {leads.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={12} className="text-center py-20 text-gray-500">
                                {searchTerm ? "没有找到匹配的记录" : "暂无记录"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        leads.map((lead) => (
                            <TableRow key={lead.id} className="hover:bg-gray-50">
                                <TableCell>
                                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                        {lead.user_tasks?.tasks?.task_no}
                                    </span>
                                </TableCell>
                                {isAdmin && (
                                    <TableCell>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className={(() => {
                                                    const pid = lead.user_tasks?.tasks?.platform;
                                                    const p = platforms.find(p => p.id === pid) || { color: 'gray' };
                                                    const colorClass = colorMap[p.color ?? 'gray'] || colorMap.gray;
                                                    return `${colorClass} text-[10px] h-4 px-1`;
                                                })()}>
                                                    {(() => {
                                                        const pid = lead.user_tasks?.tasks?.platform;
                                                        const p = platforms.find(p => p.id === pid);
                                                        return p ? p.name : (pid || '其他');
                                                    })()}
                                                </Badge>
                                            </div>
                                            <div className="font-medium text-sm line-clamp-1">{lead.user_tasks?.tasks?.title}</div>
                                        </div>
                                    </TableCell>
                                )}
                                {isAdmin && (
                                    <TableCell>
                                        <div 
                                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors group"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/app/admin/users/${lead.profiles?.id || lead.user_id}`);
                                            }}
                                        >
                                            <div className="relative h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-xs font-bold overflow-hidden border border-rose-200">
                                                {lead.profiles?.avatar_url ? (
                                                    <Image src={lead.profiles.avatar_url} alt="avatar" fill unoptimized sizes="32px" className="object-cover" />
                                                ) : (
                                                    getUserInitials(lead.profiles?.email, lead.profiles?.full_name)
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900 group-hover:text-rose-600 transition-colors">
                                                    {lead.profiles?.full_name || '未命名用户'}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {displayUserAccount(lead.profiles?.email)}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                )}
                                {showAuditor && (
                                    <TableCell>
                                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                            {lead.auditor?.full_name || '未知邀约员'}
                                        </Badge>
                                    </TableCell>
                                )}
                                <TableCell className="font-mono text-sm">
                                    {isAdmin ? lead.contact_info : maskContactInfo(lead.contact_info)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <div className="flex items-center text-xs text-gray-500 gap-1 font-medium">
                                            <CalendarIcon className="h-3 w-3 text-gray-400" />
                                            {(() => {
                                                const d = new Date(lead.verified_at || lead.created_at);
                                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                            })()}
                                        </div>
                                        <div className="text-[10px] text-gray-400 ml-4">
                                            {new Date(lead.verified_at || lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </TableCell>
                                {activeTab !== 'pending' && activeTab !== 'rejected' && (
                                    <TableCell>
                                        {lead.verified_at ? (
                                            <div className="flex items-center gap-1 text-orange-600 bg-orange-50 w-fit px-2 py-1 rounded">
                                                <LiveTimer startTime={lead.verified_at} endTime={lead.claimed_at} />
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                )}
                                {isAdmin && activeTab !== 'pending' && activeTab !== 'rejected' && (
                                    <TableCell>
                                        {(lead.unread_count ?? 0) > 0 ? (
                                            <Badge className="bg-rose-500 text-white border-none h-5 px-1.5 min-w-[20px] justify-center flex animate-pulse">
                                                {lead.unread_count}
                                            </Badge>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </TableCell>
                                )}
                                {isAdmin && activeTab !== 'pending' && activeTab !== 'rejected' && (
                                    <TableCell>
                                        {(() => {
                                            const isWechatAdded = lead.lead_followups?.[0]?.is_wechat_added;
                                            return isWechatAdded ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                                    已加微信
                                                </Badge>
                                            ) : (
                                                <span className="text-gray-300">未标记</span>
                                            );
                                        })()}
                                    </TableCell>
                                )}
                                                                        {activeTab === 'rejected' && (
                                                                            <TableCell className="max-w-[250px]">
                                                                                <div className="text-sm text-red-600 font-medium line-clamp-2" title={lead.review_note ?? undefined}>
                                                                                    {lead.review_note || '无备注'}
                                                                                </div>
                                                                            </TableCell>
                                                                        )}
                                                                        {isAdmin && activeTab === 'claimed' && (
                                                                            <TableCell className="max-w-[200px]">
                                                                                {lead.latest_message ? (
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-sm text-gray-700 truncate block" title={lead.latest_message.content ?? undefined}>
                                                                                            {lead.latest_message.content}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-gray-400">
                                                                                            {lead.latest_message.created_at ? new Date(lead.latest_message.created_at).toLocaleString() : '-'}
                                                                                        </span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-gray-300 text-xs">-</span>
                                                                                )}
                                                                            </TableCell>
                                                                        )}
                                                                        <TableCell className="text-right">                                    {actions ? actions(lead) : (
                                        <Button 
                                            size="sm" 
                                            className="bg-rose-600 hover:bg-rose-700 h-8"
                                            onClick={() => {
                                                NProgress.start();
                                                router.push(`/app/admin/reviews/${lead.id}`);
                                            }}
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> 审核
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            {totalCount > pageSize && (
                <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-500">
                        显示 {(page - 1) * pageSize + 1} 到 {Math.min(page * pageSize, totalCount)} 条，共 {totalCount} 条
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" /> 上一页
                        </Button>
                        <span className="text-sm font-medium">
                            第 {page} 页 / 共 {Math.ceil(totalCount / pageSize)} 页
                        </span>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                            disabled={page >= Math.ceil(totalCount / pageSize)}
                        >
                            下一页 <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );

    if (loading && !client && !role) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-rose-600" /></div>;

    const isAdmin = role === 'admin' || role === 'super-admin';

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{isAdmin ? "审核与分发" : "待领取客资"}</h1>
                    <p className="text-gray-500">
                        {isAdmin ? "审核用户提交并投放至客资公海" : "从公海领取客资进行对接"}
                    </p>
                </div>
                
                <div className="flex flex-wrap gap-3 items-center w-full md:w-auto mt-4 md:mt-0">
                    {isAdmin && (
                        <>
                            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                                <SelectTrigger className="w-[130px] bg-white">
                                    <SelectValue placeholder="所有平台" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">所有平台</SelectItem>
                                    {platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="w-[130px] bg-white">
                                    <SelectValue placeholder="所有类目" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">所有类目</SelectItem>
                                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </>
                    )}

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[160px] justify-start text-left font-normal bg-white",
                                    !filterDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filterDate ? format(filterDate, "PPP", { locale: zhCN }) : <span>选择日期</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={filterDate}
                                onSelect={setFilterDate}
                                initialFocus
                            />
                            {filterDate && (
                                <div className="p-3 border-t">
                                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setFilterDate(undefined)}>
                                        清除日期
                                    </Button>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>

                    <div className="relative w-full md:w-60">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="搜索联系方式..." 
                            className="pl-10 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {hasNewData && (
                <div 
                    className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md flex justify-between items-center cursor-pointer hover:bg-blue-100 transition-colors shadow-sm"
                    onClick={() => {
                        loadLeads(client!, activeTab, userId!, role!);
                        setHasNewData(false);
                    }}
                >
                    <div className="flex items-center gap-2 font-medium">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        {activeTab === 'pool' ? '公海有新客资到达，点击刷新' : '收到新的提交，点击刷新列表'}
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 hover:bg-blue-200 text-blue-800">
                        刷新
                    </Button>
                </div>
            )}

            {isAdmin ? (
                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
                    <div className="flex justify-between items-center gap-4">
                        <TabsList className="grid w-full grid-cols-6 lg:w-[900px]">
                            <TabsTrigger value="pending">待初审</TabsTrigger>
                            <TabsTrigger value="pool">公海池</TabsTrigger>
                            <TabsTrigger value="claimed">对接中</TabsTrigger>
                            <TabsTrigger value="to_archive">待归档</TabsTrigger>
                            <TabsTrigger value="completed">已归档</TabsTrigger>
                            <TabsTrigger value="rejected">已废除</TabsTrigger>
                        </TabsList>
                        
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 px-3 gap-2 text-gray-600 hover:text-blue-600 border-gray-200"
                            onClick={() => loadLeads(client!, activeTab, userId!, role!)}
                            disabled={loading}
                        >
                            <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">刷新数据</span>
                        </Button>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>
                                    {activeTab === 'pending' && "待初审提交"}
                                    {activeTab === 'pool' && "已过审 - 等待领取"}
                                    {activeTab === 'claimed' && "进行中 - 正在对接"}
                                    {activeTab === 'to_archive' && "对接完成 - 等待确认归档"}
                                    {activeTab === 'completed' && "已完成 / 归档"}
                                    {activeTab === 'rejected' && "已废除客资"}
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <TabsContent value="pending" className="m-0">
                                {renderTable()}
                            </TabsContent>

                            <TabsContent value="pool" className="m-0">
                                {renderTable((lead) => (
                                    isAdmin ? (
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            className="h-8"
                                            onClick={() => router.push(`/app/admin/reviews/${lead.id}`)}
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> 详情
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="sm" 
                                            className="bg-blue-600 hover:bg-blue-700 h-8"
                                            disabled={processingId === lead.id}
                                            onClick={() => handleClaim(lead.id)}
                                        >
                                            {processingId === lead.id ? <Loader2 className="animate-spin h-4 w-4" /> : <><Hand className="h-4 w-4 mr-2" /> 领取</>}
                                        </Button>
                                    )
                                ))}
                            </TabsContent>

                            <TabsContent value="claimed" className="m-0">
                                {renderTable((lead) => (
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            className="h-8"
                                            onClick={() => router.push(`/app/admin/reviews/${lead.id}`)}
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> 详情
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="h-8 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                                            disabled={processingId === lead.id}
                                            onClick={() => handleUnclaim(lead.id)}
                                        >
                                            {processingId === lead.id ? <Loader2 className="animate-spin h-4 w-4" /> : <><Undo2 className="h-4 w-4 mr-2" /> 退回公海</>}
                                        </Button>
                                    </div>
                                ), true)}
                            </TabsContent>

                            <TabsContent value="to_archive" className="m-0">
                                {renderTable((lead) => (
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            className="h-8"
                                            onClick={() => router.push(`/app/admin/reviews/${lead.id}`)}
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> 详情
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            className="bg-purple-600 hover:bg-purple-700 h-8"
                                            disabled={processingId === lead.id}
                                            onClick={() => handleArchive(lead.id)}
                                        >
                                            {processingId === lead.id ? <Loader2 className="animate-spin h-4 w-4" /> : <><Archive className="h-4 w-4 mr-2" /> 归档</>}
                                        </Button>
                                    </div>
                                ), true)}
                            </TabsContent>

                            <TabsContent value="completed" className="m-0">
                                {renderTable((lead) => (
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            className="h-8"
                                            onClick={() => router.push(`/app/admin/reviews/${lead.id}`)}
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> 详情
                                        </Button>
                                        <Button size="sm" variant="ghost" disabled className="h-8">
                                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> 已完成
                                        </Button>
                                    </div>
                                ), true)}
                            </TabsContent>

                            <TabsContent value="rejected" className="m-0">
                                {renderTable((lead) => (
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            className="h-8"
                                            onClick={() => router.push(`/app/admin/reviews/${lead.id}`)}
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> 详情
                                        </Button>
                                        <Button size="sm" variant="ghost" disabled className="h-8 text-red-600">
                                            已废除
                                        </Button>
                                    </div>
                                ))}
                            </TabsContent>
                        </CardContent>
                    </Card>
                </Tabs>
            ) : (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>可领取客资</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {renderTable((lead) => (
                            <Button 
                                size="sm" 
                                className="bg-blue-600 hover:bg-blue-700 h-8"
                                disabled={processingId === lead.id}
                                onClick={() => handleClaim(lead.id)}
                            >
                                {processingId === lead.id ? <Loader2 className="animate-spin h-4 w-4" /> : <><Hand className="h-4 w-4 mr-2" /> 领取</>}
                            </Button>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default function AdminReviewsPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>}>
            <ReviewsListContent />
        </Suspense>
    );
}
