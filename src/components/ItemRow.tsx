import { useState, type FormEvent } from 'react'
import * as api from '../api'
import { centsToInput, formatCents, parseCents } from '../money'
import { formatDate, relativeDays, type Occurrence } from '../schedule'
import { useStore } from '../store'
import type { Commitment } from '../types'

const ICONS: Record<string, string> = {
  college: '🎓',
  stay: '🏠',
  subscription: '🔁',
  estimate: '🛍️',
  other: '📌',
  cab: '🚕',
  travel: '✈️',
  flight: '✈️',
  train: '🚆',
  food: '🍜',
  activities: '🎟️',
  shopping: '🛍️',
  gifts: '🎁',
}

export function itemIcon(c: Commitment): string {
  const cat = c.category?.toLowerCase()
  if (cat && ICONS[cat]) return ICONS[cat]
  if (c.bucket === 'trip' && cat === 'stay') return '🏨'
  return ICONS[c.bucket] ?? '📌'
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${s}`
}

export function scheduleSummary(c: Commitment, today: string): string {
  const until = c.recurrence_end ? ` · until ${formatDate(c.recurrence_end, today)}` : ''
  switch (c.recurrence) {
    case 'none':
      return formatDate(c.due_date, today)
    case 'monthly':
      return `Monthly on the ${ordinal(c.anchor_day ?? 1)}${until}`
    case 'semester':
      return `Every 6 months${until}`
    case 'annual':
      return `Yearly${until}`
  }
}

interface Props {
  commitment: Commitment
  /** Occurrences of this commitment inside the range the parent view covers. */
  occurrences: Occurrence[]
  onEdit: () => void
  /** Extra text under the name (defaults to the schedule summary). */
  sub?: string
}

export default function ItemRow({ commitment: c, occurrences, onEdit, sub }: Props) {
  const { today } = useStore()
  const [open, setOpen] = useState(false)

  const total = occurrences.reduce((s, o) => s + o.netCents, 0)
  const next = occurrences.find((o) => o.status !== 'paid')
  const allPaid = occurrences.length > 0 && !next
  const multi = occurrences.length > 1
  const paidCount = occurrences.filter((o) => o.status === 'paid').length

  return (
    <li className={`item ${next?.status === 'overdue' ? 'is-overdue' : ''} ${allPaid ? 'is-paid' : ''}`}>
      <div className="item-row">
        <div className="item-icon" aria-hidden>
          {itemIcon(c)}
        </div>
        <div className="item-body">
          <div className="item-title">{c.name}</div>
          <div className="item-sub">
            {sub ?? scheduleSummary(c, today)}
            {c.offset_cents > 0 && <span className="tag good">−{formatCents(c.offset_cents)} aid</span>}
          </div>
        </div>
        <div className="item-amount">
          <div className="amount">{formatCents(total)}</div>
          {multi && (
            <div className="item-sub">
              {occurrences.length} × {formatCents(occurrences[0].netCents)}
            </div>
          )}
        </div>
        <div className="item-status">
          {allPaid ? (
            <span className="pill paid">{c.bucket === 'subscription' ? 'Charged' : 'Paid'}</span>
          ) : next ? (
            <span className={`pill ${next.status}`} title={formatDate(next.dueDate, today)}>
              {next.status === 'overdue' ? 'Overdue' : next.auto ? 'Renews' : 'Due'} {relativeDays(next.dueDate, today)}
            </span>
          ) : (
            <span className="pill muted">Nothing in range</span>
          )}
        </div>
        <div className="item-actions">
          {next && !next.auto && <PayButton occ={next} />}
          {multi && (
            <button className="ghost small" onClick={() => setOpen(!open)} aria-expanded={open}>
              {paidCount}/{occurrences.length} {open ? '▴' : '▾'}
            </button>
          )}
          <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${c.name}`} title="Edit">
            ✎
          </button>
        </div>
      </div>

      {!multi && occurrences[0] && <Entries occ={occurrences[0]} />}

      {multi && open && (
        <ul className="occ-list">
          {occurrences.map((o) => (
            <li key={o.dueDate} className="occ">
              <span className="occ-date">{formatDate(o.dueDate, today)}</span>
              <span className="occ-amt">{formatCents(o.netCents)}</span>
              <span className={`pill ${o.status}`}>{o.status === 'paid' && o.auto ? 'charged' : o.status}</span>
              <span className="spacer" />
              {o.status !== 'paid' && !o.auto && <PayButton occ={o} />}
              <Entries occ={o} inline />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** "Mark paid" records the remaining amount today; the caret opens a custom amount/date form. */
export function PayButton({ occ }: { occ: Occurrence }) {
  const { today, run } = useStore()
  const [custom, setCustom] = useState(false)
  const [amount, setAmount] = useState(centsToInput(occ.remainingCents))
  const [paidOn, setPaidOn] = useState(today)
  const [busy, setBusy] = useState(false)

  async function pay(amountCents: number, date: string) {
    setBusy(true)
    const ok = await run(() =>
      api.addPayment({
        commitment_id: occ.commitment.id,
        amount_cents: amountCents,
        paid_on: date,
        covered_due_date: occ.dueDate,
      }),
    )
    setBusy(false)
    if (ok) setCustom(false)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const cents = parseCents(amount)
    if (cents !== null) pay(cents, paidOn)
  }

  if (custom) {
    return (
      <form className="payform" onSubmit={submit}>
        <input aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" size={8} />
        <input aria-label="Paid on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
        <button type="submit" className="primary small" disabled={busy || parseCents(amount) === null}>
          Save
        </button>
        <button type="button" className="ghost small" onClick={() => setCustom(false)}>
          Cancel
        </button>
      </form>
    )
  }

  return (
    <span className="split-btn">
      <button className="primary small" disabled={busy} onClick={() => pay(occ.remainingCents, today)}>
        {busy ? '…' : occ.paidCents > 0 ? 'Pay rest' : 'Mark paid'}
      </button>
      <button
        className="primary small caret"
        onClick={() => setCustom(true)}
        aria-label="Record a different amount or date"
        title="Different amount or date"
      >
        ▾
      </button>
    </span>
  )
}

function Entries({ occ, inline }: { occ: Occurrence; inline?: boolean }) {
  const { today, run } = useStore()
  if (occ.entries.length === 0) return null
  return (
    <div className={inline ? 'entries inline' : 'entries'}>
      {occ.entries.map((e) => (
        <span key={e.id} className="entry">
          Paid {formatCents(e.amount_cents)} on {formatDate(e.paid_on, today)}
          <button className="link" onClick={() => run(() => api.deletePayment(e.id))}>
            undo
          </button>
        </span>
      ))}
    </div>
  )
}
