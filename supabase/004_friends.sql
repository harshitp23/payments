-- Payments — Phase 4: friends & splits (who owes whom).
-- Run AFTER 003_paychecks.sql. Paste into the Supabase SQL editor and run once.
--
-- Friends are just names you keep; they don't need an account.
-- Each payments_splits row is one change to your balance with ONE friend:
--   kind = 'expense'  → a shared cost; amount_cents is the part the non-payer owes.
--   kind = 'payment'  → money handed over to settle up.
--   paid_by = 'me'    → the friend now owes you amount_cents more.
--   paid_by = 'friend'→ you now owe the friend amount_cents more.
-- One expense split with several friends is several rows sharing a group_id.

begin;

create table public.payments_friends (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table public.payments_splits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  friend_id     uuid not null references public.payments_friends (id) on delete cascade,
  kind          text not null check (kind in ('expense', 'payment')),
  paid_by       text not null check (paid_by in ('me', 'friend')),
  description   text not null,
  occurred_on   date not null,
  amount_cents  integer not null check (amount_cents > 0),
  total_cents   integer check (total_cents is null or total_cents > 0),
  group_id      uuid,
  created_at    timestamptz not null default now()
);

create index payments_splits_user_friend_idx on public.payments_splits (user_id, friend_id, occurred_on);

revoke all on public.payments_friends, public.payments_splits from anon, authenticated;
grant select, insert, update, delete on public.payments_friends, public.payments_splits to authenticated;

alter table public.payments_friends enable row level security;
alter table public.payments_friends force row level security;
alter table public.payments_splits enable row level security;
alter table public.payments_splits force row level security;

create policy payments_friends_all on public.payments_friends
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy payments_splits_all on public.payments_splits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.payments_friends f where f.id = friend_id and f.user_id = (select auth.uid()))
  );

commit;
