'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { ImageViewer } from "@/components/ImageViewer";

interface FollowupCardProps {
    leadId: string;
    userId: string;
}

type LeadFollowup = Database['public']['Tables']['lead_followups']['Row'];

export default function FollowupCard({ leadId, userId }: FollowupCardProps) {
    const [client, setClient] = useState<SassClient | null>(null);
    const [record, setRecord] = useState<LeadFollowup | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isWechatAdded, setIsWechatAdded] = useState(false);
    const [isCalled, setIsCalled] = useState(false);
    const [mediaUrls, setMediaUrls] = useState<string[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    
    const { toast } = useToast();

    const loadData = useCallback(async (c: SassClient) => {
        setLoading(true);
        const { data } = await c.getSupabaseClient()
            .from('lead_followups')
            .select('*')
            .eq('lead_id', leadId)
            .maybeSingle(); // Assume one record per lead for simplicity
        
        if (data) {
            setRecord(data);
            setIsWechatAdded(data.is_wechat_added || false);
            setIsCalled(data.is_called || false);
            setMediaUrls(data.media_urls || []);
        }
        setLoading(false);
    }, [leadId]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            loadData(c);
        });
    }, [loadData]);

    const handleUpdateStatus = async (key: 'is_wechat_added' | 'is_called', value: boolean) => {
        if (!client) return;
        
        // Optimistic update
        if (key === 'is_wechat_added') setIsWechatAdded(value);
        if (key === 'is_called') setIsCalled(value);
        
        const payload = {
            lead_id: leadId,
            user_id: userId,
            is_wechat_added: key === 'is_wechat_added' ? value : isWechatAdded,
            is_called: key === 'is_called' ? value : isCalled,
            media_urls: mediaUrls
        };

        try {
            if (record?.id) {
                await client.getSupabaseClient().from('lead_followups').update(payload).eq('id', record.id);
            } else {
                const { data } = await client.getSupabaseClient().from('lead_followups').insert(payload).select().single();
                setRecord(data);
            }
            toast({ title: value ? "已标记" : "已取消标记" });
        } catch (e) {
            console.error(e);
            toast({ title: "更新失败", variant: "destructive" });
            // Revert
            if (key === 'is_wechat_added') setIsWechatAdded(!value);
            if (key === 'is_called') setIsCalled(!value);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!client || !e.target.files || e.target.files.length === 0) return;
        setUploading(true);
        
        const files = Array.from(e.target.files);
        const newUrls: string[] = [];

        try {
            for (const file of files) {
                const ext = file.name.split('.').pop();
                const filename = `followup_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                const { data, error } = await client.uploadFile(userId, "followups/" + filename, file);
                
                if (error) throw error;
                if (data) {
                    const { data: publicUrlData } = client.getSupabaseClient().storage.from('files').getPublicUrl(data.path);
                    newUrls.push(publicUrlData.publicUrl);
                }
            }

            const updatedUrls = [...mediaUrls, ...newUrls];
            setMediaUrls(updatedUrls);

            // Sync to DB
            const payload = {
                lead_id: leadId,
                user_id: userId,
                is_wechat_added: isWechatAdded,
                is_called: isCalled,
                media_urls: updatedUrls
            };

            if (record?.id) {
                await client.getSupabaseClient().from('lead_followups').update(payload).eq('id', record.id);
            } else {
                const { data } = await client.getSupabaseClient().from('lead_followups').insert(payload).select().single();
                setRecord(data);
            }
            toast({ title: "上传成功" });

        } catch (e) {
            console.error(e);
            toast({ title: "上传失败", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteMedia = async (urlToDelete: string) => {
        if (!client) return;
        const updatedUrls = mediaUrls.filter(u => u !== urlToDelete);
        setMediaUrls(updatedUrls);

        try {
            if (record?.id) {
                await client.getSupabaseClient().from('lead_followups').update({ media_urls: updatedUrls }).eq('id', record.id);
            }
        } catch (e) {
            console.error(e);
            toast({ title: "删除失败", variant: "destructive" });
        }
    };

    const isVideo = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase();
        return ['mp4', 'webm', 'ogg', 'mov'].includes(ext || '');
    };

    if (loading && !record) return <div className="p-4"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="pt-8 border-t-2 border-dashed border-gray-200 space-y-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                <div className="w-1 h-6 bg-blue-600 rounded-full mr-1"></div>
                对接信息
                <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">内部专用</span>
            </h3>

            {/* Switches */}
            <div className="space-y-3">
                <div className="flex items-center justify-between bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div className="space-y-0.5">
                        <Label className="text-base font-medium text-gray-900">已添加微信</Label>
                        <div className="text-xs text-gray-500">确认已成功添加客户微信</div>
                    </div>
                    <Switch checked={isWechatAdded} onCheckedChange={(c) => handleUpdateStatus('is_wechat_added', c)} />
                </div>

                <div className="flex items-center justify-between bg-green-50/50 p-4 rounded-xl border border-green-100">
                    <div className="space-y-0.5">
                        <Label className="text-base font-medium text-gray-900">已电话沟通</Label>
                        <div className="text-xs text-gray-500">确认已通过电话联系客户</div>
                    </div>
                    <Switch checked={isCalled} onCheckedChange={(c) => handleUpdateStatus('is_called', c)} />
                </div>
            </div>

            {/* Media Upload */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium text-gray-700">对接凭证 (图片/视频)</Label>
                    <label className="cursor-pointer text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm transition-colors hover:bg-gray-50">
                        <Upload className="h-3 w-3" /> 上传文件
                        <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                </div>

                <div className="flex flex-wrap gap-2">
                    {mediaUrls.map((url, idx) => (
                        <div key={idx} className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 group border border-gray-200 shadow-sm">
                            {isVideo(url) ? (
                                <video src={url} className="w-full h-full object-cover" controls />
                            ) : (
                                <Image 
                                    src={url} 
                                    alt="media" 
                                    fill 
                                    className="object-cover cursor-zoom-in" 
                                    onClick={() => setPreviewImage(url)} 
                                />
                            )}
                            {!isVideo(url) && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMedia(url);
                                }}
                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-sm z-10"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    {uploading && (
                        <div className="w-24 h-24 flex-shrink-0 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                            <Loader2 className="animate-spin text-gray-400 h-4 w-4" />
                        </div>
                    )}
                    {mediaUrls.length === 0 && !uploading && (
                        <div className="w-full text-center py-10 text-xs text-gray-400 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50 italic">
                            点击右上方“上传文件”添加对接截图或视频
                        </div>
                    )}
                </div>
            </div>
            <ImageViewer src={previewImage} open={!!previewImage} onOpenChange={() => setPreviewImage(null)} />
        </div>
    );
}
