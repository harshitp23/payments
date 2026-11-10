import type { Friend, PaidBy, Split, SplitInput } from './types'

/** "me" or a friend id. */
export type Person = string
export const ME: Person = 'me'

/** How a row moves the balance; positive means the friend owes you. */
export function effect(s: Pick<Split, 'paid_by' | 'amount_cents'>): number {
  return s.paid_by === 'me' ? s.amount_cents : -s.amount_cents
}

/** Balance per friend id: positive = they owe you, negative = you owe them. */
export function balances(splits: Split[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of splits) m.set(s.friend_id, (m.get(s.friend_id) ?? 0) + effect(s))
  return m
}

export interface FriendSummary {
  friend: Friend
  balance: number
  history: Split[]
}

/** Friends with their balance and newest-first history; who you owe/are owed most comes first. */
export function summarize(friends: Friend[], splits: Split[]): FriendSummary[] {
  const bal = balances(splits)
  return friends
    .map((friend) => ({
      friend,
      balance: bal.get(friend.id) ?? 0,
      history: splits
        .filter((s) => s.friend_id === friend.id)
        .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at)),
    }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || a.friend.name.localeCompare(b.friend.name))
}

/** Splits total into n shares that add back up exactly; the first shares absorb leftover cents. */
export function equalShares(total: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(total / n)
  const extra = total - base * n
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0))
}

/**
 * Turns one shared bill into balance rows. Only debts involving you are recorded:
 * if you paid, each friend owes you their share; if a friend paid, you owe them yours.
 */
export function expenseRows(opts: {
  description: string
  occurred_on: string
  total_cents: number
  payer: Person
  shares: Map<Person, number>
  group_id: string
}): SplitInput[] {
  const base = {
    kind: 'expense' as const,
    description: opts.description,
    occurred_on: opts.occurred_on,
    total_cents: opts.total_cents,
    group_id: opts.group_id,
  }
  if (opts.payer === ME) {
    return [...opts.shares]
      .filter(([p, cents]) => p !== ME && cents > 0)
      .map(([friend_id, amount_cents]) => ({ ...base, friend_id, paid_by: 'me' as PaidBy, amount_cents }))
  }
  const mine = opts.shares.get(ME) ?? 0
  return mine > 0 ? [{ ...base, friend_id: opts.payer, paid_by: 'friend', amount_cents: mine }] : []
}

/** The payment that brings a balance to zero. */
export function settleUp(balance: number): { paid_by: PaidBy; amount_cents: number } | null {
  if (balance === 0) return null
  // They owe you → they pay you (money moves from friend, so it counts as "friend paid").
  return balance > 0 ? { paid_by: 'friend', amount_cents: balance } : { paid_by: 'me', amount_cents: -balance }
}
