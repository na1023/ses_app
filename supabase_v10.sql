-- v10: 給与レコードの残業代を法律区分ごとに保存
alter table salary_records add column if not exists overtime_inner_pay text default '0'; -- 法定内残業(100%)
alter table salary_records add column if not exists overtime_outer_pay text default '0'; -- 法定外残業(125%)
alter table salary_records add column if not exists overtime_night_pay text default '0'; -- 深夜割増(+25%)
