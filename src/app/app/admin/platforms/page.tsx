'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Settings2, Pencil } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Database } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils';

export const runtime = 'edge';

type Platform = Database['public']['Tables']['platforms']['Row'];

const colorMap: Record<string, string> = {
    red: "bg-red-100 text-red-700 border-red-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    green: "bg-green-100 text-green-700 border-green-200",
    yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
    indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
    pink: "bg-pink-100 text-pink-700 border-pink-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    gray: "bg-gray-100 text-gray-700 border-gray-200"
};

export default function AdminPlatformsPage() {
    const [client, setClient] = useState<SassClient | null>(null);
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newPlatform, setNewPlatform] = useState({ id: '', name: '', color: 'gray' });
    const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
    const { toast } = useToast();

    const loadPlatforms = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data, error } = await c.getPlatforms();
            if (error) throw error;
            setPlatforms(data || []);
        } catch {
            toast({ title: "加载失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            loadPlatforms(c);
        });
    }, [loadPlatforms]);

    const handleSave = async () => {
        if (!client || !newPlatform.id || !newPlatform.name) return;
        try {
            if (editingPlatform) {
                const { error } = await client.updatePlatform(newPlatform.id, {
                    name: newPlatform.name,
                    color: newPlatform.color
                });
                if (error) throw error;
                toast({ title: "更新成功" });
            } else {
                const { error } = await client.createPlatform(newPlatform);
                if (error) throw error;
                toast({ title: "添加成功" });
            }
            setIsCreateOpen(false);
            setNewPlatform({ id: '', name: '', color: 'gray' });
            setEditingPlatform(null);
            loadPlatforms(client);
        } catch (error) {
            toast({ title: "操作失败", description: getErrorMessage(error), variant: "destructive" });
        }
    };

    const handleOpenEdit = (p: Platform) => {
        setEditingPlatform(p);
        setNewPlatform({ id: p.id, name: p.name, color: p.color ?? 'gray' });
        setIsCreateOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!client) return;
        if (!confirm('确认删除该平台吗？如果已有任务关联此平台，可能会导致显示异常。')) return;
        
        try {
            const { error } = await client.deletePlatform(id);
            if (error) throw error;
            toast({ title: "删除成功" });
            loadPlatforms(client);
        } catch (error) {
            toast({ title: "删除失败", description: getErrorMessage(error), variant: "destructive" });
        }
    };

    if (loading && !client) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Settings2 className="h-8 w-8" /> 平台配置
                    </h1>
                    <p className="text-gray-500 mt-2">管理任务分发的平台类型，配置后将在任务发布和用户权限设置中生效。</p>
                </div>
                
                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) {
                        setEditingPlatform(null);
                        setNewPlatform({ id: '', name: '', color: 'gray' });
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-rose-600 hover:bg-rose-700">
                            <Plus className="mr-2 h-4 w-4" /> 添加新平台
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingPlatform ? '编辑平台' : '添加新平台'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>平台 ID (英文标识)</Label>
                                <Input 
                                    placeholder="例如: kwai" 
                                    value={newPlatform.id} 
                                    onChange={(e) => setNewPlatform({...newPlatform, id: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '')})} 
                                    disabled={!!editingPlatform}
                                />
                                <p className="text-xs text-gray-500">{editingPlatform ? "ID 不可修改" : "唯一标识，建议使用全小写英文，不可重复。"}</p>
                            </div>
                            <div className="space-y-2">
                                <Label>显示名称</Label>
                                <Input 
                                    placeholder="例如: 快手" 
                                    value={newPlatform.name} 
                                    onChange={(e) => setNewPlatform({...newPlatform, name: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>标签颜色</Label>
                                <select 
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newPlatform.color}
                                    onChange={(e) => setNewPlatform({...newPlatform, color: e.target.value})}
                                >
                                    <option value="gray">灰色 (Gray)</option>
                                    <option value="red">红色 (Red)</option>
                                    <option value="blue">蓝色 (Blue)</option>
                                    <option value="green">绿色 (Green)</option>
                                    <option value="yellow">黄色 (Yellow)</option>
                                    <option value="indigo">紫色 (Indigo)</option>
                                    <option value="pink">粉色 (Pink)</option>
                                    <option value="slate">深灰 (Slate)</option>
                                </select>
                            </div>
                            <Button className="w-full bg-rose-600 hover:bg-rose-700" onClick={handleSave}>
                                {editingPlatform ? '保存修改' : '确认添加'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>现有平台列表</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>名称</TableHead>
                                <TableHead>颜色预览</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {platforms.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-mono text-gray-600">{p.id}</TableCell>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`${colorMap[p.color ?? 'gray'] || colorMap.gray}`}>
                                            {p.name}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right flex justify-end gap-2">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-blue-600 hover:bg-blue-50"
                                            onClick={() => handleOpenEdit(p)}
                                        >
                                            <Pencil className="h-4 w-4 mr-1" /> 编辑
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-red-500 hover:bg-red-50 hover:text-red-600"
                                            onClick={() => handleDelete(p.id)}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" /> 删除
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
