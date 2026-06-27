'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, ExternalLink, Check, X, User, Link as LinkIcon, Trash2, PlayCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import Link from 'next/link';
import { ImageViewer } from '@/components/ImageViewer';
import { Database } from '@/lib/types';
import { displayUserAccount, getErrorMessage, getUserInitials } from '@/lib/utils';

export const runtime = 'edge';

type Task = Database['public']['Tables']['tasks']['Row'];
type Lead = Database['public']['Tables']['leads']['Row'];
type Platform = Database['public']['Tables']['platforms']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Participant = Database['public']['Tables']['user_tasks']['Row'] & {
    profiles: Profile | null;
};

export default function AdminTaskDetailPage() {
    const params = useParams();
    const router = useRouter();
    const taskId = params.id as string;
    
    const [client, setClient] = useState<SassClient | null>(null);
    const [task, setTask] = useState<Task | null>(null);
    const [participant, setParticipant] = useState<Participant | null>(null);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const { toast } = useToast();

    // Reject Dialog
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadData = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            // 1. Fetch Task Details
            const { data: taskData, error: taskError } = await c.getSupabaseClient()
                .from('tasks')
                .select('*')
                .eq('id', taskId)
                .single();
            if (taskError) throw taskError;
            setTask(taskData);

            // 2. Fetch The Single Participant
            const { data: parts, error: partsError } = await c.getTaskParticipants(taskId);
            if (partsError) throw partsError;
            
            if (parts && parts.length > 0) {
                const p = parts[0];
                setParticipant(p as unknown as Participant);

                // 3. Fetch Leads for this participant
                const { data: leadsData } = await c.getSupabaseClient()
                    .from('leads')
                    .select('*')
                    .eq('user_task_id', p.id)
                    .order('created_at', { ascending: false });
                setLeads(leadsData || []);
            } else {
                setParticipant(null);
                setLeads([]);
            }

        } catch (error) {
            console.error(error);
            toast({ title: "加载失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [taskId, toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            c.getPlatforms().then(({ data }) => setPlatforms(data || [])); // Load platforms
            loadData(c);
        });
    }, [loadData]);

    const handleApproveLink = async () => {
        if (!client || !participant) return;
        setSubmitting(true);
        try {
            await client.reviewTaskLink(participant.id, 'approved');
            toast({ title: "已通过链接审核" });
            loadData(client);
        } catch (error) {
            toast({ title: "操作失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRejectLink = async () => {
        if (!client || !participant) return;
        setSubmitting(true);
        try {
            await client.reviewTaskLink(participant.id, 'rejected', rejectReason);
            toast({ title: "已驳回链接", description: "用户需要重新提交" });
            loadData(client);
            setIsRejectOpen(false);
            setRejectReason('');
        } catch (error) {
            toast({ title: "操作失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteTask = async () => {
        if (!client || !task) return;
        if (!confirm('确定要删除这个任务吗？此操作不可恢复。')) return;
        
        try {
            const { error } = await client.deleteTask(task.id);
            if (error) throw error;
            toast({ title: "任务已删除" });
            router.push('/app/admin/tasks');
        } catch (error) {
            toast({ title: "删除失败", description: getErrorMessage(error), variant: "destructive" });
        }
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-rose-600" /></div>;
    if (!task) return <div className="p-8">任务不存在</div>;

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="flex justify-between items-center mb-6">
                <Button variant="ghost" className="pl-0 hover:pl-2 transition-all" onClick={() => router.push('/app/admin/tasks')}> 
                    <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDeleteTask} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="mr-2 h-4 w-4" /> 删除任务
                </Button>
            </div>

            {/* --- Task Info Card --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                {/* Hero Image/Video */}
                <div className="relative h-48 md:h-64 w-full bg-gray-100 cursor-zoom-in group" onClick={() => task.images?.[0] && setPreviewImage(task.images[0])}>
                    {task.images && task.images.length > 0 ? (
                        (() => {
                            const firstMedia = task.images[0];
                            const isVideo = firstMedia.match(/\.(mp4|webm|ogg|mov)$/i);
                            return isVideo ? (
                                <div className="relative w-full h-full">
                                    <video src={firstMedia} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                        <PlayCircle className="h-16 w-16 text-white/80" />
                                    </div>
                                </div>
                            ) : (
                                <Image 
                                    src={firstMedia} 
                                    alt={task.title} 
                                    fill 
                                    className="object-cover hover:opacity-95 transition-opacity"
                                />
                            );
                        })()
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">暂无封面内容</div>
                    )}
                    <div className="absolute top-4 left-4 flex gap-2 items-center">
                        <span className="font-mono text-xs font-bold text-white bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                            {task.task_no}
                        </span>
                        <Badge className={(() => {
                            const p = platforms.find(p => p.id === task.platform) || { name: task.platform, color: 'gray' };
                            // Map 'bg-X-50' styles to 'text-X-600' or similar for this transparent hero usage
                            // Since colorMap gives "bg-X-50 text-X-600", we can extract the text color or just use a mapping
                            let textClass = 'text-black';
                            if (p.color === 'red') textClass = 'text-red-600';
                            else if (p.color === 'blue') textClass = 'text-blue-600';
                            else if (p.color === 'green') textClass = 'text-green-600';
                            else if (p.color === 'indigo') textClass = 'text-indigo-600';
                            else if (p.color === 'yellow') textClass = 'text-yellow-600';
                            else if (p.color === 'pink') textClass = 'text-pink-600';
                            else if (p.color === 'slate') textClass = 'text-slate-900';
                            
                            return `bg-white/90 ${textClass} hover:bg-white text-sm px-2 py-0.5`;
                        })()}>
                            {(() => {
                                const p = platforms.find(p => p.id === task.platform);
                                return p ? p.name : task.platform;
                            })()}
                        </Badge>
                        <Badge variant={task.status === 'open' ? 'default' : 'secondary'} className={
                            task.status === 'open' ? 'bg-green-600 text-white border-none text-sm px-2 py-0.5' : 'bg-gray-800 text-white border-none text-sm px-2 py-0.5'
                        }>
                            {task.status === 'open' ? '招募中' : task.status === 'ongoing' ? '进行中' : '已关闭'}
                        </Badge>
                    </div>
                </div>

                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h1 className="text-2xl font-bold text-gray-900 leading-tight">{task.title}</h1>
                        <div className="flex flex-col items-end">
                            <span className="text-xs text-gray-500 mb-1">任务奖励</span>
                            <span className="text-2xl font-bold text-rose-600">{task.reward_amount}积分</span>
                        </div>
                    </div>

                    <div className="prose max-w-none text-gray-700 text-sm mb-6">
                        <h3 className="font-semibold text-gray-900 mb-2">任务文案</h3>
                        <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap leading-relaxed border border-gray-100">
                            {task.content}
                        </div>
                    </div>
                    <div className="prose max-w-none text-gray-700 text-sm mb-6">
                        <h3 className="font-semibold text-gray-900 mb-2">任务要求</h3>
                        <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap leading-relaxed border border-gray-100">
                            {task.remark}
                        </div>
                    </div>

                    {task.guest_description && (
                        <div className="prose max-w-none text-gray-700 text-sm mb-6">
                            <h3 className="font-semibold text-gray-900 mb-2">嘉宾描述</h3>
                            <div className="bg-blue-50 p-4 rounded-lg whitespace-pre-wrap leading-relaxed border border-blue-100 text-blue-900">
                                {task.guest_description}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- Participant Section --- */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <User className="h-5 w-5 text-gray-500" />
                    认领与执行情况
                </h2>

                {!participant ? (
                    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
                        该任务暂无用户认领
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {/* 1. User Info Card */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="h-14 w-14 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                {participant.profiles?.avatar_url ? (
                                    <Image src={participant.profiles.avatar_url} alt="avatar" width={56} height={56} className="object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-sm font-bold text-gray-500">
                                        {getUserInitials(participant.profiles?.email, participant.profiles?.full_name)}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-gray-900">{participant.profiles?.full_name || '未知用户'}</h3>
                                    <Badge variant="outline">{participant.profiles?.role || 'user'}</Badge>
                                </div>
                                <div className="text-gray-500 text-sm">{displayUserAccount(participant.profiles?.email)}</div>
                                <div className="text-xs text-gray-400 mt-1">认领时间: {new Date(participant.created_at).toLocaleString()}</div>
                            </div>
                            <Link href={`/app/admin/users/${participant.user_id}`}>
                                <Button variant="outline" size="sm">查看用户档案</Button>
                            </Link>
                        </div>

                        {/* 2. Link Review Card */}
                        <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                            participant.link_status === 'pending' ? 'border-orange-200 ring-4 ring-orange-50' : 
                            participant.link_status === 'approved' ? 'border-green-200' : 'border-gray-200'
                        }`}>
                            <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <LinkIcon className="h-4 w-4" /> 帖子链接审核
                                </h3>
                                <div>
                                    {participant.link_status === 'approved' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100">已通过</Badge>}
                                    {participant.link_status === 'rejected' && <Badge className="bg-red-100 text-red-700 hover:bg-red-100">已驳回</Badge>}
                                    {participant.link_status === 'pending' && participant.proof_urls && participant.proof_urls.length > 0 && <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 animate-pulse">待审核</Badge>}
                                    {(!participant.proof_urls || participant.proof_urls.length === 0) && <Badge variant="outline">待提交</Badge>}
                                </div>
                            </div>
                            
                            <div className="p-6">
                                {participant.proof_urls && participant.proof_urls.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            {participant.proof_urls.map((url: string, i: number) => (
                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors group border border-transparent hover:border-blue-100">
                                                    <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                                                    <span className="text-sm text-gray-700 group-hover:text-blue-700 truncate underline decoration-dotted underline-offset-4">{url}</span>
                                                </a>
                                            ))}
                                        </div>

                                        {participant.link_status === 'rejected' && (
                                            <div className="bg-red-50 p-3 rounded text-sm text-red-600 border border-red-100">
                                                <strong>驳回原因:</strong> {participant.link_reject_reason}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        {participant.link_status !== 'approved' && (
                                            <div className="flex gap-3 pt-4 border-t mt-4">
                                                <Button 
                                                    className="flex-1 bg-green-600 hover:bg-green-700" 
                                                    onClick={handleApproveLink}
                                                    disabled={submitting}
                                                >
                                                    <Check className="mr-2 h-4 w-4" /> 通过链接
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                                    onClick={() => setIsRejectOpen(true)}
                                                    disabled={submitting}
                                                >
                                                    <X className="mr-2 h-4 w-4" /> 驳回链接
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400 py-8 text-sm italic">
                                        用户尚未提交任何链接。
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Leads List Card */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b bg-gray-50/50 flex flex-wrap justify-between items-center gap-3">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <User className="h-4 w-4" /> 提交的客资
                                </h3>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 whitespace-nowrap">
                                        总计 {leads.length}
                                    </Badge>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 whitespace-nowrap">
                                        通过 {leads.filter(l => ['verified', 'claimed', 'done', 'completed'].includes(l.status ?? '')).length}
                                    </Badge>
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 whitespace-nowrap">
                                        待审 {leads.filter(l => l.status === 'pending').length}
                                    </Badge>
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 whitespace-nowrap">
                                        驳回 {leads.filter(l => l.status === 'rejected').length}
                                    </Badge>
                                </div>
                            </div>
                            
                            <div className="p-6">
                                {leads.length === 0 ? (
                                    <div className="text-center text-gray-400 py-8 text-sm italic border border-dashed rounded-lg bg-gray-50">
                                        用户暂未提交任何客资。
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {leads.map((lead) => (
                                            <div 
                                                key={lead.id} 
                                                className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group"
                                                onClick={() => router.push(`/app/admin/reviews/${lead.id}`)}
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="font-medium text-gray-900 group-hover:text-rose-600 transition-colors flex items-center gap-2">
                                                        <span className="text-gray-500 text-sm">联系方式:</span>
                                                        <span className="font-mono text-base">{lead.contact_info}</span>
                                                    </div>
                                                    <Badge className={
                                                        ['verified', 'claimed', 'done', 'completed'].includes(lead.status ?? '') ? 'bg-green-100 text-green-700' :
                                                        lead.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }>
                                                        {['verified', 'claimed', 'done', 'completed'].includes(lead.status ?? '') ? '已通过' : 
                                                         lead.status === 'rejected' ? '已废除' : '审核中'}
                                                    </Badge>
                                                </div>
                                                
                                                {lead.proof_images && lead.proof_images.length > 0 ? (
                                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                                        {lead.proof_images.map((img: string, idx: number) => {
                                                            const isVideo = img.match(/\.(mp4|webm|ogg|mov)$/i);
                                                            return (
                                                                <div key={idx} className="relative h-16 w-16 rounded bg-gray-100 overflow-hidden block border cursor-zoom-in flex-shrink-0" onClick={(e) => { e.stopPropagation(); setPreviewImage(img); }}>
                                                                    {isVideo ? (
                                                                        <div className="relative w-full h-full">
                                                                            <video src={img} className="w-full h-full object-cover" />
                                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                                                <PlayCircle className="h-6 w-6 text-white/80" />
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <Image src={img} alt="proof" fill className="object-cover" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-red-400 italic">无凭证素材</div>
                                                )}
                                                
                                                <div className="text-xs text-gray-400 mt-2 flex justify-between items-center border-t pt-2 border-gray-50">
                                                    <span>提交于 {new Date(lead.created_at).toLocaleString()}</span>
                                                    {lead.review_note && <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded max-w-[200px] truncate">备注: {lead.review_note}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Reject Dialog */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>驳回链接</DialogTitle></DialogHeader>
                    <Textarea 
                        value={rejectReason} 
                        onChange={(e) => setRejectReason(e.target.value)} 
                        placeholder="请说明驳回原因（如：链接无法访问、帖子内容不符等）..." 
                        rows={4} 
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectOpen(false)}>取消</Button>
                        <Button variant="destructive" onClick={handleRejectLink} disabled={submitting}>
                            确认驳回
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ImageViewer src={previewImage} open={!!previewImage} onOpenChange={() => setPreviewImage(null)} />
        </div>
    );
}
