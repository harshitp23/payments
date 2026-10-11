import { useState, type FormEvent } from 'react'
import * as api from '../api'
import { centsToInput, parseCents } from '../money'
import { parseIso } from '../schedule'
import { useStore } from '../store'
import type { Bucket, Commitment, Recurrence, Semester, Trip } from '../types'
import { Modal } from './ui'

export const TRIP_CATEGORIES = ['travel', 'cab', 'stay', 'food', 'activities', 'shopping', 'other']
export const ESTIMATE_CATEGORIES = ['shopping', 'gifts', 'events', 'tech', 'health', 'other']

const COPY: Record<Bucket, { title: string; name: string; date: string }> = {
  college: { title: 'college cost', name: 'Tuition, lab fee, books…', date: 'Due date' },
  stay: { title: 'stay cost', name: 'Rent, utilities, deposit…', date: 'Due date' },
  other: { title: 'cost', name: 'Name', date: 'Due date' },
  subscription: { title: 'subscription', name: 'Netflix, Spotify, iCloud…', date: 'Next billing date' },
  trip: { title: 'trip expense', name: 'Flight to…, Airbnb, Uber…', date: 'When' },
  estimate: { title: 'estimate', name: 'Winter clothes, birthday gift…', date: 'Roughly when' },
}

interface Props {
  bucket: Bucket
  initial?: Commitment | null
  semester?: Semester | null
  trip?: Trip | null
  /** Default repeat for a new item (e.g. 'annual' when adding a yearly subscription). */
  recurrence?: Recurrence
  onClose: () => void
}

export default function ItemForm({ bucket: initialBucket, initial, semester, trip, recurrence: initialRecurrence, onClose }: Props) {
  const { today, run } = useStore()
  const [bucket, setBucket] = useState<Bucket>(initial?.bucket ?? initialBucket)
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? (initialBucket === 'trip' ? 'travel' : ''))
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amount_cents) : '')
  const [offset, setOffset] = useState(initial && initial.offset_cents > 0 ? centsToInput(initial.offset_cents) : '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? trip?.start_date ?? today)
  const [recurrence, setRecurrence] = useState<Recurrence>(
    initial?.recurrence ?? initialRecurrence ?? (initialBucket === 'subscription' ? 'monthly' : 'none'),
  )
  const [anchor, setAnchor] = useState(String(initial?.anchor_day ?? parseIso(dueDate).day))
  const [anchorTouched, setAnchorTouched] = useState(
    initial?.anchor_day != null && initial.anchor_day !== parseIso(initial.due_date).day,
  )
  const [recurrenceEnd, setRecurrenceEnd] = useState(initial?.recurrence_end ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [busy, setBusy] = useState(false)

  const isSemesterItem = bucket === 'college' || bucket === 'stay' || bucket === 'other'
  const recurrenceOptions: Recurrence[] =
    bucket === 'subscription' ? ['monthly', 'annual'] : isSemesterItem ? ['none', 'monthly'] : ['none']
  const copy = COPY[bucket]

  const amountCents = parseCents(amount)
  const offsetCents = offset.trim() === '' ? 0 : parseCents(offset)
  const anchorDay = Number(anchor)
  const recurring = recurrence !== 'none'

  const errors: string[] = []
  if (!name.trim()) errors.push('Give it a name.')
  if (amountCents === null || amountCents <= 0) errors.push('Amount must be more than 0.')
  if (offsetCents === null) errors.push('Aid must be a number.')
  else if (amountCents !== null && offsetCents > amountCents) errors.push('Aid can’t be more than the amount.')
  if (!dueDate) errors.push('Pick a date.')
  if (recurring && (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31))
    errors.push('Day of month must be 1–31.')
  if (recurring && recurrenceEnd && recurrenceEnd < dueDate) errors.push('End date is before the first payment.')

  function onRecurrence(r: Recurrence) {
    setRecurrence(r)
    // Rent and the like usually stop when the semester ends.
    if (r !== 'none' && isSemesterItem && !recurrenceEnd && semester) setRecurrenceEnd(semester.end_date)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (errors.length > 0) return
    setBusy(true)
    const ok = await run(() =>
      api.saveCommitment(
        {
          name: name.trim(),
          bucket,
          category: category.trim() || null,
          amount_cents: amountCents!,
          offset_cents: offsetCents!,
          due_date: dueDate,
          recurrence,
          anchor_day: recurring ? anchorDay : null,
          recurrence_end: recurring && recurrenceEnd ? recurrenceEnd : null,
          semester_id: isSemesterItem ? (initial?.semester_id ?? semester?.id ?? null) : null,
          trip_id: bucket === 'trip' ? (initial?.trip_id ?? trip?.id ?? null) : null,
          notes: notes.trim() || null,
        },
        initial?.id,
      ),
    )
    setBusy(false)
    if (ok) onClose()
  }

  async function remove() {
    if (!initial) return
    if (!confirm(`Delete “${initial.name}” and its payment history?`)) return
    if (await run(() => api.deleteCommitment(initial.id))) onClose()
  }

  return (
    <Modal title={`${initial ? 'Edit' : 'Add'} ${copy.title}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {isSemesterItem && (
          <div className="segmented" role="radiogroup" aria-label="Type">
            {(['college', 'stay'] as const).map((b) => (
              <button
                type="button"
                key={b}
                role="radio"
                aria-checked={bucket === b}
                className={bucket === b ? 'on' : ''}
                onClick={() => setBucket(b)}
              >
                {b === 'college' ? '🎓 College' : '🏠 Stay'}
              </button>
            ))}
          </div>
        )}

        {bucket === 'trip' && (
          <div className="chips" role="radiogroup" aria-label="Category">
            {TRIP_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                role="radio"
                aria-checked={category === cat}
                className={`chip-btn ${category === cat ? 'on' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.name} autoFocus />
        </label>

        <div className="field-row">
          <label className="field">
            <span>{recurring ? 'Amount each time' : bucket === 'trip' || bucket === 'estimate' ? 'Estimated cost' : 'Amount'}</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
          {isSemesterItem && (
            <label className="field">
              <span>Scholarship / aid / discount</span>
              <input value={offset} onChange={(e) => setOffset(e.target.value)} inputMode="decimal" placeholder="0.00" />
            </label>
          )}
          {bucket === 'estimate' && (
            <label className="field">
              <span>Category</span>
              <input value={category} onChange={(e) => setCategory(e.target.value)} list="est-cats" placeholder="shopping" />
              <datalist id="est-cats">
                {ESTIMATE_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          )}
        </div>

        {recurrenceOptions.length > 1 && (
          <div className="field">
            <span>Repeats</span>
            <div className="segmented">
              {recurrenceOptions.map((r) => (
                <button type="button" key={r} className={recurrence === r ? 'on' : ''} onClick={() => onRecurrence(r)}>
                  {r === 'none' ? 'One time' : r === 'monthly' ? 'Monthly' : 'Yearly'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span>{recurring && bucket !== 'subscription' ? 'First due date' : copy.date}</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value)
                if (!anchorTouched && e.target.value) setAnchor(String(parseIso(e.target.value).day))
              }}
            />
          </label>
          {recurring && (
            <label className="field">
              <span>{bucket === 'subscription' ? 'Cancelled / ends (optional)' : 'Last payment by'}</span>
              <input type="date" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} />
            </label>
          )}
        </div>

        {recurrence === 'monthly' && (
          <label className="field compact">
            <span>Day of month</span>
            <input
              type="number"
              min={1}
              max={31}
              value={anchor}
              onChange={(e) => {
                setAnchor(e.target.value)
                setAnchorTouched(true)
              }}
            />
            <small className="muted">Short months use their last day.</small>
          </label>
        )}

        <label className="field">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
        </label>

        {errors.length > 0 && amount !== '' && name !== '' && <p className="form-error">{errors[0]}</p>}

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
          <button type="submit" className="primary" disabled={busy || errors.length > 0}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
