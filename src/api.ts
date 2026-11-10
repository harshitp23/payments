import { supabase } from './supabase'
import type {
  Commitment,
  CommitmentInput,
  Friend,
  Incoming,
  IncomingInput,
  Income,
  IncomeInput,
  IsoDate,
  LedgerEntry,
  Paycheck,
  PaycheckInput,
  Semester,
  SemesterInput,
  Split,
  SplitInput,
  Trip,
  TripInput,
} from './types'

// user_id is never sent: every table defaults it to auth.uid() and RLS enforces it.

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** Like check, but a table that doesn't exist yet (migration not run) reads as empty. */
function optional<T>(res: { data: T[] | null; error: { message: string; code?: string } | null }): T[] {
  if (res.error && (res.error.code === 'PGRST205' || res.error.code === '42P01')) return []
  return check(res)
}

export interface AllData {
  semesters: Semester[]
  trips: Trip[]
  commitments: Commitment[]
  ledger: LedgerEntry[]
  income: Income[]
  paychecks: Paycheck[]
  friends: Friend[]
  splits: Split[]
  incoming: Incoming[]
}

export async function fetchAll(): Promise<AllData> {
  const [semesters, trips, commitments, ledger, income, paychecks, friends, splits, incoming] = await Promise.all([
    supabase.from('payments_semesters').select('*').order('start_date'),
    supabase.from('payments_trips').select('*').order('start_date'),
    supabase.from('payments_commitments').select('*').order('due_date'),
    supabase.from('payments_ledger').select('*').order('paid_on'),
    supabase.from('payments_income').select('*').order('month'),
    supabase.from('payments_paychecks').select('*').order('paid_on'),
    supabase.from('payments_friends').select('*').order('name'),
    supabase.from('payments_splits').select('*').order('occurred_on'),
    supabase.from('payments_incoming').select('*').order('created_at'),
  ])
  return {
    semesters: check(semesters),
    trips: check(trips),
    commitments: check(commitments),
    ledger: check(ledger),
    income: check(income),
    paychecks: check(paychecks),
    friends: optional(friends),
    splits: optional(splits),
    incoming: optional(incoming),
  }
}

// Semesters

export async function saveSemester(input: SemesterInput, id?: string): Promise<void> {
  const q = supabase.from('payments_semesters')
  check(await (id ? q.update(input).eq('id', id) : q.insert(input)))
}

export async function deleteSemester(id: string): Promise<void> {
  check(await supabase.from('payments_semesters').delete().eq('id', id))
}

// Trips

export async function saveTrip(input: TripInput, id?: string): Promise<void> {
  const q = supabase.from('payments_trips')
  check(await (id ? q.update(input).eq('id', id) : q.insert(input)))
}

export async function deleteTrip(id: string): Promise<void> {
  check(await supabase.from('payments_trips').delete().eq('id', id))
}

// Commitments

export async function saveCommitment(input: CommitmentInput, id?: string): Promise<void> {
  const q = supabase.from('payments_commitments')
  check(await (id ? q.update(input).eq('id', id) : q.insert(input)))
}

export async function updateCommitment(
  id: string,
  patch: Partial<CommitmentInput> & { is_archived?: boolean },
): Promise<void> {
  check(await supabase.from('payments_commitments').update(patch).eq('id', id))
}

export async function deleteCommitment(id: string): Promise<void> {
  check(await supabase.from('payments_commitments').delete().eq('id', id))
}

// Ledger

export async function addPayment(entry: {
  commitment_id: string
  amount_cents: number
  paid_on: IsoDate
  covered_due_date: IsoDate
}): Promise<void> {
  check(await supabase.from('payments_ledger').insert(entry))
}

export async function deletePayment(id: string): Promise<void> {
  check(await supabase.from('payments_ledger').delete().eq('id', id))
}

// Income

/** Inserts or overwrites the rows for each (source, month). */
export async function upsertIncome(rows: IncomeInput[]): Promise<void> {
  check(await supabase.from('payments_income').upsert(rows, { onConflict: 'user_id,source,month' }))
}

export async function updateIncome(id: string, patch: Partial<IncomeInput>): Promise<void> {
  check(await supabase.from('payments_income').update(patch).eq('id', id))
}

export async function deleteIncome(id: string): Promise<void> {
  check(await supabase.from('payments_income').delete().eq('id', id))
}

// Paychecks

export async function savePaycheck(input: PaycheckInput, id?: string): Promise<void> {
  const q = supabase.from('payments_paychecks')
  check(await (id ? q.update(input).eq('id', id) : q.insert(input)))
}

export async function deletePaycheck(id: string): Promise<void> {
  check(await supabase.from('payments_paychecks').delete().eq('id', id))
}

// Friends & splits

export async function addFriend(name: string): Promise<Friend> {
  return check(await supabase.from('payments_friends').insert({ name }).select().single())
}

export async function renameFriend(id: string, name: string): Promise<void> {
  check(await supabase.from('payments_friends').update({ name }).eq('id', id))
}

/** Also deletes the friend's whole history (on delete cascade). */
export async function deleteFriend(id: string): Promise<void> {
  check(await supabase.from('payments_friends').delete().eq('id', id))
}

export async function addSplits(rows: SplitInput[]): Promise<void> {
  if (rows.length) check(await supabase.from('payments_splits').insert(rows))
}

export async function updateSplit(id: string, patch: Partial<SplitInput>): Promise<void> {
  check(await supabase.from('payments_splits').update(patch).eq('id', id))
}

export async function deleteSplit(id: string): Promise<void> {
  check(await supabase.from('payments_splits').delete().eq('id', id))
}

// Money coming back (refunds, returns, transfers)

export async function addIncoming(input: IncomingInput): Promise<void> {
  check(await supabase.from('payments_incoming').insert(input))
}

export async function updateIncoming(id: string, patch: Partial<IncomingInput>): Promise<void> {
  check(await supabase.from('payments_incoming').update(patch).eq('id', id))
}

export async function deleteIncoming(id: string): Promise<void> {
  check(await supabase.from('payments_incoming').delete().eq('id', id))
}
