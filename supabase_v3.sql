-- ============================================================
-- v3: 案件ごとの就業時間（定時）＋ 帰社時間 の追加
-- Supabase SQL Editor で実行してください。
-- ============================================================

-- 案件ごとの1日の就業時間（定時）。これを超えた分を残業として計算。
alter table projects add column if not exists standard_hours text default '8';

-- 帰社日の「帰社時間」。現場の稼働時間には含めず、その日の勤務時間として加算。
alter table daily_reports add column if not exists return_office_hours text default '0';
