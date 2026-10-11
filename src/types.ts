// Mirrors supabase/001_payments_schema.sql, 002_semesters_trips_income.sql and 003_paychecks.sql

export type Bucket = 'college' | 'stay' | 'subscription' | 'trip' | 'estimate' | 'other'
export type Recurrence = 'none' | 'monthly' | 'semester' | 'annual'

export const RECURRENCES: Recurrence[] = ['none', 'monthly', 'semester', 'annual']

/** ISO calendar date, e.g. "2026-10-09". */
export type IsoDate = string

export interface Semester {
  id: string
  user_id: string
  name: string
  start_date: IsoDate
  end_date: IsoDate
  created_at: string
}
export type SemesterInput = Pick<Semester, 'name' | 'start_date' | 'end_date'>

export interface Trip {
  id: string
  user_id: string
  name: string
  start_date: IsoDate
  end_date: IsoDate | null
  notes: string | null
  is_archived: boolean
  created_at: string
}
export type TripInput = Pick<Trip, 'name' | 'start_date' | 'end_date' | 'notes'>

export interface Commitment {
  id: string
  user_id: string
  name: string
  bucket: Bucket
  category: string | null
  amount_cents: number
  offset_cents: number
  due_date: IsoDate
  anchor_day: number | null
  recurrence: Recurrence
  recurrence_end: IsoDate | null
  semester_id: string | null
  trip_id: string | null
  group_id: string | null
  group_label: string | null
  is_archived: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

/** Columns the client writes; the rest are filled by defaults/triggers. */
export type CommitmentInput = Pick<
  Commitment,
  | 'name'
  | 'bucket'
  | 'category'
  | 'amount_cents'
  | 'offset_cents'
  | 'due_date'
  | 'anchor_day'
  | 'recurrence'
  | 'recurrence_end'
  | 'semester_id'
  | 'trip_id'
  | 'notes'
>

export interface LedgerEntry {
  id: string
  user_id: string
  commitment_id: string
  amount_cents: number
  paid_on: IsoDate
  covered_due_date: IsoDate
  created_at: string
}

export interface Income {
  id: string
  user_id: string
  source: string
  /** First day of the month, e.g. "2026-09-01". */
  month: IsoDate
  /** What you expect to earn; money actually received is tracked as paychecks. */
  amount_cents: number
  notes: string | null
  created_at: string
  updated_at: string
}
export type IncomeInput = Pick<Income, 'source' | 'month' | 'amount_cents' | 'notes'>

export interface Paycheck {
  id: string
  user_id: string
  source: string | null
  paid_on: IsoDate
  amount_cents: number
  notes: string | null
  created_at: string
}
export type PaycheckInput = Pick<Paycheck, 'source' | 'paid_on' | 'amount_cents' | 'notes'>
