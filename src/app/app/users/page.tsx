'use client';

import { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { copyToClipboard, displayUserAccount, getErrorMessage, getUserInitials } from '@/lib/utils';
import { User, Shield, Loader2, Key, Save, MapPin, MessageSquare, Smartphone, CheckCircle2, XCircle, UserCircle, Share2, Copy } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Profile = Database['public']['Tables']['profiles']['Row'];
type PlatformAccount = {
    platform: string;
    account_id: string;
    is_verified: boolean | null;
};

export default function UserSettingsPage() {
    const [client, setClient] = useState<SassClient | null>(null);
    const [currentUser, setCurrentUser] = useState<Profile | null>(null);
    const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Form States
    const [fullName, setFullName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [origin, setOrigin] = useState('');
    
    const { toast } = useToast();

    const loadData = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data: { user } } = await c.getSupabaseClient().auth.getUser();
            if (user) {
                const { data: profile } = await c.getUserProfile(user.id);
                if (profile) {
                    setCurrentUser(profile);
                    setFullName(profile.full_name || '');
                }

                // Fetch platform accounts
                const { data: accounts } = await c.getSupabaseClient()
                    .from('user_platform_accounts')
                    .select('*')
                    .eq('user_id', user.id);
                
                if (accounts) {
                    setPlatformAccounts(accounts);
                }
            }
        } catch (error) {
            console.error(error);
            toast({ title: "加载个人信息失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        setOrigin(window.location.origin);
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            loadData(c);
        });
    }, [loadData]);

    const handleUpdateProfile = async () => {
        if (!client || !currentUser) return;
        setSaving(true);
        try {
            const { error } = await client.getSupabaseClient()
                .from('profiles')
                .update({ full_name: fullName })
                .eq('id', currentUser.id);

            if (error) throw error;
            
            toast({ title: "个人资料已更新" });
            setCurrentUser(prev => prev ? ({ ...prev, full_name: fullName }) : null);
        } catch (error) {
            toast({ title: "更新失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!client) return;
        if (!newPassword || newPassword.length < 6) {
            toast({ title: "密码长度不足", description: "密码至少需要 6 位", variant: "destructive" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: "两次密码不一致", variant: "destructive" });
            return;
        }

        setSaving(true);
        try {
            const { error } = await client.getSupabaseClient().auth.updateUser({
                password: newPassword
            });

            if (error) throw error;
            
            toast({ title: "密码修改成功" });
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            toast({ title: "修改失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-rose-600" /></div>;

    return (
        <div className="container mx-auto py-8 px-4 max-w-3xl space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">账号设置</h1>
                <p className="text-gray-500">管理您的个人资料和账户安全</p>
            </div>

            <div className="grid gap-8">
                {/* Profile Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" /> 个人资料
                        </CardTitle>
                        <CardDescription>您的公开显示信息</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center gap-6 pb-6 border-b">
                            <div className="h-20 w-20 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-3xl font-bold border-4 border-white shadow-sm">
                                {getUserInitials(currentUser?.email, fullName)}
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm text-gray-500">登录账号</div>
                                <div className="font-medium text-lg text-gray-900">{displayUserAccount(currentUser?.email)}</div>
                                <div className="flex gap-2 mt-2">
                                    <Badge 
                                        variant={
                                            currentUser?.role === 'super-admin' ? 'destructive' :
                                            currentUser?.role === 'admin' ? 'default' : 
                                            currentUser?.role === 'auditor' ? 'outline' : 'secondary'
                                        }
                                        className={currentUser?.role === 'auditor' ? 'border-orange-500 text-orange-600 bg-orange-50' : ''}
                                    >
                                        <Shield className="h-3 w-3 mr-1" />
                                                                                    {currentUser?.role === 'super-admin' ? '超级管理员' :
                                                                                     currentUser?.role === 'admin' ? '管理员' : 
                                                                                     currentUser?.role === 'auditor' ? '邀约员' : '普通用户'}                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="full_name">姓名 / 昵称</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        id="full_name" 
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="请输入您的姓名"
                                        className="max-w-md"
                                    />
                                    <Button onClick={handleUpdateProfile} disabled={saving}>
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                        保存
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Onboarding Info Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserCircle className="h-5 w-5" /> 基础资料
                        </CardTitle>
                        <CardDescription>注册时填写的系统信息</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Smartphone className="h-3 w-3" /> 系统工号
                            </div>
                            <div className="font-bold text-lg text-rose-600">
                                {currentUser?.short_id || '-'}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" /> 微信号
                            </div>
                            <div className="font-medium text-gray-900">
                                {currentUser?.wechat_id || '未填写'}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> 所在地区
                            </div>
                            <div className="font-medium text-gray-900">
                                {currentUser?.province} {currentUser?.city}
                                {(!currentUser?.province && !currentUser?.city) && '未设置'}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Platform Accounts Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5" /> 绑定的平台账号
                        </CardTitle>
                        <CardDescription>您在注册时提交的社交媒体账号</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {platformAccounts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {platformAccounts.map((acc, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                                                {acc.platform === 'douyin' ? '抖音' :
                                                 acc.platform === 'xiaohongshu' ? '小红书' :
                                                 acc.platform === 'shipinhao' ? '视频号' :
                                                 acc.platform === 'kuaishou' ? '快手' :
                                                 acc.platform === 'weibo' ? '微博' :
                                                 acc.platform === 'xianyu' ? '闲鱼' : acc.platform}
                                            </span>
                                            <span className="font-bold text-gray-700">{acc.account_id}</span>
                                        </div>
                                        <Badge variant={acc.is_verified ? "default" : "secondary"} className="h-fit">
                                            {acc.is_verified ? (
                                                <><CheckCircle2 className="h-3 w-3 mr-1" /> 已实名</>
                                            ) : (
                                                <><XCircle className="h-3 w-3 mr-1" /> 未实名</>
                                            )}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-gray-400 italic">
                                暂无绑定的平台账号
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Invite Section */}
                <Card className="border-rose-100 bg-rose-50/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-rose-700">
                            <Share2 className="h-5 w-5" /> 邀请好友
                        </CardTitle>
                        <CardDescription>分享您的专属链接，邀请好友加入</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input 
                                readOnly
                                value={origin && currentUser?.short_id ? `${origin}/onboarding?invite=${currentUser.short_id}` : '加载中...'}
                                className="bg-white"
                            />
                            <Button 
                                variant="secondary"
                                className="shrink-0"
                                onClick={async () => {
                                    if (!origin || !currentUser?.short_id) return;
                                    const link = `${origin}/onboarding?invite=${currentUser.short_id}`;
                                    const success = await copyToClipboard(link);
                                    if (success) toast({ title: "复制成功", description: "邀请链接已复制到剪贴板" });
                                    else toast({ title: "复制失败", variant: "destructive" });
                                }}
                            >
                                <Copy className="h-4 w-4 mr-2" /> 复制链接
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Security Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5" /> 修改密码
                        </CardTitle>
                        <CardDescription>建议定期更换密码以保障账户安全</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="new_password">新密码</Label>
                                <Input 
                                    id="new_password" 
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="至少 6 位"
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
                        <Button 
                            className="bg-gray-900 hover:bg-gray-800"
                            onClick={handleUpdatePassword}
                            disabled={saving || !newPassword}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                            更新密码
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
