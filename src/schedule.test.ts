import { describe, expect, it } from 'vitest'
import { parseCents } from './money'
import { buildOccurrence, dueDates, indexLedger, monthsBetween, nthDueDate } from './schedule'
import { currentSemester } from './rollup'
import type { Commitment, LedgerEntry, Semester } from './types'

function commitment(over: Partial<Commitment>): Commitment {
  return {
    id: 'c1',
    user_id: 'u',
    name: 'Rent',
    bucket: 'stay',
    category: null,
    amount_cents: 100_000,
    offset_cents: 0,
    due_date: '2026-08-01',
    anchor_day: null,
    recurrence: 'none',
    recurrence_end: null,
    semester_id: null,
    trip_id: null,
    group_id: null,
    group_label: null,
    is_archived: false,
    notes: null,
    created_at: '',
    updated_at: '',
    ...over,
  }
}

describe('nthDueDate', () => {
  it('clamps to month end without drifting', () => {
    expect([0, 1, 2].map((n) => nthDueDate('2026-01-31', 31, 1, n))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })
  it('handles leap years and year rollover', () => {
    expect(nthDueDate('2027-12-29', 29, 2, 1)).toBe('2028-02-29')
  })
})

describe('dueDates', () => {
  it('one-time items', () => {
    expect(dueDates(commitment({}), '2026-12-31')).toEqual(['2026-08-01'])
    expect(dueDates(commitment({}), '2026-07-31')).toEqual([])
  })
  it('monthly rent stops at recurrence_end', () => {
    const c = commitment({ recurrence: 'monthly', anchor_day: 1, recurrence_end: '2026-12-15' })
    expect(dueDates(c, '2027-06-01')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01'])
  })
})

describe('buildOccurrence', () => {
  const ledger = (entries: Partial<LedgerEntry>[]) =>
    indexLedger(entries.map((e, i) => ({ id: `l${i}`, user_id: 'u', commitment_id: 'c1', amount_cents: 0, paid_on: '2026-08-01', covered_due_date: '2026-08-01', created_at: '', ...e })))

  it('nets aid off the amount and tracks partial payments', () => {
    const c = commitment({ amount_cents: 500_000, offset_cents: 200_000 })
    const o = buildOccurrence(c, '2026-08-01', ledger([{ amount_cents: 100_000 }]), '2026-07-01')
    expect(o).toMatchObject({ netCents: 300_000, paidCents: 100_000, remainingCents: 200_000, status: 'partial' })
  })
  it('marks full-aid items paid once a zero entry exists', () => {
    const c = commitment({ amount_cents: 1000, offset_cents: 1000 })
    expect(buildOccurrence(c, '2026-08-01', ledger([]), '2026-09-01').status).toBe('overdue')
    expect(buildOccurrence(c, '2026-08-01', ledger([{ amount_cents: 0 }]), '2026-09-01').status).toBe('paid')
  })
  it('treats past subscription charges as paid automatically', () => {
    const c = commitment({ bucket: 'subscription', recurrence: 'monthly', anchor_day: 1 })
    expect(buildOccurrence(c, '2026-08-01', ledger([]), '2026-09-01').status).toBe('paid')
    expect(buildOccurrence(c, '2026-10-01', ledger([]), '2026-09-01').status).toBe('due')
  })
})

describe('monthsBetween', () => {
  it('spans months inclusively across years', () => {
    expect(monthsBetween('2026-11-15', '2027-02-03')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01'])
  })
})

describe('currentSemester', () => {
  const sem = (id: string, start: string, end: string): Semester => ({ id, user_id: 'u', name: id, start_date: start, end_date: end, created_at: '' })
  const list = [sem('spring', '2026-01-01', '2026-05-31'), sem('fall', '2026-08-01', '2026-12-31')]
  it('prefers the one containing today, then the next upcoming', () => {
    expect(currentSemester(list, '2026-10-09')?.id).toBe('fall')
    expect(currentSemester(list, '2026-06-15')?.id).toBe('fall')
    expect(currentSemester(list, '2027-02-01')?.id).toBe('fall')
  })
})

describe('parseCents', () => {
  it('parses common inputs', () => {
    expect(parseCents('1,234.5')).toBe(123_450)
    expect(parseCents('$12')).toBe(1200)
    expect(parseCents('₹ 999.99')).toBe(99_999)
    expect(parseCents('abc')).toBeNull()
    expect(parseCents('1.234')).toBeNull()
  })
})
