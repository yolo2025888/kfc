'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Trash2, Image as ImageIcon, SquarePen, User, RotateCcw } from 'lucide-react';
import Image from 'next/image';
import NProgress from 'nprogress';
import { getErrorMessage } from '@/lib/utils';

type Avatar = Database['public']['Tables']['avatar_library']['Row'] & { profiles?: { email: string, full_name: string } | null };

export default function AdminAvatarsPage() {
    const [client, setClient] = useState<SassClient | null>(null);
    const [avatars, setAvatars] = useState<Avatar[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAvatar, setEditingAvatar] = useState<Avatar | null>(null);
    const [userId, setUserId] = useState<string>('');

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        avatar_url: ''
    });

    const [uploading, setUploading] = useState(false);

    const loadAvatars = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data, error } = await c.getAvatars();
            if (error) throw error;
            setAvatars((data || []) as Avatar[]);
        } catch (error) {
            console.error(error);
            toast({ title: "加载头像库失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            if (user) setUserId(user.id);
            loadAvatars(c);
        });
    }, [loadAvatars]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!client || !e.target.files || e.target.files.length === 0 || !userId) return;
        
        setUploading(true);
        const file = e.target.files[0];

        try {
            const filename = `avatar_${Date.now()}_${file.name}`;
            const { data, error } = await client.uploadFile(userId, "avatars/" + filename, file);
            
            if (error) throw error;
            if (data) {
                const { data: publicUrlData } = client.getSupabaseClient().storage.from('files').getPublicUrl(data.path);
                setFormData(prev => ({ ...prev, avatar_url: publicUrlData.publicUrl }));
                toast({ title: "头像上传成功" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "上传失败", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!client) return;
        if (!formData.name || !formData.avatar_url) {
            toast({ title: "缺少必填项", description: "名字和头像为必填", variant: "destructive" });
            return;
        }

        setLoading(true);
        NProgress.start();
        try {
            if (editingAvatar) {
                const { error } = await client.updateAvatar(editingAvatar.id, formData);
                if (error) throw error;
                toast({ title: "更新成功" });
            } else {
                const { error } = await client.createAvatar(formData);
                if (error) throw error;
                toast({ title: "添加成功" });
            }
            
            setIsDialogOpen(false);
            setEditingAvatar(null);
            setFormData({ name: '', description: '', avatar_url: '' });
            loadAvatars(client);
        } catch (error) {
            console.error(error);
            toast({ title: "操作失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setLoading(false);
            NProgress.done();
        }
    };

    const handleEditClick = (avatar: Avatar) => {
        setEditingAvatar(avatar);
        setFormData({
            name: avatar.name,
            description: avatar.description || '',
            avatar_url: avatar.avatar_url
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!client || !confirm('确定要删除这个头像账号吗？')) return;
        
        NProgress.start();
        try {
            const { error } = await client.deleteAvatar(id);
            if (error) throw error;
            toast({ title: "删除成功" });
            loadAvatars(client);
        } catch {
            toast({ title: "删除失败", variant: "destructive" });
        } finally {
            NProgress.done();
        }
    };

    const handleRelease = async (id: string) => {
        if (!client || !confirm('确定要释放这个头像吗？这将使其重新变为“未领取”状态。')) return;
        
        NProgress.start();
        try {
            const { error } = await client.releaseAvatar(id);
            if (error) throw error;
            toast({ title: "释放成功" });
            loadAvatars(client);
        } catch (error) {
            toast({ title: "操作失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            NProgress.done();
        }
    };

    if (loading && !client) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">账号头像库</h1>
                    <p className="text-gray-500">管理可供使用的账号头像、名字及简介</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        setEditingAvatar(null);
                        setFormData({ name: '', description: '', avatar_url: '' });
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-rose-600 hover:bg-rose-700">
                            <Plus className="mr-2 h-4 w-4" /> 添加账号
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingAvatar ? '编辑账号' : '添加新账号'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex justify-center mb-4">
                                <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                                    {formData.avatar_url ? (
                                        <Image src={formData.avatar_url} alt="avatar" fill className="object-cover" />
                                    ) : (
                                        <User className="h-12 w-12 text-gray-300" />
                                    )}
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                                        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <ImageIcon className="h-6 w-6 text-white" />}
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>账号名称</Label>
                                <Input 
                                    value={formData.name} 
                                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                                    placeholder="输入账号名称"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>简介 / 描述</Label>
                                <Textarea 
                                    value={formData.description} 
                                    onChange={(e) => setFormData({...formData, description: e.target.value})} 
                                    placeholder="输入账号简介（可选）"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                            <Button className="bg-rose-600 hover:bg-rose-700" onClick={handleSubmit} disabled={loading || uploading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingAvatar ? '保存更改' : '立即添加')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>已收录账号</CardTitle>
                    <CardDescription>共有 {avatars.length} 个账号头像</CardDescription>
                </CardHeader>
                <CardContent className="relative min-h-[200px]">
                    {loading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg transition-opacity duration-200">
                            <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
                        </div>
                    )}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">头像</TableHead>
                                <TableHead>名称</TableHead>
                                <TableHead>简介</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>领取人</TableHead>
                                <TableHead className="w-[150px]">创建时间</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {avatars.length === 0 && !loading && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                        头像库还是空的。点击上方按钮添加一个吧。
                                    </TableCell>
                                </TableRow>
                            )}
                            {avatars.map((avatar) => (
                                <TableRow key={avatar.id}>
                                    <TableCell>
                                        <div className="relative w-10 h-10 rounded-full overflow-hidden border bg-gray-50">
                                            <Image src={avatar.avatar_url} alt={avatar.name} fill className="object-cover" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{avatar.name}</TableCell>
                                    <TableCell>
                                        <span className="text-sm text-gray-600 line-clamp-1">
                                            {avatar.description || '-'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {avatar.claimed_by ? (
                                            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">已领取</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-gray-500">未领取</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {avatar.claimed_by ? (
                                            <div className="flex flex-col text-xs">
                                                <span className="font-medium text-gray-900">{avatar.profiles?.full_name || '未知用户'}</span>
                                                <span className="text-gray-500">{avatar.profiles?.email}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-gray-500 text-sm">
                                        {new Date(avatar.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {avatar.claimed_by && (
                                                <Button size="sm" variant="ghost" onClick={() => handleRelease(avatar.id)} title="释放头像" className="text-orange-500 hover:text-orange-600 hover:bg-orange-50">
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button size="sm" variant="ghost" onClick={() => handleEditClick(avatar)}>
                                                <SquarePen className="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleDelete(avatar.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
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
