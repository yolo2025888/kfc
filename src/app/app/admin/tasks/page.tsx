'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Loader2, Trash2, Image as ImageIcon, Eye, Search, Link as LinkIcon, Calendar as CalendarIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { cn, getErrorMessage } from "@/lib/utils"
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import NProgress from 'nprogress';

const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type AdminTask = Database['public']['Views']['admin_tasks_stats_view']['Row'];
type Platform = Database['public']['Tables']['platforms']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type NewTaskPayload = Omit<TaskInsert, 'task_no'> & Partial<Pick<TaskInsert, 'task_no'>>;

export default function AdminTasksPage() {
    const router = useRouter();
    const [client, setClient] = useState<SassClient | null>(null);
    const [tasks, setTasks] = useState<AdminTask[]>([]);
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [userId, setUserId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPlatform, setFilterPlatform] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all'); // New
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterClaimant, setFilterClaimant] = useState('');
    const [filterLinkStatus, setFilterLinkStatus] = useState('all');
    const [filterHasLeads, setFilterHasLeads] = useState(false);
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined); // New
    const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);

    // New Task Form State
    const [newTask, setNewTask] = useState<{
        title: string;
        content: string;
        remark: string;
        guest_description: string;
        platforms: string[];
        reward_amount: number;
        images: string[];
        category_ids: string[];
    }>({
        title: '',
        content: '',
        remark: `🌟非四川IP 需要定位 成都\n❤️要求发布之后❤️上传链接\n☀️有客资 一定要上传客资\n---------------------------------\n💎评论区 自己评论一条：\n\r谢谢耐心看完❤️嘉宾认真找！\n评论区很少看 感兴趣🉑直接斯沃 看皂片`,
        guest_description: '',
        platforms: [],
        reward_amount: 5,
        images: [],
        category_ids: []
    });
    const [uploading, setUploading] = useState(false);
    
    // UI state for category cascade selection
    const [activeParentId, setActiveParentId] = useState<string | null>(null);

    useEffect(() => {
        if (platforms.length > 0 && newTask.platforms.length === 0) {
            setNewTask(prev => ({ ...prev, platforms: [platforms[0].id] }));
        }
    }, [platforms, newTask.platforms.length]);

    // Group categories for display
    const parentCategories = categories.filter(c => !c.parent_id);
    const getChildCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId);

    // Initialize active parent
    useEffect(() => {
        const firstParent = categories.find(c => !c.parent_id);
        if (firstParent && !activeParentId) {
            setActiveParentId(firstParent.id);
        }
    }, [categories, activeParentId]);

    // Filter tasks based on search term and other filters
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = 
            (task.title ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (task.task_no ?? '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesPlatform = filterPlatform === 'all' || task.platform === filterPlatform;
        const matchesCategory = filterCategory === 'all' || task.category_id === filterCategory;
        const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
        
        const matchesClaimant = !filterClaimant || (task.participant_name?.toLowerCase() || '').includes(filterClaimant.toLowerCase());
        const matchesLinkStatus = filterLinkStatus === 'all' || 
            (filterLinkStatus === 'none' ? !task.link_status : task.link_status === filterLinkStatus);
        const matchesLeads = !filterHasLeads || (task.leads_count && task.leads_count > 0);
        
        // Date match (YYYY-MM-DD)
        const matchesDate = !filterDate || formatDate(task.created_at ?? '') === format(filterDate, "yyyy-MM-dd");

        return matchesSearch && matchesPlatform && matchesCategory && matchesStatus && matchesClaimant && matchesLinkStatus && matchesLeads && matchesDate;
    });

    const loadTasks = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data, error } = await c.getAdminTasksStats();
            if (error) throw error;
            setTasks(data || []);
        } catch (error) {
            console.error(error);
            const code = typeof error === 'object' && error && 'code' in error
                ? String((error as { code?: unknown }).code)
                : undefined;
            // Don't show toast on 406/empty, just show empty state
            if (code !== '406') {
                toast({ title: "鍔犺浇浠诲姟澶辫触", description: "鍙兘鏄潈闄愪笉瓒虫垨缃戠粶闂", variant: "destructive" });
            }
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            if (user) setUserId(user.id);
            
            loadTasks(c);
            // Load platforms
            c.getPlatforms().then(({ data }) => setPlatforms(data || []));
            // Load categories
            c.getCategories().then(({ data }) => setCategories(data || []));
        });
    }, [loadTasks]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!client || !e.target.files || e.target.files.length === 0 || !userId) return;
        
        setUploading(true);
        const files = Array.from(e.target.files);
        const newImageUrls: string[] = [];

        try {
            for (const file of files) {
                const filename = `${Date.now()}_${file.name}`;
                const { data, error } = await client.uploadFile(userId, "tasks/" + filename, file);
                
                if (error) throw error;
                if (data) {
                    const { data: publicUrlData } = client.getSupabaseClient().storage.from('files').getPublicUrl(data.path);
                    newImageUrls.push(publicUrlData.publicUrl);
                }
            }
            setNewTask(prev => ({ ...prev, images: [...prev.images, ...newImageUrls] }));
            toast({ title: "素材上传成功", description: `已添加 ${newImageUrls.length} 个新素材` });
        } catch (error) {
            console.error(error);
            toast({ title: "上传失败", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleCreateTask = async () => {
        if (!client) return;
        if (!newTask.title || !newTask.content) {
            toast({ title: "缺少字段", description: "标题和内容是必填项", variant: "destructive" });
            return;
        }
        if (newTask.platforms.length === 0) {
            toast({ title: "缺少平台", description: "请至少选择一个平台", variant: "destructive" });
            return;
        }

        try {
            const tasksToCreate: NewTaskPayload[] = [];
            
            // Generate combinations: each platform gets its own task, multiplied by categories
            for (const platformId of newTask.platforms) {
                // If no categories selected, create one task with null category
                const categories = newTask.category_ids.length > 0 ? newTask.category_ids : [null];
                
                for (const catId of categories) {
                    tasksToCreate.push({
                        title: newTask.title,
                        content: newTask.content,
                        remark: newTask.remark,
                        guest_description: newTask.guest_description,
                        platform: platformId,
                        reward_amount: newTask.reward_amount,
                        images: newTask.images,
                        status: 'open',
                        created_by: userId || null,
                        category_id: catId
                    });
                }
            }

            // Execute in parallel
            await Promise.all(tasksToCreate.map(task => client.createTask(task)));
            
            toast({ title: `成功发布 ${tasksToCreate.length} 个任务` });
            setIsCreateOpen(false);
            setNewTask({ 
                title: '', content: '', remark: '', guest_description: '', 
                platforms: platforms.length > 0 ? [platforms[0].id] : [], 
                reward_amount: 5, images: [], category_ids: [] 
            });
            loadTasks(client);
        } catch (error) {
            console.error("Create Task Error:", error);
            toast({ title: "发布任务失败", description: getErrorMessage(error, "请检查数据库迁移是否执行"), variant: "destructive" });
        }
    };

    const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
        if (!client) return;
        setProcessingTaskId(taskId);
        // If it's open OR ongoing, the action is to CLOSE it.
        // If it's closed, the action is to OPEN it.
        const isActive = currentStatus === 'open' || currentStatus === 'ongoing';
        const newStatus = isActive ? 'closed' : 'open';
        
        try {
            await client.updateTaskStatus(taskId, newStatus);
            toast({ title: `任务已${isActive ? '关闭' : '开启'}` });
            loadTasks(client);
        } catch {
            toast({ title: "操作失败", variant: "destructive" });
        } finally {
            setProcessingTaskId(null);
        }
    }

    const handleDeleteTask = async (taskId: string) => {
        if (!client) return;
        try {
            const { error } = await client.deleteTask(taskId);
            if (error) throw error;
            toast({ title: "任务已删除" });
            loadTasks(client);
        } catch (error) {
            console.error(error);
            toast({ title: "删除失败", description: getErrorMessage(error), variant: "destructive" });
        }
    }

    const [updatingLinkId, setUpdatingLinkId] = useState<string | null>(null);

    const handleUpdateLinkStatus = async (userTaskId: string, status: 'approved' | 'rejected' | 'pending') => {
        if (!client) return;
        setUpdatingLinkId(userTaskId);
        try {
            await client.reviewTaskLink(userTaskId, status);
            toast({ title: "状态已更新" });
            loadTasks(client);
        } catch (error) {
            console.error(error);
            toast({ title: "更新失败", description: getErrorMessage(error, "操作失败"), variant: "destructive" });
        } finally {
            setUpdatingLinkId(null);
        }
    };

    if (loading && !client) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">任务管理</h1>
                    <p className="text-gray-500">创建并管理分发任务</p>
                </div>
                
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-rose-600 hover:bg-rose-700 whitespace-nowrap">
                            <Plus className="mr-2 h-4 w-4" /> 发布新任务
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>发布新任务</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>发布平台 (多选)</Label>
                                    <div className="flex flex-wrap gap-4 pt-1">
                                        {platforms.map(p => (
                                            <div key={p.id} className="flex items-center space-x-2 border rounded px-3 py-2 bg-white">
                                                <Checkbox 
                                                    id={`platform-${p.id}`}
                                                    checked={newTask.platforms.includes(p.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setNewTask(prev => ({ ...prev, platforms: [...prev.platforms, p.id] }));
                                                        } else {
                                                            setNewTask(prev => ({ ...prev, platforms: prev.platforms.filter(id => id !== p.id) }));
                                                        }
                                                    }}
                                                />
                                                <label 
                                                    htmlFor={`platform-${p.id}`} 
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    {p.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>类目 (级联多选)</Label>
                                    <div className="flex border rounded-md h-60 overflow-hidden bg-white">
                                        {/* Left Column: Parent Categories */}
                                        <div className="w-1/3 border-r bg-gray-50 overflow-y-auto">
                                            {parentCategories.map(parent => {
                                                const children = getChildCategories(parent.id);
                                                // Check if any child is selected or the parent itself is selected
                                                const hasSelected = newTask.category_ids.includes(parent.id) || 
                                                    children.some(child => newTask.category_ids.includes(child.id));
                                                
                                                return (
                                                    <div 
                                                        key={parent.id}
                                                        onClick={() => setActiveParentId(parent.id)}
                                                        className={cn(
                                                            "px-4 py-3 text-sm cursor-pointer flex items-center justify-between hover:bg-gray-100 transition-colors",
                                                            activeParentId === parent.id ? "bg-white font-medium text-rose-600 border-l-4 border-l-rose-600" : "text-gray-600 border-l-4 border-l-transparent"
                                                        )}
                                                    >
                                                        <span className="truncate">{parent.name}</span>
                                                        {hasSelected && <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />}
                                                    </div>
                                                );
                                            })}
                                            {parentCategories.length === 0 && (
                                                <div className="p-4 text-xs text-gray-400 text-center">
                                                    暂无类目，请先去类目管理添加
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Column: Child Categories (Checkboxes) */}
                                        <div className="w-2/3 p-4 overflow-y-auto bg-white">
                                            {activeParentId ? (
                                                <div className="space-y-3">
                                                    <div className="text-xs text-gray-400 font-medium mb-2 px-1">
                                                        {categories.find(c => c.id === activeParentId)?.name} 下的分类
                                                    </div>
                                                    
                                                    {/* Option to select the parent category itself */}
                                                    <div className="flex items-center space-x-2 px-1 py-1 rounded hover:bg-gray-50">
                                                        <Checkbox 
                                                            id={`cat-${activeParentId}`}
                                                            checked={newTask.category_ids.includes(activeParentId)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setNewTask(prev => ({ ...prev, category_ids: [...prev.category_ids, activeParentId] }));
                                                                } else {
                                                                    setNewTask(prev => ({ ...prev, category_ids: prev.category_ids.filter(id => id !== activeParentId) }));
                                                                }
                                                            }}
                                                        />
                                                        <label htmlFor={`cat-${activeParentId}`} className="text-sm font-semibold cursor-pointer select-none text-gray-900">
                                                            全部 / 通用
                                                        </label>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        {getChildCategories(activeParentId).map(child => (
                                                            <div key={child.id} className="flex items-center space-x-2 px-1 py-1 rounded hover:bg-gray-50">
                                                                <Checkbox 
                                                                    id={`cat-${child.id}`}
                                                                    checked={newTask.category_ids.includes(child.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            setNewTask(prev => ({ ...prev, category_ids: [...prev.category_ids, child.id] }));
                                                                        } else {
                                                                            setNewTask(prev => ({ ...prev, category_ids: prev.category_ids.filter(id => id !== child.id) }));
                                                                        }
                                                                    }}
                                                                />
                                                                <label htmlFor={`cat-${child.id}`} className="text-sm text-gray-600 cursor-pointer select-none">
                                                                    {child.name}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    {getChildCategories(activeParentId).length === 0 && (
                                                        <div className="text-sm text-gray-400 py-4 text-center italic">
                                                            该类目下暂无二级分类
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                                                    请先选择左侧一级类目
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 w-1/3">
                                    <Label>奖励数量 (积分)</Label>
                                    <Input 
                                        type="number" 
                                        value={newTask.reward_amount} 
                                        onChange={(e) => setNewTask({...newTask, reward_amount: Number(e.target.value)})} 
                                        placeholder="5"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>任务标题</Label>
                                <Input 
                                    value={newTask.title} 
                                    onChange={(e) => setNewTask({...newTask, title: e.target.value})} 
                                    placeholder="例如：发朋友圈集赞（50字+3图）"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>任务文案</Label>
                                <Textarea 
                                    value={newTask.content} 
                                    onChange={(e) => setNewTask({...newTask, content: e.target.value})} 
                                    placeholder="请输入详细的任务文案..."
                                    className="h-32"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>任务要求</Label>
                                <Textarea 
                                    value={newTask.remark} 
                                    onChange={(e) => setNewTask({...newTask, remark: e.target.value})} 
                                    placeholder="请输入内部任务要求..."
                                    className="h-20"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>嘉宾描述</Label>
                                <Textarea 
                                    value={newTask.guest_description} 
                                    onChange={(e) => setNewTask({...newTask, guest_description: e.target.value})} 
                                    placeholder="请输入嘉宾描述信息..."
                                    className="h-24"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>任务素材 (图片/视频)</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {newTask.images.map((url, idx) => {
                                        const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i);
                                        return (
                                            <div key={idx} className="relative w-20 h-20 rounded-md overflow-hidden border bg-black">
                                                {isVideo ? (
                                                    <video src={url} className="w-full h-full object-cover" muted />
                                                ) : (
                                                    <Image src={url} alt="preview" fill className="object-cover" />
                                                )}
                                                <button 
                                                    onClick={() => setNewTask(prev => ({...prev, images: prev.images.filter((_, i) => i !== idx)}))}
                                                    className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl z-10"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                                {isVideo && <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1 rounded">Video</div>}
                                            </div>
                                        );
                                    })}
                                    <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed rounded-md cursor-pointer hover:bg-gray-50">
                                        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-gray-400" /> : <ImageIcon className="h-6 w-6 text-gray-400" />}
                                        <span className="text-xs text-gray-500 mt-1">上传</span>
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept="image/*,video/*" 
                                            className="hidden" 
                                            onChange={handleImageUpload} 
                                            disabled={uploading} 
                                        />
                                    </label>
                                </div>
                            </div>

                            <Button className="w-full bg-rose-600 hover:bg-rose-700" onClick={handleCreateTask} disabled={uploading}>
                                {uploading ? '上传素材中...' : '发布任务'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filter Bar */}
            <Card className="mb-6 bg-gray-50/50 border-gray-200 shadow-none">
                <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500">搜索</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="编号 / 标题" 
                                className="pl-9 w-40 h-9" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500">平台</Label>
                        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                            <SelectTrigger className="w-32 h-9 bg-white">
                                <SelectValue placeholder="全部" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部平台</SelectItem>
                                {platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500">类目</Label>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="w-32 h-9 bg-white">
                                <SelectValue placeholder="全部" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部类目</SelectItem>
                                {parentCategories.map(parent => {
                                    const children = getChildCategories(parent.id);
                                    if (children.length === 0) {
                                        return <SelectItem key={parent.id} value={parent.id}>{parent.name}</SelectItem>;
                                    }
                                    return (
                                        <React.Fragment key={parent.id}>
                                            <SelectItem value={parent.id} className="font-semibold text-gray-900 bg-gray-50">{parent.name}</SelectItem>
                                            {children.map(child => (
                                                <SelectItem key={child.id} value={child.id} className="pl-6">
                                                    {child.name}
                                                </SelectItem>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500">任务状态</Label>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-28 h-9 bg-white">
                                <SelectValue placeholder="全部" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部</SelectItem>
                                <SelectItem value="open">招募中</SelectItem>
                                <SelectItem value="ongoing">进行中</SelectItem>
                                <SelectItem value="closed">已关闭</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500">链接状态</Label>
                        <Select value={filterLinkStatus} onValueChange={setFilterLinkStatus}>
                            <SelectTrigger className="w-28 h-9 bg-white">
                                <SelectValue placeholder="全部" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部</SelectItem>
                                <SelectItem value="pending">待审核</SelectItem>
                                <SelectItem value="approved">已通过</SelectItem>
                                <SelectItem value="rejected">已驳回</SelectItem>
                                <SelectItem value="none">未提交</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500">认领人</Label>
                        <Input 
                            placeholder="姓名搜索..." 
                            className="w-32 h-9" 
                            value={filterClaimant}
                            onChange={(e) => setFilterClaimant(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center space-x-2 pb-2.5">
                        <Checkbox 
                            id="has-leads" 
                            checked={filterHasLeads}
                            onCheckedChange={(c) => setFilterHasLeads(!!c)}
                        />
                        <label htmlFor="has-leads" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-gray-700">
                            仅看有客资
                        </label>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500"></Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[150px] h-9 justify-start text-left font-normal bg-white",
                                        !filterDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {filterDate ? format(filterDate, "PPP", { locale: zhCN }) : <span>选择日期</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={filterDate}
                                    onSelect={setFilterDate}
                                    initialFocus
                                />
                                {filterDate && (
                                    <div className="p-3 border-t">
                                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setFilterDate(undefined)}>
                                            清除日期
                                        </Button>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                    </div>
                    
                    <div className="ml-auto pb-2 text-xs text-gray-400">
                        共 {filteredTasks.length} 条数据
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>任务列表</CardTitle>
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
                                <TableHead className="w-[120px]">领取时间</TableHead>
                                <TableHead className="w-[100px]">编号</TableHead>
                                <TableHead>任务标题</TableHead>
                                <TableHead>平台</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>认领人</TableHead>
                                <TableHead>帖子链接</TableHead>
                                <TableHead>审核状态</TableHead>
                                <TableHead>奖励</TableHead>
                                <TableHead>操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTasks.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                                        {tasks.length === 0 ? "暂无任务。点击上方按钮发布一个吧。" : "没有找到匹配的任务。"}
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredTasks.map((task) => (
                                <TableRow key={task.id}>
                                    <TableCell className="text-gray-500 text-sm whitespace-nowrap">
                                        {task.participant_claimed_at ? (
                                            format(new Date(task.participant_claimed_at), "MM-dd HH:mm")
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs font-medium text-gray-500">
                                        {task.task_no}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div>{task.title}</div>
                                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{task.content}</div>
                                    </TableCell>
                                    <TableCell>
                                        {(() => {
                                            const p = platforms.find(p => p.id === task.platform) || { name: task.platform, color: 'gray' };
                                            // Simple color mapping for standard badges
                                            let badgeClass = 'bg-gray-100 text-gray-700';
                                            if (p.color === 'red') badgeClass = 'bg-red-100 text-red-700';
                                            else if (p.color === 'blue') badgeClass = 'bg-blue-100 text-blue-700';
                                            else if (p.color === 'green') badgeClass = 'bg-green-100 text-green-700';
                                            else if (p.color === 'indigo') badgeClass = 'bg-indigo-100 text-indigo-700';
                                            else if (p.color === 'yellow') badgeClass = 'bg-yellow-100 text-yellow-700';
                                            else if (p.color === 'slate') badgeClass = 'bg-slate-900 text-white';
                                            else if (p.color === 'pink') badgeClass = 'bg-pink-100 text-pink-700';
                                            
                                            return <Badge variant="secondary" className={badgeClass}>{p.name}</Badge>;
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={
                                            task.status === 'open' ? 'bg-green-50 text-green-700 border-green-200' : 
                                            task.status === 'ongoing' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500'
                                        }>
                                            {task.status === 'open' ? '招募中' : task.status === 'ongoing' ? '进行中' : '已关闭'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {task.participant_user_id ? (
                                            <div 
                                                className="flex items-center gap-2 cursor-pointer group/user"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    NProgress.start();
                                                    router.push(`/app/admin/users/${task.participant_user_id}`);
                                                }}
                                            >
                                                <div className="h-6 w-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-300 relative group-hover/user:border-rose-400 transition-colors">
                                                    {task.participant_avatar ? (
                                                        <Image src={task.participant_avatar} alt="avatar" fill className="object-cover" />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-gray-500 bg-gray-100">
                                                            {(task.participant_name?.[0] || 'U').toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-sm text-gray-700 max-w-[100px] truncate group-hover/user:text-rose-600 transition-colors font-medium" title={task.participant_name ?? undefined}>
                                                    {task.participant_name || '未知用户'}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs italic">待认领</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-[120px]">
                                        {task.participant_proof_urls && task.participant_proof_urls.length > 0 ? (
                                            <a 
                                                href={task.participant_proof_urls[0]} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <LinkIcon className="h-3 w-3 flex-shrink-0" />
                                                <span className="truncate">查看帖子</span>
                                            </a>
                                        ) : (
                                            <span className="text-gray-300 text-xs italic">未提交</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {task.participant_user_id ? (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <div className="cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                                                        {updatingLinkId === task.participant_link_id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                        ) : (
                                                            <>
                                                                {task.link_status === 'pending' ? (
                                                                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200 h-5 px-1.5 w-fit animate-pulse text-[10px]">
                                                                        待审核
                                                                    </Badge>
                                                                ) : task.link_status === 'approved' ? (
                                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 h-5 px-1.5 w-fit text-[10px]">
                                                                        已通过
                                                                    </Badge>
                                                                ) : task.link_status === 'rejected' ? (
                                                                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 h-5 px-1.5 w-fit text-[10px]">
                                                                        已驳回
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-[10px] text-gray-400">待提交</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-32 p-1" align="start">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="text-xs font-medium text-gray-500 px-2 py-1">修改状态</div>
                                                        <Button variant="ghost" size="sm" className="justify-start h-8 text-green-600 w-full" onClick={() => task.participant_link_id && handleUpdateLinkStatus(task.participant_link_id, 'approved')}>
                                                            通过
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="justify-start h-8 text-red-600 w-full" onClick={() => task.participant_link_id && handleUpdateLinkStatus(task.participant_link_id, 'rejected')}>
                                                            驳回
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="justify-start h-8 w-full" onClick={() => task.participant_link_id && handleUpdateLinkStatus(task.participant_link_id, 'pending')}>
                                                            重置待审
                                                        </Button>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        ) : (
                                            <span className="text-gray-300 text-xs italic">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{task.reward_amount}积分</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                title="管理参与者"
                                                onClick={() => {
                                                    NProgress.start();
                                                    router.push(`/app/admin/tasks/${task.id}`);
                                                }}
                                            >
                                                <Eye className="h-4 w-4 text-gray-500" />
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="outline"
                                                onClick={() => task.id && toggleTaskStatus(task.id, task.status || 'open')}
                                                disabled={processingTaskId === task.id}
                                            >
                                                {processingTaskId === task.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    (task.status === 'open' || task.status === 'ongoing') ? '关闭' : '重新开启'
                                                )}
                                            </Button>
                                            
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button size="sm" variant="destructive" title="删除任务">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>确认删除该任务吗？</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-red-600 font-medium">
                                                            警告：此操作不可恢复！
                                                        </AlertDialogDescription>
                                                        <AlertDialogDescription>
                                                            删除任务将自动删除所有关联数据。
                                                        </AlertDialogDescription>
                                                        <div className="text-sm text-muted-foreground">
                                                            包括：
                                                            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
                                                                <li>该任务的所有用户接单记录</li>
                                                                <li>该任务下产生的所有客资数据 (Leads)</li>
                                                                <li>相关的审核记录、评论及跟进信息</li>
                                                            </ul>
                                                        </div>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>取消</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => task.id && handleDeleteTask(task.id)} className="bg-red-600 hover:bg-red-700">
                                                            确认删除
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
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
