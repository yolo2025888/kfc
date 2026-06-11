'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Copy, Download, UserCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { copyToClipboard, getErrorMessage } from '@/lib/utils';

type Avatar = Database['public']['Tables']['avatar_library']['Row'];
type ClaimAvatarResult = {
    success?: boolean;
    message?: string;
};

export const runtime = 'edge';

export default function AvatarDetailPage() {
    const params = useParams();
    const router = useRouter();
    const avatarId = params.id as string;
    
    const [client, setClient] = useState<SassClient | null>(null);
    const [avatar, setAvatar] = useState<Avatar | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const { toast } = useToast();

    const loadAvatar = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data, error } = await c.getSupabaseClient()
                .from('avatar_library')
                .select('*')
                .eq('id', avatarId)
                .single();
            
            if (error) throw error;
            setAvatar(data);
        } catch (error) {
            console.error(error);
            toast({ title: "加载详情失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [avatarId, toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            if (user) setUserId(user.id);
            loadAvatar(c);
        });
    }, [loadAvatar]);

    const handleClaim = async () => {
        if (!client || !avatar) return;
        setClaiming(true);
        try {
            const { data, error } = await client.claimAvatar(avatar.id);
            
            const result = data as ClaimAvatarResult | null;
            if (error || result?.success === false) {
                throw new Error(result?.message || error?.message || "领取失败");
            }

            toast({ title: "领取成功！", description: "此头像现在归您所有。" });
            loadAvatar(client); // Reload status
        } catch (error) {
            console.error(error);
            toast({ title: "领取失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setClaiming(false);
        }
    };

    const handleCopy = async (text: string, label: string) => {
        if (!text) return;
        const success = await copyToClipboard(text);
        if (success) {
            toast({ title: `${label}已复制` });
        } else {
            toast({ title: `${label}复制失败`, description: "请手动长按复制", variant: "destructive" });
        }
    };

    const handleDownload = async () => {
        if (!avatar) return;
        try {
            const response = await fetch(avatar.avatar_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${avatar.name}.jpg`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast({ title: "开始下载图片" });
        } catch {
            window.open(avatar.avatar_url, '_blank');
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-rose-600" /></div>;
    if (!avatar) return <div className="p-8 text-center">头像不存在</div>;

    const isClaimedByMe = userId && avatar.claimed_by === userId;
    const isClaimedByOthers = avatar.claimed_by && avatar.claimed_by !== userId;
    const isAvailable = !avatar.claimed_by;

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <Button variant="ghost" className="mb-6 pl-0 hover:pl-2 transition-all" onClick={() => router.push('/app/avatars')}> 
                <ArrowLeft className="mr-2 h-4 w-4" /> 返回资源池
            </Button>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Left: Image Preview */}
                <div className="space-y-4">
                    <Card className="overflow-hidden border-none shadow-xl bg-gray-50 aspect-square relative group">
                        <Image 
                            src={avatar.avatar_url} 
                            alt={avatar.name} 
                            fill 
                            className={`object-cover ${isClaimedByOthers ? 'grayscale opacity-75' : ''}`}
                        />
                        {isClaimedByMe && (
                            <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> 已领取
                            </div>
                        )}
                        {isClaimedByOthers && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <div className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5" /> 已被他人领取
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        {isAvailable && (
                            <Button className="w-full bg-rose-600 hover:bg-rose-700 h-12 text-lg shadow-lg shadow-rose-100" onClick={handleClaim} disabled={claiming}>
                                {claiming ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                                立即领取使用
                            </Button>
                        )}
                        
                        {isClaimedByMe ? (
                            <div className="grid grid-cols-2 gap-4">
                                <Button className="w-full" variant="outline" onClick={() => handleCopy(avatar.avatar_url, "图片链接")}>
                                    <Copy className="h-4 w-4 mr-2" /> 复制链接
                                </Button>
                                <Button className="w-full" variant="outline" onClick={handleDownload}>
                                    <Download className="h-4 w-4 mr-2" /> 下载原图
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                                {isAvailable ? "领取后即可解锁下载和复制功能" : "该资源已被占用，请查看其他头像"}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Info and Copy Tools */}
                <div className="space-y-6">
                    <div>
                        <Badge className="mb-2 bg-rose-100 text-rose-700 hover:bg-rose-100">官方推荐</Badge>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <UserCircle className="h-8 w-8 text-gray-400" />
                            {avatar.name}
                        </h1>
                    </div>

                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-sm font-medium text-gray-500">标题 / 昵称</CardTitle>
                                {isClaimedByMe && (
                                    <Button variant="ghost" size="sm" onClick={() => handleCopy(avatar.name, "标题")}>
                                        <Copy className="h-3 w-3 mr-1" /> 复制
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg font-semibold text-gray-800 select-all">{avatar.name}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-sm font-medium text-gray-500">人设简介 / 文案</CardTitle>
                                {isClaimedByMe && (
                                    <Button variant="ghost" size="sm" onClick={() => handleCopy(avatar.description || '', "文案")}>
                                        <Copy className="h-3 w-3 mr-1" /> 复制
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed select-all">
                                {avatar.description || "暂无详细说明。"}
                            </p>
                        </CardContent>
                    </Card>

                    {isClaimedByMe && (
                        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                            <p className="text-sm text-green-800">
                                <strong>已成功领取：</strong> 您现在拥有此头像的使用权，请尽快配置到您的账号中。
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
