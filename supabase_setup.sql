  -- ============================================================
  -- SES業務管理アプリ  Supabase テーブル作成スクリプト
  -- supabase.com の SQL Editor に貼り付けて実行してください
  -- ============================================================

  -- 案件
  create table if not exists projects (
    id           text primary key,
    company      text default '',
    project_name text default '',
    status       text default '参画前',
    start_date   text default '',
    end_date     text default '',
    memo         text default ''
  );

  -- 既存テーブルへの列追加（すでにテーブルがある場合）
  alter table projects add column if not exists status text default '参画前';

  -- 面談
  create table if not exists interviews (
    id                  text primary key,
    company             text default '',
    project_name        text default '',
    work_content        text default '',
    attendance_content  text default '',
    status              text default '',
    interview_date      text default '',
    memo                text default ''
  );

  -- ToDo
  create table if not exists todos (
    id           text primary key,
    company      text default '',
    project_name text default '',
    task         text default '',
    due_date     text default '',
    progress     text default '',
    created_at   text default ''
  );

  -- 日報
  create table if not exists daily_reports (
    id              text primary key,
    date            text default '',
    company         text default '',
    project_name    text default '',
    attendance_type text default '',
    start_time      text default '',
    end_time        text default '',
    break_time      text default '',
    work_hours      float8 default 0,
    work_content    text default '',
    remarks         text default '',
    created_at      text default ''
  );

  -- 給与記録
  create table if not exists salary_records (
    id                       text primary key,
    year_month               text default '',
    company                  text default '',
    basic_salary             text default '0',
    skill_allowance          text default '0',
    qualification_allowance  text default '0',
    commute_allowance        text default '0',
    expense_reimbursement    text default '0',
    other_expense            text default '0',
    transport_allowance      text default '0',
    overtime_pay             text default '0',
    health_insurance         text default '0',
    nursing_insurance        text default '0',
    pension                  text default '0',
    employment_insurance     text default '0',
    income_tax               text default '0',
    resident_tax             text default '0',
    memo                     text default '',
    created_at               text default ''
  );

  -- Row Level Security を無効化（個人利用のため）
  alter table projects       disable row level security;
  alter table interviews     disable row level security;
  alter table todos          disable row level security;
  alter table daily_reports  disable row level security;
  alter table salary_records disable row level security;
