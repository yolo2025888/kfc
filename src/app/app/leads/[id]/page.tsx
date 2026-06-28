'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, User, Info, Upload, Trash2, Edit, PlayCircle, Plus } from 'lucide-react';

import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { ImageViewer } from '@/components/ImageViewer';
import { getErrorMessage } from '@/lib/utils';

type Lead = Database['public']['Tables']['leads']['Row'] & {
    user_tasks: { 
        tasks: { 
            title: string, 
            task_no: string, 
            platform: string,
            reward_amount: number | null
        } | null 
    } | null
};

export default function UserLeadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.id as string;
    
    const [client, setClient] = useState<SassClient | null>(null);
    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const { toast } = useToast();

    // Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [contactInfo, setContactInfo] = useState('');
    const [proofImages, setProofImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const loadLead = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            if (!user) return;

            const { data, error } = await c.getSupabaseClient()
                .from('leads')
                .select('*, user_tasks(tasks(*))')
                .eq('id', leadId)
                .eq('user_id', user.id) // Security: Ensure it's the owner
                .single();
            
            if (error) throw error;
            setLead(data as unknown as Lead);
        } catch (error) {
            console.error('Fetch error:', error);
            toast({ title: "加载失败", description: "客资记录不存在或无权访问", variant: "destructive" });
            router.push('/app/leads');
        } finally {
            setLoading(false);
        }
    }, [leadId, router, toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            loadLead(c);
        });
    }, [loadLead]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!client || !e.target.files || e.target.files.length === 0 || !lead) return;
        
        setUploading(true);
        const files = Array.from(e.target.files);
        const newImageUrls: string[] = [];

        try {
            for (const file of files) {
                const filename = `${Date.now()}_resubmit_${file.name}`;
                const { data, error } = await client.uploadFile(lead.user_id, "leads/" + filename, file);
                
                if (error) throw error;
                if (data) {
                    const { data: publicUrlData } = client.getSupabaseClient().storage.from('files').getPublicUrl(data.path);
                    newImageUrls.push(publicUrlData.publicUrl);
                }
            }
            setProofImages(prev => [...prev, ...newImageUrls]);
            toast({ title: "图片上传成功" });
        } catch (error) {
            console.error(error);
            toast({ title: "上传失败", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleResubmit = async () => {
        if (!client || !lead) return;
        if (proofImages.length === 0) {
            toast({ title: "请上传凭证截图", description: "至少需要一张截图", variant: "destructive" });
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await client.getSupabaseClient()
                .from('leads')
                .update({
                    contact_info: contactInfo,
                    proof_images: proofImages,
                    status: 'pending',
                    review_note: null,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', lead.id);

            if (error) throw error;

            toast({ title: "重新提交成功", description: "请等待管理员再次审核。" });
            setIsEditing(false);
            loadLead(client); 
        } catch (error) {
            console.error(error);
            toast({ title: "提交失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const openEdit = () => {
        if (!lead) return;
        setContactInfo(lead.contact_info);
        setProofImages(lead.proof_images || []);
        setIsEditing(true);
    };

    const getStatusBadge = (status: string | null) => {
        switch (status) {
            case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">审核中</Badge>;
            case 'verified': return <Badge className="bg-blue-100 text-blue-800">已过审</Badge>;
            case 'claimed': return <Badge className="bg-blue-100 text-blue-800">对接中</Badge>;
            case 'done': return <Badge className="bg-purple-100 text-purple-800">结算中</Badge>;
            case 'completed': return <Badge className="bg-green-100 text-green-800">已结算</Badge>;
            case 'rejected': return <Badge variant="destructive">已驳回</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    if (loading) return <div className="flex h-[80vh] justify-center items-center"><Loader2 className="animate-spin h-10 w-10 text-rose-600" /></div>;
    if (!lead) return null;

    const task = lead.user_tasks?.tasks;

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <Button variant="ghost" className="mb-6 pl-0 hover:pl-2 transition-all" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
            </Button>

            <div className="grid gap-6">
                {/* Header Info */}
                <Card>
                    <CardHeader className="flex flex-row items-start justify-between">
                        <div>
                            <CardTitle className="text-2xl font-bold">{task?.title || '未知任务'}</CardTitle>
                            <CardDescription className="mt-1 flex items-center gap-2">
                                <Badge variant="outline">{task?.task_no}</Badge>
                                <Badge variant="outline">{task?.platform}</Badge>
                            </CardDescription>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500 mb-1">预计收益</div>
                            <div className="text-2xl font-bold text-rose-600">{task?.reward_amount}积分</div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Status Card */}
                    <Card className="md:col-span-1">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Info className="h-4 w-4" /> 审核状态
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center py-4">
                                {getStatusBadge(lead.status)}
                                <div className="text-xs text-gray-400 mt-4 text-center">
                                    提交于 {new Date(lead.created_at).toLocaleString()}
                                </div>
                                {lead.status === 'rejected' && (
                                    <Button size="sm" variant="outline" className="mt-4 border-red-200 text-red-600 hover:bg-red-50" onClick={openEdit}>
                                        <Edit className="h-3 w-3 mr-2" /> 重新编辑提交
                                    </Button>
                                )}
                            </div>
                            {lead.status === 'rejected' && lead.review_note && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
                                    <span className="font-bold block mb-1">驳回原因：</span>
                                    {lead.review_note}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Content Card */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <User className="h-4 w-4" /> 提交信息
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold">联系方式 / 客资</label>
                                <div className="text-lg font-mono bg-gray-50 p-3 rounded mt-1 border">
                                    {lead.contact_info}
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold">提交凭证</label>
                                {lead.proof_images && lead.proof_images.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        {lead.proof_images.map((img, idx) => {
                                            const isVideo = img.match(/\.(mp4|webm|ogg|mov)$/i);
                                            return (
                                                <div key={idx} className="relative aspect-square rounded border overflow-hidden cursor-zoom-in group" onClick={() => setPreviewImage(img)}>
                                                    {isVideo ? (
                                                        <div className="relative w-full h-full">
                                                            <video src={img} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                                <PlayCircle className="h-8 w-8 text-white/80" />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <Image src={img} alt="proof" fill className="object-cover" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-400 mt-1 italic">未上传凭证</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <ImageViewer src={previewImage} open={!!previewImage} onOpenChange={() => setPreviewImage(null)} />

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>重新编辑提交</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>联系方式</Label>
                            <Input 
                                value={contactInfo} 
                                onChange={(e) => setContactInfo(e.target.value)} 
                                placeholder="修改联系方式..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>凭证截图/视频</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {proofImages.map((img, idx) => {
                                    const isVideo = img.match(/\.(mp4|webm|ogg|mov)$/i);
                                    return (
                                        <div key={idx} className="relative aspect-square rounded-md overflow-hidden border group">
                                            {isVideo ? (
                                                <video src={img} className="w-full h-full object-cover" />
                                            ) : (
                                                <Image src={img} alt="proof" fill className="object-cover" />
                                            )}
                                            <button 
                                                onClick={() => setProofImages(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-0 right-0 bg-red-500/80 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                            {isVideo && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/5">
                                                    <PlayCircle className="h-6 w-6 text-white/70" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                                    {uploading ? <Loader2 className="animate-spin text-gray-400" /> : <Plus className="text-gray-400" />}
                                    <span className="text-[10px] text-gray-400 mt-1">添加图片/视频</span>
                                    <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                                </label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>取消</Button>
                        <Button onClick={handleResubmit} disabled={uploading || submitting || proofImages.length === 0} className="bg-rose-600 hover:bg-rose-700">
                            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            重新提交
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
