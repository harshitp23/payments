-- Payments — Phase 2: semesters, trips, income, and richer commitment buckets.
-- Run AFTER 001_payments_schema.sql. Paste into the Supabase SQL editor and run once.

begin;

-- ---------------------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------------------

create table public.payments_semesters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),

  constraint payments_semesters_range check (end_date >= start_date)
);

create table public.payments_trips (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (length(btrim(name)) > 0),
  start_date   date not null,
  end_date     date,
  notes        text,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),

  constraint payments_trips_range check (end_date is null or end_date >= start_date)
);

-- One row per income source per month. amount_cents is the estimate;
-- received_cents is filled in once the money actually lands.
create table public.payments_income (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source          text not null check (length(btrim(source)) > 0),
  month           date not null check (extract(day from month) = 1),
  amount_cents    integer not null check (amount_cents >= 0),
  received_cents  integer check (received_cents >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint payments_income_source_month_key unique (user_id, source, month)
);

-- ---------------------------------------------------------------------------
-- Commitments: link to semester / trip, new buckets, free-form category
-- ---------------------------------------------------------------------------

alter table public.payments_commitments
  add column semester_id uuid references public.payments_semesters (id) on delete cascade,
  add column trip_id     uuid references public.payments_trips (id) on delete cascade,
  add column category    text;

alter table public.payments_commitments drop constraint payments_commitments_bucket_check;
update public.payments_commitments set bucket = 'subscription' where bucket = 'recurring';
alter table public.payments_commitments
  add constraint payments_commitments_bucket_check
    check (bucket in ('college', 'stay', 'subscription', 'trip', 'estimate', 'other')),
  add constraint payments_commitments_trip_link
    check ((bucket = 'trip') = (trip_id is not null));

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index payments_commitments_semester_idx on public.payments_commitments (semester_id);
create index payments_commitments_trip_idx     on public.payments_commitments (trip_id);
create index payments_semesters_user_idx       on public.payments_semesters (user_id, start_date);
create index payments_trips_user_idx           on public.payments_trips (user_id, start_date);
create index payments_income_user_month_idx    on public.payments_income (user_id, month);

create trigger payments_income_set_updated_at
  before update on public.payments_income
  for each row execute function public.payments_set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on public.payments_semesters from anon, authenticated;
revoke all on public.payments_trips     from anon, authenticated;
revoke all on public.payments_income    from anon, authenticated;

grant select, insert, update, delete on public.payments_semesters to authenticated;
grant select, insert, update, delete on public.payments_trips     to authenticated;
grant select, insert, update, delete on public.payments_income    to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.payments_semesters enable row level security;
alter table public.payments_trips     enable row level security;
alter table public.payments_income    enable row level security;
alter table public.payments_semesters force row level security;
alter table public.payments_trips     force row level security;
alter table public.payments_income    force row level security;

create policy payments_semesters_all on public.payments_semesters
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy payments_trips_all on public.payments_trips
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy payments_income_all on public.payments_income
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Commitments may only link to the caller's own semester / trip (FK checks
-- bypass RLS, so this has to be enforced in the policy).
drop policy payments_commitments_insert on public.payments_commitments;
drop policy payments_commitments_update on public.payments_commitments;

create policy payments_commitments_insert on public.payments_commitments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (semester_id is null or exists (
      select 1 from public.payments_semesters s
      where s.id = semester_id and s.user_id = (select auth.uid())))
    and (trip_id is null or exists (
      select 1 from public.payments_trips t
      where t.id = trip_id and t.user_id = (select auth.uid())))
  );

create policy payments_commitments_update on public.payments_commitments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (semester_id is null or exists (
      select 1 from public.payments_semesters s
      where s.id = semester_id and s.user_id = (select auth.uid())))
    and (trip_id is null or exists (
      select 1 from public.payments_trips t
      where t.id = trip_id and t.user_id = (select auth.uid())))
  );

commit;
