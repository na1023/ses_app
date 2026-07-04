-- ============================================================
-- v5: 複数勤務セッション（間を空けた出勤・退勤）
-- Supabase SQL Editor で実行してください。
-- ============================================================
alter table daily_reports add column if not exists work_sessions text default '';
