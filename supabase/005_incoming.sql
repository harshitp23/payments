-- Payments — Phase 5: money coming back (refunds, returns, transfers you're owed).
-- Run AFTER 004_friends.sql. Paste into the Supabase SQL editor and run once.
-- received_on is null while you're still waiting; set when you tick it off.

begin;

create table public.payments_incoming (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description   text not null check (length(trim(description)) > 0),
  source        text,
  amount_cents  integer not null check (amount_cents > 0),
  expected_on   date,
  received_on   date,
  created_at    timestamptz not null default now()
);

create index payments_incoming_user_idx on public.payments_incoming (user_id, received_on);

revoke all on public.payments_incoming from anon, authenticated;
grant select, insert, update, delete on public.payments_incoming to authenticated;

alter table public.payments_incoming enable row level security;
alter table public.payments_incoming force row level security;

create policy payments_incoming_all on public.payments_incoming
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
