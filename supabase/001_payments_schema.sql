-- Payments commitments tracker — Phase 1 schema
-- Paste into the Supabase SQL editor and run once.

begin;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.payments_commitments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  bucket          text not null check (bucket in ('college', 'recurring', 'other')),
  amount_cents    integer not null check (amount_cents > 0),
  offset_cents    integer not null default 0,
  due_date        date not null,
  anchor_day      smallint check (anchor_day between 1 and 31),
  recurrence      text not null default 'none' check (recurrence in ('none', 'monthly', 'semester', 'annual')),
  recurrence_end  date,
  group_id        uuid,
  group_label     text,
  is_archived     boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint payments_commitments_offset_range
    check (offset_cents >= 0 and offset_cents <= amount_cents),
  -- Recurring rows must carry an anchor so month-end clamping never drifts.
  constraint payments_commitments_anchor_required
    check (recurrence = 'none' or anchor_day is not null)
);

create table public.payments_ledger (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  commitment_id     uuid not null references public.payments_commitments (id) on delete cascade,
  amount_cents      integer not null check (amount_cents >= 0),  -- 0 allowed: full-aid items can still be marked paid
  paid_on           date not null,
  covered_due_date  date not null,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index payments_commitments_user_due_idx
  on public.payments_commitments (user_id, due_date);

create index payments_ledger_user_commitment_covered_idx
  on public.payments_ledger (user_id, commitment_id, covered_due_date);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.payments_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger payments_commitments_set_updated_at
  before update on public.payments_commitments
  for each row execute function public.payments_set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: signed-in users only; anon gets nothing.
-- ---------------------------------------------------------------------------

revoke all on public.payments_commitments from anon, authenticated;
revoke all on public.payments_ledger      from anon, authenticated;

grant select, insert, update, delete on public.payments_commitments to authenticated;
grant select, insert, delete         on public.payments_ledger      to authenticated;  -- ledger is immutable: no update

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.payments_commitments enable row level security;
alter table public.payments_ledger      enable row level security;
alter table public.payments_commitments force row level security;
alter table public.payments_ledger      force row level security;

-- payments_commitments

create policy payments_commitments_select on public.payments_commitments
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy payments_commitments_insert on public.payments_commitments
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy payments_commitments_update on public.payments_commitments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy payments_commitments_delete on public.payments_commitments
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- payments_ledger
-- Insert also verifies the referenced commitment belongs to the caller:
-- FK checks bypass RLS, so without this a client could attach a ledger row
-- to someone else's commitment id.

create policy payments_ledger_select on public.payments_ledger
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy payments_ledger_insert on public.payments_ledger
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.payments_commitments c
      where c.id = commitment_id
        and c.user_id = (select auth.uid())
    )
  );

create policy payments_ledger_delete on public.payments_ledger
  for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
