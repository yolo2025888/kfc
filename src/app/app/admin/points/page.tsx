'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit2, Loader2, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  POINTS_TRIGGER_LABELS,
  normalizePoints,
  type PointsRule,
  type PointsRuleInput,
  type PointsTriggerEvent,
} from '@/lib/points';
import { getErrorMessage } from '@/lib/utils';

type Platform = { id: string; name: string; color: string | null };
type Category = { id: string; name: string; parent_id: string | null };
type PointsPayload = {
  data?: {
    rules: PointsRule[];
    platforms: Platform[];
    categories: Category[];
  };
  error?: string;
};

type RuleForm = {
  id?: string;
  name: string;
  trigger_event: PointsTriggerEvent;
  platform: string;
  category_id: string;
  points: string;
  is_enabled: boolean;
  priority: string;
  description: string;
};

const ALL_VALUE = '__all__';

const emptyForm: RuleForm = {
  name: '',
  trigger_event: 'link_approved',
  platform: ALL_VALUE,
  category_id: ALL_VALUE,
  points: '0',
  is_enabled: true,
  priority: '100',
  description: '',
};

function toForm(rule?: PointsRule): RuleForm {
  if (!rule) return emptyForm;

  return {
    id: rule.id,
    name: rule.name,
    trigger_event: rule.trigger_event,
    platform: rule.platform ?? ALL_VALUE,
    category_id: rule.category_id ?? ALL_VALUE,
    points: String(rule.points),
    is_enabled: rule.is_enabled,
    priority: String(rule.priority),
    description: rule.description ?? '',
  };
}

function toPayload(form: RuleForm): PointsRuleInput {
  return {
    id: form.id,
    name: form.name,
    trigger_event: form.trigger_event,
    platform: form.platform === ALL_VALUE ? null : form.platform,
    category_id: form.category_id === ALL_VALUE ? null : form.category_id,
    points: normalizePoints(form.points),
    is_enabled: form.is_enabled,
    priority: Number(form.priority) || 100,
    description: form.description || null,
  };
}

export default function AdminPointsPage() {
  const [rules, setRules] = useState<PointsRule[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const { toast } = useToast();

  const platformName = (id: string | null) => {
    if (!id) return '全部平台';
    return platforms.find((platform) => platform.id === id)?.name ?? id;
  };

  const categoryName = (id: string | null) => {
    if (!id) return '全部类目';
    return categories.find((category) => category.id === id)?.name ?? id;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/points', { cache: 'no-store' });
      const payload = (await res.json()) as PointsPayload;
      if (!res.ok) throw new Error(payload.error || '加载积分规则失败');

      setRules(payload.data?.rules ?? []);
      setPlatforms(payload.data?.platforms ?? []);
      setCategories(payload.data?.categories ?? []);
    } catch (error) {
      toast({
        title: '加载失败',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (rule: PointsRule) => {
    setForm(toForm(rule));
    setDialogOpen(true);
  };

  const saveRule = async () => {
    setSaving(true);
    try {
      const payload = toPayload(form);
      const res = await fetch('/api/admin/points', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || '保存积分规则失败');

      toast({ title: '保存成功', description: '积分规则已更新，后续审核将按新规则入账。' });
      setDialogOpen(false);
      await loadData();
    } catch (error) {
      toast({
        title: '保存失败',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('确认删除这条积分规则吗？已产生的积分流水不会受影响。')) return;

    try {
      const res = await fetch(`/api/admin/points?id=${id}`, { method: 'DELETE' });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error || '删除积分规则失败');

      toast({ title: '删除成功' });
      await loadData();
    } catch (error) {
      toast({
        title: '删除失败',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在加载积分规则...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-2 sm:p-4">
      <div className="flex flex-col gap-4 rounded-3xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
            <SlidersHorizontal className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-950">积分规则管理</h1>
            <p className="mt-1 text-sm text-gray-500">
              设置全局积分规则，也可以按平台或任务类目覆盖。越具体的规则优先生效。
            </p>
          </div>
        </div>

        <Button onClick={openCreate} className="bg-rose-600 hover:bg-rose-700">
          <Plus className="h-4 w-4" />
          新增规则
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">发帖奖励</CardTitle>
            <CardDescription>帖子链接审核通过后入账</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-rose-600">
            {rules.find((rule) => rule.trigger_event === 'link_approved' && !rule.platform && !rule.category_id)?.points ?? 0} 分
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">客资奖励</CardTitle>
            <CardDescription>客资初审通过后入账</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-blue-600">
            {rules.find((rule) => rule.trigger_event === 'lead_verified' && !rule.platform && !rule.category_id)?.points ?? 0} 分
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">归档奖励</CardTitle>
            <CardDescription>最终完成后的额外奖励</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600">
            {rules.find((rule) => rule.trigger_event === 'lead_completed' && !rule.platform && !rule.category_id)?.points ?? 0} 分
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>规则列表</CardTitle>
          <CardDescription>
            平台和类目都为“全部”时就是全局规则。单个任务发布后会保留任务上的积分快照，历史流水不受新规则影响。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>规则</TableHead>
                <TableHead>触发事件</TableHead>
                <TableHead>范围</TableHead>
                <TableHead>积分</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>优先级</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{rule.name}</div>
                    {rule.description && (
                      <div className="mt-1 max-w-[280px] truncate text-xs text-gray-500">
                        {rule.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{POINTS_TRIGGER_LABELS[rule.trigger_event]}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{platformName(rule.platform)}</Badge>
                      <Badge variant="outline">{categoryName(rule.category_id)}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-rose-600">{rule.points} 分</TableCell>
                  <TableCell>
                    {rule.is_enabled ? (
                      <Badge className="bg-green-50 text-green-700 hover:bg-green-50">启用</Badge>
                    ) : (
                      <Badge variant="secondary">停用</Badge>
                    )}
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => deleteRule(rule.id)}
                      >
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? '编辑积分规则' : '新增积分规则'}</DialogTitle>
            <DialogDescription>
              建议先维护全局规则，确实需要差异化时再增加平台或类目规则。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>规则名称</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="例如：有效客资初审通过"
                />
              </div>
              <div className="space-y-2">
                <Label>触发事件</Label>
                <Select
                  value={form.trigger_event}
                  onValueChange={(value) =>
                    setForm({ ...form, trigger_event: value as PointsTriggerEvent })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(POINTS_TRIGGER_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>适用平台</Label>
                <Select
                  value={form.platform}
                  onValueChange={(value) => setForm({ ...form, platform: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>全部平台</SelectItem>
                    {platforms.map((platform) => (
                      <SelectItem key={platform.id} value={platform.id}>
                        {platform.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>适用类目</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(value) => setForm({ ...form, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>全部类目</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>积分数量</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.points}
                  onChange={(event) => setForm({ ...form, points: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
                />
              </div>
              <div className="flex items-end gap-3 rounded-lg border p-3">
                <Switch
                  checked={form.is_enabled}
                  onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })}
                />
                <div>
                  <Label>启用规则</Label>
                  <p className="text-xs text-gray-500">关闭后不会自动入账</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>规则说明</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="内部备注，说明这条规则为什么这样设置。"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={saveRule} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存规则
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
