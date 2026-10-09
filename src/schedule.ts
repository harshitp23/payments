import type { Commitment, IsoDate, LedgerEntry, Recurrence } from './types'

// Dates are handled as plain Y/M/D so local time zones never shift a due date.

export function parseIso(d: IsoDate): { y: number; m: number; day: number } {
  const [y, m, day] = d.split('-').map(Number)
  return { y, m: m - 1, day }
}

export function toIso(y: number, m: number, day: number): IsoDate {
  return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
}

export function todayIso(): IsoDate {
  const now = new Date()
  return toIso(now.getFullYear(), now.getMonth(), now.getDate())
}

export function addDays(d: IsoDate, n: number): IsoDate {
  const { y, m, day } = parseIso(d)
  const t = new Date(Date.UTC(y, m, day + n))
  return toIso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())
}

const STEP_MONTHS: Record<Exclude<Recurrence, 'none'>, number> = {
  monthly: 1,
  semester: 6,
  annual: 12,
}

/**
 * Due date of the nth occurrence (n = 0 is the base date's month). Always
 * computed from the base date + anchor day, never from the previous occurrence,
 * so a 31st anchor gives Feb 28 then Mar 31 rather than drifting to the 28th.
 */
export function nthDueDate(base: IsoDate, anchorDay: number, stepMonths: number, n: number): IsoDate {
  const { y, m } = parseIso(base)
  const total = m + stepMonths * n
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  return toIso(ny, nm, Math.min(anchorDay, daysInMonth(ny, nm)))
}

const MAX_OCCURRENCES = 1000

type Schedule = Pick<Commitment, 'due_date' | 'anchor_day' | 'recurrence' | 'recurrence_end'>

/** All due dates for a commitment up to and including `last`. */
export function dueDates(c: Schedule, last: IsoDate): IsoDate[] {
  if (c.recurrence === 'none') return c.due_date <= last ? [c.due_date] : []

  const step = STEP_MONTHS[c.recurrence]
  const anchor = c.anchor_day ?? parseIso(c.due_date).day
  const end = c.recurrence_end && c.recurrence_end < last ? c.recurrence_end : last
  const out: IsoDate[] = []
  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    const d = nthDueDate(c.due_date, anchor, step, n)
    if (d > end) break
    out.push(d)
  }
  return out
}

export function netCents(c: Pick<Commitment, 'amount_cents' | 'offset_cents'>): number {
  return c.amount_cents - c.offset_cents
}

export type OccurrenceStatus = 'paid' | 'partial' | 'overdue' | 'due'

export interface Occurrence {
  commitment: Commitment
  dueDate: IsoDate
  netCents: number
  paidCents: number
  remainingCents: number
  entries: LedgerEntry[]
  status: OccurrenceStatus
  /** Auto-charged (subscriptions): past dates count as paid without a ledger row. */
  auto: boolean
}

export function firstOfMonth(d: IsoDate): IsoDate {
  return d.slice(0, 8) + '01'
}

/** First-of-month dates from the month containing `from` through the month containing `to`. */
export function monthsBetween(from: IsoDate, to: IsoDate): IsoDate[] {
  const base = firstOfMonth(from)
  const end = firstOfMonth(to)
  const out: IsoDate[] = []
  for (let n = 0; n < 600; n++) {
    const d = nthDueDate(base, 1, 1, n)
    if (d > end) break
    out.push(d)
  }
  return out
}

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })
const DAY_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const DAY_YEAR_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function utc(d: IsoDate): Date {
  const { y, m, day } = parseIso(d)
  return new Date(Date.UTC(y, m, day))
}

export function formatMonth(d: IsoDate): string {
  return MONTH_FMT.format(utc(d))
}

/** "Oct 9", or "Oct 9, 2027" when not in the current year. */
export function formatDate(d: IsoDate, today: IsoDate = todayIso()): string {
  return (d.slice(0, 4) === today.slice(0, 4) ? DAY_FMT : DAY_YEAR_FMT).format(utc(d))
}

export function daysUntil(d: IsoDate, today: IsoDate): number {
  return Math.round((utc(d).getTime() - utc(today).getTime()) / 86_400_000)
}

/** "today", "tomorrow", "in 5 days", "3 days ago". */
export function relativeDays(d: IsoDate, today: IsoDate): string {
  const n = daysUntil(d, today)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

export function ledgerKey(commitmentId: string, dueDate: IsoDate): string {
  return `${commitmentId}|${dueDate}`
}

export function indexLedger(entries: LedgerEntry[]): Map<string, LedgerEntry[]> {
  const map = new Map<string, LedgerEntry[]>()
  for (const e of entries) {
    const k = ledgerKey(e.commitment_id, e.covered_due_date)
    const list = map.get(k)
    if (list) list.push(e)
    else map.set(k, [e])
  }
  return map
}

export function buildOccurrence(
  c: Commitment,
  dueDate: IsoDate,
  ledger: Map<string, LedgerEntry[]>,
  today: IsoDate,
): Occurrence {
  const entries = ledger.get(ledgerKey(c.id, dueDate)) ?? []
  const net = netCents(c)
  const auto = c.bucket === 'subscription'
  if (auto) {
    const charged = dueDate <= today
    return {
      commitment: c,
      dueDate,
      netCents: net,
      paidCents: charged ? net : 0,
      remainingCents: charged ? 0 : net,
      entries,
      status: charged ? 'paid' : 'due',
      auto,
    }
  }
  const paid = entries.reduce((s, e) => s + e.amount_cents, 0)
  const remaining = Math.max(0, net - paid)
  // Any ledger entry with nothing left owing counts as paid; this covers
  // full-aid items (net 0) that were explicitly marked paid.
  let status: OccurrenceStatus
  if (entries.length > 0 && remaining === 0) status = 'paid'
  else if (dueDate < today) status = 'overdue'
  else if (paid > 0) status = 'partial'
  else status = 'due'
  return { commitment: c, dueDate, netCents: net, paidCents: paid, remainingCents: remaining, entries, status, auto }
}

/** Occurrences of one commitment with due dates in [from, to], oldest first. */
export function occurrencesBetween(
  c: Commitment,
  from: IsoDate,
  to: IsoDate,
  ledger: Map<string, LedgerEntry[]>,
  today: IsoDate,
): Occurrence[] {
  return dueDates(c, to)
    .filter((d) => d >= from)
    .map((d) => buildOccurrence(c, d, ledger, today))
}

export function byDate(a: Occurrence, b: Occurrence): number {
  return a.dueDate.localeCompare(b.dueDate) || a.commitment.name.localeCompare(b.commitment.name)
}

export interface Totals {
  total: number
  paid: number
  remaining: number
}

export function totals(occs: Occurrence[]): Totals {
  let total = 0
  let paid = 0
  let remaining = 0
  for (const o of occs) {
    total += o.netCents
    paid += Math.min(o.paidCents, o.netCents)
    remaining += o.remainingCents
  }
  return { total, paid, remaining }
}
