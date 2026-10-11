import { useMemo, useState } from 'react'
import * as api from '../api'
import { formatCents, formatWhole } from '../money'
import { addDays, netCents, occurrencesBetween, totals } from '../schedule'
import { useStore } from '../store'
import type { Commitment, Recurrence } from '../types'
import ItemForm from './ItemForm'
import ItemRow from './ItemRow'
import { Empty, PageHead, Section, Stat } from './ui'

export default function Subscriptions() {
  const { data, ledger, today, semester, run } = useStore()
  const [editing, setEditing] = useState<{ initial?: Commitment; recurrence?: Recurrence } | null>(null)

  const { monthly, yearly, inactive, ended, monthlyTotal, yearlyTotal, semesterCost } = useMemo(() => {
    const all = data.commitments.filter((c) => c.bucket === 'subscription')
    const subs = all.filter((c) => !c.is_archived)
    // Inactive = paused for now (is_archived), can be switched back on any time.
    const inactive = all.filter((c) => c.is_archived)
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
    return { monthly, yearly, inactive, ended, monthlyTotal: sum(monthly), yearlyTotal: sum(yearly), semesterCost }
  }, [data.commitments, ledger, today, semester])

  const setActive = (c: Commitment, active: boolean) =>
    run(() => api.updateCommitment(c.id, { is_archived: !active }))
  const pauseButton = (c: Commitment) => (
    <button className="ghost small" onClick={() => setActive(c, false)} title="Stop counting this until you turn it back on">
      Pause
    </button>
  )

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

      {monthly.length === 0 && yearly.length === 0 && inactive.length === 0 ? (
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
                  <ItemRow key={c.id} commitment={c} occurrences={next} onEdit={() => setEditing({ initial: c })} actions={pauseButton(c)} />
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
                  <ItemRow key={c.id} commitment={c} occurrences={next} onEdit={() => setEditing({ initial: c })} actions={pauseButton(c)} />
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      {inactive.length > 0 && (
        <Section title="Inactive" aside="paused — not counted in your totals">
          <ul className="items">
            {inactive.map((c) => (
              <ItemRow
                key={c.id}
                commitment={c}
                occurrences={[]}
                sub={`${formatCents(c.amount_cents - c.offset_cents)} ${c.recurrence === 'annual' ? 'per year' : 'per month'}`}
                onEdit={() => setEditing({ initial: c })}
                actions={
                  <button className="small" onClick={() => setActive(c, true)}>
                    Activate
                  </button>
                }
              />
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
