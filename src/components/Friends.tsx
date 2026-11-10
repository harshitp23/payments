import { useMemo, useState, type FormEvent } from 'react'
import * as api from '../api'
import { equalShares, expenseRows, ME, settleUp, summarize, type FriendSummary, type Person } from '../friends'
import { centsToInput, formatCents, formatWhole, parseCents } from '../money'
import { formatDate } from '../schedule'
import { useStore } from '../store'
import type { Friend, PaidBy, Split } from '../types'
import { Empty, Modal, PageHead, Section, Stat } from './ui'

export default function Friends() {
  const { data, today, run } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const [expense, setExpense] = useState<{ friendId?: string } | null>(null)
  const [settling, setSettling] = useState<FriendSummary | null>(null)
  const [editing, setEditing] = useState<Split | null>(null)
  const [friendForm, setFriendForm] = useState<{ initial?: Friend } | null>(null)

  const people = useMemo(() => summarize(data.friends, data.splits), [data.friends, data.splits])
  const owed = people.filter((p) => p.balance > 0)
  const owe = people.filter((p) => p.balance < 0)
  const owedTotal = owed.reduce((s, p) => s + p.balance, 0)
  const oweTotal = -owe.reduce((s, p) => s + p.balance, 0)
  const net = owedTotal - oweTotal

  async function removeFriend(f: Friend) {
    if (!confirm(`Remove ${f.name}? Everything you've logged with them is deleted too.`)) return
    if (await run(() => api.deleteFriend(f.id))) setOpen(null)
  }

  return (
    <>
      <PageHead
        title="Friends"
        subtitle="Who owes who. Split a bill, then settle up when money changes hands. Your friends don't need an account."
        action={
          <button className="primary" onClick={() => setExpense({})}>
            + Add expense
          </button>
        }
      />

      <div className="stats">
        <Stat label="You're owed" value={formatCents(owedTotal)} tone="good" sub={countLabel(owed.length)} />
        <Stat label="You owe" value={formatCents(oweTotal)} tone={oweTotal > 0 ? 'bad' : 'default'} sub={countLabel(owe.length)} />
        <Stat
          label={net >= 0 ? 'Overall, you get back' : 'Overall, you pay'}
          value={formatWhole(Math.abs(net))}
          tone={net > 0 ? 'good' : net < 0 ? 'bad' : 'default'}
        />
      </div>

      {people.length === 0 ? (
        <Empty icon="🤝" title="No friends added yet">
          <p>Paid for dinner, a cab or groceries for someone? Log it here and see who owes what.</p>
          <button className="primary" onClick={() => setExpense({})}>
            Add your first expense
          </button>
        </Empty>
      ) : (
        <Section
          title="Balances"
          action={
            <button className="add-line" onClick={() => setFriendForm({})}>
              + Add friend
            </button>
          }
        >
          <ul className="items">
            {people.map((p) => {
              const isOpen = open === p.friend.id
              return (
                <li key={p.friend.id} className="item">
                  <button
                    className="friend-row"
                    onClick={() => setOpen(isOpen ? null : p.friend.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="item-icon avatar" aria-hidden>
                      {p.friend.name.trim()[0]?.toUpperCase()}
                    </span>
                    <span className="friend-main">
                      <span className="item-title">{p.friend.name}</span>
                      <span className="item-sub">
                        {p.history.length} entr{p.history.length === 1 ? 'y' : 'ies'}
                        {p.history[0] && ` · last ${formatDate(p.history[0].occurred_on, today)}`}
                      </span>
                    </span>
                    <BalanceText balance={p.balance} />
                    <span className="caret-sm">{isOpen ? '▴' : '▾'}</span>
                  </button>

                  {isOpen && (
                    <div className="friend-detail">
                      <div className="friend-actions">
                        {p.balance !== 0 && (
                          <button className="primary small" onClick={() => setSettling(p)}>
                            Settle up
                          </button>
                        )}
                        <button className="small" onClick={() => setExpense({ friendId: p.friend.id })}>
                          + Expense with {p.friend.name}
                        </button>
                        <span className="spacer" />
                        <button className="ghost small" onClick={() => setFriendForm({ initial: p.friend })}>
                          Rename
                        </button>
                        <button className="ghost small danger" onClick={() => removeFriend(p.friend)}>
                          Remove
                        </button>
                      </div>
                      {p.history.length === 0 ? (
                        <p className="muted small">Nothing logged yet.</p>
                      ) : (
                        p.history.map((s) => (
                          <button key={s.id} className="paycheck-line split-line" onClick={() => setEditing(s)}>
                            <span className="paycheck-date">{formatDate(s.occurred_on, today)}</span>
                            <span className="grow">
                              {s.kind === 'payment' ? '💸 ' : ''}
                              {s.description}
                              <span className="muted small"> · {describe(s, p.friend.name)}</span>
                            </span>
                            <span className={s.paid_by === 'me' ? 'owed-amount' : 'owe-amount'}>
                              {s.paid_by === 'me' ? '+' : '−'}
                              {formatCents(s.amount_cents)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="muted small legend-note">
            <span className="owed-amount">+</span> adds to what they owe you · <span className="owe-amount">−</span> adds to
            what you owe them (or pays down their debt)
          </p>
        </Section>
      )}

      {expense && <ExpenseForm friendId={expense.friendId} onClose={() => setExpense(null)} />}
      {settling && <SettleForm summary={settling} onClose={() => setSettling(null)} />}
      {editing && <SplitForm split={editing} onClose={() => setEditing(null)} />}
      {friendForm && <FriendForm initial={friendForm.initial} onClose={() => setFriendForm(null)} />}
    </>
  )
}

function countLabel(n: number): string {
  return n === 0 ? 'nobody' : `${n} friend${n === 1 ? '' : 's'}`
}

function BalanceText({ balance }: { balance: number }) {
  if (balance === 0) return <span className="friend-balance muted small">settled up ✓</span>
  return (
    <span className={`friend-balance ${balance > 0 ? 'owed-amount' : 'owe-amount'}`}>
      <span className="small">{balance > 0 ? 'owes you' : 'you owe'}</span> {formatCents(Math.abs(balance))}
    </span>
  )
}

/** One-line explanation of a history row from your point of view. */
function describe(s: Split, name: string): string {
  if (s.kind === 'payment') return s.paid_by === 'me' ? `you paid ${name}` : `${name} paid you`
  const bill = s.total_cents ? `${formatCents(s.total_cents)} bill, ` : ''
  return s.paid_by === 'me' ? `${bill}you paid` : `${bill}${name} paid`
}

function newGroupId(): string {
  return crypto.randomUUID()
}

function SubmitRow({
  busy,
  disabled,
  label,
  onClose,
  onDelete,
}: {
  busy: boolean
  disabled: boolean
  label: string
  onClose: () => void
  onDelete?: () => void
}) {
  return (
    <div className="form-actions">
      {onDelete && (
        <button type="button" className="danger ghost" onClick={onDelete}>
          Delete
        </button>
      )}
      <span className="spacer" />
      <button type="button" className="ghost" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" className="primary" disabled={busy || disabled}>
        {busy ? 'Saving…' : label}
      </button>
    </div>
  )
}

/** Logs a shared bill: who was in on it, who paid, and how it's split. */
function ExpenseForm({ friendId, onClose }: { friendId?: string; onClose: () => void }) {
  const { data, today, run } = useStore()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [chosen, setChosen] = useState<string[]>(friendId ? [friendId] : [])
  const [payer, setPayer] = useState<Person>(ME)
  const [mode, setMode] = useState<'equal' | 'custom'>('equal')
  const [excluded, setExcluded] = useState<Set<Person>>(new Set())
  const [custom, setCustom] = useState<Record<Person, string>>({})
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const nameOf = (p: Person) => (p === ME ? 'You' : (data.friends.find((f) => f.id === p)?.name ?? '?'))
  const total = parseCents(amount)
  const participants: Person[] = [ME, ...chosen]
  const effectivePayer = participants.includes(payer) ? payer : ME

  const { shares, splitError } = useMemo(() => {
    const shares = new Map<Person, number>()
    if (!total) return { shares, splitError: null }
    if (mode === 'equal') {
      const inSplit = participants.filter((p) => !excluded.has(p))
      if (inSplit.length === 0) return { shares, splitError: 'Pick at least one person to split with.' }
      equalShares(total, inSplit.length).forEach((c, i) => shares.set(inSplit[i], c))
      return { shares, splitError: null }
    }
    let sum = 0
    for (const p of participants) {
      const raw = custom[p]?.trim() ?? ''
      const c = raw === '' ? 0 : parseCents(raw)
      if (c === null) return { shares, splitError: `${nameOf(p)}'s amount isn't a number.` }
      shares.set(p, c)
      sum += c
    }
    if (sum !== total)
      return {
        shares,
        splitError: `Shares add up to ${formatCents(sum)} — ${formatCents(Math.abs(total - sum))} ${sum < total ? 'left to assign' : 'too much'}.`,
      }
    return { shares, splitError: null }
  }, [total, mode, chosen, excluded, custom])

  const rows =
    total && !splitError
      ? expenseRows({
          description: description.trim(),
          occurred_on: date,
          total_cents: total,
          payer: effectivePayer,
          shares,
          group_id: newGroupId(),
        })
      : []
  const invalid = !description.trim() || !total || !date || chosen.length === 0 || !!splitError || rows.length === 0

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  async function addNew() {
    const name = newName.trim()
    if (!name) return
    const existing = data.friends.find((f) => f.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!chosen.includes(existing.id)) toggle(existing.id)
      setNewName('')
      return
    }
    const box: { created?: Friend } = {}
    const ok = await run(async () => {
      box.created = await api.addFriend(name)
    })
    if (ok && box.created) {
      const id = box.created.id
      setChosen((c) => [...c, id])
      setNewName('')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const ok = await run(() => api.addSplits(rows))
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title="Add a shared expense" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>What was it for?</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dinner at Chipotle" autoFocus />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Total bill</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="field">
          <span>With</span>
          <div className="cat-chips">
            {data.friends.map((f) => (
              <button
                type="button"
                key={f.id}
                className={`chip-btn ${chosen.includes(f.id) ? 'on' : ''}`}
                onClick={() => toggle(f.id)}
                aria-pressed={chosen.includes(f.id)}
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="inline-add">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addNew()
                }
              }}
              placeholder={data.friends.length ? 'Someone new? Type a name' : "Friend's name"}
            />
            <button type="button" className="small" onClick={addNew} disabled={!newName.trim()}>
              Add
            </button>
          </div>
        </div>

        {chosen.length > 0 && (
          <>
            <label className="field">
              <span>Who paid?</span>
              <select value={effectivePayer} onChange={(e) => setPayer(e.target.value)}>
                {participants.map((p) => (
                  <option key={p} value={p}>
                    {p === ME ? 'You' : nameOf(p)}
                  </option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>Split</span>
              <div className="segmented inline">
                <button type="button" className={mode === 'equal' ? 'on' : ''} onClick={() => setMode('equal')}>
                  Equally
                </button>
                <button type="button" className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>
                  Custom amounts
                </button>
              </div>
              <div className="share-list">
                {participants.map((p) => (
                  <div key={p} className="share-line">
                    {mode === 'equal' ? (
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={!excluded.has(p)}
                          onChange={() =>
                            setExcluded((s) => {
                              const n = new Set(s)
                              if (n.has(p)) n.delete(p)
                              else n.add(p)
                              return n
                            })
                          }
                        />
                        {nameOf(p)}
                      </label>
                    ) : (
                      <span>{nameOf(p)}</span>
                    )}
                    <span className="grow" />
                    {mode === 'equal' ? (
                      <span className="muted">{shares.has(p) ? formatCents(shares.get(p)!) : '—'}</span>
                    ) : (
                      <input
                        aria-label={`${nameOf(p)}'s share`}
                        value={custom[p] ?? ''}
                        onChange={(e) => setCustom((c) => ({ ...c, [p]: e.target.value }))}
                        inputMode="decimal"
                        placeholder="0.00"
                        size={8}
                      />
                    )}
                  </div>
                ))}
              </div>
              {mode === 'equal' && (
                <small className="muted">Untick someone who isn't sharing the cost (e.g. untick yourself if you just covered for them).</small>
              )}
            </div>
          </>
        )}

        {splitError && <p className="form-error">{splitError}</p>}
        {rows.length > 0 && (
          <div className="preview">
            {rows.map((r) => (
              <div key={r.friend_id}>
                {r.paid_by === 'me' ? (
                  <>
                    <strong>{nameOf(r.friend_id)}</strong> will owe you <span className="owed-amount">{formatCents(r.amount_cents)}</span>
                  </>
                ) : (
                  <>
                    You'll owe <strong>{nameOf(r.friend_id)}</strong> <span className="owe-amount">{formatCents(r.amount_cents)}</span>
                  </>
                )}
              </div>
            ))}
            {effectivePayer !== ME && chosen.length > 1 && (
              <div className="muted small">Only what you owe is tracked — not what others owe {nameOf(effectivePayer)}.</div>
            )}
          </div>
        )}
        {total && !splitError && chosen.length > 0 && rows.length === 0 && (
          <p className="muted small">Nobody owes anyone anything with this split.</p>
        )}

        <SubmitRow busy={busy} disabled={invalid} label="Add expense" onClose={onClose} />
      </form>
    </Modal>
  )
}

/** Records money changing hands; defaults to the amount that clears the balance. */
function SettleForm({ summary, onClose }: { summary: FriendSummary; onClose: () => void }) {
  const { today, run } = useStore()
  const name = summary.friend.name
  const suggested = settleUp(summary.balance)
  const [paidBy, setPaidBy] = useState<PaidBy>(suggested?.paid_by ?? 'friend')
  const [amount, setAmount] = useState(suggested ? centsToInput(suggested.amount_cents) : '')
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const cents = parseCents(amount)
  const invalid = !cents || !date
  const after = cents ? summary.balance + (paidBy === 'me' ? cents : -cents) : summary.balance

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const ok = await run(() =>
      api.addSplits([
        {
          friend_id: summary.friend.id,
          kind: 'payment',
          paid_by: paidBy,
          description: after === 0 ? 'Settled up' : 'Payment',
          occurred_on: date,
          amount_cents: cents!,
          total_cents: null,
          group_id: null,
        },
      ]),
    )
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title={`Settle up with ${name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="segmented inline">
          <button type="button" className={paidBy === 'friend' ? 'on' : ''} onClick={() => setPaidBy('friend')}>
            {name} paid you
          </button>
          <button type="button" className={paidBy === 'me' ? 'on' : ''} onClick={() => setPaidBy('me')}>
            You paid {name}
          </button>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Amount</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <p className="muted small">
          After this:{' '}
          {after === 0
            ? "you're all square ✓"
            : after > 0
              ? `${name} owes you ${formatCents(after)}`
              : `you owe ${name} ${formatCents(-after)}`}
        </p>
        <SubmitRow busy={busy} disabled={invalid} label="Record payment" onClose={onClose} />
      </form>
    </Modal>
  )
}

/** Edits or deletes one history row. */
function SplitForm({ split, onClose }: { split: Split; onClose: () => void }) {
  const { data, run } = useStore()
  const name = data.friends.find((f) => f.id === split.friend_id)?.name ?? 'Friend'
  const [description, setDescription] = useState(split.description)
  const [amount, setAmount] = useState(centsToInput(split.amount_cents))
  const [date, setDate] = useState(split.occurred_on)
  const [paidBy, setPaidBy] = useState<PaidBy>(split.paid_by)
  const [busy, setBusy] = useState(false)
  const cents = parseCents(amount)
  const invalid = !description.trim() || !cents || !date
  const isPayment = split.kind === 'payment'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const ok = await run(() =>
      api.updateSplit(split.id, { description: description.trim(), amount_cents: cents!, occurred_on: date, paid_by: paidBy }),
    )
    setBusy(false)
    if (ok) onClose()
  }

  async function remove() {
    if (!confirm(`Delete "${split.description}" with ${name}?`)) return
    if (await run(() => api.deleteSplit(split.id))) onClose()
  }

  return (
    <Modal title={isPayment ? 'Edit payment' : 'Edit expense'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </label>
        <div className="segmented inline">
          <button type="button" className={paidBy === 'me' ? 'on' : ''} onClick={() => setPaidBy('me')}>
            {isPayment ? `You paid ${name}` : `You paid · ${name} owes you`}
          </button>
          <button type="button" className={paidBy === 'friend' ? 'on' : ''} onClick={() => setPaidBy('friend')}>
            {isPayment ? `${name} paid you` : `${name} paid · you owe`}
          </button>
        </div>
        <div className="field-row">
          <label className="field">
            <span>{isPayment ? 'Amount' : paidBy === 'me' ? `${name}'s share` : 'Your share'}</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        {split.total_cents && <p className="muted small">Whole bill was {formatCents(split.total_cents)}.</p>}
        <SubmitRow busy={busy} disabled={invalid} label="Save changes" onClose={onClose} onDelete={remove} />
      </form>
    </Modal>
  )
}

function FriendForm({ initial, onClose }: { initial?: Friend; onClose: () => void }) {
  const { data, run } = useStore()
  const [name, setName] = useState(initial?.name ?? '')
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim()
  const taken = data.friends.some((f) => f.id !== initial?.id && f.name.toLowerCase() === trimmed.toLowerCase())
  const invalid = !trimmed || taken

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const ok = await run(() => (initial ? api.renameFriend(initial.id, trimmed) : api.addFriend(trimmed)))
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title={initial ? `Rename ${initial.name}` : 'Add a friend'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        {taken && <p className="form-error">You already have a friend called {trimmed}.</p>}
        <SubmitRow busy={busy} disabled={invalid} label={initial ? 'Save' : 'Add friend'} onClose={onClose} />
      </form>
    </Modal>
  )
}
