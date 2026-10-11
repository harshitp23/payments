-- Payments — Phase 3: individual paychecks.
-- Run AFTER 002_semesters_trips_income.sql. Paste into the Supabase SQL editor and run once.
--
-- payments_income now only holds what you EXPECT per month. What you actually
-- received is the sum of the paychecks dated in that month.

begin;

create table public.payments_paychecks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source        text,
  paid_on       date not null,
  amount_cents  integer not null check (amount_cents > 0),
  notes         text,
  created_at    timestamptz not null default now()
);

create index payments_paychecks_user_date_idx on public.payments_paychecks (user_id, paid_on);

-- Carry over any "received" amounts already ticked off, as one paycheck on the 1st.
insert into public.payments_paychecks (user_id, source, paid_on, amount_cents)
select user_id, source, month, received_cents
from public.payments_income
where received_cents > 0;

alter table public.payments_income drop column received_cents;

revoke all on public.payments_paychecks from anon, authenticated;
grant select, insert, update, delete on public.payments_paychecks to authenticated;

alter table public.payments_paychecks enable row level security;
alter table public.payments_paychecks force row level security;

create policy payments_paychecks_all on public.payments_paychecks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
