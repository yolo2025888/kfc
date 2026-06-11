-- 1. 从 public.leads 表移除 proof_url 字段
ALTER TABLE public.leads
DROP COLUMN IF EXISTS proof_url;

-- 2. 向 public.user_tasks 表添加 proof_urls (文本数组) 字段
ALTER TABLE public.user_tasks
ADD COLUMN proof_urls text[] DEFAULT '{}';

-- 3. 可选：如果您希望在 RLS 策略中控制 proof_urls 字段的更新权限
-- 例如：允许用户更新自己的 user_tasks 记录（包括 proof_urls）
-- 如果之前有这样的策略，且允许 UPDATE，那么新加的字段会自动被包含。
