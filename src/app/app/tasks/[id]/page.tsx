'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Trash2, Copy, Download, Link as LinkIcon, PlayCircle, Plus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { ImageViewer } from '@/components/ImageViewer';
import { copyToClipboard, getErrorMessage } from '@/lib/utils';


type UserTask = Database['public']['Tables']['user_tasks']['Row'] & { 
    tasks: Database['public']['Tables']['tasks']['Row'] | null 
    // Add explicitly if not in auto-generated types yet, though they should be after generation. 
    // For safety, we can rely on Database['public']['Tables']['user_tasks']['Row'] having them if types are updated.
    // If types.ts is not updated yet, we cast or extend.
    link_status?: string;
    link_reject_reason?: string;
};
type Lead = Database['public']['Tables']['leads']['Row'];
type Platform = Database['public']['Tables']['platforms']['Row'];

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

export const runtime = 'edge';

export default function TaskWorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const userTaskId = params.id as string;
    
    const [client, setClient] = useState<SassClient | null>(null);
    const [userTask, setUserTask] = useState<UserTask | null>(null);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const { toast } = useToast();

    // Form State for Leads
    const [contactInfo, setContactInfo] = useState('');
    const [socialId, setSocialId] = useState('');
    const [proofImages, setProofImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    // Form State for Proof URLs
    const [proofUrlsInput, setProofUrlsInput] = useState('');
    const [submittingProofUrls, setSubmittingProofUrls] = useState(false);

    const loadData = useCallback(async (c: SassClient, uid: string) => {
        setLoading(true);
        try {
            // Fetch User Task Details
            const { data: utData, error: utError } = await c.getUserTaskById(userTaskId);
            if (utError) throw utError;
            const userTaskData = utData as unknown as UserTask;
            setUserTask(userTaskData);
            // Set initial proof URLs for display
            if (userTaskData.proof_urls) {
                setProofUrlsInput(userTaskData.proof_urls.join('\n'));
            }

            // Verify ownership
            if (utData.user_id !== uid) {
                toast({ title: "无权访问", variant: "destructive" });
                router.push('/app/tasks');
                return;
            }

            // Fetch Leads
            const { data: leadsData, error: lError } = await c.getLeadsByUserTask(userTaskId);
            if (lError) throw lError;
            setLeads(leadsData || []);

        } catch (error) {
            console.error(error);
            toast({ title: "加载数据失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [router, toast, userTaskId]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            c.getPlatforms().then(({ data }) => setPlatforms(data || [])); // Load platforms
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            if (user) {
                setUserId(user.id);
                loadData(c, user.id);
            }
        });
    }, [loadData]);

    const handleCopy = async (text: string) => {
        const success = await copyToClipboard(text);
        if (success) {
            toast({ title: "复制成功" });
        } else {
            toast({ title: "复制失败", description: "请手动长按复制", variant: "destructive" });
        }
    };

    const handleDownloadMedia = async (url: string) => {
        try {
            toast({ title: "正在保存素材...", description: "请稍候" });
            const response = await fetch(url);
            const blob = await response.blob();
            
            // Determine file name and extension
            const urlExt = url.split('.').pop()?.split('?')[0]?.toLowerCase();
            const ext = urlExt || (blob.type.includes('video') ? 'mp4' : 'jpg');
            const filename = `task_material_${Date.now()}.${ext}`;
            const file = new File([blob], filename, { type: blob.type });

            // 1. Try Native Share
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: '保存素材',
                });
                toast({ title: "视频正在下载！请稍等！" });
                return;
            }

            // 2. Fallback to standard Blob Download
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
            toast({ title: "保存中...", description: "文件将存入您的设备" });
        } catch (e) {
            console.error(e);
            window.open(url, '_blank'); 
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!client || !e.target.files || e.target.files.length === 0 || !userId) return;
        
        setUploading(true);
        const files = Array.from(e.target.files);
        const newImageUrls: string[] = [];

        try {
            for (const file of files) {
                const filename = `${Date.now()}_lead_${file.name}`;
                const { data, error } = await client.uploadFile(userId, "leads/" + filename, file);
                
                if (error) throw error;
                if (data) {
                    const { data: publicUrlData } = client.getSupabaseClient().storage.from('files').getPublicUrl(data.path);
                    newImageUrls.push(publicUrlData.publicUrl);
                }
            }
            setProofImages(prev => [...prev, ...newImageUrls]);
            toast({ title: "上传成功", description: `已添加 ${newImageUrls.length} 个新凭证` });
        } catch (error) {
            console.error(error);
            toast({ title: "上传失败", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleSubmitLead = async () => {
        if (!client || !userTask) return;
        if (proofImages.length === 0) {
            toast({ title: "请上传凭证截图", description: "至少需要一张截图（如二维码或聊天记录）", variant: "destructive" });
            return;
        }

        try {
            const { error } = await client.submitLead({
                user_task_id: userTask.id,
                user_id: userId,
                contact_info: contactInfo || '未填写 (见截图)',
                social_id: socialId || null,
                proof_images: proofImages,
                status: 'pending'
            });

            if (error) throw error;

            toast({ title: "提交成功", description: "请等待管理员审核。" });
            setContactInfo('');
            setSocialId('');
            setProofImages([]);
            
            // Reload leads
            const { data } = await client.getLeadsByUserTask(userTaskId);
            if (data) setLeads(data);

        } catch (error) {
            console.error(error);
            toast({ title: "提交失败", description: getErrorMessage(error), variant: "destructive" });
        }
    };

    const handleSubmitProofUrls = async () => {
        if (!client || !userTask || !userId) return;
        
        // Extract all URLs starting with http or https
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = proofUrlsInput.match(urlRegex);
        const urls = matches ? Array.from(new Set(matches.map(url => url.trim()))) : [];
        
        if (urls.length === 0) {
            toast({ title: "未发现有效链接", description: "请确保输入包含正确的 http:// 或 https:// 链接", variant: "destructive" });
            return;
        }
        setSubmittingProofUrls(true);
        try {
            await client.updateUserTaskProofUrls(userTask.id, urls);
            toast({ title: "链接提取并提交成功", description: `已识别并记录 ${urls.length} 个有效链接。` });
            loadData(client, userId); 
        } catch (error) {
            console.error(error);
            toast({ title: "链接提交失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSubmittingProofUrls(false);
        }
    };


    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-rose-600" /></div>;
    if (!userTask) return <div className="p-8">任务不存在</div>;
    
    const isTaskClosed = userTask.status === 'closed' || userTask.status === 'dropped';

    return (
        <div className="max-w-4xl mx-auto py-4 sm:py-8 px-1 sm:px-4">
            <Button variant="ghost" className="mb-4 sm:mb-6 pl-0 hover:pl-2 transition-all text-sm" onClick={() => router.push('/app/tasks')}> 
                <ArrowLeft className="mr-2 h-4 w-4" /> 返回任务大厅
            </Button>
            
            {isTaskClosed && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-3 sm:p-4 mb-6 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-xs sm:text-sm text-amber-700">
                                当前任务已结束或关闭，无法继续提交新数据。
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Overview and Tools */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100 mb-6 sm:mb-8">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {userTask.tasks?.task_no}
                        </span>
                        <Badge variant="secondary" className={(() => {
                            const pid = userTask.tasks?.platform;
                            const p = platforms.find(p => p.id === pid) || { color: 'gray' };
                            const colorClass = colorMap[p.color ?? 'gray'] || colorMap.gray;
                            return `${colorClass} text-[10px] px-1.5 py-0`;
                        })()}>
                            {(() => {
                                const pid = userTask.tasks?.platform;
                                const p = platforms.find(p => p.id === pid);
                                return p ? p.name : (pid || '其他');
                            })()}
                        </Badge>
                    </div>
                    <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-xs">
                        奖励: {userTask.tasks?.reward_amount}积分/个
                    </Badge>
                </div>

                {userTask.tasks?.images && userTask.tasks.images.length > 0 && (
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            任务素材 <span className="text-xs text-gray-400 font-normal">(点击预览，或点击 ↓ 保存)</span>
                        </h4>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {userTask.tasks.images.map((img, i) => {
                                const isVideo = img.match(/\.(mp4|webm|ogg|mov)$/i);
                                return (
                                    <div key={i} className="relative h-32 w-32 sm:h-40 sm:w-40 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 cursor-zoom-in border border-gray-100 shadow-sm group">
                                        <Button 
                                            size="icon" 
                                            variant="secondary" 
                                            className="absolute top-1 right-1 h-7 w-7 bg-white/90 hover:bg-white shadow-md z-20 rounded-full opacity-80 hover:opacity-100 transition-opacity"
                                            onClick={(e) => { e.stopPropagation(); handleDownloadMedia(img); }}
                                            title="保存到本地"
                                        >
                                            <Download className="h-3.5 w-3.5 text-gray-800" />
                                        </Button>

                                        {isVideo ? (
                                            <div className="relative w-full h-full" onClick={() => setPreviewImage(img)}>
                                                <video src={img} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                    <PlayCircle className="h-10 w-10 text-white/80" />
                                                </div>
                                            </div>
                                        ) : (
                                            <Image 
                                                src={img} 
                                                alt="task example"
                                                fill 
                                                className="object-cover" 
                                                onClick={() => setPreviewImage(img)}
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center mb-4 border-t pt-4 sm:pt-6">
                    <h1 className="text-xl sm:text-3xl font-bold text-gray-900 line-clamp-2">{userTask.tasks?.title}</h1>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="h-7 text-[10px] sm:h-8 sm:text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 flex-shrink-0 ml-2"
                        onClick={() => handleCopy(userTask.tasks?.title || '')}
                    >
                        <Copy className="h-3 w-3 mr-1" /> 复制标题
                    </Button>
                </div>
                
                <div className="flex justify-end items-center mb-2">
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="h-7 text-[10px] sm:h-8 sm:text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                        onClick={() => handleCopy(userTask.tasks?.content || '')}
                    >
                        <Copy className="h-3 w-3 mr-1" /> 复制文案
                    </Button>
                </div>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg text-sm sm:text-base text-gray-700 whitespace-pre-wrap relative group mb-6 border border-gray-100">
                    {userTask.tasks?.content}
                </div>

                {userTask.tasks?.remark && (
                    <div className="bg-amber-50 p-3 sm:p-4 rounded-lg text-amber-900 whitespace-pre-wrap border border-amber-100 mb-6 relative">
                        <div className="text-[10px] sm:text-xs font-bold text-amber-700 mb-2 uppercase tracking-wide flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span> 
                            任务要求
                        </div>
                        <div className="text-sm sm:text-base">{userTask.tasks.remark}</div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {/* Left Column: Submission Forms */}
                <div className="space-y-6 sm:y-8">
                    {/* Submit Proof URLs */}
                    <Card className="h-fit border-l-4 border-l-transparent data-[status=rejected]:border-l-red-500 data-[status=approved]:border-l-green-500" data-status={userTask?.link_status}>
                        <CardHeader className="p-4 sm:p-6">
                            <div className="flex justify-between items-center mb-1">
                                <CardTitle className="text-lg sm:text-xl">提交帖子链接</CardTitle>
                                {userTask?.link_status === 'approved' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-1.5">已通过</Badge>}
                                {userTask?.link_status === 'rejected' && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1.5">已驳回</Badge>}
                                {userTask?.link_status === 'pending' && userTask.proof_urls && userTask.proof_urls.length > 0 && <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-[10px] px-1.5">审核中</Badge>}
                            </div>
                            <CardDescription className="text-xs sm:text-sm">发布完成后，请在此处提交您的帖子链接。</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                            {userTask?.link_status === 'rejected' && (
                                <div className="bg-red-50 p-2 sm:p-3 rounded-md text-[11px] sm:text-sm text-red-600 border border-red-100">
                                    <strong>驳回原因:</strong> {userTask.link_reject_reason || "链接无效或无法访问，请检查后重新提交"}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm">帖子链接</Label>
                                <Textarea
                                    placeholder="您从其他平台复制的链接"
                                    value={proofUrlsInput}
                                    onChange={(e) => setProofUrlsInput(e.target.value)}
                                    rows={4}
                                    className="text-xs sm:text-sm"
                                    disabled={userTask?.link_status === 'approved' || isTaskClosed}
                                />
                            </div>
                            
                            {userTask?.link_status !== 'approved' && (
                                <Button size="sm" className="w-full bg-rose-600 hover:bg-rose-700 h-9 sm:h-10 text-sm" onClick={handleSubmitProofUrls} disabled={submittingProofUrls || isTaskClosed}>
                                    {submittingProofUrls ? '提交中...' : userTask?.link_status === 'rejected' ? '重新提交' : '提交凭证链接'}
                                </Button>
                            )}
                        </CardContent>
                    </Card>


                    {/* Submit Leads Form */}
                    <Card className="h-fit">
                        <CardHeader className="p-4 sm:p-6">
                            <CardTitle className="text-lg sm:text-xl">提交新客资</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">填写获取的客户联系方式并上传截图凭证。</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm font-bold">客户联系方式 (选填): </Label>
                                <div className='text-[10px] sm:text-xs text-rose-600 italic'>tip: 客户微信号/手机号，若只有二维码可不填</div>
                                <Input 
                                    placeholder="例如:1838080xxx" 
                                    value={contactInfo}
                                    onChange={(e) => setContactInfo(e.target.value)}
                                    className="text-xs sm:text-sm h-9"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm font-bold">客户社交账号 ID (选填): </Label>
                                <Input 
                                    placeholder="小红书/抖音/微信 ID 等" 
                                    value={socialId}
                                    onChange={(e) => setSocialId(e.target.value)}
                                    className="text-xs sm:text-sm h-9"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm font-bold">凭证截图/视频 (必填): </Label>
                                <div className='text-[10px] sm:text-xs text-rose-600 italic'>tip: 包含主页、聊天记录或二维码截图</div>
                                <div className="grid grid-cols-3 gap-2">
                                    {proofImages.map((img, idx) => {
                                        const isVideo = img.match(/\.(mp4|webm|ogg|mov)$/i);
                                        return (
                                            <div key={idx} className="relative aspect-square rounded-md overflow-hidden border shadow-sm group">
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
                                                <button 
                                                    onClick={() => setProofImages(prev => prev.filter((_, i) => i !== idx))}
                                                    className="absolute top-0 right-0 bg-red-500/80 text-white p-1 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                                        {uploading ? <Loader2 className="animate-spin text-gray-400 h-4 w-4" /> : <Plus className="text-gray-400 h-4 w-4" />}
                                        <span className="text-[10px] text-gray-400 mt-1">添加截图/视频</span>
                                        <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                                    </label>
                                </div>
                            </div>

                            <Button size="sm" className="w-full bg-rose-600 hover:bg-rose-700 h-9 sm:h-10 text-sm" onClick={handleSubmitLead} disabled={uploading || isTaskClosed}>
                                {uploading ? '上传中...' : '提交审核'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: History Lists */}
                <div className="space-y-6 sm:space-y-8">
                    {/* Proof URLs History */}
                    <Card className="h-fit">
                        <CardHeader className="p-4 sm:p-6">
                            <CardTitle className="text-lg sm:text-xl">帖子链接提交记录</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">当前任务已提交的凭证链接</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                            {userTask && userTask.proof_urls && userTask.proof_urls.length > 0 ? (
                                <div className="space-y-2">
                                    {userTask.proof_urls.map((url, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm text-blue-600">
                                            <LinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                            <Link href={url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                                                {url}
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-400 py-4 text-xs sm:text-sm">暂无记录</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Leads History List */}
                    <Card className="h-fit">
                        <CardHeader className="p-4 sm:p-6">
                            <CardTitle className="text-lg sm:text-xl">客资提交记录</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">累计提交: {leads.length}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                            <div className="space-y-3 max-h-[400px] sm:max-h-[500px] overflow-y-auto pr-1 sm:pr-2">
                                {leads.length === 0 && (
                                    <div className="text-center text-gray-400 py-8 text-xs sm:text-sm">暂无提交客资记录。</div>
                                )}
                                {leads.map(lead => (
                                    <div key={lead.id} className="p-2 sm:p-3 rounded-lg border bg-white shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-xs sm:text-sm">{lead.contact_info}</span>
                                                {lead.social_id && (
                                                    <span className="text-[9px] sm:text-[10px] text-gray-400 font-mono">ID: {lead.social_id}</span>
                                                )}
                                            </div>
                                            <Badge className={(() => {
                                                const isPassed = ['verified', 'claimed', 'done', 'completed', 'approved'].includes(lead.status ?? '');
                                                return `${isPassed ? 'bg-green-100 text-green-700' : lead.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'} hover:bg-opacity-80 text-[10px] px-1.5 py-0`;
                                            })()}>
                                                {['verified', 'claimed', 'done', 'completed', 'approved'].includes(lead.status ?? '') ? '已通过' : lead.status === 'rejected' ? '已驳回' : '审核中'}
                                            </Badge>
                                        </div>
                                        {lead.proof_images && lead.proof_images.length > 0 ? (
                                            <div className="flex gap-1.5 mb-2">
                                                {lead.proof_images.map((img, i) => {
                                                    const isVideo = img.match(/\.(mp4|webm|ogg|mov)$/i);
                                                    return (
                                                        <div key={i} className="relative h-9 w-9 sm:h-10 sm:w-10 rounded bg-gray-100 overflow-hidden cursor-zoom-in border" onClick={() => setPreviewImage(img)}>
                                                            {isVideo ? (
                                                                <div className="relative w-full h-full">
                                                                    <video src={img} className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                                        <PlayCircle className="h-4 w-4 text-white/80" />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <Image src={img} alt="thumb" fill className="object-cover" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-red-500 mb-2 font-medium">无凭证素材</div>
                                        )}
                                        <div className="text-[9px] sm:text-xs text-gray-400 flex justify-between items-center">
                                            <span>{new Date(lead.created_at).toLocaleDateString()}</span>
                                            {lead.review_note && (
                                                <span className="text-red-500 ml-2 truncate max-w-[100px] font-medium" title={lead.review_note}>
                                                    {lead.review_note}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <ImageViewer src={previewImage} open={!!previewImage} onOpenChange={() => setPreviewImage(null)} />
        </div>
    );
}
