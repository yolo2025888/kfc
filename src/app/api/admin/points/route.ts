import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth/admin';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import {
  isPointsTriggerEvent,
  normalizePoints,
  type PointsRule,
  type PointsRuleInput,
  type PointsTriggerEvent,
} from '@/lib/points';
import { getErrorMessage } from '@/lib/utils';

type SupabaseLikeError = { message: string };
type PlatformRow = { id: string; name: string; color: string | null };
type CategoryRow = { id: string; name: string; parent_id: string | null };
type PointsRuleRow = {
  id: string;
  name: string;
  trigger_event: string;
  platform: string | null;
  category_id: string | null;
  points: number | string;
  is_enabled: boolean;
  priority: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type PointsRuleInsert = {
  name: string;
  trigger_event: PointsTriggerEvent;
  platform: string | null;
  category_id: string | null;
  points: number;
  is_enabled: boolean;
  priority: number;
  description: string | null;
};

type PointsRuleUpdate = Partial<PointsRuleInsert>;

type TableSelectQuery<T> = {
  select(columns: string): {
    order(
      column: string,
      options?: { ascending?: boolean }
    ): Promise<{ data: T[] | null; error: SupabaseLikeError | null }>;
  };
};

type PointsRuleQuery = TableSelectQuery<PointsRuleRow> & {
  insert(record: PointsRuleInsert): {
    select(columns: string): {
      single(): Promise<{ data: PointsRuleRow | null; error: SupabaseLikeError | null }>;
    };
  };
  update(record: PointsRuleUpdate): {
    eq(column: 'id', value: string): {
      select(columns: string): {
        single(): Promise<{ data: PointsRuleRow | null; error: SupabaseLikeError | null }>;
      };
    };
  };
  delete(): {
    eq(column: 'id', value: string): Promise<{ error: SupabaseLikeError | null }>;
  };
};

type PointsAdminClient = {
  from(table: 'points_rules'): PointsRuleQuery;
  from(table: 'platforms'): TableSelectQuery<PlatformRow>;
  from(table: 'categories'): TableSelectQuery<CategoryRow>;
};

function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized: Only administrators can perform this action.' },
    { status: 403 }
  );
}

function toPointsRule(row: PointsRuleRow): PointsRule | null {
  if (!isPointsTriggerEvent(row.trigger_event)) return null;

  return {
    ...row,
    trigger_event: row.trigger_event,
    points: normalizePoints(row.points),
  };
}

function isRule(rule: PointsRule | null): rule is PointsRule {
  return rule !== null;
}

function normalizeRuleInput(input: Partial<PointsRuleInput>): PointsRuleInsert {
  const name = input.name?.trim();
  if (!name) throw new Error('规则名称不能为空');
  if (!input.trigger_event || !isPointsTriggerEvent(input.trigger_event)) {
    throw new Error('请选择有效的触发事件');
  }

  return {
    name,
    trigger_event: input.trigger_event,
    platform: input.platform || null,
    category_id: input.category_id || null,
    points: normalizePoints(input.points),
    is_enabled: input.is_enabled ?? true,
    priority: input.priority ?? 100,
    description: input.description?.trim() || null,
  };
}

export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) return unauthorized();

    const supabase = createServerAdminClient() as unknown as PointsAdminClient;
    const [rulesRes, platformsRes, categoriesRes] = await Promise.all([
      supabase.from('points_rules').select('*').order('priority', { ascending: true }),
      supabase.from('platforms').select('id, name, color').order('created_at', { ascending: true }),
      supabase.from('categories').select('id, name, parent_id').order('created_at', { ascending: true }),
    ]);

    if (rulesRes.error) throw rulesRes.error;
    if (platformsRes.error) throw platformsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;

    return NextResponse.json({
      data: {
        rules: (rulesRes.data ?? []).map(toPointsRule).filter(isRule),
        platforms: platformsRes.data ?? [],
        categories: categoriesRes.data ?? [],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isCurrentUserAdmin())) return unauthorized();

    const payload = (await req.json()) as Partial<PointsRuleInput>;
    const record = normalizeRuleInput(payload);
    const supabase = createServerAdminClient() as unknown as PointsAdminClient;
    const { data, error } = await supabase
      .from('points_rules')
      .insert(record)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ data: data ? toPointsRule(data) : null });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!(await isCurrentUserAdmin())) return unauthorized();

    const payload = (await req.json()) as Partial<PointsRuleInput>;
    if (!payload.id) return NextResponse.json({ error: '规则 ID 不能为空' }, { status: 400 });

    const record = normalizeRuleInput(payload);
    const supabase = createServerAdminClient() as unknown as PointsAdminClient;
    const { data, error } = await supabase
      .from('points_rules')
      .update(record)
      .eq('id', payload.id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ data: data ? toPointsRule(data) : null });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!(await isCurrentUserAdmin())) return unauthorized();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '规则 ID 不能为空' }, { status: 400 });

    const supabase = createServerAdminClient() as unknown as PointsAdminClient;
    const { error } = await supabase.from('points_rules').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
