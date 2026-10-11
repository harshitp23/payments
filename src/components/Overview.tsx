import { useMemo, useState } from 'react'
import { formatCents, formatWhole } from '../money'
import { COLORS, comingUp, incomeTotal, semesterRollup } from '../rollup'
import { addDays, daysUntil, formatDate, relativeDays, totals } from '../schedule'
import { useStore } from '../store'
import { itemIcon, PayButton } from './ItemRow'
import { SemesterForm } from './forms'
import { Empty, PageHead, Progress, Section, StackedBar, Stat } from './ui'
import type { View } from './Dashboard'

const BUCKET_LABEL: Record<string, string> = {
  college: 'College',
  stay: 'Stay',
  other: 'Other',
  subscription: 'Subscription',
  trip: 'Trip',
  estimate: 'Estimate',
}

export default function Overview({ go }: { go: (v: View) => void }) {
  const { data, ledger, today, semester } = useStore()
  const [creating, setCreating] = useState(false)
  const [horizon, setHorizon] = useState(30)

  const roll = useMemo(
    () => (semester ? semesterRollup(data, semester, ledger, today) : null),
    [data, semester, ledger, today],
  )
  const soon = useMemo(
    () => comingUp(data.commitments, ledger, today, addDays(today, horizon)),
    [data.commitments, ledger, today, horizon],
  )

  if (!semester || !roll) {
    return (
      <>
        <PageHead title="Welcome 👋" subtitle="Start by setting up your current semester." />
        <Empty icon="🎓" title="No semester yet">
          <p>Semesters hold your fixed costs (tuition, rent…) and frame your income and spending estimates.</p>
          <button className="primary" onClick={() => setCreating(true)}>
            Set up a semester
          </button>
        </Empty>
        {creating && <SemesterForm onClose={() => setCreating(false)} />}
      </>
    )
  }

  const t = {
    college: totals(roll.college),
    stay: totals(roll.stay),
    other: totals(roll.other),
    subscriptions: totals(roll.subscriptions),
    trips: totals(roll.trips),
    estimates: totals(roll.estimates),
  }
  const spend = Object.values(t).reduce((s, x) => s + x.total, 0)
  const paid = Object.values(t).reduce((s, x) => s + x.paid, 0)
  const income = incomeTotal(roll.income, roll.paychecks)
  const left = income.expected - spend
  const overdue = soon.filter((o) => o.status === 'overdue')
  const daysLeft = daysUntil(semester.end_date, today)

  return (
    <>
      <PageHead
        title={semester.name}
        subtitle={
          <>
            {formatDate(semester.start_date, today)} – {formatDate(semester.end_date, today)}
            {daysLeft >= 0 && today >= semester.start_date && ` · ${daysLeft} days to go`}
          </>
        }
      />

      {overdue.length > 0 && (
        <div className="alert">
          ⚠️ {overdue.length} overdue payment{overdue.length > 1 ? 's' : ''} ·{' '}
          {formatCents(overdue.reduce((s, o) => s + o.remainingCents, 0))}
        </div>
      )}

      <div className="stats">
        <Stat
          label="Expected income"
          value={formatWhole(income.expected)}
          sub={
            income.expected === 0 ? (
              <button className="link" onClick={() => go('income')}>
                Add income →
              </button>
            ) : (
              `${formatWhole(income.received)} received`
            )
          }
        />
        <Stat label="Planned spending" value={formatWhole(spend)} sub={`${formatWhole(spend - paid)} still to pay`} />
        <Stat
          label={left >= 0 ? 'Left over' : 'Shortfall'}
          value={formatWhole(Math.abs(left))}
          tone={left >= 0 ? 'good' : 'bad'}
          sub={left >= 0 ? 'income minus spending' : 'spending exceeds income'}
        />
        <Stat label="Paid so far" value={formatWhole(paid)} sub={<Progress value={paid} max={spend} label="" />} />
      </div>

      <div className="grid-2">
        <Section title="Where the money goes">
          {spend === 0 ? (
            <Empty icon="🧾" title="Nothing planned yet">
              <button className="primary" onClick={() => go('semester')}>
                Add fixed costs
              </button>
            </Empty>
          ) : (
            <StackedBar
              segments={[
                { key: 'college', label: 'College', value: t.college.total, color: COLORS.college },
                { key: 'stay', label: 'Stay', value: t.stay.total, color: COLORS.stay },
                { key: 'other', label: 'Other fixed', value: t.other.total, color: COLORS.other },
                { key: 'subs', label: 'Subscriptions', value: t.subscriptions.total, color: COLORS.subscriptions },
                { key: 'trips', label: 'Trips', value: t.trips.total, color: COLORS.trips },
                { key: 'est', label: 'Other estimates', value: t.estimates.total, color: COLORS.estimates },
              ]}
            />
          )}
        </Section>

        <Section
          title="Coming up"
          action={
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} aria-label="Window">
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          }
        >
          {soon.length === 0 ? (
            <p className="muted">Nothing due in the next {horizon} days. 🎉</p>
          ) : (
            <ul className="timeline">
              {soon.map((o) => (
                <li key={`${o.commitment.id}|${o.dueDate}`} className={`tl ${o.status}`}>
                  <div className="tl-date">
                    <span className="tl-day">{formatDate(o.dueDate, today)}</span>
                    <span className="tl-rel">{relativeDays(o.dueDate, today)}</span>
                  </div>
                  <div className="tl-icon" aria-hidden>
                    {itemIcon(o.commitment)}
                  </div>
                  <div className="tl-body">
                    <div className="item-title">{o.commitment.name}</div>
                    <div className="item-sub">{BUCKET_LABEL[o.commitment.bucket]}</div>
                  </div>
                  <div className="amount">{formatCents(o.remainingCents)}</div>
                  <div className="tl-action">
                    {o.auto ? <span className="pill due">auto</span> : <PayButton occ={o} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  )
}
