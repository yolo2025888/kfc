'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import NProgress from 'nprogress';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, ArrowLeft, ShieldCheck } from 'lucide-react';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { displayUserAccount, getErrorMessage, toInternalLoginEmail } from '@/lib/utils';

type Role = Database['public']['Tables']['app_roles']['Row'];
type Platform = Database['public']['Tables']['platforms']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function AdminAddUserPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [client, setClient] = useState<SassClient | null>(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        role: 'user', // Default role
        remark: ''
    });
    const [roles, setRoles] = useState<Role[]>([]);
    const [customRoleId, setCustomRoleId] = useState<string | null>(null);
    const [visiblePlatforms, setVisiblePlatforms] = useState<string[]>([]);
    const [platforms, setPlatforms] = useState<Platform[]>([]); 
    const [categories, setCategories] = useState<Category[]>([]);
    const [visibleCategories, setVisibleCategories] = useState<string[]>([]); // New
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        createSPASassClientAuthenticated().then(c => {
            setClient(c);
            c.getPlatforms().then(({ data }) => setPlatforms(data || []));
            c.getCategories().then(({ data }) => setCategories(data || []));
            
            // Fetch dynamic roles
            fetch('/api/admin/roles').then(res => res.json()).then(res => {
                if (res.data) {
                    const roleRows = res.data as Role[];
                    setRoles(roleRows);
                    // Set default customRoleId if role is already set
                    const defaultRole = roleRows.find((r) => r.code === 'user');
                    if (defaultRole) setCustomRoleId(defaultRole.id);
                }
            });
        });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const code = e.target.value;
        setFormData(prev => ({ ...prev, role: code }));
        const roleObj = roles.find(r => r.code === code);
        setCustomRoleId(roleObj?.id || null);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!client) return;

        const { email, password, confirmPassword, role, full_name, remark } = formData;

        if (!email || !password || !confirmPassword) {
            toast({ title: "用户名和密码是必填项", variant: "destructive" });
            return;
        }
        if (password !== confirmPassword) {
            toast({ title: "两次输入的密码不一致", variant: "destructive" });
            return;
        }

        const finalEmail = toInternalLoginEmail(email);

        setLoading(true);
        NProgress.start();
        try {
            await client.adminCreateUser({
                email: finalEmail,
                password,
                role,
                custom_role_id: customRoleId,
                full_name: full_name || null,
                remark: remark || null,
                visible_platforms: visiblePlatforms, // Send array as-is
                visible_categories: visibleCategories // Send array as-is
            });
            toast({ title: "用户创建成功", description: `账号: ${displayUserAccount(finalEmail)}` });
            setFormData({
                email: '',
                password: '',
                confirmPassword: '',
                full_name: '',
                role: 'user',
                remark: ''
            });
            setVisiblePlatforms([]);
            setVisibleCategories([]);
        } catch (error) {
            console.error("Error creating user:", error);
            toast({ title: "用户创建失败", description: getErrorMessage(error, "未知错误"), variant: "destructive" });
        } finally {
            setLoading(false);
            NProgress.done();
        }
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-2xl">
            <Button variant="ghost" className="mb-6 pl-0 hover:pl-2 transition-all" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> 返回
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" /> 新增用户
                    </CardTitle>
                    <CardDescription>创建新的平台登录账号，并为其分配角色。</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">用户名</Label>
                                <div className="relative">
                                    <Input 
                                        id="email" 
                                        name="email" 
                                        type="text" 
                                        value={formData.email} 
                                        onChange={handleChange} 
                                        placeholder="例如：zhangsan" 
                                        required 
                                        className="pr-3"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="full_name">姓名/昵称 (可选)</Label>
                                <Input 
                                    id="full_name" 
                                    name="full_name" 
                                    type="text" 
                                    value={formData.full_name} 
                                    onChange={handleChange} 
                                    placeholder="用户姓名" 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">密码</Label>
                                <Input 
                                    id="password" 
                                    name="password" 
                                    type="password" 
                                    value={formData.password} 
                                    onChange={handleChange} 
                                    placeholder="至少6位" 
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">确认密码</Label>
                                <Input 
                                    id="confirmPassword" 
                                    name="confirmPassword" 
                                    type="password" 
                                    value={formData.confirmPassword} 
                                    onChange={handleChange} 
                                    placeholder="再次输入密码" 
                                    required 
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role">角色</Label>
                            <select 
                                id="role" 
                                name="role" 
                                value={formData.role} 
                                onChange={handleRoleChange}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {roles.length > 0 ? roles.map((r) => (
                                    <option key={r.id} value={r.code}>{r.name} ({r.code})</option>
                                )) : <option disabled>正在加载角色列表...</option>}
                            </select>
                        </div>
                        
                        {/* Platform & Category Visibility Settings */}
                        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <Label className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> 任务可见性设置
                                <p className="text-sm text-gray-500 mb-4">
    默认不勾选则不可见全部平台。请勾选允许用户看到的平台类型。
</p>
                            </Label>
                            
                            <div className="text-xs font-bold text-gray-500 mt-2 mb-1">平台权限</div>
                            <div className="flex flex-wrap gap-6 mb-4">
                                {platforms.length > 0 ? platforms.map(p => (
                                    <div key={p.id} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`new-platform-${p.id}`} 
                                            checked={visiblePlatforms.includes(p.id)}
                                            onCheckedChange={() => togglePlatform(p.id)}
                                        />
                                        <Label htmlFor={`new-platform-${p.id}`}>{p.name}</Label>
                                    </div>
                                )) : (
                                    <span className="text-xs text-gray-400">加载中或暂无平台</span>
                                )}
                            </div>

                            <div className="text-xs font-bold text-gray-500 mb-1 border-t pt-2 border-gray-200">类目权限</div>
                            <div className="flex flex-wrap gap-4">
                                {categories.length > 0 ? categories.map(c => (
                                    <div key={c.id} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`new-cat-${c.id}`} 
                                            checked={visibleCategories.includes(c.id)}
                                            onCheckedChange={() => toggleCategory(c.id)}
                                        />
                                        <Label htmlFor={`new-cat-${c.id}`}>{c.name}</Label>
                                    </div>
                                )) : <span className="text-xs text-gray-400">暂无类目</span>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="remark">备注 (可选)</Label>
                            <Textarea 
                                id="remark" 
                                name="remark" 
                                value={formData.remark} 
                                onChange={handleChange} 
                                placeholder="例如：由李经理推荐 / 负责抖音任务" 
                                rows={3}
                            />
                        </div>

                        <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                            创建用户
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
