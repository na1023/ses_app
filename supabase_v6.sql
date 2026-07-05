-- ============================================================
-- v6: 精算の理由メモ（月×案件ごとに、下限割れ/上限超過などの理由を記録）
-- Supabase SQL Editor で実行してください。
-- ============================================================
create table if not exists settlement_notes (
  id         text primary key,   -- projectId_YYYY-MM の形式
  project_id text default '',
  year_month text default '',
  reason     text default '',
  user_id    uuid references auth.users(id) on delete cascade,
  created_at text default ''
);

alter table settlement_notes enable row level security;

drop policy if exists "own_select" on settlement_notes;
drop policy if exists "own_insert" on settlement_notes;
drop policy if exists "own_update" on settlement_notes;
drop policy if exists "own_delete" on settlement_notes;
create policy "own_select" on settlement_notes for select using (auth.uid() = user_id);
create policy "own_insert" on settlement_notes for insert with check (auth.uid() = user_id);
create policy "own_update" on settlement_notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_delete" on settlement_notes for delete using (auth.uid() = user_id);
