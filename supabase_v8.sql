-- ============================================================
-- v8: ユーザー設定（自社の定時・締め日・時給算出の基礎）
-- Supabase SQL Editor で実行してください。
-- サーバー側の計算（精算・残業代）で参照するため DB に保存します。
-- ============================================================
create table if not exists user_settings (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  closing_type      text default 'month_end',  -- 'month_end'（月末締め）| 'day_15'（15日締め）
  standard_minutes  text default '480',        -- 自社の定時（分/日）既定=8時間
  annual_work_days  text default '240',        -- 年間所定労働日数（時給算出用）
  base_salary       text default '0',          -- 月額基本給（時給算出の基礎賃金）
  fixed_allowance   text default '0',          -- 予想給与に加える固定手当（任意）
  updated_at        text default ''
);

alter table user_settings enable row level security;
drop policy if exists "own_all" on user_settings;
create policy "own_all" on user_settings
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
