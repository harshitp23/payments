import type { AllData } from './api'
import { byDate, firstOfMonth, occurrencesBetween, type Occurrence } from './schedule'
import type { Commitment, Income, IsoDate, LedgerEntry, Paycheck, Semester } from './types'

export const EARLIEST: IsoDate = '0000-01-01'

/** The semester containing today, else the next one to start, else the latest. */
export function currentSemester(semesters: Semester[], today: IsoDate): Semester | null {
  const containing = semesters.find((s) => s.start_date <= today && today <= s.end_date)
  if (containing) return containing
  const next = semesters.filter((s) => s.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  return next ?? semesters[semesters.length - 1] ?? null
}

export interface SemesterRollup {
  college: Occurrence[]
  stay: Occurrence[]
  other: Occurrence[]
  subscriptions: Occurrence[]
  trips: Occurrence[]
  estimates: Occurrence[]
  income: Income[]
  paychecks: Paycheck[]
}

/**
 * Everything that costs or earns money in a semester:
 * - items linked to the semester: every occurrence up to its end date
 *   (tuition due before term starts still belongs to the term)
 * - subscriptions, trip items and estimates: occurrences inside the date range
 * - income rows and paychecks for months that overlap the range
 */
export function semesterRollup(
  data: AllData,
  sem: Semester,
  ledger: Map<string, LedgerEntry[]>,
  today: IsoDate,
): SemesterRollup {
  const r: SemesterRollup = { college: [], stay: [], other: [], subscriptions: [], trips: [], estimates: [], income: [], paychecks: [] }
  const live = data.commitments.filter((c) => !c.is_archived)

  for (const c of live) {
    if (c.semester_id === sem.id) {
      const list = c.bucket === 'college' ? r.college : c.bucket === 'stay' ? r.stay : r.other
      list.push(...occurrencesBetween(c, EARLIEST, sem.end_date, ledger, today))
    } else if (c.bucket === 'subscription') {
      r.subscriptions.push(...occurrencesBetween(c, sem.start_date, sem.end_date, ledger, today))
    } else if (c.bucket === 'trip') {
      r.trips.push(...occurrencesBetween(c, sem.start_date, sem.end_date, ledger, today))
    } else if (c.bucket === 'estimate') {
      r.estimates.push(...occurrencesBetween(c, sem.start_date, sem.end_date, ledger, today))
    }
  }
  const firstMonth = sem.start_date.slice(0, 8) + '01'
  r.income = data.income.filter((i) => i.month >= firstMonth && i.month <= sem.end_date)
  r.paychecks = data.paychecks.filter((p) => p.paid_on >= firstMonth && firstOfMonth(p.paid_on) <= sem.end_date)

  for (const k of ['college', 'stay', 'other', 'subscriptions', 'trips', 'estimates'] as const) r[k].sort(byDate)
  return r
}

/**
 * What needs paying soon across everything: unpaid occurrences due on or before
 * `last` (overdue included), plus upcoming subscription renewals.
 */
export function comingUp(
  commitments: Commitment[],
  ledger: Map<string, LedgerEntry[]>,
  today: IsoDate,
  last: IsoDate,
): Occurrence[] {
  const out: Occurrence[] = []
  for (const c of commitments) {
    if (c.is_archived) continue
    for (const o of occurrencesBetween(c, EARLIEST, last, ledger, today)) {
      if (o.status !== 'paid' || (o.auto && o.dueDate >= today)) out.push(o)
    }
  }
  return out.sort(byDate)
}

/** Groups occurrences by commitment, ordered by each commitment's earliest occurrence. */
export function groupByCommitment(occs: Occurrence[]): { commitment: Commitment; occurrences: Occurrence[] }[] {
  const map = new Map<string, { commitment: Commitment; occurrences: Occurrence[] }>()
  for (const o of [...occs].sort(byDate)) {
    const g = map.get(o.commitment.id)
    if (g) g.occurrences.push(o)
    else map.set(o.commitment.id, { commitment: o.commitment, occurrences: [o] })
  }
  return [...map.values()]
}

export const COLORS = {
  college: 'var(--c-college)',
  stay: 'var(--c-stay)',
  subscriptions: 'var(--c-subs)',
  trips: 'var(--c-trips)',
  estimates: 'var(--c-est)',
  other: 'var(--c-other)',
}

/** Expected income vs. the sum of paychecks actually received. */
export function incomeTotal(income: Income[], paychecks: Paycheck[]): { expected: number; received: number } {
  return {
    expected: income.reduce((s, r) => s + r.amount_cents, 0),
    received: paychecks.reduce((s, p) => s + p.amount_cents, 0),
  }
}
