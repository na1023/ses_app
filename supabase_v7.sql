-- ============================================================
-- v7: 案件ごとの稼働曜日パターン（土日祝出勤の現場に対応）
-- Supabase SQL Editor で実行してください。
-- work_days: 稼働する曜日を 0=日,1=月,...,6=土 のカンマ区切り（既定=平日）
-- work_holidays: 祝日も稼働するか（'1'=する / '0'=しない）
-- ============================================================
alter table projects add column if not exists work_days text default '1,2,3,4,5';
alter table projects add column if not exists work_holidays text default '0';
