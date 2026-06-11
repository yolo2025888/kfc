'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Search, Eye } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/utils';

export const runtime = 'edge';

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

type Lead = Database['public']['Tables']['leads']['Row'] & { 
    user_tasks: { tasks: { title: string, platform: string, task_no: string } } | null,
    profiles: { email: string, full_name: string } | null
};

export default function ReviewHistoryPage() {
    const [client, setClient] = useState<SassClient | null>(null);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const router = useRouter();

    const loadHistory = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            if (!user) return;

            const { data, error } = await c.getSupabaseClient()
                .from('leads')
                .select('*, user_tasks(tasks(title, platform, task_no)), profiles!user_id(email, full_name)')
                .eq('auditor_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setLeads((data || []) as unknown as Lead[]);
        } catch (error) {
            const message = getErrorMessage(error, "未知错误");
            console.error('Fetch history error:', message);
            toast({ title: "加载历史记录失败", description: message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            loadHistory(c);
        });
    }, [loadHistory]);

    const filteredLeads = leads.filter(lead => 
        lead.contact_info.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.user_tasks?.tasks?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.user_tasks?.tasks?.task_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string | null) => {
        switch (status) {
            case 'claimed':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">对接中</Badge>;
            case 'done':
                return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">待归档</Badge>;
            case 'completed':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">已完成</Badge>;
            case 'rejected':
                return <Badge variant="destructive">已废除</Badge>;
            case 'approved': // Legacy
                return <Badge className="bg-green-100 text-green-700">已通过</Badge>;
            case 'verified':
                return <Badge className="bg-yellow-100 text-yellow-700">待领取</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    if (loading && !client) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">我的对接列表</h1>
                    <p className="text-gray-500">查看并管理您领取的客资。</p>
                </div>
                
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder="搜索编号、标题或联系方式..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>对接记录 ({leads.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>编号</TableHead>
                                <TableHead>客资/联系方式</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>过审时间</TableHead>
                                <TableHead>等待时长</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLeads.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        暂无符合条件的记录。
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredLeads.map((lead) => (
                                <TableRow key={lead.id} className="hover:bg-gray-50">
                                    <TableCell>
                                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                            {lead.user_tasks?.tasks?.task_no}
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                        {lead.contact_info}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(lead.status)}
                                        {lead.review_note && (
                                            <div className="text-[10px] text-gray-400 mt-1 max-w-[150px] truncate" title={lead.review_note}>
                                                注: {lead.review_note}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-400">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(lead.verified_at || lead.created_at).toLocaleDateString()}
                                        </div>
                                        <div className="text-[10px] text-gray-300">
                                            {new Date(lead.verified_at || lead.created_at).toLocaleTimeString()}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {lead.verified_at ? (
                                            <div className="flex items-center gap-1 text-gray-600 bg-gray-50 w-fit px-2 py-1 rounded border">
                                                <LiveTimer startTime={lead.verified_at} endTime={lead.claimed_at} />
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="h-8"
                                            onClick={() => router.push(`/app/admin/reviews/${lead.id}`)}
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> 详情
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
