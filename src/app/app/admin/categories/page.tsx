'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trash2, Tag, ChevronRight, Layers } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

type Category = Database['public']['Tables']['categories']['Row'];

export default function CategoriesPage() {
    const [client, setClient] = useState<SassClient | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    const [newCategoryName, setNewCategoryName] = useState('');
    const [parentId, setParentId] = useState<string>('root');
    const [submitting, setSubmitting] = useState(false);

    const loadCategories = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data, error } = await c.getCategories();
            if (error) throw error;
            setCategories(data || []);
        } catch (error) {
            console.error(error);
            toast({ title: "加载类目失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            loadCategories(c);
        });
    }, [loadCategories]);

    const handleCreate = async () => {
        if (!client || !newCategoryName.trim()) return;
        setSubmitting(true);
        try {
            const finalParentId = parentId === 'root' ? undefined : parentId;
            const { error } = await client.createCategory(newCategoryName.trim(), finalParentId);
            if (error) throw error;
            
            toast({ title: "添加成功" });
            setIsDialogOpen(false);
            setNewCategoryName('');
            setParentId('root');
            loadCategories(client);
        } catch (error) {
            toast({ title: "添加失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        const hasChildren = categories.some(c => c.parent_id === id);
        if (hasChildren) {
            toast({ title: "无法删除", description: "该类目下有关联的子类目，请先删除子类目。", variant: "destructive" });
            return;
        }

        if (!client || !confirm('确定要删除这个类目吗？')) return;
        try {
            const { error } = await client.deleteCategory(id);
            if (error) throw error;
            toast({ title: "删除成功" });
            loadCategories(client);
        } catch (error) {
            toast({ title: "删除失败", description: getErrorMessage(error), variant: "destructive" });
        }
    };

    const parentCategories = categories.filter(c => !c.parent_id);
    
    // Sort categories to show parents followed by their children
    const sortedCategories = [...parentCategories].flatMap(parent => [
        parent,
        ...categories.filter(child => child.parent_id === parent.id)
    ]);

    if (loading && !client) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">类目设置</h1>
                    <p className="text-gray-500">管理任务的分类标签，支持二级分类</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-rose-600 hover:bg-rose-700">
                            <Plus className="mr-2 h-4 w-4" /> 新增类目
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>新增类目</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>父级类目</Label>
                                <Select value={parentId} onValueChange={setParentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择父级类目" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="root">无（作为一级类目）</SelectItem>
                                        {parentCategories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>类目名称</Label>
                                <Input 
                                    value={newCategoryName} 
                                    onChange={(e) => setNewCategoryName(e.target.value)} 
                                    placeholder="例如：图文任务、视频任务"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                            <Button className="bg-rose-600 hover:bg-rose-700" onClick={handleCreate} disabled={submitting || !newCategoryName.trim()}>
                                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '确认添加'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>现有类目</CardTitle>
                    <CardDescription>共 {categories.length} 个分类</CardDescription>
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
                                <TableHead>名称</TableHead>
                                <TableHead>层级</TableHead>
                                <TableHead>创建时间</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                        暂无类目。
                                    </TableCell>
                                </TableRow>
                            )}
                            {sortedCategories.map((cat) => {
                                const isSub = !!cat.parent_id;
                                return (
                                    <TableRow key={cat.id} className={isSub ? "bg-gray-50/50" : "font-medium"}>
                                        <TableCell className="flex items-center gap-2">
                                            {isSub ? (
                                                <>
                                                    <div className="w-6" />
                                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                                    <Tag className="h-3 w-3 text-rose-400" />
                                                    <span className="text-gray-600">{cat.name}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Layers className="h-4 w-4 text-rose-600" />
                                                    <span>{cat.name}</span>
                                                </>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${isSub ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {isSub ? '二级类目' : '一级类目'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-sm">
                                            {new Date(cat.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="ghost" onClick={() => handleDelete(cat.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
