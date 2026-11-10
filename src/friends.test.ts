import { describe, expect, it } from 'vitest'
import { balances, equalShares, expenseRows, ME, settleUp } from './friends'
import type { Split } from './types'

function split(over: Partial<Split>): Split {
  return {
    id: 's',
    user_id: 'u',
    friend_id: 'a',
    kind: 'expense',
    paid_by: 'me',
    description: 'Dinner',
    occurred_on: '2026-11-01',
    amount_cents: 1000,
    total_cents: null,
    group_id: null,
    created_at: '2026-11-01T00:00:00Z',
    ...over,
  }
}

describe('equalShares', () => {
  it('adds back up to the total', () => {
    expect(equalShares(1000, 3)).toEqual([334, 333, 333])
    expect(equalShares(900, 3)).toEqual([300, 300, 300])
    expect(equalShares(500, 0)).toEqual([])
  })
})

describe('balances', () => {
  it('nets expenses and payments per friend', () => {
    const b = balances([
      split({ friend_id: 'a', paid_by: 'me', amount_cents: 3000 }),
      split({ friend_id: 'a', kind: 'payment', paid_by: 'friend', amount_cents: 1000 }),
      split({ friend_id: 'b', paid_by: 'friend', amount_cents: 2500 }),
    ])
    expect(b.get('a')).toBe(2000)
    expect(b.get('b')).toBe(-2500)
  })
})

describe('expenseRows', () => {
  const base = { description: 'Pizza', occurred_on: '2026-11-01', total_cents: 3000, group_id: 'g' }

  it('records what each friend owes when I paid', () => {
    const rows = expenseRows({
      ...base,
      payer: ME,
      shares: new Map([
        [ME, 1000],
        ['a', 1000],
        ['b', 1000],
      ]),
    })
    expect(rows.map((r) => [r.friend_id, r.paid_by, r.amount_cents])).toEqual([
      ['a', 'me', 1000],
      ['b', 'me', 1000],
    ])
  })

  it('records only my share when a friend paid', () => {
    const rows = expenseRows({
      ...base,
      payer: 'a',
      shares: new Map([
        [ME, 1200],
        ['a', 900],
        ['b', 900],
      ]),
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ friend_id: 'a', paid_by: 'friend', amount_cents: 1200 })
  })
})

describe('settleUp', () => {
  it('produces the payment that zeroes the balance', () => {
    for (const bal of [2500, -1800]) {
      const p = settleUp(bal)!
      expect(bal + (p.paid_by === 'me' ? p.amount_cents : -p.amount_cents)).toBe(0)
    }
    expect(settleUp(0)).toBeNull()
  })
})
