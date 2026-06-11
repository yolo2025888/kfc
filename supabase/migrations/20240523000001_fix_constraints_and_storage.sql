-- 1. 修改 tasks 表的 status 约束，增加 'ongoing' 状态
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('open', 'closed', 'archived', 'ongoing'));

-- 2. 修复 Storage 权限 (允许上传图片)
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public viewing" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'files' );

CREATE POLICY "Allow public viewing"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'files' );

-- 3. [核心修复] 创建“接单”安全函数 (RPC)
-- 这个函数允许普通用户安全地“抢单”，它会绕过RLS自动更新任务状态
CREATE OR REPLACE FUNCTION public.join_task(p_task_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- 以系统权限运行，忽略RLS
AS $$
DECLARE
  v_task_status text;
  v_new_id uuid;
BEGIN
  -- 1. 检查任务是否还是 Open
  SELECT status INTO v_task_status FROM public.tasks WHERE id = p_task_id;
  
  IF v_task_status IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task_status != 'open' THEN
    RAISE EXCEPTION '手慢了，任务已被抢！';
  END IF;

  -- 2. 插入接单记录
  INSERT INTO public.user_tasks (task_id, user_id, status)
  VALUES (p_task_id, p_user_id, 'in_progress')
  RETURNING id INTO v_new_id;

  -- 3. 更新任务状态为 'ongoing' (进行中/已接)
  UPDATE public.tasks SET status = 'ongoing' WHERE id = p_task_id;

  RETURN json_build_object('id', v_new_id);
END;
$$;