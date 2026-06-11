CREATE TABLE IF NOT EXISTS public.points_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL CHECK (
    trigger_event IN ('link_approved', 'lead_verified', 'lead_completed', 'manual_adjust')
  ),
  platform TEXT REFERENCES public.platforms(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  points NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS points_rules_lookup_idx
  ON public.points_rules (trigger_event, is_enabled, platform, category_id, priority);

CREATE TABLE IF NOT EXISTS public.user_points_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  available_points NUMERIC(12, 2) NOT NULL DEFAULT 0,
  lifetime_earned NUMERIC(12, 2) NOT NULL DEFAULT 0,
  lifetime_spent NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_points_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  balance_after NUMERIC(12, 2) NOT NULL DEFAULT 0,
  trigger_event TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  user_task_id UUID REFERENCES public.user_tasks(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES public.points_rules(id) ON DELETE SET NULL,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_points_ledger_user_created_idx
  ON public.user_points_ledger (user_id, created_at DESC);

ALTER TABLE public.points_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage points rules"
  ON public.points_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super-admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super-admin', 'super_admin')
    )
  );

CREATE POLICY "Users read own points account"
  ON public.user_points_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin read all points accounts"
  ON public.user_points_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super-admin', 'super_admin')
    )
  );

CREATE POLICY "Users read own points ledger"
  ON public.user_points_ledger
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin read all points ledger"
  ON public.user_points_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super-admin', 'super_admin')
    )
  );

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_points_rules_updated_at ON public.points_rules;
CREATE TRIGGER update_points_rules_updated_at
  BEFORE UPDATE ON public.points_rules
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_points_accounts_updated_at ON public.user_points_accounts;
CREATE TRIGGER update_user_points_accounts_updated_at
  BEFORE UPDATE ON public.user_points_accounts
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE FUNCTION public.resolve_points_rule(
  p_trigger_event TEXT,
  p_platform TEXT,
  p_category_id UUID
)
RETURNS public.points_rules AS $$
DECLARE
  v_rule public.points_rules;
BEGIN
  SELECT *
  INTO v_rule
  FROM public.points_rules
  WHERE trigger_event = p_trigger_event
    AND is_enabled = true
    AND (platform IS NULL OR platform = p_platform)
    AND (category_id IS NULL OR category_id = p_category_id)
  ORDER BY
    (CASE WHEN platform IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN category_id IS NOT NULL THEN 2 ELSE 0 END) DESC,
    priority ASC,
    updated_at DESC
  LIMIT 1;

  RETURN v_rule;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.award_user_points(
  p_user_id UUID,
  p_amount NUMERIC,
  p_trigger_event TEXT,
  p_source_type TEXT,
  p_source_id UUID,
  p_task_id UUID DEFAULT NULL,
  p_user_task_id UUID DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL,
  p_rule_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_ledger_id UUID;
  v_balance NUMERIC(12, 2);
  v_idempotency_key TEXT;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN
    RETURN;
  END IF;

  v_idempotency_key := COALESCE(
    p_idempotency_key,
    p_trigger_event || ':' || p_source_type || ':' || COALESCE(p_source_id::text, p_user_id::text)
  );

  INSERT INTO public.user_points_ledger (
    user_id,
    amount,
    balance_after,
    trigger_event,
    source_type,
    source_id,
    task_id,
    user_task_id,
    lead_id,
    rule_id,
    note,
    idempotency_key,
    created_by,
    metadata
  )
  VALUES (
    p_user_id,
    p_amount,
    0,
    p_trigger_event,
    p_source_type,
    p_source_id,
    p_task_id,
    p_user_task_id,
    p_lead_id,
    p_rule_id,
    p_note,
    v_idempotency_key,
    p_created_by,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_ledger_id;

  IF v_ledger_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_points_accounts (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_points_accounts
  SET
    available_points = available_points + p_amount,
    lifetime_earned = lifetime_earned + GREATEST(p_amount, 0),
    lifetime_spent = lifetime_spent + GREATEST(-p_amount, 0),
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING available_points INTO v_balance;

  UPDATE public.user_points_ledger
  SET balance_after = COALESCE(v_balance, 0)
  WHERE id = v_ledger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.award_points_on_user_task_link()
RETURNS TRIGGER AS $$
DECLARE
  v_task public.tasks;
  v_rule public.points_rules;
BEGIN
  IF NEW.link_status = 'approved'
     AND COALESCE(OLD.link_status, '') <> 'approved' THEN
    SELECT *
    INTO v_task
    FROM public.tasks
    WHERE id = NEW.task_id;

    SELECT *
    INTO v_rule
    FROM public.resolve_points_rule('link_approved', v_task.platform, v_task.category_id);

    IF v_rule.id IS NOT NULL THEN
      PERFORM public.award_user_points(
        NEW.user_id,
        v_rule.points,
        'link_approved',
        'user_task',
        NEW.id,
        NEW.task_id,
        NEW.id,
        NULL,
        v_rule.id,
        '帖子链接审核通过',
        'points:link_approved:user_task:' || NEW.id::text,
        NULL,
        jsonb_build_object('platform', v_task.platform, 'category_id', v_task.category_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS award_points_on_user_task_link_trigger ON public.user_tasks;
CREATE TRIGGER award_points_on_user_task_link_trigger
  AFTER UPDATE OF link_status ON public.user_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_user_task_link();

CREATE OR REPLACE FUNCTION public.award_points_on_lead_status()
RETURNS TRIGGER AS $$
DECLARE
  v_task public.tasks;
  v_user_task public.user_tasks;
  v_rule public.points_rules;
  v_trigger_event TEXT;
  v_note TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'verified' THEN
    v_trigger_event := 'lead_verified';
    v_note := '客资初审通过';
  ELSIF NEW.status = 'completed' THEN
    v_trigger_event := 'lead_completed';
    v_note := '客资最终归档';
  ELSE
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_user_task
  FROM public.user_tasks
  WHERE id = NEW.user_task_id;

  SELECT *
  INTO v_task
  FROM public.tasks
  WHERE id = v_user_task.task_id;

  SELECT *
  INTO v_rule
  FROM public.resolve_points_rule(v_trigger_event, v_task.platform, v_task.category_id);

  IF v_rule.id IS NOT NULL THEN
    PERFORM public.award_user_points(
      NEW.user_id,
      v_rule.points,
      v_trigger_event,
      'lead',
      NEW.id,
      v_task.id,
      NEW.user_task_id,
      NEW.id,
      v_rule.id,
      v_note,
      'points:' || v_trigger_event || ':lead:' || NEW.id::text,
      NEW.auditor_id,
      jsonb_build_object('platform', v_task.platform, 'category_id', v_task.category_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS award_points_on_lead_status_trigger ON public.leads;
CREATE TRIGGER award_points_on_lead_status_trigger
  AFTER UPDATE OF status ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_lead_status();

INSERT INTO public.points_rules
  (name, trigger_event, platform, category_id, points, is_enabled, priority, description)
VALUES
  ('发帖链接审核通过', 'link_approved', NULL, NULL, 5, true, 100, '用户提交的帖子链接审核通过后自动入账。'),
  ('有效客资初审通过', 'lead_verified', NULL, NULL, 2, true, 100, '用户提交的客资通过初审后自动入账。'),
  ('客资最终归档奖励', 'lead_completed', NULL, NULL, 0, false, 100, '最终成交或归档后的额外奖励，默认关闭，可按业务开启。')
ON CONFLICT DO NOTHING;

INSERT INTO public.app_permissions (code, name, type, path, icon, sort_order, is_special, with_spacing)
VALUES (
  'menu:my_points',
  '我的积分',
  'menu',
  '/app/points',
  'FileText',
  26,
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_special = EXCLUDED.is_special,
  with_spacing = EXCLUDED.with_spacing;

INSERT INTO public.app_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r, public.app_permissions p
WHERE r.code IN ('user', 'admin', 'super_admin')
  AND p.code = 'menu:my_points'
ON CONFLICT DO NOTHING;

INSERT INTO public.app_permissions (code, name, type, path, icon, sort_order, is_special, with_spacing)
VALUES (
  'menu:admin_points',
  '积分规则管理',
  'menu',
  '/app/admin/points',
  'Settings2',
  59,
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_special = EXCLUDED.is_special,
  with_spacing = EXCLUDED.with_spacing;

INSERT INTO public.app_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r, public.app_permissions p
WHERE r.code IN ('admin', 'super_admin')
  AND p.code = 'menu:admin_points'
ON CONFLICT DO NOTHING;
