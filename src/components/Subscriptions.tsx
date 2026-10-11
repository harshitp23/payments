import { useMemo, useState } from 'react'
import { formatCents, formatWhole } from '../money'
import { addDays, netCents, occurrencesBetween, totals } from '../schedule'
import { useStore } from '../store'
import type { Commitment, Recurrence } from '../types'
import ItemForm from './ItemForm'
import ItemRow from './ItemRow'
import { Empty, PageHead, Section, Stat } from './ui'

export default function Subscriptions() {
  const { data, ledger, today, semester } = useStore()
  const [editing, setEditing] = useState<{ initial?: Commitment; recurrence?: Recurrence } | null>(null)

  const { monthly, yearly, ended, monthlyTotal, yearlyTotal, semesterCost } = useMemo(() => {
    const subs = data.commitments.filter((c) => c.bucket === 'subscription' && !c.is_archived)
    const active = subs
      .filter((c) => !c.recurrence_end || c.recurrence_end >= today)
      .map((c) => ({ c, next: occurrencesBetween(c, today, addDays(today, 400), ledger, today).slice(0, 1) }))
      .sort((a, b) => (a.next[0]?.dueDate ?? '9999').localeCompare(b.next[0]?.dueDate ?? '9999'))
    const monthly = active.filter(({ c }) => c.recurrence !== 'annual')
    const yearly = active.filter(({ c }) => c.recurrence === 'annual')
    const ended = subs.filter((c) => c.recurrence_end && c.recurrence_end < today)
    const sum = (list: typeof active) => list.reduce((s, { c }) => s + netCents(c), 0)
    const semesterCost = semester
      ? totals(subs.flatMap((c) => occurrencesBetween(c, semester.start_date, semester.end_date, ledger, today))).total
      : null
    return { monthly, yearly, ended, monthlyTotal: sum(monthly), yearlyTotal: sum(yearly), semesterCost }
  }, [data.commitments, ledger, today, semester])

  const addButton = (recurrence: Recurrence) => (
    <button className="add-line" onClick={() => setEditing({ recurrence })}>
      + Add {recurrence === 'annual' ? 'yearly' : 'monthly'}
    </button>
  )

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
        <Stat label="Monthly subscriptions" value={`${formatCents(monthlyTotal)}/mo`} tone="accent" sub={`${monthly.length} active`} />
        <Stat label="Yearly subscriptions" value={`${formatCents(yearlyTotal)}/yr`} sub={`${yearly.length} active`} />
        {semesterCost !== null && semester && <Stat label={`During ${semester.name}`} value={formatWhole(semesterCost)} />}
      </div>

      {monthly.length === 0 && yearly.length === 0 ? (
        <Empty icon="🔁" title="No subscriptions yet">
          <p>Add Netflix, Spotify, your phone plan, gym… and see what they add up to.</p>
        </Empty>
      ) : (
        <>
          <Section title="Monthly" aside={`${formatCents(monthlyTotal)} / month`} action={addButton('monthly')}>
            {monthly.length === 0 ? (
              <p className="muted small">No monthly subscriptions.</p>
            ) : (
              <ul className="items">
                {monthly.map(({ c, next }) => (
                  <ItemRow key={c.id} commitment={c} occurrences={next} onEdit={() => setEditing({ initial: c })} />
                ))}
              </ul>
            )}
          </Section>
          <Section title="Yearly" aside={`${formatCents(yearlyTotal)} / year`} action={addButton('annual')}>
            {yearly.length === 0 ? (
              <p className="muted small">No yearly subscriptions.</p>
            ) : (
              <ul className="items">
                {yearly.map(({ c, next }) => (
                  <ItemRow key={c.id} commitment={c} occurrences={next} onEdit={() => setEditing({ initial: c })} />
                ))}
              </ul>
            )}
          </Section>
        </>
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

      {editing && (
        <ItemForm
          bucket="subscription"
          initial={editing.initial}
          recurrence={editing.recurrence}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
