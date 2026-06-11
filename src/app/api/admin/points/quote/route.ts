import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth/admin';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { isPointsTriggerEvent, normalizePoints } from '@/lib/points';
import { getErrorMessage } from '@/lib/utils';

export const runtime = 'edge';

type SupabaseLikeError = { message: string };
type ResolveRuleRow = {
  id: string;
  points: number | string;
} | null;
type PointsQuoteClient = {
  rpc(
    fn: 'resolve_points_rule',
    args: { p_trigger_event: string; p_platform: string | null; p_category_id: string | null }
  ): Promise<{ data: ResolveRuleRow; error: SupabaseLikeError | null }>;
};

export async function GET(req: Request) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json(
        { error: 'Unauthorized: Only administrators can perform this action.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const triggerEvent = searchParams.get('trigger_event') ?? 'link_approved';
    const platform = searchParams.get('platform');
    const categoryId = searchParams.get('category_id');

    if (!isPointsTriggerEvent(triggerEvent)) {
      return NextResponse.json({ error: 'Invalid trigger event' }, { status: 400 });
    }

    const supabase = createServerAdminClient() as unknown as PointsQuoteClient;
    const { data, error } = await supabase.rpc('resolve_points_rule', {
      p_trigger_event: triggerEvent,
      p_platform: platform || null,
      p_category_id: categoryId || null,
    });

    if (error) throw error;

    return NextResponse.json({
      data: {
        rule_id: data?.id ?? null,
        points: normalizePoints(data?.points ?? 0),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
