import { useState, type FormEvent } from 'react'
import * as api from '../api'
import { centsToInput, formatCents, parseCents } from '../money'
import { firstOfMonth, monthsBetween } from '../schedule'
import { useStore } from '../store'
import type { Paycheck, Semester, Trip } from '../types'
import { Modal } from './ui'

/** Suggests the next semester's name and dates from today (Spring Jan–May, Summer Jun–Jul, Fall Aug–Dec). */
export function suggestSemester(today: string): { name: string; start_date: string; end_date: string } {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  if (m <= 5) return { name: `Spring ${y}`, start_date: `${y}-01-01`, end_date: `${y}-05-31` }
  if (m <= 7) return { name: `Summer ${y}`, start_date: `${y}-06-01`, end_date: `${y}-07-31` }
  return { name: `Fall ${y}`, start_date: `${y}-08-01`, end_date: `${y}-12-31` }
}

function FormActions({
  busy,
  disabled,
  isEdit,
  onClose,
  onDelete,
}: {
  busy: boolean
  disabled: boolean
  isEdit: boolean
  onClose: () => void
  onDelete?: () => void
}) {
  return (
    <div className="form-actions">
      {isEdit && onDelete && (
        <button type="button" className="danger ghost" onClick={onDelete}>
          Delete
        </button>
      )}
      <span className="spacer" />
      <button type="button" className="ghost" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" className="primary" disabled={busy || disabled}>
        {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
      </button>
    </div>
  )
}

export function SemesterForm({ initial, onClose }: { initial?: Semester | null; onClose: () => void }) {
  const { today, run, setSemesterId } = useStore()
  const suggestion = suggestSemester(today)
  const [name, setName] = useState(initial?.name ?? suggestion.name)
  const [start, setStart] = useState(initial?.start_date ?? suggestion.start_date)
  const [end, setEnd] = useState(initial?.end_date ?? suggestion.end_date)
  const [busy, setBusy] = useState(false)
  const invalid = !name.trim() || !start || !end || end < start

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const ok = await run(() => api.saveSemester({ name: name.trim(), start_date: start, end_date: end }, initial?.id))
    setBusy(false)
    if (ok) onClose()
  }

  async function remove() {
    if (!initial) return
    if (!confirm(`Delete ${initial.name}? Its college and stay costs (and their payment history) are deleted too.`)) return
    if (await run(() => api.deleteSemester(initial.id))) {
      setSemesterId('')
      onClose()
    }
  }

  return (
    <Modal title={initial ? 'Edit semester' : 'New semester'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Starts</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Ends</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {end && start && end < start && <p className="form-error">End date is before the start.</p>}
        <FormActions busy={busy} disabled={invalid} isEdit={!!initial} onClose={onClose} onDelete={remove} />
      </form>
    </Modal>
  )
}

export function TripForm({ initial, onClose }: { initial?: Trip | null; onClose: () => void }) {
  const { today, run } = useStore()
  const [name, setName] = useState(initial?.name ?? '')
  const [start, setStart] = useState(initial?.start_date ?? today)
  const [end, setEnd] = useState(initial?.end_date ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const invalid = !name.trim() || !start || (!!end && end < start)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const ok = await run(() =>
      api.saveTrip(
        { name: name.trim(), start_date: start, end_date: end || null, notes: notes.trim() || null },
        initial?.id,
      ),
    )
    setBusy(false)
    if (ok) onClose()
  }

  async function remove() {
    if (!initial) return
    if (!confirm(`Delete the ${initial.name} trip and all its expenses?`)) return
    if (await run(() => api.deleteTrip(initial.id))) onClose()
  }

  return (
    <Modal title={initial ? 'Edit trip' : 'Plan a trip'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Where to?</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Thanksgiving in NYC" autoFocus />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Leaving</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Back (optional)</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
        </label>
        <FormActions busy={busy} disabled={invalid} isEdit={!!initial} onClose={onClose} onDelete={remove} />
      </form>
    </Modal>
  )
}

/** Adds the same expected amount for a source across a range of months. */
export function IncomeForm({ onClose }: { onClose: () => void }) {
  const { data, today, semester, run } = useStore()
  const sources = [...new Set(data.income.map((i) => i.source))]
  const [source, setSource] = useState(sources[0] ?? '')
  const [amount, setAmount] = useState('')
  const [from, setFrom] = useState((semester && semester.start_date > today ? semester.start_date : today).slice(0, 7))
  const [to, setTo] = useState((semester?.end_date ?? today).slice(0, 7))
  const [busy, setBusy] = useState(false)

  const cents = parseCents(amount)
  const months = from && to && to >= from ? monthsBetween(`${from}-01`, `${to}-01`) : []
  const invalid = !source.trim() || cents === null || months.length === 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    const src = source.trim()
    // Keep notes already recorded for months being overwritten.
    const existing = new Map(data.income.filter((i) => i.source === src).map((i) => [i.month, i]))
    setBusy(true)
    const ok = await run(() =>
      api.upsertIncome(
        months.map((month) => ({
          source: src,
          month,
          amount_cents: cents!,
          notes: existing.get(month)?.notes ?? null,
        })),
      ),
    )
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title="Add expected income" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Source</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} list="income-sources" placeholder="Campus job" autoFocus />
          <datalist id="income-sources">
            {sources.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Expected per month</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
          <small className="muted">Tip: hourly pay × hours per week × 4.3</small>
        </label>
        <div className="field-row">
          <label className="field">
            <span>From</span>
            <input type="month" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="month" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {months.length > 0 && cents !== null && (
          <p className="muted small">
            Adds {months.length} month{months.length > 1 ? 's' : ''} · {formatCents(cents * months.length)} total. Months that
            already exist for this source are updated.
          </p>
        )}
        <FormActions busy={busy} disabled={invalid} isEdit={false} onClose={onClose} />
      </form>
    </Modal>
  )
}

/** Picks a sensible default pay date for a month: today if it's this month, else the 1st. */
function defaultPayDate(month: string, today: string): string {
  return firstOfMonth(today) === month ? today : month
}

/** Logs (or edits) one paycheck that actually landed. */
export function PaycheckForm({
  month,
  initial,
  onClose,
}: {
  month: string
  initial?: Paycheck | null
  onClose: () => void
}) {
  const { data, today, run } = useStore()
  const sources = [...new Set([...data.income.map((i) => i.source), ...data.paychecks.flatMap((p) => p.source ?? [])])]
  const monthSources = data.income.filter((i) => i.month === month).map((i) => i.source)
  const [source, setSource] = useState(initial ? (initial.source ?? '') : (monthSources[0] ?? sources[0] ?? ''))
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amount_cents) : '')
  const [paidOn, setPaidOn] = useState(initial?.paid_on ?? defaultPayDate(month, today))
  const [busy, setBusy] = useState(false)

  const cents = parseCents(amount)
  const invalid = cents === null || cents <= 0 || !paidOn

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const ok = await run(() =>
      api.savePaycheck(
        { source: source.trim() || null, paid_on: paidOn, amount_cents: cents!, notes: initial?.notes ?? null },
        initial?.id,
      ),
    )
    setBusy(false)
    if (ok) onClose()
  }

  async function remove() {
    if (!initial) return
    if (!confirm('Delete this paycheck?')) return
    if (await run(() => api.deletePaycheck(initial.id))) onClose()
  }

  return (
    <Modal title={initial ? 'Edit paycheck' : 'Add paycheck'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field-row">
          <label className="field">
            <span>Amount received</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus />
          </label>
          <label className="field">
            <span>Paid on</span>
            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>From (optional)</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} list="paycheck-sources" placeholder="Campus job" />
          <datalist id="paycheck-sources">
            {sources.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        {paidOn && firstOfMonth(paidOn) !== month && (
          <p className="muted small">This date is in another month, so it will be counted there.</p>
        )}
        <FormActions busy={busy} disabled={invalid} isEdit={!!initial} onClose={onClose} onDelete={remove} />
      </form>
    </Modal>
  )
}
