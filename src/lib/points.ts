export type PointsTriggerEvent =
  | 'link_approved'
  | 'lead_verified'
  | 'lead_completed'
  | 'manual_adjust';

export type PointsRule = {
  id: string;
  name: string;
  trigger_event: PointsTriggerEvent;
  platform: string | null;
  category_id: string | null;
  points: number;
  is_enabled: boolean;
  priority: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type PointsRuleInput = {
  id?: string;
  name: string;
  trigger_event: PointsTriggerEvent;
  platform?: string | null;
  category_id?: string | null;
  points: number;
  is_enabled: boolean;
  priority?: number;
  description?: string | null;
};

export type PointsAccount = {
  user_id: string;
  available_points: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string;
};

export type PointsLedgerEntry = {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  trigger_event: PointsTriggerEvent;
  source_type: string;
  source_id: string | null;
  task_id: string | null;
  user_task_id: string | null;
  lead_id: string | null;
  rule_id: string | null;
  note: string | null;
  created_at: string;
};

export const POINTS_TRIGGER_LABELS: Record<PointsTriggerEvent, string> = {
  link_approved: '发帖链接审核通过',
  lead_verified: '客资初审通过',
  lead_completed: '客资最终归档',
  manual_adjust: '人工调整',
};

export function isPointsTriggerEvent(value: string): value is PointsTriggerEvent {
  return value in POINTS_TRIGGER_LABELS;
}

export function normalizePoints(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}
