'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, Plus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

export const runtime = 'edge';

type Lead = Database['public']['Tables']['leads']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type UserTask = Database['public']['Tables']['user_tasks']['Row'] & { 
    tasks: Task | null;
    leads: Lead[];
};

export default function MyLeadsPage() {
    const [client, setClient] = useState<SassClient | null>(null);
    const [userTasks, setUserTasks] = useState<UserTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
    
    // Pagination
    const [page, setPage] = useState(1);
    const pageSize = 10; // Reduced page size since rows are expandable
    const [totalCount, setTotalCount] = useState(0);

    const { toast } = useToast();

    const loadData = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            if (!user) return;

            let query = c.getSupabaseClient()
                .from('user_tasks')
                .select('*, tasks!inner(*), leads(*)', { count: 'exact' })
                .eq('user_id', user.id);

            if (searchTerm) {
                query = query.ilike('tasks.title', `%${searchTerm}%`);
            }

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            
            // Sort leads inside tasks by time desc
            const sortedData = ((data || []) as unknown as UserTask[]).map(ut => ({
                ...ut,
                leads: [...ut.leads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            }));

            setUserTasks(sortedData);
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Fetch error:', error);
            toast({ title: "加载失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, searchTerm, toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
        });
    }, []);

    useEffect(() => {
        if (client) {
            loadData(client);
        }
    }, [client, loadData]);

    const toggleExpand = (id: string) => {
        const newSet = new Set(expandedTasks);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedTasks(newSet);
    };

    const getStatusBadge = (status: string | null) => {
        switch (status) {
            case 'pending': return <Badge className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50">审核中</Badge>;
            case 'verified': return <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">已过审</Badge>;
            case 'claimed': return <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">对接中</Badge>;
            case 'done': return <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-50">结算中</Badge>;
            case 'completed': return <Badge className="bg-green-50 text-green-700 hover:bg-green-50">已结算</Badge>;
            case 'rejected': return <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200">已驳回</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    if (loading && !client) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-rose-600" /></div>;

    return (
        <div className="max-w-7xl mx-auto py-4 sm:py-8 px-1 sm:px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">我的客资</h1>
                    <p className="text-sm text-gray-500">按任务查看您的提交记录与收益。</p>
                </div>
                
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder="搜索任务标题..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
            </div>

            <Card className="border-none shadow-sm bg-transparent">
                <div className="space-y-4">
                    {userTasks.length === 0 && (
                        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed">
                            暂无参与的任务
                        </div>
                    )}
                    
                    {userTasks.map((ut) => {
                        const isExpanded = expandedTasks.has(ut.id);
                        const passedLeads = ut.leads.filter(l => ['verified', 'claimed', 'done', 'completed'].includes(l.status || ''));
                        return (
                            <div key={ut.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden transition-all hover:border-blue-300">
                                {/* Task Header Row */}
                                <div 
                                    className={`flex items-center justify-between p-3 sm:p-4 cursor-pointer ${isExpanded ? 'bg-gray-50' : 'bg-white'}`}
                                    onClick={() => toggleExpand(ut.id)}
                                >
                                    <div className="flex items-center gap-3 sm:gap-4 flex-1">
                                        <div className="bg-gray-100 p-1.5 sm:p-2 rounded-full">
                                            {isExpanded ? <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" /> : <ChevronRightIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-gray-900 text-base sm:text-lg">{ut.tasks?.title}</h3>
                                                <Badge variant="outline" className="text-[10px] sm:text-xs font-normal">
                                                    {ut.tasks?.platform}
                                                </Badge>
                                            </div>
                                            <div className="text-xs sm:text-sm text-gray-500 mt-0.5 flex gap-3 sm:gap-4">
                                                <span>提交: {ut.leads.length}</span>
                                                <span className="text-green-600 font-medium">通过: {passedLeads.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <Button size="sm" variant="outline" className="h-8 text-xs sm:text-sm" onClick={(e) => {
                                            e.stopPropagation();
                                            // Redirect to task detail to add more leads
                                            window.location.href = `/app/tasks/${ut.id}`; 
                                        }}>
                                            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" /> 继续提交
                                        </Button>
                                    </div>
                                </div>

                                {/* Expanded Leads Table */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 bg-white p-2 sm:p-4 animate-in slide-in-from-top-2 duration-200 overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead>联系方式 / 内容</TableHead>
                                                    <TableHead>审核状态</TableHead>
                                                    <TableHead>审核备注</TableHead>
                                                    <TableHead>提交时间</TableHead>
                                                    <TableHead className="text-right">操作</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ut.leads.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                                                            该任务暂无客资提交
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    ut.leads.map(lead => (
                                                        <TableRow key={lead.id} className="hover:bg-gray-50">
                                                            <TableCell className="font-mono font-medium text-sm">
                                                                {lead.contact_info}
                                                            </TableCell>
                                                            <TableCell>
                                                                {getStatusBadge(lead.status)}
                                                            </TableCell>
                                                            <TableCell className="text-sm text-red-500 max-w-[200px] truncate">
                                                                {lead.review_note || '-'} 
                                                            </TableCell>
                                                            <TableCell className="text-gray-400 text-xs">
                                                                {new Date(lead.created_at).toLocaleString()}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button size="sm" variant="ghost" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" asChild>
                                                                    <Link href={`/app/leads/${lead.id}`}>详情</Link>
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Pagination Controls */}
                {totalCount > pageSize && (
                    <div className="flex items-center justify-between pt-6">
                        <div className="text-sm text-gray-500">
                            显示 {(page - 1) * pageSize + 1} 到 {Math.min(page * pageSize, totalCount)} 个任务，共 {totalCount} 个
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
            </Card>
        </div>
    );
}
