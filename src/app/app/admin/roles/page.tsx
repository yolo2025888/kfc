'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";

// Types
type Role = {
  id: string;
  code: string;
  name: string;
  description: string;
  permission_ids: string[];
};

type Permission = {
  id: string;
  code: string;
  name: string;
  type: 'menu' | 'action';
  sort_order: number;
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog State
  const [isOpen, setIsOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '', permission_ids: [] as string[] });
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/admin/roles'),
        fetch('/api/admin/permissions')
      ]);
      
      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();
      
      if (rolesData.data) setRoles(rolesData.data);
      if (permsData.data) setPermissions(permsData.data);
    } catch {
      toast({ title: '加载失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpen = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        code: role.code,
        description: role.description || '',
        permission_ids: role.permission_ids || []
      });
    } else {
      setEditingRole(null);
      setFormData({ name: '', code: '', description: '', permission_ids: [] });
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) return toast({ title: '请填写必填项', variant: 'destructive' });
    
    setSaving(true);
    try {
      const method = editingRole ? 'PUT' : 'POST';
      const body = {
        ...formData,
        id: editingRole?.id
      };

      const res = await fetch('/api/admin/roles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) throw new Error('Failed');
      
      toast({ title: '保存成功' });
      setIsOpen(false);
      fetchData(); // Reload
    } catch {
      toast({ title: '保存失败', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (pid: string) => {
    setFormData(prev => {
      const ids = prev.permission_ids;
      if (ids.includes(pid)) return { ...prev, permission_ids: ids.filter(x => x !== pid) };
      return { ...prev, permission_ids: [...ids, pid] };
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此角色吗？')) return;
    try {
      await fetch(`/api/admin/roles?id=${id}`, { method: 'DELETE' });
      toast({ title: '删除成功' });
      fetchData();
    } catch {
      toast({ title: '删除失败', variant: 'destructive' });
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold text-gray-900">角色管理</h1>
           <p className="text-gray-500">配置系统角色及其对应的菜单权限</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-rose-600 hover:bg-rose-700">
          <Plus className="h-4 w-4 mr-2" /> 新增角色
        </Button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>角色名称</TableHead>
              <TableHead>标识 (Code)</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>权限数</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map(role => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell><Badge variant="outline">{role.code}</Badge></TableCell>
                <TableCell className="text-gray-500">{role.description}</TableCell>
                <TableCell>{role.permission_ids?.length || 0} 项</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleOpen(role)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  {['admin', 'super_admin', 'auditor', 'user'].includes(role.code) ? (
                    <span className="text-xs text-gray-400 px-2">系统内置</span>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(role.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? '编辑角色' : '新增角色'}</DialogTitle>
            <DialogDescription>
              配置角色的基础信息和可见菜单权限。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>角色名称</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="例如：财务专员"
                />
              </div>
              <div className="space-y-2">
                <Label>唯一标识 (Code)</Label>
                <Input 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value})} 
                  placeholder="例如：finance"
                  disabled={!!editingRole} // 禁止修改 Code
                />
              </div>
            </div>
            <div className="space-y-2">
               <Label>描述</Label>
               <Input 
                 value={formData.description} 
                 onChange={e => setFormData({...formData, description: e.target.value})} 
                 placeholder="角色的职责描述"
               />
            </div>

            <div className="space-y-3 pt-4 border-t">
               <Label className="text-base font-semibold">菜单权限配置</Label>
               <div className="grid grid-cols-2 gap-3">
                  {permissions.map(p => {
                    const checked = formData.permission_ids.includes(p.id);
                    return (
                      <div 
                        key={p.id} 
                        className={`
                          flex items-center space-x-3 border p-3 rounded-lg cursor-pointer transition-colors
                          ${checked ? 'bg-rose-50 border-rose-200' : 'bg-white hover:bg-gray-50'}
                        `}
                        onClick={() => togglePermission(p.id)}
                      >
                         <div className={`
                            w-5 h-5 rounded border flex items-center justify-center
                            ${checked ? 'bg-rose-600 border-rose-600' : 'border-gray-300 bg-white'}
                         `}>
                            {checked && <Check className="h-3.5 w-3.5 text-white" />}
                         </div>
                         <div>
                            <div className="font-medium text-sm">{p.name}</div>
                            <div className="text-xs text-gray-400">{p.code}</div>
                         </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-rose-600">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存配置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
