import { NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import {
  isPointsTriggerEvent,
  normalizePoints,
  type PointsAccount,
  type PointsLedgerEntry,
} from '@/lib/points';
import { getErrorMessage } from '@/lib/utils';

export const runtime = 'edge';

type SupabaseLikeError = { message: string };
type PointsAccountRow = {
  user_id: string;
  available_points: number | string;
  lifetime_earned: number | string;
  lifetime_spent: number | string;
  updated_at: string;
};
type PointsLedgerRow = {
  id: string;
  user_id: string;
  amount: number | string;
  balance_after: number | string;
  trigger_event: string;
  source_type: string;
  source_id: string | null;
  task_id: string | null;
  user_task_id: string | null;
  lead_id: string | null;
  rule_id: string | null;
  note: string | null;
  created_at: string;
};

type AccountQuery = {
  select(columns: string): {
    eq(column: 'user_id', value: string): {
      maybeSingle(): Promise<{ data: PointsAccountRow | null; error: SupabaseLikeError | null }>;
    };
  };
};
type LedgerQuery = {
  select(columns: string): {
    eq(column: 'user_id', value: string): {
      order(
        column: 'created_at',
        options: { ascending: boolean }
      ): {
        limit(count: number): Promise<{ data: PointsLedgerRow[] | null; error: SupabaseLikeError | null }>;
      };
    };
  };
};
type PointsClient = {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: SupabaseLikeError | null;
    }>;
  };
  from(table: 'user_points_accounts'): AccountQuery;
  from(table: 'user_points_ledger'): LedgerQuery;
};

function toAccount(row: PointsAccountRow | null, userId: string): PointsAccount {
  return {
    user_id: userId,
    available_points: normalizePoints(row?.available_points ?? 0),
    lifetime_earned: normalizePoints(row?.lifetime_earned ?? 0),
    lifetime_spent: normalizePoints(row?.lifetime_spent ?? 0),
    updated_at: row?.updated_at ?? new Date(0).toISOString(),
  };
}

function toLedgerEntry(row: PointsLedgerRow): PointsLedgerEntry | null {
  if (!isPointsTriggerEvent(row.trigger_event)) return null;

  return {
    ...row,
    trigger_event: row.trigger_event,
    amount: normalizePoints(row.amount),
    balance_after: normalizePoints(row.balance_after),
  };
}

function isLedgerEntry(entry: PointsLedgerEntry | null): entry is PointsLedgerEntry {
  return entry !== null;
}

export async function GET() {
  try {
    const supabase = (await createSSRClient()) as unknown as PointsClient;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [accountRes, ledgerRes] = await Promise.all([
      supabase
        .from('user_points_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_points_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (accountRes.error) throw accountRes.error;
    if (ledgerRes.error) throw ledgerRes.error;

    return NextResponse.json({
      data: {
        account: toAccount(accountRes.data, user.id),
        ledger: (ledgerRes.data ?? []).map(toLedgerEntry).filter(isLedgerEntry),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
