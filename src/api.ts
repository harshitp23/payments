import { supabase } from './supabase'
import type {
  Commitment,
  CommitmentInput,
  Income,
  IncomeInput,
  IsoDate,
  LedgerEntry,
  Semester,
  SemesterInput,
  Trip,
  TripInput,
} from './types'

// user_id is never sent: every table defaults it to auth.uid() and RLS enforces it.

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export interface AllData {
  semesters: Semester[]
  trips: Trip[]
  commitments: Commitment[]
  ledger: LedgerEntry[]
  income: Income[]
}

export async function fetchAll(): Promise<AllData> {
  const [semesters, trips, commitments, ledger, income] = await Promise.all([
    supabase.from('payments_semesters').select('*').order('start_date'),
    supabase.from('payments_trips').select('*').order('start_date'),
    supabase.from('payments_commitments').select('*').order('due_date'),
    supabase.from('payments_ledger').select('*').order('paid_on'),
    supabase.from('payments_income').select('*').order('month'),
  ])
  return {
    semesters: check(semesters),
    trips: check(trips),
    commitments: check(commitments),
    ledger: check(ledger),
    income: check(income),
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
