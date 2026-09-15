-- v11: 半休で有給を消化しないフラグ
-- '1' = 有給を使わない（無給の半休など） / '0' or NULL = 通常どおり消化
alter table daily_reports
  add column if not exists no_leave_consume text default '0';
