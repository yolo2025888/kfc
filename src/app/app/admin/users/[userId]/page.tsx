'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Mail, Calendar, Briefcase, Save, Shield, Key, Settings, Trash2, UserCircle, MessageSquare, MapPin, Smartphone } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { displayUserAccount, getErrorMessage, getUserInitials } from '@/lib/utils';

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

type Profile = Database['public']['Tables']['profiles']['Row'] & { visible_platforms: string[] | null, visible_categories: string[] | null, custom_role_id: string | null };
type UserTask = Database['public']['Tables']['user_tasks']['Row'] & {
    tasks: Database['public']['Tables']['tasks']['Row'] | null;
    valid_leads_count?: number | null;
};
type PlatformAccount = Database['public']['Tables']['user_platform_accounts']['Row'];
type Platform = Database['public']['Tables']['platforms']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Role = Database['public']['Tables']['app_roles']['Row'] & { permission_ids?: string[] };

export default function AdminUserDetailPage() {
    const params = useParams();
    const router = useRouter();
    const targetUserId = params.userId as string;
    
    const [client, setClient] = useState<SassClient | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [userTasks, setUserTasks] = useState<UserTask[]>([]);
    const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditOpen, setIsEditOpen] = useState(false);
    
    // Permission State
    const [visiblePlatforms, setVisiblePlatforms] = useState<string[]>([]);
    const [platforms, setPlatforms] = useState<Platform[]>([]); 
    const [visibleCategories, setVisibleCategories] = useState<string[]>([]); // New
    const [categories, setCategories] = useState<Category[]>([]); // New
    const [role, setRole] = useState<string>('user');
    const [roles, setRoles] = useState<Role[]>([]); // Dynamic roles
    const [customRoleId, setCustomRoleId] = useState<string | null>(null);
    
    // Basic Info State
    const [fullName, setFullName] = useState('');
    const [remark, setRemark] = useState('');

    // Password Reset State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    const loadData = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            // 1. Get Profile
            const { data: profileData } = await c.getSupabaseClient()
                .from('profiles')
                .select('*')
                .eq('id', targetUserId)
                .single();
            
            if (profileData) {
                setProfile(profileData);
                setVisiblePlatforms(profileData.visible_platforms || []);
                setVisibleCategories(profileData.visible_categories || []);
                setFullName(profileData.full_name || '');
                setRemark(profileData.remark || '');
                
                // Fetch registration platform accounts
                const { data: accounts } = await c.getSupabaseClient()
                    .from('user_platform_accounts')
                    .select('*')
                    .eq('user_id', targetUserId);
                if (accounts) setPlatformAccounts(accounts);
            }

            // 2. Get Tasks
            const { data: tasksData, error: tasksError } = await c.getSupabaseClient()
                .from('user_tasks')
                .select('*, tasks(*), leads(count)')
                .eq('user_id', targetUserId)
                .order('created_at', { ascending: false });

            // Note: Since Supabase's leads(count) with global filter is tricky, 
            // we will query and count correctly if needed, but for now let's use a 
            // more reliable approach if the simple count isn't accurate enough.
            // However, to keep it simple, we'll filter the leads in the count if possible.
            
            // If we really want "Strict" count in THIS specific table:
            // We can fetch all leads for these tasks and count manually.
            if (tasksData && tasksData.length > 0) {
                const utIds = tasksData.map(ut => ut.id);
                const { data: validLeads } = await c.getSupabaseClient()
                    .from('leads')
                    .select('user_task_id')
                    .in('user_task_id', utIds)
                    .in('status', ['verified', 'claimed', 'done', 'completed']);
                
                // Attach the count to tasksData
                const enrichedTasks = (tasksData ?? []) as unknown as UserTask[];
                enrichedTasks.forEach((ut) => {
                    ut.valid_leads_count = validLeads?.filter(l => l.user_task_id === ut.id).length || 0;
                });
            }

            if (tasksError) throw tasksError;
            setUserTasks((tasksData ?? []) as unknown as UserTask[]);

            // 3. Load Platforms, Categories & Roles
            c.getPlatforms().then(({ data }) => setPlatforms(data || []));
            c.getCategories().then(({ data }) => setCategories(data || [])); 
            
            // 4. Fetch Roles and Init Role State
            fetch('/api/admin/roles').then(res => res.json()).then(res => {
                if (res.data && profileData) {
                    setRoles(res.data);
                    
                    // Priority: custom_role_id -> role
                    if (profileData.custom_role_id) {
                        setCustomRoleId(profileData.custom_role_id);
                        const r = (res.data as Role[]).find((x) => x.id === profileData.custom_role_id);
                        if (r) setRole(r.code);
                    } else {
                        setRole(profileData.role || 'user');
                        const r = (res.data as Role[]).find((x) => x.code === profileData.role);
                        if (r) setCustomRoleId(r.id);
                    }
                }
            });

        } catch (error) {
            console.error(error);
            toast({ title: "加载用户数据失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [targetUserId, toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            loadData(c);
        });
    }, [loadData]);

    const handleSavePermissions = async () => {
        if (!client || !profile) return;
        setSaving(true);
        try {
            await client.adminUpdateUserProfile(targetUserId, {
                role: role,
                custom_role_id: customRoleId,
                visible_platforms: visiblePlatforms,
                visible_categories: visibleCategories
            });

            toast({ title: "权限更新成功", description: "该用户的角色及可见性已调整。" });
            // Update local profile state partially
            setProfile(prev => prev ? ({ ...prev, role, custom_role_id: customRoleId }) : null);
        } catch (error) {
            console.error(error);
            toast({ title: "更新失败", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBasicInfo = async () => {
        if (!client || !profile) return;
        setSaving(true);
        try {
            await client.adminUpdateUserProfile(targetUserId, {
                full_name: fullName,
                remark: remark
            });

            toast({ title: "基本信息更新成功" });
            setProfile(prev => prev ? ({ ...prev, full_name: fullName, remark }) : null);
        } catch (error) {
            console.error(error);
            toast({ title: "更新失败", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!client || !targetUserId) return;
        if (!newPassword || newPassword.length < 6) {
            toast({ title: "密码长度不足", description: "密码至少需要6位", variant: "destructive" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: "两次密码不一致", variant: "destructive" });
            return;
        }

        setSaving(true);
        try {
            await client.adminUpdateUserPassword(targetUserId, newPassword);
            toast({ title: "密码重置成功", description: "该用户可以使用新密码登录了。" });
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error("Password reset error:", error);
            toast({ title: "重置失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!client || !targetUserId) return;
        if (!confirm('危险操作：确定要永久删除该用户吗？\n\n此操作将删除该用户的所有数据（任务记录、客资等），且不可恢复！')) return;
        
        setSaving(true);
        try {
            await client.adminDeleteUser(targetUserId);
            toast({ title: "用户已删除", description: "该用户及相关数据已被永久移除。" });
            router.push('/app/admin/users');
        } catch (error) {
            console.error("Delete user error:", error);
            toast({ title: "删除失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const togglePlatform = (platform: string) => {
        setVisiblePlatforms(prev => 
            prev.includes(platform) 
                ? prev.filter(p => p !== platform)
                : [...prev, platform]
        );
    };

    const toggleCategory = (id: string) => {
        setVisibleCategories(prev => 
            prev.includes(id) 
                ? prev.filter(c => c !== id)
                : [...prev, id]
        );
    };

    if (loading && !profile) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-rose-600" /></div>;
    if (!profile) return <div className="p-8 text-center">用户不存在</div>;

    return (
        <div className="container mx-auto py-8 px-4 max-w-5xl">
            {/* Top Navigation & Actions */}
            <div className="flex items-center justify-between mb-6">
                <Button variant="ghost" className="pl-0 hover:pl-2 transition-all" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> 返回
                </Button>

                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Settings className="h-4 w-4" /> 编辑用户资料
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>编辑用户资料</DialogTitle>
                            <DialogDescription>
                                对 {profile.full_name || displayUserAccount(profile.email)} 进行信息修改、权限配置或密码重置。
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="basic" className="w-full mt-4">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="basic">基本信息</TabsTrigger>
                                <TabsTrigger value="permissions">权限设置</TabsTrigger>
                                <TabsTrigger value="security">安全管理</TabsTrigger>
                            </TabsList>

                            {/* Tab 1: Basic Info */}
                            <TabsContent value="basic" className="space-y-4 py-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="full_name">用户姓名 / 昵称</Label>
                                        <Input 
                                            id="full_name" 
                                            value={fullName} 
                                            onChange={(e) => setFullName(e.target.value)} 
                                            placeholder="请输入姓名"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="remark">后台备注 (仅管理员可见)</Label>
                                        <Textarea 
                                            id="remark" 
                                            value={remark} 
                                            onChange={(e) => setRemark(e.target.value)} 
                                            placeholder="例如：李总推荐 / 重点客户"
                                            rows={3}
                                        />
                                    </div>
                                </div>
                                <div className="pt-2 flex justify-end">
                                    <Button onClick={handleSaveBasicInfo} disabled={saving} variant="default">
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        保存基本信息
                                    </Button>
                                </div>
                            </TabsContent>

                            {/* Tab 2: Permissions */}
                            <TabsContent value="permissions" className="space-y-4 py-4">
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <Label className="text-sm font-bold">系统角色</Label>
                                        <select 
                                            value={role} 
                                            onChange={(e) => {
                                                const code = e.target.value;
                                                setRole(code);
                                                const r = roles.find((x) => x.code === code);
                                                setCustomRoleId(r?.id || null);
                                            }}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {roles.length > 0 ? roles.map((r) => (
                                                <option key={r.id} value={r.code}>{r.name} ({r.code})</option>
                                            )) : <option disabled>加载角色中...</option>}
                                        </select>
                                        <p className="text-xs text-gray-500">
                                            不同角色拥有不同的后台访问权限。
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <Label className="text-sm font-bold">任务大厅可见性 (平台)</Label>
                                        <div className="flex flex-wrap gap-4 pt-1">
                                            {platforms.length > 0 ? platforms.map(p => (
                                                <div key={p.id} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`platform-${p.id}`} 
                                                        checked={visiblePlatforms.includes(p.id)}
                                                        onCheckedChange={() => togglePlatform(p.id)}
                                                    />
                                                    <Label htmlFor={`platform-${p.id}`}>{p.name}</Label>
                                                </div>
                                            )) : (
                                                <span className="text-sm text-gray-400">加载中...</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mb-4">
    默认不勾选则不可见全部平台。请勾选允许用户看到的平台类型。
</p>
                                    </div>

                                    <div className="space-y-3 border-t pt-4">
                                        <Label className="text-sm font-bold">任务大厅可见性 (类目)</Label>
                                        <div className="flex flex-wrap gap-4 pt-1">
                                            {categories.length > 0 ? categories.map(c => (
                                                <div key={c.id} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`cat-${c.id}`} 
                                                        checked={visibleCategories.includes(c.id)}
                                                        onCheckedChange={() => toggleCategory(c.id)}
                                                    />
                                                    <Label htmlFor={`cat-${c.id}`}>{c.name}</Label>
                                                </div>
                                            )) : (
                                                <span className="text-sm text-gray-400">无类目或加载中...</span>
                                            )}
                                        </div>
                                    <p className="text-sm text-gray-500 mb-4">
                                        默认不勾选则不可见全部类目。请勾选允许用户看到的任务分类。
                                    </p>
                                    </div>
                                </div>
                                <div className="pt-4 border-t flex justify-end">
                                    <Button onClick={handleSavePermissions} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        保存设置
                                    </Button>
                                </div>
                            </TabsContent>

                            {/* Tab 3: Security */}
                            <TabsContent value="security" className="space-y-4 py-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="new_password">新密码</Label>
                                        <Input 
                                            id="new_password" 
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="至少6位"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirm_password">确认新密码</Label>
                                        <Input 
                                            id="confirm_password" 
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="再次输入以确认"
                                        />
                                    </div>
                                </div>
                                <div className="pt-2 flex justify-end">
                                    <Button onClick={handleResetPassword} disabled={saving} variant="destructive">
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                                        重置密码
                                    </Button>
                                </div>

                                <div className="border-t pt-6 mt-6">
                                    <h4 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">
                                        <Trash2 className="h-4 w-4" /> 危险区域
                                    </h4>
                                    <div className="bg-red-50 border border-red-100 rounded-md p-4 flex justify-between items-center">
                                        <div>
                                            <div className="font-medium text-red-900 text-sm">删除此用户</div>
                                            <div className="text-red-700 text-xs mt-1">
                                                删除后，该用户的所有数据（包括任务、客资记录）都将被清除，且无法恢复。
                                            </div>
                                        </div>
                                        <Button 
                                            variant="destructive" 
                                            size="sm" 
                                            className="bg-red-600 hover:bg-red-700"
                                            onClick={handleDeleteUser}
                                            disabled={saving}
                                        >
                                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            删除用户
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-8">
                {/* User Profile Summary Card */}
                <Card className="bg-gradient-to-br from-white to-gray-50 border-gray-200">
                    <CardHeader className="flex flex-row items-center gap-6">
                        <div className="relative h-20 w-20 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-3xl font-bold border-4 border-white shadow-sm overflow-hidden">
                            {profile.avatar_url ? (
                                <Image src={profile.avatar_url} alt="avatar" fill unoptimized sizes="80px" className="object-cover" />
                            ) : (
                                getUserInitials(profile.email, profile.full_name)
                            )}
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-2xl">{profile.full_name || '未设置昵称'}</CardTitle>
                            <div className="flex items-center text-gray-500 gap-4 text-sm">
                                <div className="flex items-center gap-1"><Mail className="h-4 w-4" /> {displayUserAccount(profile.email)}</div>
                                <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> 注册于 {new Date(profile.created_at).toLocaleDateString()}</div>
                            </div>
                            <div className="pt-2 flex gap-2">
                                <Badge 
                                    variant={
                                        profile.role === 'super-admin' ? 'destructive' :
                                        profile.role === 'admin' ? 'default' : 
                                        profile.role === 'auditor' ? 'outline' : 'secondary'
                                    }
                                    className={profile.role === 'auditor' ? 'border-orange-500 text-orange-600 bg-orange-50' : ''}
                                >
                                    <Shield className="h-3 w-3 mr-1" />
                                    {profile.role === 'super-admin' ? '超级管理员' :
                                     profile.role === 'admin' ? '管理员' : 
                                     profile.role === 'auditor' ? '邀约员' : '普通用户'}
                                </Badge>
                                {profile.remark && (
                                    <Badge variant="outline" className="text-gray-500 border-gray-300">
                                        {profile.remark}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                {/* Registration Info & Platform Accounts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-1">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <UserCircle className="h-4 w-4 text-rose-500" /> 注册留存信息
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <div className="text-[10px] uppercase font-bold text-gray-400">系统短工号</div>
                                <div className="font-mono font-bold text-rose-600">{profile.short_id || '-'}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] uppercase font-bold text-gray-400">微信号</div>
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                    <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                                    {profile.wechat_id || '未填写'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] uppercase font-bold text-gray-400">常驻地区</div>
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                    <MapPin className="h-3.5 w-3.5 text-orange-400" />
                                    {profile.province} {profile.city}
                                    {(!profile.province && !profile.city) && '未识别'}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Smartphone className="h-4 w-4 text-rose-500" /> 绑定的平台账号 ({platformAccounts.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {platformAccounts.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {platformAccounts.map((acc, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                                                    {acc.platform === 'douyin' ? '抖音' :
                                                     acc.platform === 'xiaohongshu' ? '小红书' :
                                                     acc.platform === 'shipinhao' ? '视频号' :
                                                     acc.platform === 'kuaishou' ? '快手' :
                                                     acc.platform === 'weibo' ? '微博' :
                                                     acc.platform === 'xianyu' ? '闲鱼' : acc.platform}
                                                </span>
                                                <span className="text-sm font-bold text-gray-700">{acc.account_id}</span>
                                            </div>
                                            <Badge variant={acc.is_verified ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                                {acc.is_verified ? '已实名' : '未实名'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-gray-400 text-xs italic">
                                    该用户暂无绑定的平台账号
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Task History - Primary View */}
                <Card className="min-h-[500px]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5" /> 接单历史
                        </CardTitle>
                        <CardDescription>该用户共接取了 {userTasks.length} 个任务</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>任务标题</TableHead>
                                    <TableHead>平台</TableHead>
                                    <TableHead>有效客资</TableHead>
                                    <TableHead>接单状态</TableHead>
                                    <TableHead>接单时间</TableHead>
                                    <TableHead>奖励</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {userTasks.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                                            暂无接单记录
                                        </TableCell>
                                    </TableRow>
                                )}
                                {userTasks.map((ut) => (
                                    <TableRow key={ut.id} className="hover:bg-gray-50">
                                        <TableCell className="font-medium">
                                            {ut.tasks ? (
                                                <Link href={`/app/tasks/view/${ut.tasks.id}`} className="hover:text-rose-600 hover:underline underline-offset-4 transition-colors">
                                                    {ut.tasks.title}
                                                </Link>
                                            ) : (
                                                '未知任务'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={(() => {
                                                const pid = ut.tasks?.platform;
                                                const p = platforms.find(p => p.id === pid);
                                                const baseClass = colorMap[p?.color ?? 'gray'] || colorMap.gray;
                                                return baseClass;
                                            })()}>
                                                {(() => {
                                                    const pid = ut.tasks?.platform;
                                                    const p = platforms.find(p => p.id === pid);
                                                    return p ? p.name : (pid || '其他');
                                                })()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono font-medium">
                                            {ut.valid_leads_count || 0}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={
                                                ut.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                ut.status === 'dropped' ? 'bg-red-100 text-red-800' :
                                                'bg-blue-100 text-blue-800'
                                            }>
                                                {ut.status === 'in_progress' ? '进行中' : ut.status === 'dropped' ? '已放弃' : '已完成'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-sm">
                                            {new Date(ut.created_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell>{ut.tasks?.reward_amount}积分</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
