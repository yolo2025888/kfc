CREATE TABLE IF NOT EXISTS public.onboarding_guide_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key TEXT NOT NULL UNIQUE CHECK (
    section_key IN ('experience', 'location', 'platforms', 'accounts', 'wechat', 'success')
  ),
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  subtitle TEXT,
  body TEXT,
  image_url TEXT,
  sop_text TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.onboarding_guide_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read onboarding guide sections"
  ON public.onboarding_guide_sections
  FOR SELECT
  USING (true);

CREATE POLICY "Admin manage onboarding guide sections"
  ON public.onboarding_guide_sections
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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_onboarding_guide_sections_updated_at
  ON public.onboarding_guide_sections;

CREATE TRIGGER update_onboarding_guide_sections_updated_at
  BEFORE UPDATE ON public.onboarding_guide_sections
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

INSERT INTO public.onboarding_guide_sections
  (section_key, sort_order, title, subtitle, body, image_url, sop_text, options)
VALUES
  (
    'experience',
    10,
    '🤔 第一步：你有做过代发吗？',
    '如实选择就行，不影响注册',
    '发帖奖励：每条作品立得5元基础奖励
客资收益：有效客资立得2元基础奖励
高额提成：后端成功获佣100-5000元回报',
    NULL,
    '不用纠结有没有经验，按真实情况选择即可。',
    '["我有做过", "我没做过"]'::jsonb
  ),
  (
    'location',
    20,
    '📍 第二步：确定您的城市 🗺️',
    '方便给你发对应的任务',
    NULL,
    NULL,
    '城市用于匹配区域任务，不会影响注册通过。',
    '["确认位置"]'::jsonb
  ),
  (
    'platforms',
    30,
    '📱 第三步：选择可代发的平台',
    NULL,
    '💰 多一个平台，多一份收入 💰',
    NULL,
    '能做哪个选哪个，后面也可以再补充。',
    '["选好了，下一步"]'::jsonb
  ),
  (
    'accounts',
    40,
    '📝 第四步：填写对应账号 ID',
    '🚨 是账号ID，不是账号昵称！必须准确！',
    NULL,
    NULL,
    '如果有多个账号，可以点 + 添加。',
    '["提交信息"]'::jsonb
  ),
  (
    'wechat',
    50,
    '💬 第五步：填写您的微信号',
    NULL,
    '用于结算现金奖励和后续任务对接',
    NULL,
    '请填写常用微信，方便客服联系和结算。',
    '["提交并获取账号", "正在提交..."]'::jsonb
  ),
  (
    'success',
    60,
    '🎉 账号分配成功 🎊',
    '👇 添加您的专属客服，方便结算 👇',
    '🚀 收益之旅',
    'https://pub-4dddd8b2f3784069b2572fc969de004f.r2.dev/qr_code.jpg',
    '⚠️ 务必截图保存，防止丢失 ⚠️',
    '["截图保存并进入系统"]'::jsonb
  )
ON CONFLICT (section_key) DO NOTHING;

INSERT INTO public.app_permissions (code, name, type, path, icon, sort_order, is_special, with_spacing)
VALUES (
  'menu:admin_onboarding_guide',
  '注册引导管理',
  'menu',
  '/app/admin/onboarding-guide',
  'FileText',
  58,
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
  AND p.code = 'menu:admin_onboarding_guide'
ON CONFLICT DO NOTHING;
