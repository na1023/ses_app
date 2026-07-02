-- ============================================================
-- SES業務管理アプリ  アカウント連携（認証 + RLS）セットアップ
-- Supabase の SQL Editor に貼り付けて実行してください。
--
-- 目的：各行を user_id（auth.users）に紐づけ、RLS で
--       「自分のデータは自分だけが読み書きできる」状態にする。
-- ============================================================

-- 1) 各テーブルに user_id 列を追加（auth.users を参照）
alter table daily_reports   add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table projects        add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table interviews      add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table todos           add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table salary_records  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table leave_grants    add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2) RLS を有効化
alter table daily_reports   enable row level security;
alter table projects        enable row level security;
alter table interviews      enable row level security;
alter table todos           enable row level security;
alter table salary_records  enable row level security;
alter table leave_grants    enable row level security;

-- 3) ポリシー：自分の user_id の行のみ許可（select/insert/update/delete）
--    ※ 何度でも再実行できるよう既存ポリシーを drop してから作成
do $$
declare t text;
begin
  foreach t in array array[
    'daily_reports','projects','interviews','todos','salary_records','leave_grants'
  ]
  loop
    execute format('drop policy if exists "own_select" on %I;', t);
    execute format('drop policy if exists "own_insert" on %I;', t);
    execute format('drop policy if exists "own_update" on %I;', t);
    execute format('drop policy if exists "own_delete" on %I;', t);

    execute format('create policy "own_select" on %I for select using (auth.uid() = user_id);', t);
    execute format('create policy "own_insert" on %I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "own_update" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('create policy "own_delete" on %I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ============================================================
-- 4) （任意）既存データを自分のアカウントに引き継ぐ
--    新規アカウント作成後、下記で自分の UID を確認し、
--    user_id が空の行を自分のものとして紐づけられます。
--
--    -- 自分の UID を確認：
--    -- select id, email from auth.users;
--
--    -- 例：UID を貼り付けて実行（'YOUR-UID' を置換）
--    -- update daily_reports  set user_id = 'YOUR-UID' where user_id is null;
--    -- update projects       set user_id = 'YOUR-UID' where user_id is null;
--    -- update interviews     set user_id = 'YOUR-UID' where user_id is null;
--    -- update todos          set user_id = 'YOUR-UID' where user_id is null;
--    -- update salary_records set user_id = 'YOUR-UID' where user_id is null;
--    -- update leave_grants   set user_id = 'YOUR-UID' where user_id is null;
-- ============================================================

-- 補足：Streamlit 版は service_role キーを使うため RLS を素通りします
-- （＝管理用として全データにアクセス可能）。Next.js(PWA) 版はアカウント単位で隔離されます。
