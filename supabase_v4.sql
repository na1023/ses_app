-- ============================================================
-- v4: 案件ごとの就業時間（何時〜何時）
-- Supabase SQL Editor で実行してください。
-- ============================================================
alter table projects add column if not exists work_start text default '';
alter table projects add column if not exists work_end   text default '';
alter table projects add column if not exists work_break text default '01:00';
