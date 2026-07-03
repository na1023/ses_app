-- ============================================================
-- 既存データの引き継ぎ ＋ 精算幅（案件ごとの月間下限/上限時間）の追加
-- Supabase の SQL Editor に貼り付けて実行してください。
-- ============================================================

-- 1) 案件マスタに「精算幅」列を追加（月間の下限・上限時間）
alter table projects add column if not exists min_hours text default '';
alter table projects add column if not exists max_hours text default '';

-- 2) 既存データ（user_id が空の行）を、最初に作成されたアカウントに紐づける
--    ※ 個人利用（アカウント1つ）を想定。複数ユーザーがいる場合は下の
--       メール指定版（コメント）を使ってください。
do $$
declare uid uuid;
begin
  select id into uid from auth.users order by created_at asc limit 1;
  if uid is not null then
    update daily_reports  set user_id = uid where user_id is null;
    update projects       set user_id = uid where user_id is null;
    update interviews     set user_id = uid where user_id is null;
    update todos          set user_id = uid where user_id is null;
    update salary_records set user_id = uid where user_id is null;
    update leave_grants   set user_id = uid where user_id is null;
  end if;
end $$;

-- --- メールで明示的に指定したい場合（上を使わずこちらを使う）---
-- update daily_reports  set user_id = (select id from auth.users where email = 'あなたのメール') where user_id is null;
-- update projects       set user_id = (select id from auth.users where email = 'あなたのメール') where user_id is null;
-- update interviews     set user_id = (select id from auth.users where email = 'あなたのメール') where user_id is null;
-- update todos          set user_id = (select id from auth.users where email = 'あなたのメール') where user_id is null;
-- update salary_records set user_id = (select id from auth.users where email = 'あなたのメール') where user_id is null;
-- update leave_grants   set user_id = (select id from auth.users where email = 'あなたのメール') where user_id is null;
