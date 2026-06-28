'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Check, X, ExternalLink, Calendar, Hand, Undo2, CheckCircle2, Archive, Pencil, Trash2, Plus, PlayCircle, UserCheck } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { ImageViewer } from '@/components/ImageViewer';
import ImageCropper from '@/components/ImageCropper';
import ChatBox from '@/components/ChatBox';
import FollowupCard from '@/components/FollowupCard';
import { AssignLeadDialog } from '@/components/AssignLeadDialog';
import { Database } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils';

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
type LeadRow = Database['public']['Tables']['leads']['Row'];
type ReviewTask = Pick<
    Database['public']['Tables']['tasks']['Row'],
    'id' | 'title' | 'platform' | 'content' | 'guest_description' | 'task_no' | 'reward_amount'
>;
type ReviewLead = LeadRow & {
    user_tasks: {
        proof_urls: string[] | null;
        tasks: ReviewTask | null;
    } | null;
    profiles: { email: string | null; full_name: string | null } | null;
    auditor: { full_name: string | null } | null;
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

    return <span className="font-mono">{elapsed}</span>;
}

function ExpandableContent({ content }: { content: string }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = content.length > 100;

    return (
        <div>
            <p className={`text-sm text-gray-600 whitespace-pre-wrap leading-relaxed ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
                {content}
            </p>
            {isLong && (
                <button 
                    onClick={() => setExpanded(!expanded)}
                    className="text-xs text-blue-600 mt-1 hover:underline flex items-center gap-1"
                >
                    {expanded ? '收起' : '展开全文'}
                </button>
            )}
        </div>
    );
}

export default function ReviewDetailPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.id as string;
    
    const [client, setClient] = useState<SassClient | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string>('user');
    const [lead, setLead] = useState<ReviewLead | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [editingImage, setEditingImage] = useState<string | null>(null);
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const { toast } = useToast();

    // Reject Dialog
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Edit States
    const [isEditingLead, setIsEditingLead] = useState(false);
    const [editLeadForm, setEditLeadForm] = useState({ contact_info: '', social_id: '' });
    const [isEditingTask, setIsEditingTask] = useState(false);
    const [editTaskForm, setEditTaskForm] = useState({ guest_description: '' });
    const [isAssignOpen, setIsAssignOpen] = useState(false);

    const handleCropSave = async (croppedBlob: Blob) => {
        if (!client || !lead || !editingImage) return;
        
        try {
            toast({ title: "正在上传...", description: "裁剪后的图片正在保存" });
            const newUrl = await client.uploadProofImage(croppedBlob);
            
            const newImages = (lead.proof_images ?? []).map((img) => img === editingImage ? newUrl : img);
            await client.updateLeadProofImages(lead.id, newImages);
            
            toast({ title: "图片更新成功" });
            setLead({ ...lead, proof_images: newImages });
        } catch (error) {
            console.error(error);
            toast({ title: "更新失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setEditingImage(null);
        }
    };

    const handleAdminUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!client || !lead || !e.target.files || e.target.files.length === 0) return;
        
        setSubmitting(true);
        const files = Array.from(e.target.files);
        const newUrls: string[] = [];

        try {
            toast({ title: "正在上传...", description: `正在上传 ${files.length} 个新凭证` });
            
            for (const file of files) {
                const url = await client.uploadProofImage(file);
                newUrls.push(url);
            }

            const updatedImages = [...(lead.proof_images || []), ...newUrls];
            await client.updateLeadProofImages(lead.id, updatedImages);
            
            toast({ title: "上传成功", description: "凭证内容已更新" });
            setLead({ ...lead, proof_images: updatedImages });

        } catch (error) {
            console.error(error);
            toast({ title: "上传失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const loadLead = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            if (!user) return;

            // 1. Fetch Lead
            const { data, error } = await c.getSupabaseClient()
                .from('leads')
                .select('*, user_tasks(proof_urls, tasks(id, title, platform, content, guest_description, task_no, reward_amount)), profiles!user_id(email, full_name), auditor:profiles!auditor_id(full_name)')
                .eq('id', leadId)
                .single();
            
            if (error) throw error;
            setLead(data as unknown as ReviewLead);

            // 2. Mark as read (Upsert)
            await c.getSupabaseClient()
                .from('lead_reads')
                .upsert({ 
                    user_id: user.id, 
                    lead_id: leadId, 
                    last_read_at: new Date().toISOString() 
                });

        } catch (error) {
            console.error('Fetch lead error:', error);
            toast({ title: "加载失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [leadId, toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            c.getPlatforms().then(({ data }) => setPlatforms(data || [])); // Load platforms
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            if (user) {
                setUserId(user.id);
                const { data: profile } = await c.getSupabaseClient()
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                setUserRole(profile?.role || 'user');
            }
            loadLead(c);
        });
    }, [loadLead]);

    const handleApprove = async () => {
        if (!client || !lead || !userId) return;
        setSubmitting(true);
        try {
            await client.reviewLead(lead.id, 'verified', userId);
            toast({ title: "初审通过", description: "已移交至客资公海等待领取", className: "bg-green-600 text-white" });
            router.push('/app/admin/reviews'); 
        } catch {
            toast({ title: "操作失败", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!client || !lead || !userId) return;
        setSubmitting(true);
        try {
            if (lead.status === 'pending') {
                await client.reviewLead(lead.id, 'rejected', userId, rejectReason);
            } else {
                // For verified/claimed leads, use abolishLead RPC
                const { error } = await client.abolishLead(lead.id, rejectReason);
                if (error) throw error;
            }
            
            toast({ title: "已废除", description: "该客资已标记为废除状态" });
            router.push('/app/admin/reviews');
        } catch (error) {
            console.error(error);
            toast({ title: "操作失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSubmitting(false);
            setIsRejectOpen(false);
        }
    };

    const handleClaim = async () => {
        if (!client || !userId) return;
        setSubmitting(true);
        try {
            const { error } = await client.getSupabaseClient()
                .from('leads')
                .update({ status: 'claimed', auditor_id: userId })
                .eq('id', leadId);
            
            if (error) throw error;
            toast({ title: "领取成功", description: "已开始对接" });
            loadLead(client);
        } catch {
            toast({ title: "操作失败", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    // Auditor: Mark as Done (Pre-complete)
    const handlePreComplete = async () => {
        if (!client) return;
        setSubmitting(true);
        try {
            const { error } = await client.getSupabaseClient()
                .from('leads')
                .update({ status: 'done' })
                .eq('id', leadId);
            
            if (error) throw error;
            toast({ title: "已提交归档", description: "等待管理员确认归档" });
            loadLead(client);
        } catch {
            toast({ title: "操作失败", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    // Admin: Archive (Final Complete)
    const handleArchive = async () => {
        if (!client) return;
        setSubmitting(true);
        try {
            const { error } = await client.getSupabaseClient()
                .from('leads')
                .update({ status: 'completed' })
                .eq('id', leadId);
            
            if (error) throw error;
            toast({ title: "已确认归档", className: "bg-green-600 text-white" });
            router.push('/app/admin/reviews');
        } catch {
            toast({ title: "操作失败", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    const handleUnclaim = async () => {
        if (!client) return;
        setSubmitting(true);
        try {
            // Use RPC for atomic cleanup (status reset + comments delete + followups delete)
            const { error } = await client.unclaimLead(leadId);
            
            if (error) throw error;

            toast({ title: "已退回公海", description: "该客资已重置，对接信息与聊天记录已彻底清理。" });
            router.push('/app/admin/reviews');
        } catch (error) {
            console.error(error);
            toast({ title: "操作失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    const handleSaveLeadInfo = async () => {
        if (!client || !lead) return;
        setSubmitting(true);
        try {
            const { error } = await client.getSupabaseClient()
                .from('leads')
                .update({ 
                    contact_info: editLeadForm.contact_info,
                    social_id: editLeadForm.social_id || null 
                })
                .eq('id', lead.id);
            
            if (error) throw error;
            toast({ title: "客资信息已更新" });
            setLead({ ...lead, contact_info: editLeadForm.contact_info, social_id: editLeadForm.social_id });
            setIsEditingLead(false);
        } catch (error) {
            toast({ title: "更新失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    const handleSaveTaskInfo = async () => {
        if (!client || !lead || !lead.user_tasks?.tasks?.id) return;
        setSubmitting(true);
        try {
            const { error } = await client.getSupabaseClient()
                .from('tasks')
                .update({ guest_description: editTaskForm.guest_description })
                .eq('id', lead.user_tasks.tasks.id);
            
            if (error) throw error;
            toast({ title: "任务信息已更新" });
            const updatedTask = { ...lead.user_tasks.tasks, guest_description: editTaskForm.guest_description };
            const updatedUserTasks = { ...lead.user_tasks, tasks: updatedTask };
            setLead({ ...lead, user_tasks: updatedUserTasks });
            setIsEditingTask(false);
        } catch (error) {
            toast({ title: "更新失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <div className="flex h-[80vh] justify-center items-center"><Loader2 className="animate-spin h-10 w-10 text-rose-600" /></div>;
    if (!lead) return <div className="p-8 text-center">客资记录不存在</div>;

    const task = lead.user_tasks?.tasks;
    const isAdmin = userRole === 'admin' || userRole === 'super-admin';

    const renderActions = () => {
        if (lead.status === 'completed') {
            return (
                <div className="bg-green-50 p-6 text-center border-t border-green-100">
                    <div className="flex flex-col items-center gap-2 text-green-700">
                        <Archive className="h-8 w-8" />
                        <span className="font-bold text-lg">已完成归档</span>
                    </div>
                    {lead.auditor && <div className="text-xs text-green-600 mt-2">对接人: {lead.auditor.full_name}</div>}
                </div>
            );
        }

        if (lead.status === 'rejected') {
            return (
                <div className="bg-red-50 p-6 text-center border-t border-red-100">
                    <div className="flex flex-col items-center gap-2 text-red-700">
                        <X className="h-8 w-8" />
                        <span className="font-bold text-lg">已废除</span>
                    </div>
                    {lead.review_note && <div className="text-sm text-red-600 mt-2 bg-white/50 p-2 rounded">{lead.review_note}</div>}
                </div>
            );
        }

        if (lead.status === 'pending') {
            if (!isAdmin) return <div className="p-6 text-center text-gray-500 bg-gray-50 border-t">等待管理员审核</div>;
            return (
                <div className="p-6 border-t bg-gray-50/50 flex flex-col gap-3">
                    <div className="flex gap-3">
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-lg" onClick={handleApprove} disabled={submitting}>
                            {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : <><Check className="mr-2 h-5 w-5" /> 通过 (公海)</>}
                        </Button>
                        <Button className="flex-1 bg-blue-600 hover:bg-blue-700 h-12 text-lg" onClick={() => setIsAssignOpen(true)} disabled={submitting}>
                            {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : <><UserCheck className="mr-2 h-5 w-5" /> 通过并分配</>}
                        </Button>
                    </div>
                    <Button className="w-full h-12 text-lg" variant="outline" onClick={() => setIsRejectOpen(true)} disabled={submitting}>
                        <X className="mr-2 h-5 w-5" /> 废除
                    </Button>
                </div>
            );
        }

        if (lead.status === 'verified') {
            if (isAdmin) {
                return (
                    <div className="p-6 text-center bg-gray-50 border-t flex flex-col gap-3">
                        <div className="text-gray-500">已投放至公海，等待邀约员领取</div>
                        <div className="flex gap-3 w-full">
                            <Button 
                                className="flex-1 bg-blue-600 hover:bg-blue-700" 
                                onClick={() => setIsAssignOpen(true)}
                                disabled={submitting}
                            >
                                <UserCheck className="mr-2 h-4 w-4" /> 指定分配
                            </Button>
                            
                            <Button 
                                className="flex-1 text-red-600 border-red-200 hover:bg-red-50" 
                                variant="outline" 
                                onClick={() => setIsRejectOpen(true)}
                                disabled={submitting}
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> 废除
                            </Button>
                        </div>
                    </div>
                );
            }
            return (
                <div className="p-6 border-t bg-blue-50/30">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg" onClick={handleClaim} disabled={submitting}>
                        {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : <><Hand className="mr-2 h-5 w-5" /> 领取对接</>}
                    </Button>
                </div>
            );
        }

        if (lead.status === 'claimed') {
            return (
                <div className="p-6 border-t bg-gray-50/50 space-y-3">
                    <div className="flex items-center gap-2 mb-2 justify-center">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            当前对接人: {lead.auditor?.full_name || '未知'}
                        </Badge>
                    </div>
                    
                    <div className="flex gap-3">
                        {/* Admin Action: Complete */}
                        {isAdmin && (
                            <Button className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg shadow-sm" onClick={handlePreComplete} disabled={submitting}>
                                {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : <><CheckCircle2 className="mr-2 h-5 w-5" /> 完成对接</>}
                            </Button>
                        )}

                        {isAdmin && (
                            <Button className="w-full h-12 text-lg text-orange-700 border-orange-200 hover:bg-orange-50" variant="outline" onClick={handleUnclaim} disabled={submitting}>
                                {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : <><Undo2 className="mr-2 h-5 w-5" /> 退回公海</>}
                            </Button>
                        )}

                        {isAdmin && (
                            <Button 
                                className="flex-1 h-12 text-lg text-red-600 border-red-200 hover:bg-red-50" 
                                variant="outline" 
                                onClick={() => setIsRejectOpen(true)}
                                disabled={submitting}
                            >
                                <Trash2 className="mr-2 h-5 w-5" /> 废除
                            </Button>
                        )}
                    </div>
                </div>
            );
        }

        if (lead.status === 'done') {
            return (
                <div className="p-6 border-t bg-purple-50/50 space-y-3">
                    <div className="flex flex-col items-center gap-2 mb-4 text-purple-700">
                        <CheckCircle2 className="h-8 w-8" />
                        <span className="font-bold text-lg">待归档</span>
                        <span className="text-xs">对接员已完成，等待管理员确认</span>
                    </div>

                    {isAdmin ? (
                        <div className="flex gap-3">
                            <Button className="flex-1 bg-purple-600 hover:bg-purple-700 h-12 text-lg shadow-sm" onClick={handleArchive} disabled={submitting}>
                                {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : <><Archive className="mr-2 h-5 w-5" /> 确认归档</>}
                            </Button>
                            <Button className="flex-1 h-12 text-lg text-orange-700 border-orange-200 hover:bg-orange-50" variant="outline" onClick={handleUnclaim} disabled={submitting}>
                                {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : <><Undo2 className="mr-2 h-5 w-5" /> 退回公海</>}
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center text-sm text-purple-600">
                            请等待管理员进行最终归档确认。
                        </div>
                    )}
                </div>
            )
        }

        return null;
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-100 overflow-hidden">
            {/* Header */}
            <div className="h-14 bg-white border-b flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> 返回
                </Button>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className={
                        lead.status === 'pending' ? 'bg-orange-50 text-orange-700' :
                        lead.status === 'verified' ? 'bg-yellow-50 text-yellow-700' :
                        lead.status === 'claimed' ? 'bg-blue-50 text-blue-700' :
                        lead.status === 'done' ? 'bg-purple-50 text-purple-700' :
                        lead.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-gray-100'
                    }>
                        {lead.status === 'pending' ? '待审核' :
                         lead.status === 'verified' ? '待领取' :
                         lead.status === 'claimed' ? '对接中' :
                         lead.status === 'done' ? '待归档' :
                         lead.status === 'completed' ? '已归档' : '已废除'}
                    </Badge>
                </div>
            </div>

            {/* Workspace */}
            <div className="flex-grow flex overflow-hidden">
                {/* LEFT: Information Panel */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-6 space-y-6 border-r">
                    {/* 1. Time Status Bar (TOP) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center">
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            提交: {new Date(lead.created_at).toLocaleString()}
                        </div>
                        {lead.verified_at && (
                            <div className="text-xs text-blue-500 flex items-center gap-1 font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                过审: {new Date(lead.verified_at).toLocaleString()}
                            </div>
                        )}
                        {lead.verified_at && (
                            <div className="text-xs text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                <Hand className="h-3 w-3" />
                                等待时长: <LiveTimer startTime={lead.verified_at} endTime={lead.claimed_at} />
                            </div>
                        )}
                    </div>

                    {/* 2. Task Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge className="bg-gray-900 text-white">{task?.task_no}</Badge>
                                    <Badge variant="secondary" className={(() => {
                                        const pid = task?.platform;
                                        const p = platforms.find(p => p.id === pid) || { color: 'gray' };
                                        const baseClass = colorMap[p.color ?? 'gray'] || colorMap.gray;
                                        return baseClass;
                                    })()}>
                                        {(() => {
                                            const pid = task?.platform;
                                            const p = platforms.find(p => p.id === pid);
                                            return p ? p.name : (pid || '其他');
                                        })()}
                                    </Badge>
                                </div>
                                {isAdmin && <h2 className="text-2xl font-bold text-gray-900 leading-snug">{task?.title}</h2>}
                            </div>
                            {isAdmin && <div className="text-rose-600 font-bold text-xl">{task?.reward_amount}积分</div>}
                        </div>
                        
                        <div className="space-y-4">
                            {isAdmin && (
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    <h4 className="text-sm font-bold text-gray-700 mb-2">任务文案</h4>
                                    <ExpandableContent content={task?.content || ''} />
                                </div>
                            )}

                            {task?.guest_description && (
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-sm font-bold text-blue-800">嘉宾描述</h4>
                                        {isAdmin && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                    setEditTaskForm({ guest_description: task.guest_description || '' });
                                                    setIsEditingTask(true);
                                                }}
                                            >
                                                <Pencil className="h-3 w-3 text-blue-600" />
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-sm text-blue-700 whitespace-pre-wrap leading-relaxed">{task.guest_description}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. Submission Content (Consolidated Info & Proofs) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">提交内容</h3>
                        <div className="space-y-6">
                            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg relative group">
                                <div className="flex justify-between items-start">
                                    <label className="text-xs font-bold text-yellow-700 uppercase">联系方式 / 客资</label>
                                    {isAdmin && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                                setEditLeadForm({ 
                                                    contact_info: lead.contact_info, 
                                                    social_id: lead.social_id || '' 
                                                });
                                                setIsEditingLead(true);
                                            }}
                                        >
                                            <Pencil className="h-3 w-3 text-yellow-700" />
                                        </Button>
                                    )}
                                </div>
                                <div className="text-lg font-mono font-bold text-gray-900 mt-1 select-all break-all">{lead.contact_info}</div>
                            </div>

                            {lead.social_id && (
                                <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">客户社交账号 ID</label>
                                    <div className="text-lg font-mono font-bold text-gray-900 mt-1 select-all break-all">{lead.social_id}</div>
                                </div>
                            )}

                            {isAdmin && lead.user_tasks?.proof_urls && lead.user_tasks.proof_urls.length > 0 && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500 mb-2 block">帖子链接</label>
                                    <div className="space-y-2">
                                        {lead.user_tasks.proof_urls.map((url: string, i: number) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="bg-gray-50 p-2 rounded text-xs flex items-center gap-2 border text-blue-600 hover:underline">
                                                <ExternalLink className="h-3 w-3" /> {url}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Integrated Proof Images */}
                            <div className="space-y-3 pt-4 border-t">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">凭证图片</label>
                                {lead.proof_images && lead.proof_images.length > 0 ? (
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {(lead.proof_images ?? []).map((img, idx) => {
                                            const isVideo = img.match(/\.(mp4|webm|ogg|mov)$/i);
                                            return (
                                                <div key={idx} className="relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden aspect-square group">
                                                    {isVideo ? (
                                                        <div className="relative w-full h-full cursor-zoom-in" onClick={() => setPreviewImage(img)}>
                                                            <video 
                                                                src={img} 
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                                <PlayCircle className="h-10 w-10 text-white/80 drop-shadow-md" />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <Image 
                                                            src={img} 
                                                            alt="凭证" 
                                                            fill 
                                                            className="object-cover cursor-zoom-in" 
                                                            onClick={() => setPreviewImage(img)}
                                                        />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
                                                    
                                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                        {isAdmin && (
                                                            <Button 
                                                                size="icon" 
                                                                variant="secondary" 
                                                                className="h-8 w-8 bg-white/90 hover:bg-white shadow-sm" 
                                                                onClick={(e) => { e.stopPropagation(); setEditingImage(img); }}
                                                            >
                                                                <Pencil className="h-4 w-4 text-gray-700" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {/* Admin Add Proof Button */}
                                        {isAdmin && (
                                            <label className="relative flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer transition-colors aspect-square group">
                                                {submitting ? (
                                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                                ) : (
                                                    <>
                                                        <Plus className="h-6 w-6 text-gray-400 group-hover:text-rose-500 mb-1" />
                                                        <span className="text-xs text-gray-400 group-hover:text-rose-500 font-medium">添加凭证</span>
                                                    </>
                                                )}
                                                <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleAdminUploadProof} disabled={submitting} />
                                            </label>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-24 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed text-gray-400 text-sm">
                                        无图片凭证
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Operations */}
                <div className="flex-1 bg-white flex flex-col shadow-lg z-10 overflow-hidden border-l">
                    {/* Content Container (Scrollable parts) */}
                    <div className="flex-1 flex flex-col relative overflow-hidden min-h-0">
                        {/* Overlay for non-verified leads (only covers content, not buttons) */}
                        {['pending', 'verified'].includes(lead.status ?? '') && (
                            <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center">
                                <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-50 max-w-sm">
                                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 mx-auto">
                                        <Hand className="h-8 w-8 text-blue-500 animate-bounce" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                                        {lead.status === 'verified' ? '等待邀约员领取' : '等待审核通过'}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {lead.status === 'verified' 
                                            ? '该客资已进入公海，请等待邀约员领取后开启内部沟通与对接。' 
                                            : '客资审核通过并由邀约员领取后，即可在此进行内部协作与消息沟通。'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Top: Followup Info (Scrollable if too tall, max 40% height) */}
                        <div className="flex-shrink-0 bg-gray-50/30 p-4 border-b max-h-[40vh] overflow-y-auto custom-scrollbar">
                            {userId && <FollowupCard leadId={leadId} userId={userId} />}
                        </div>

                        {/* Middle: Chat (Fills remaining space) */}
                        <div className="flex-1 min-h-0 bg-white relative">
                            {userId && (
                                <div className="absolute inset-0">
                                    <ChatBox leadId={leadId} userId={userId} />
                                </div>
                            )}
                        </div>
                    </div>

                    {renderActions()}
                </div>
            </div>

            {/* Reject Dialog */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>废除原因</DialogTitle></DialogHeader>
                    <Textarea 
                        value={rejectReason} 
                        onChange={(e) => setRejectReason(e.target.value)} 
                        placeholder="请说明废除该客资的原因..." 
                        rows={4} 
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectOpen(false)}>取消</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={submitting}>
                            确认废除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Lead Dialog */}
            <Dialog open={isEditingLead} onOpenChange={setIsEditingLead}>
                <DialogContent>
                    <DialogHeader><DialogTitle>修改客资信息</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>联系方式 / 客资</Label>
                            <Input 
                                value={editLeadForm.contact_info} 
                                onChange={(e) => setEditLeadForm({...editLeadForm, contact_info: e.target.value})} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>社交账号 ID</Label>
                            <Input 
                                value={editLeadForm.social_id} 
                                onChange={(e) => setEditLeadForm({...editLeadForm, social_id: e.target.value})} 
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingLead(false)}>取消</Button>
                        <Button onClick={handleSaveLeadInfo} disabled={submitting}>保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Task Dialog */}
            <Dialog open={isEditingTask} onOpenChange={setIsEditingTask}>
                <DialogContent>
                    <DialogHeader><DialogTitle>修改嘉宾描述</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>嘉宾描述</Label>
                            <Textarea 
                                value={editTaskForm.guest_description} 
                                onChange={(e) => setEditTaskForm({...editTaskForm, guest_description: e.target.value})} 
                                rows={6}
                            />
                            <p className="text-xs text-red-500">注意：修改此描述将更新该任务下的所有客资展示。</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingTask(false)}>取消</Button>
                        <Button onClick={handleSaveTaskInfo} disabled={submitting}>保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ImageViewer src={previewImage} open={!!previewImage} onOpenChange={() => setPreviewImage(null)} />
            
            <ImageCropper 
                src={editingImage} 
                open={!!editingImage} 
                onOpenChange={(open) => !open && setEditingImage(null)} 
                onCropComplete={handleCropSave}
            />

            <AssignLeadDialog 
                open={isAssignOpen} 
                onOpenChange={setIsAssignOpen} 
                leadId={leadId} 
                client={client}
                onSuccess={() => loadLead(client!)} 
            />
        </div>
    );
}
