'use client';

import { useEffect, useState } from 'react';
import { Coins, Loader2, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  POINTS_TRIGGER_LABELS,
  type PointsAccount,
  type PointsLedgerEntry,
} from '@/lib/points';
import { getErrorMessage } from '@/lib/utils';

type PointsMeResponse = {
  data?: {
    account: PointsAccount;
    ledger: PointsLedgerEntry[];
  };
  error?: string;
};

const emptyAccount: PointsAccount = {
  user_id: '',
  available_points: 0,
  lifetime_earned: 0,
  lifetime_spent: 0,
  updated_at: new Date(0).toISOString(),
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PointsPage() {
  const [account, setAccount] = useState<PointsAccount>(emptyAccount);
  const [ledger, setLedger] = useState<PointsLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadPoints = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/points/me', { cache: 'no-store' });
        const payload = (await res.json()) as PointsMeResponse;
        if (!res.ok) throw new Error(payload.error || '加载积分失败');

        setAccount(payload.data?.account ?? emptyAccount);
        setLedger(payload.data?.ledger ?? []);
      } catch (error) {
        toast({
          title: '加载失败',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadPoints();
  }, [toast]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在加载我的积分...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-2 sm:p-4">
      <div className="rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3">
            <WalletCards className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">我的积分</h1>
            <p className="mt-1 text-sm text-white/80">审核通过后自动入账，所有变化都会记录流水。</p>
          </div>
        </div>
        <div className="mt-8">
          <div className="text-sm text-white/80">当前可用积分</div>
          <div className="mt-2 text-5xl font-black tracking-tight">{account.available_points}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              累计获得
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-emerald-600">
            {account.lifetime_earned}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-5 w-5 text-slate-500" />
              累计扣减 / 结算
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-slate-700">
            {account.lifetime_spent}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            积分流水
          </CardTitle>
          <CardDescription>最近 50 条积分变化。若对积分有疑问，可截图给客服核对。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>积分</TableHead>
                <TableHead>余额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-gray-400">
                    暂无积分流水，完成任务审核后会自动显示。
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-gray-500">
                      {formatDate(entry.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{POINTS_TRIGGER_LABELS[entry.trigger_event]}</Badge>
                    </TableCell>
                    <TableCell>{entry.note || '-'}</TableCell>
                    <TableCell className={entry.amount >= 0 ? 'font-bold text-emerald-600' : 'font-bold text-red-600'}>
                      {entry.amount >= 0 ? '+' : ''}
                      {entry.amount}
                    </TableCell>
                    <TableCell className="font-medium">{entry.balance_after}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
