'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Eye, Mail, Shield, Search } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import NProgress from 'nprogress';

type UserStat = {
    user_id: string;
    email: string;
    full_name: string | null;
    role: string;
    remark: string | null;
    created_at: string;
    total_leads: number;
    today_leads: number;
    total_tasks: number;
    today_tasks: number;
    invite_count: number;
};

type AppRole = Database['public']['Tables']['app_roles']['Row'];

export default function AdminUsersPage() {
    const [client, setClient] = useState<SassClient | null>(null);
    const [users, setUsers] = useState<UserStat[]>([]);
    const [roles, setRoles] = useState<AppRole[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const router = useRouter();

    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    const loadUsers = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            const { data, error } = await c.getUserStats();
            if (error) throw error;
            setUsers((data || []) as unknown as UserStat[]);
        } catch (error) {
            console.error(error);
            toast({ title: "加载用户列表失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            loadUsers(c);
            
            const { data: rolesData } = await c.getRoles();
            if (rolesData) setRoles(rolesData as unknown as AppRole[]);
        });
    }, [loadUsers]);

    const navigateToUser = (userId: string) => {
        NProgress.start();
        router.push(`/app/admin/users/${userId}`);
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = 
            (user.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        
        const matchesRole = roleFilter === 'all' || user.role === roleFilter || (roleFilter === 'user' && !user.role);

        return matchesSearch && matchesRole;
    });

    if (loading && !client) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
                    <p className="text-gray-500">查看并管理平台所有注册用户及其业绩。</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="搜索姓名或邮箱..." 
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-full sm:w-40">
                            <SelectValue placeholder="选择角色" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">所有角色</SelectItem>
                            {roles.length > 0 ? roles.map(r => (
                                <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                            )) : (
                                <>
                                    <SelectItem value="user">普通用户</SelectItem>
                                    <SelectItem value="auditor">邀约员</SelectItem>
                                    <SelectItem value="admin">管理员</SelectItem>
                                    <SelectItem value="super-admin">超级管理员</SelectItem>
                                </>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>注册用户列表</CardTitle>
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
                                <TableHead>用户信息</TableHead>
                                <TableHead className="text-center">总任务</TableHead>
                                <TableHead className="text-center">今日任务</TableHead>
                                <TableHead className="text-center">总客资</TableHead>
                                <TableHead className="text-center">今日客资</TableHead>
                                <TableHead className="text-center">邀请人数</TableHead>
                                <TableHead>角色</TableHead>
                                <TableHead>备注</TableHead>
                                <TableHead>注册时间</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                        没有找到匹配的用户
                                    </TableCell>
                                </TableRow>
                            ) : filteredUsers.map((user) => (
                                <TableRow key={user.user_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigateToUser(user.user_id)}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold">
                                                {user.full_name ? user.full_name.slice(0, 1).toUpperCase() : user.email?.[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{user.full_name || '未设置昵称'}</div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Mail className="h-3 w-3" /> {user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-mono font-medium text-base">
                                        {user.total_tasks}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {user.today_tasks > 0 ? (
                                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                                +{user.today_tasks}
                                            </Badge>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center font-mono font-medium text-base">
                                        {user.total_leads}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {user.today_leads > 0 ? (
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                                +{user.today_leads}
                                            </Badge>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center font-mono font-bold text-rose-600 text-base">
                                        {user.invite_count || 0}
                                    </TableCell>
                                    <TableCell>
                                        <Badge 
                                            variant={
                                                user.role === 'super-admin' ? 'destructive' :
                                                user.role === 'admin' ? 'default' : 
                                                user.role === 'auditor' ? 'outline' : 'secondary'
                                            } 
                                            className={`flex w-fit items-center gap-1 ${user.role === 'auditor' ? 'border-orange-500 text-orange-600 bg-orange-50' : ''}`}
                                        >
                                            <Shield className="h-3 w-3" />
                                            {user.role === 'super-admin' ? '超级管理员' :
                                             user.role === 'admin' ? '管理员' : 
                                             user.role === 'auditor' ? '邀约员' : '普通用户'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate text-gray-500 text-sm">
                                        {user.remark || '-'}
                                    </TableCell>
                                    <TableCell className="text-gray-500 text-sm">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={(e) => {
                                            e.stopPropagation();
                                            navigateToUser(user.user_id);
                                        }}>
                                            <Eye className="h-4 w-4 mr-2" /> 详情
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
