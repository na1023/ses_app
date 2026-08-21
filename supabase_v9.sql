-- v9: 帰社日の開始/終了時刻を保存
alter table daily_reports add column if not exists return_office_start text default '';
alter table daily_reports add column if not exists return_office_end   text default '';
