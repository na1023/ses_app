-- ============================================================
-- SES業務管理アプリ  フルセットアップ（新規プロジェクト用）
-- 東京リージョンで新規プロジェクトを作成し、SQL Editor に貼り付けて実行。
-- 既存の全マイグレーション（v1〜v5＋認証RLS）を1本にまとめたものです。
-- ============================================================

-- ---------- テーブル ----------
create table if not exists projects (
  id text primary key, company text default '', project_name text default '',
  status text default '参画前', start_date text default '', end_date text default '',
  memo text default ''
);
create table if not exists interviews (
  id text primary key, company text default '', project_name text default '',
  work_content text default '', attendance_content text default '', status text default '',
  interview_date text default '', memo text default ''
);
create table if not exists todos (
  id text primary key, company text default '', project_name text default '',
  task text default '', due_date text default '', progress text default '', created_at text default ''
);
create table if not exists daily_reports (
  id text primary key, date text default '', company text default '', project_name text default '',
  attendance_type text default '', start_time text default '', end_time text default '',
  break_time text default '', work_hours float8 default 0, work_content text default '',
  remarks text default '', created_at text default ''
);
create table if not exists salary_records (
  id text primary key, year_month text default '',
  basic_salary text default '0', skill_allowance text default '0', qualification_allowance text default '0',
  commute_allowance text default '0', expense_reimbursement text default '0', other_expense text default '0',
  transport_allowance text default '0', overtime_pay text default '0',
  health_insurance text default '0', nursing_insurance text default '0', pension text default '0',
  employment_insurance text default '0', income_tax text default '0', resident_tax text default '0',
  memo text default '', created_at text default ''
);
create table if not exists leave_grants (
  id text primary key, grant_date text default '', days text default '0', memo text default '', created_at text default ''
);
create table if not exists settlement_notes (
  id text primary key, project_id text default '', year_month text default '', reason text default '', created_at text default ''
);

-- ---------- 追加列（v2〜v5） ----------
alter table projects       add column if not exists status text default '参画前';
alter table projects       add column if not exists min_hours text default '';
alter table projects       add column if not exists max_hours text default '';
alter table projects       add column if not exists standard_hours text default '8';
alter table projects       add column if not exists work_start text default '';
alter table projects       add column if not exists work_end   text default '';
alter table projects       add column if not exists work_break text default '01:00';
alter table projects       add column if not exists work_days text default '1,2,3,4,5';
alter table projects       add column if not exists work_holidays text default '0';
alter table daily_reports  add column if not exists late_early_time text default '0';
alter table daily_reports  add column if not exists return_office_hours text default '0';
alter table daily_reports  add column if not exists work_sessions text default '';
alter table salary_records add column if not exists deduction_amount text default '0';
alter table salary_records add column if not exists salary_type      text default '給与';
alter table salary_records add column if not exists tax_adjustment   text default '0';

-- ---------- user_id + RLS ----------
alter table daily_reports   add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table projects        add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table interviews      add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table todos           add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table salary_records  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table leave_grants    add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table settlement_notes add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table daily_reports   enable row level security;
alter table projects        enable row level security;
alter table interviews      enable row level security;
alter table todos           enable row level security;
alter table salary_records  enable row level security;
alter table leave_grants    enable row level security;
alter table settlement_notes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['daily_reports','projects','interviews','todos','salary_records','leave_grants','settlement_notes']
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

-- ---------- 既存データを取り込んだ後、自分のアカウントに紐づける場合 ----------
-- （CSVインポート後に実行。1アカウント運用を想定）
-- do $$
-- declare uid uuid;
-- begin
--   select id into uid from auth.users order by created_at asc limit 1;
--   update daily_reports  set user_id = uid where user_id is null;
--   update projects       set user_id = uid where user_id is null;
--   update interviews     set user_id = uid where user_id is null;
--   update todos          set user_id = uid where user_id is null;
--   update salary_records set user_id = uid where user_id is null;
--   update leave_grants   set user_id = uid where user_id is null;
-- end $$;
