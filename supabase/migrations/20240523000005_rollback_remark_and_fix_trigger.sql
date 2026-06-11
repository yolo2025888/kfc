-- 确保 remark 字段存在，因为 API Route 将手动插入
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS remark text NULL;
-- 确保 full_name 字段允许 NULL
ALTER TABLE public.profiles ALTER COLUMN full_name DROP NOT NULL;
-- 确保 role 字段有默认值 'user' (因为 API Route 会手动插入)
-- 确保 role 字段允许 NULL (如果 API Route 没提供的话)
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;


-- 彻底简化 handle_new_user() 触发器函数，只插入最基本的 id 和 email
-- 其他字段由 API Route 手动插入/更新
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (
    new.id, 
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET -- 仍保留 ON CONFLICT DO UPDATE，但只更新 email
    email = EXCLUDED.email,
    updated_at = NOW(); -- 确保 updated_at 字段被更新
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 重新绑定 Trigger (确保函数更新后生效)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();