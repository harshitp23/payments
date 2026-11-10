import { useState, type FormEvent } from 'react'
import * as api from '../api'
import { centsToInput, formatCents, parseCents } from '../money'
import { formatDate, relativeDays } from '../schedule'
import { useStore } from '../store'
import type { Incoming } from '../types'
import { Modal, PageHead, Section, Stat } from './ui'

/** Refunds, returns and transfers you're waiting on; tick each off when it lands. */
export default function IncomingView() {
  const { data, today, run } = useStore()
  const [editing, setEditing] = useState<{ initial?: Incoming } | null>(null)
  const [showReceived, setShowReceived] = useState(false)

  const pending = data.incoming
    .filter((i) => !i.received_on)
    .sort((a, b) => (a.expected_on ?? '9999').localeCompare(b.expected_on ?? '9999'))
  const received = data.incoming
    .filter((i) => i.received_on)
    .sort((a, b) => b.received_on!.localeCompare(a.received_on!))
  const pendingTotal = pending.reduce((s, i) => s + i.amount_cents, 0)

  const tick = (i: Incoming, got: boolean) => run(() => api.updateIncoming(i.id, { received_on: got ? today : null }))

  const line = (i: Incoming) => {
    const late = !i.received_on && i.expected_on && i.expected_on < today
    const when = i.received_on
      ? `received ${formatDate(i.received_on, today)}`
      : i.expected_on
        ? `expected ${formatDate(i.expected_on, today)} (${relativeDays(i.expected_on, today)})`
        : 'no date set'
    return (
      <li key={i.id} className={`incoming-line ${i.received_on ? 'done' : ''}`}>
        <input
          type="checkbox"
          checked={!!i.received_on}
          onChange={(e) => tick(i, e.target.checked)}
          aria-label={i.received_on ? `Mark ${i.description} as not received` : `Mark ${i.description} as received`}
        />
        <button className="incoming-body" onClick={() => setEditing({ initial: i })}>
          <span className="item-title">{i.description}</span>
          <span className={`item-sub ${late ? 'late' : ''}`}>
            {i.source ? `${i.source} · ` : ''}
            {when}
          </span>
        </button>
        <span className="received-amount">{formatCents(i.amount_cents)}</span>
      </li>
    )
  }

  return (
    <>
      <PageHead
        title="Refunds & transfers"
        subtitle="Returns, refunds and transfers you're waiting on. Tick each one off when the money lands."
        action={
          <button className="primary" onClick={() => setEditing({})}>
            + Add refund / transfer
          </button>
        }
      />

      <div className="stats">
        <Stat
          label="Total to come"
          value={formatCents(pendingTotal)}
          tone="good"
          sub={`${pending.length} pending`}
        />
      </div>

    <Section title="Waiting on">
      {pending.length === 0 ? (
        <p className="muted small">
          Nothing pending. Add returns, refunds, deposits or transfers you're waiting on — tick them off when they arrive.
        </p>
      ) : (
        <ul className="items">{pending.map(line)}</ul>
      )}
      {received.length > 0 && (
        <>
          <button className="link small" onClick={() => setShowReceived((v) => !v)}>
            {showReceived ? 'Hide' : 'Show'} received ({received.length})
          </button>
          {showReceived && <ul className="items">{received.map(line)}</ul>}
        </>
      )}
    </Section>
      {editing && <IncomingForm initial={editing.initial} onClose={() => setEditing(null)} />}
    </>
  )
}

function IncomingForm({ initial, onClose }: { initial?: Incoming; onClose: () => void }) {
  const { data, run } = useStore()
  const sources = [...new Set(data.incoming.flatMap((i) => i.source ?? []))]
  const [description, setDescription] = useState(initial?.description ?? '')
  const [source, setSource] = useState(initial?.source ?? '')
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amount_cents) : '')
  const [expected, setExpected] = useState(initial?.expected_on ?? '')
  const [received, setReceived] = useState(initial?.received_on ?? '')
  const [busy, setBusy] = useState(false)
  const cents = parseCents(amount)
  const invalid = !description.trim() || !cents

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const input = {
      description: description.trim(),
      source: source.trim() || null,
      amount_cents: cents!,
      expected_on: expected || null,
      received_on: received || null,
    }
    const ok = await run(() => (initial ? api.updateIncoming(initial.id, input) : api.addIncoming(input)))
    setBusy(false)
    if (ok) onClose()
  }

  async function remove() {
    if (!initial || !confirm(`Delete "${initial.description}"?`)) return
    if (await run(() => api.deleteIncoming(initial.id))) onClose()
  }

  return (
    <Modal title={initial ? 'Edit incoming money' : 'Money coming back'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>What is it?</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Amazon return, deposit refund, Venmo from mom…"
            autoFocus
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Amount</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
          <label className="field">
            <span>From (optional)</span>
            <input value={source} onChange={(e) => setSource(e.target.value)} list="incoming-sources" placeholder="Amazon" />
            <datalist id="incoming-sources">
              {sources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Expected by (optional)</span>
            <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </label>
          {initial && (
            <label className="field">
              <span>Received on</span>
              <input type="date" value={received} onChange={(e) => setReceived(e.target.value)} />
            </label>
          )}
        </div>
        <div className="form-actions">
          {initial && (
            <button type="button" className="danger ghost" onClick={remove}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={busy || invalid}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
