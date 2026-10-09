import { useMemo, useState } from 'react'
import { formatCents, formatWhole } from '../money'
import { addDays, occurrencesBetween, totals } from '../schedule'
import { useStore } from '../store'
import type { Commitment } from '../types'
import ItemForm from './ItemForm'
import ItemRow from './ItemRow'
import { Empty, PageHead, Section, Stat } from './ui'

export default function Subscriptions() {
  const { data, ledger, today, semester } = useStore()
  const [editing, setEditing] = useState<{ initial?: Commitment } | null>(null)

  const { active, ended, monthly, semesterCost } = useMemo(() => {
    const subs = data.commitments.filter((c) => c.bucket === 'subscription' && !c.is_archived)
    const active = subs
      .filter((c) => !c.recurrence_end || c.recurrence_end >= today)
      .map((c) => ({ c, next: occurrencesBetween(c, today, addDays(today, 400), ledger, today).slice(0, 1) }))
      .sort((a, b) => (a.next[0]?.dueDate ?? '9999').localeCompare(b.next[0]?.dueDate ?? '9999'))
    const ended = subs.filter((c) => c.recurrence_end && c.recurrence_end < today)
    // Monthly equivalent: annual plans count as 1/12 per month.
    const monthly = active.reduce(
      (s, { c }) => s + (c.recurrence === 'annual' ? (c.amount_cents - c.offset_cents) / 12 : c.amount_cents - c.offset_cents),
      0,
    )
    const semesterCost = semester
      ? totals(subs.flatMap((c) => occurrencesBetween(c, semester.start_date, semester.end_date, ledger, today))).total
      : null
    return { active, ended, monthly, semesterCost }
  }, [data.commitments, ledger, today, semester])

  return (
    <>
      <PageHead
        title="Subscriptions"
        subtitle="Things that charge you automatically."
        action={
          <button className="primary" onClick={() => setEditing({})}>
            + Add subscription
          </button>
        }
      />

      <div className="stats">
        <Stat label="Per month" value={formatCents(Math.round(monthly))} tone="accent" sub={`${active.length} active`} />
        <Stat label="Per year" value={formatWhole(Math.round(monthly * 12))} />
        {semesterCost !== null && semester && <Stat label={`During ${semester.name}`} value={formatWhole(semesterCost)} />}
      </div>

      {active.length === 0 ? (
        <Empty icon="🔁" title="No subscriptions yet">
          <p>Add Netflix, Spotify, your phone plan, gym… and see what they add up to.</p>
        </Empty>
      ) : (
        <Section title="Active" aside="sorted by next charge">
          <ul className="items">
            {active.map(({ c, next }) => (
              <ItemRow key={c.id} commitment={c} occurrences={next} onEdit={() => setEditing({ initial: c })} />
            ))}
          </ul>
        </Section>
      )}

      {ended.length > 0 && (
        <Section title="Cancelled">
          <ul className="items muted-items">
            {ended.map((c) => (
              <ItemRow key={c.id} commitment={c} occurrences={[]} onEdit={() => setEditing({ initial: c })} />
            ))}
          </ul>
        </Section>
      )}

      {editing && <ItemForm bucket="subscription" initial={editing.initial} onClose={() => setEditing(null)} />}
    </>
  )
}
