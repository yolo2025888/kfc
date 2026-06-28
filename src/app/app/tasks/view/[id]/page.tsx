'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Loader2, ArrowLeft, CheckCircle, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { ImageViewer } from '@/components/ImageViewer';
import { displayUserAccount, getErrorMessage, getUserInitials } from '@/lib/utils';


type Task = Database['public']['Tables']['tasks']['Row'];
type UserTask = Database['public']['Tables']['user_tasks']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Platform = Database['public']['Tables']['platforms']['Row'];
type Lead = Database['public']['Tables']['leads']['Row'] & {
    proof_url?: string | null;
};
type Assignee = Profile & {
    user_task_id: string;
    proof_urls: string[] | null;
};

export default function TaskDetailPage() {
    const params = useParams();
    const router = useRouter();
    const taskId = params.id as string;
    
    const [client, setClient] = useState<SassClient | null>(null);
    const [task, setTask] = useState<Task | null>(null);
    const [myUserTask, setMyUserTask] = useState<UserTask | null>(null);
    const [assignee, setAssignee] = useState<Assignee | null>(null);
    const [taskLeads, setTaskLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [platforms, setPlatforms] = useState<Platform[]>([]); // New
    const { toast } = useToast();

    const loadData = useCallback(async (c: SassClient, uid: string, role?: string) => {
        setLoading(true);
        try {
            // 1. Get Task Detail
            const { data: taskData, error: tError } = await c.getTaskDetails(taskId);
            if (tError) throw tError;
            setTask(taskData);

            // 2. Check if user already joined this task (unless admin)
            const { data: utData } = await c.getSupabaseClient()
                .from('user_tasks')
                .select('*')
                .eq('task_id', taskId)
                .eq('user_id', uid)
                .maybeSingle();
            
            if (utData) setMyUserTask(utData);

            // 3. If Admin and task is ongoing, get assignee AND leads
            if ((role === 'admin' || role === 'super-admin') && taskData.status === 'ongoing') {
                const { data: utDetails } = await c.getSupabaseClient()
                    .from('user_tasks')
                    .select('id, profiles(*), proof_urls') // <-- Added proof_urls here
                    .eq('task_id', taskId)
                    .eq('status', 'in_progress')
                    .maybeSingle();
                
                if (utDetails?.profiles) {
                    setAssignee({
                        ...(utDetails.profiles as Profile),
                        user_task_id: utDetails.id,
                        proof_urls: utDetails.proof_urls
                    });
                }

                if (utDetails?.id) {
                    const { data: leadsData } = await c.getSupabaseClient()
                        .from('leads')
                        .select('*')
                        .eq('user_task_id', utDetails.id)
                        .order('created_at', { ascending: false });
                    setTaskLeads(leadsData || []);
                }
            }

        } catch (error) {
            console.error(error);
            toast({ title: "加载任务详情失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [taskId, toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            c.getPlatforms().then(({ data }) => setPlatforms(data || [])); // Load platforms
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            
            if (user) {
                setUserId(user.id);
                // Check Admin
                const authRole = user.app_metadata?.role;
                let role = authRole;
                if (authRole === 'admin' || authRole === 'super-admin') {
                    setIsAdmin(true);
                } else {
                    const { data: profile } = await c.getUserProfile(user.id);
                    const profileRole = profile?.role;
                    if (profileRole === 'admin' || profileRole === 'super-admin') {
                        setIsAdmin(true);
                        role = profileRole;
                    }
                }
                loadData(c, user.id, role);
            }
        });
    }, [loadData]);

    const handleJoinTask = async () => {
        if (!client || !userId || !task) return;
        try {
            const { error } = await client.joinTask(task.id, userId);
            if (error) throw error;
            
            toast({ title: "领取成功！", description: "正在跳转到工作台..." });
            // Reload to update state, or redirect to workspace directly
            // Redirecting to workspace is better flow
            // But we need the NEW user_task id.
            // joinTask returns { data: userTask } if we updated it correctly? 
            // My unified.ts joinTask update returns { data, error }. Let's re-fetch to be safe or check return.
            // The unified.ts logic returns the user_task object.
            
            // Re-fetch to be safe and simple
            const { data: utData } = await client.getSupabaseClient()
                .from('user_tasks')
                .select('*')
                .eq('task_id', task.id)
                .eq('user_id', userId)
                .single();
                
            if (utData) {
                router.push(`/app/tasks/${utData.id}`);
            } else {
                // Fallback
                loadData(client, userId);
            }

        } catch (error) {
            console.error(error);
            const message = getErrorMessage(error, "请稍后再试");
            toast({ title: "领取失败", description: message, variant: "destructive" });
            // If the error message indicates it was taken, redirect back to the hall
            if (message.includes('抢')) {
                setTimeout(() => router.push('/app/tasks'), 1500);
            }
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-rose-600" /></div>;
    if (!task) return <div className="p-8 text-center text-gray-500">任务不存在或已被删除</div>;

    return (
        <div className="max-w-4xl mx-auto py-4 sm:py-8 px-1 sm:px-4">
            <Button variant="ghost" className="mb-4 sm:mb-6 pl-0 hover:pl-2 transition-all text-sm" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> 返回
            </Button>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Hero Image */}
                <div className="relative h-48 md:h-80 w-full bg-gray-100" onClick={() => !task.images?.[0]?.match(/\.(mp4|webm|ogg|mov)$/i) && task.images?.[0] && setPreviewImage(task.images[0])}>
                    {task.images && task.images.length > 0 ? (
                        task.images[0].match(/\.(mp4|webm|ogg|mov)$/i) ? (
                            <video 
                                src={task.images[0]} 
                                controls 
                                className="w-full h-full object-contain bg-black" 
                            />
                        ) : (
                            <Image 
                                src={task.images[0]} 
                                alt={task.title} 
                                fill 
                                className="object-cover hover:opacity-95 transition-opacity cursor-zoom-in"
                            />
                        )
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">暂无封面图片</div>
                    )}
                    <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex gap-2 sm:gap-3 items-center flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-bold text-white bg-black/50 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded backdrop-blur-sm">
                            {task.task_no}
                        </span>
                        <Badge className={(() => {
                            const pid = task.platform;
                            const p = platforms.find(p => p.id === pid) || { color: 'gray' };
                            // Map 'bg-X-50' styles to 'text-X-600' or similar for this transparent hero usage
                            // Since colorMap gives "bg-X-50 text-X-600", we can extract the text color or just use a mapping
                            let textClass = 'text-gray-700';
                            if (p.color === 'red') textClass = 'text-red-600';
                            else if (p.color === 'blue') textClass = 'text-blue-600';
                            else if (p.color === 'green') textClass = 'text-green-600';
                            else if (p.color === 'indigo') textClass = 'text-indigo-600';
                            else if (p.color === 'yellow') textClass = 'text-yellow-600';
                            else if (p.color === 'pink') textClass = 'text-pink-600';
                            else if (p.color === 'slate') textClass = 'text-slate-900';
                            
                            return `bg-white/90 ${textClass} hover:bg-white text-xs sm:text-base px-2 py-0.5 sm:px-3 sm:py-1`;
                        })()}>
                            {(() => {
                                const pid = task.platform;
                                const p = platforms.find(p => p.id === pid);
                                return p ? p.name : (pid || '其他');
                            })()}
                        </Badge>
                        <Badge variant={task.status === 'open' ? 'default' : 'secondary'} className={
                            task.status === 'open' ? 'bg-green-600 text-white border-none text-xs sm:text-base px-2 py-0.5 sm:px-3 sm:py-1' : 'bg-gray-800 text-white border-none text-xs sm:text-base px-2 py-0.5 sm:px-3 sm:py-1'
                        }>
                            {task.status === 'open' ? '招募中' : task.status === 'ongoing' ? '进行中(已接)' : '已关闭'}
                        </Badge>
                    </div>
                </div>

                <div className="p-4 sm:p-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-2">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{task.title}</h1>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0 w-full sm:w-auto justify-between sm:justify-start mt-2 sm:mt-0 bg-rose-50 sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none">
                            <span className="text-xs sm:text-sm text-gray-500 mb-0 sm:mb-1">任务奖励</span>
                            <span className="text-xl sm:text-3xl font-bold text-rose-600">{task.reward_amount}积分</span>
                        </div>
                    </div>

                    <div className="prose max-w-none text-gray-700 mb-8">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">任务文案</h3>
                        <div className="bg-gray-50 p-4 sm:p-6 rounded-lg whitespace-pre-wrap leading-relaxed border border-gray-100 text-sm sm:text-base">
                            {task.content}
                        </div>
                    </div>

                    {task.remark && (
                        <div className="prose max-w-none text-gray-700 mb-8">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">任务要求</h3>
                            <div className="bg-amber-50 p-4 sm:p-6 rounded-lg whitespace-pre-wrap leading-relaxed border border-amber-100 text-amber-900 text-sm sm:text-base">
                                {task.remark}
                            </div>
                        </div>
                    )}

                    {task.guest_description && (
                        <div className="prose max-w-none text-gray-700 mb-8">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">嘉宾描述</h3>
                            <div className="bg-blue-50 p-4 sm:p-6 rounded-lg whitespace-pre-wrap leading-relaxed border border-blue-100 text-blue-900 text-sm sm:text-base">
                                {task.guest_description}
                            </div>
                        </div>
                    )}

                    {task.images && task.images.length > 1 && (
                        <div className="mb-8">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">更多示例</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-4">
                                {task.images.slice(1).map((img, i) => (
                                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setPreviewImage(img)}>
                                        {img.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                                            <>
                                                <video src={img} className="w-full h-full object-cover" muted />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                    <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                                                        <div className="w-0 h-0 border-t-4 border-t-transparent border-l-8 border-l-white border-b-4 border-b-transparent ml-1"></div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <Image src={img} alt="detail" fill className="object-cover hover:scale-105 transition-transform" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {assignee && (
                        <div className="mb-8 space-y-6">
                            <div>
                                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">当前接单人</h3>
                                <Link href={`/app/admin/users/${assignee.id}`}>
                                    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer border border-blue-100 group">
                                        <div className="h-12 w-12 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">
                                            {getUserInitials(assignee.email, assignee.full_name)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                                                {assignee.full_name || '未设置昵称'}
                                            </div>
                                            <div className="text-sm text-gray-500">{displayUserAccount(assignee.email)}</div>
                                        </div>
                                        <ExternalLink className="ml-auto h-4 w-4 text-blue-400 group-hover:text-blue-600" />
                                    </div>
                                </Link>
                            </div>

                            {assignee.proof_urls && assignee.proof_urls.length > 0 && (
                                <div>
                                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">提交的帖子链接</h3>
                                    <div className="space-y-2">
                                        {assignee.proof_urls.map((url: string, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm font-medium overflow-hidden">
                                                <LinkIcon className="h-4 w-4 flex-shrink-0 text-gray-500" />
                                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block">
                                                    {url}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">提交的客资 ({taskLeads.length})</h3>
                                {taskLeads.length === 0 ? (
                                    <div className="text-center p-8 bg-gray-50 rounded-lg text-gray-500 border border-dashed text-sm">
                                        该用户暂未提交任何客资
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {taskLeads.map((lead) => (
                                            <div 
                                                key={lead.id} 
                                                className="p-3 sm:p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group/lead"
                                                onClick={() => router.push(`/app/admin/reviews/${lead.id}`)}
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="font-medium text-gray-900 group-hover/lead:text-rose-600 transition-colors text-sm sm:text-base">
                                                        <span className="text-gray-500 text-xs sm:text-sm mr-2">联系方式:</span>
                                                        {lead.contact_info}
                                                    </div>
                                                    <Badge className={
                                                        ['verified', 'claimed', 'done', 'completed', 'approved'].includes(lead.status ?? '') ? 'bg-green-100 text-green-700 text-xs' :
                                                        lead.status === 'rejected' ? 'bg-red-100 text-red-700 text-xs' :
                                                        'bg-yellow-100 text-yellow-700 text-xs'
                                                    }>
                                                        {['verified', 'claimed', 'done', 'completed', 'approved'].includes(lead.status ?? '') ? '已通过' : lead.status === 'rejected' ? '已驳回' : '审核中'}
                                                    </Badge>
                                                </div>
                                                {lead.proof_url && (
                                                    <div className="bg-gray-50 p-2 rounded text-xs sm:text-sm font-medium flex items-center gap-2 overflow-hidden mb-2">
                                                        <ExternalLink className="h-3 w-3 flex-shrink-0 text-gray-500" />
                                                        <a href={lead.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block">
                                                            {lead.proof_url}
                                                        </a>
                                                    </div>
                                                )}
                                                {lead.proof_images && lead.proof_images.length > 0 ? (
                                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                                        {lead.proof_images.map((img: string, idx: number) => (
                                                            <div key={idx} className="relative h-12 w-12 sm:h-16 sm:w-16 rounded bg-gray-100 overflow-hidden block border cursor-zoom-in" onClick={() => setPreviewImage(img)}>
                                                                <Image src={img} alt="proof" fill className="object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-red-400">无截图</div>
                                                )}
                                                <div className="text-xs text-gray-400 mt-2 flex justify-between">
                                                    <span>提交于 {new Date(lead.created_at).toLocaleString()}</span>
                                                    {lead.review_note && <span className="text-red-500">备注: {lead.review_note}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Action Bar */}
                    <div className="border-t pt-4 sm:pt-8 mt-4 sm:mt-8 flex justify-end">
                        {myUserTask ? (
                            <Button className="bg-rose-600 hover:bg-rose-700 h-10 sm:h-12 px-8 text-base sm:text-lg shadow-lg shadow-rose-100 w-full md:w-auto" onClick={() => router.push(`/app/tasks/${myUserTask.id}`)}>
                                <ExternalLink className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> 进入我的工作台
                            </Button>
                        ) : isAdmin ? (
                            <Button variant="outline" disabled className="h-10 sm:h-12 px-8 text-base sm:text-lg w-full md:w-auto">
                                管理员预览模式
                            </Button>
                        ) : task.status !== 'open' ? (
                            <Button variant="secondary" disabled className="h-10 sm:h-12 px-8 text-base sm:text-lg w-full md:w-auto">
                                任务已结束或被抢
                            </Button>
                        ) : (
                            <Button className="bg-rose-600 hover:bg-rose-700 h-10 sm:h-12 px-8 text-base sm:text-lg shadow-lg shadow-rose-100 w-full md:w-auto" onClick={handleJoinTask}>
                                <CheckCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> 立即接单
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            <ImageViewer src={previewImage} open={!!previewImage} onOpenChange={() => setPreviewImage(null)} />
        </div>
    );
}
