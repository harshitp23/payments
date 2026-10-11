import { useMemo, useState } from 'react'
import * as api from '../api'
import { centsToInput, formatCents, formatWhole, parseCents } from '../money'
import { incomeTotal } from '../rollup'
import { firstOfMonth, formatDate, formatMonth, monthsBetween } from '../schedule'
import { useStore } from '../store'
import type { Income, Paycheck } from '../types'
import { IncomeForm, PaycheckForm } from './forms'
import { PageHead, Stat } from './ui'

export default function IncomeView() {
  const { data, today, semester } = useStore()
  const [adding, setAdding] = useState(false)
  const [paycheck, setPaycheck] = useState<{ month: string; initial?: Paycheck } | null>(null)
  const [scope, setScope] = useState<'semester' | 'all'>(semester ? 'semester' : 'all')
  const thisMonth = firstOfMonth(today)
  const [open, setOpen] = useState<string | null>(thisMonth)

  const { months, rows, checks } = useMemo(() => {
    if (scope === 'semester' && semester) {
      const months = monthsBetween(semester.start_date, semester.end_date)
      return {
        months,
        rows: data.income.filter((r) => months.includes(r.month)),
        checks: data.paychecks.filter((p) => months.includes(firstOfMonth(p.paid_on))),
      }
    }
    const all = [...data.income.map((r) => r.month), ...data.paychecks.map((p) => firstOfMonth(p.paid_on)), thisMonth].sort()
    return { months: monthsBetween(all[0], all[all.length - 1]), rows: data.income, checks: data.paychecks }
  }, [data.income, data.paychecks, scope, semester, thisMonth])

  const incomeByMonth = groupBy(rows, (r) => r.month)
  const checksByMonth = groupBy(checks, (p) => firstOfMonth(p.paid_on))
  const tot = incomeTotal(rows, checks)
  const perMonth = months.map((m) => incomeTotal(incomeByMonth.get(m) ?? [], checksByMonth.get(m) ?? []))
  const max = Math.max(1, ...perMonth.map((t) => Math.max(t.expected, t.received)))

  return (
    <>
      <PageHead
        title="Income"
        subtitle="What you expect to earn each month, and the paychecks that actually came in."
        action={
          <button className="primary" onClick={() => setAdding(true)}>
            + Expected income
          </button>
        }
      />

      {semester && (
        <div className="segmented inline">
          <button className={scope === 'semester' ? 'on' : ''} onClick={() => setScope('semester')}>
            {semester.name}
          </button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
            All months
          </button>
        </div>
      )}

      <div className="stats">
        <Stat label="Expected" value={formatWhole(tot.expected)} />
        <Stat
          label="Received"
          value={formatWhole(tot.received)}
          tone="good"
          sub={`${checks.length} paycheck${checks.length === 1 ? '' : 's'}`}
        />
        <Stat
          label="Average paycheck"
          value={formatWhole(checks.length ? tot.received / checks.length : 0)}
        />
      </div>

      <ul className="months">
        <li className="month-head" aria-hidden>
          <span>Month</span>
          <span />
          <span className="amount">Expected</span>
          <span className="amount">Received</span>
          <span />
        </li>
        {months.map((m, i) => {
          const list = incomeByMonth.get(m) ?? []
          const pays = checksByMonth.get(m) ?? []
          const t = perMonth[i]
          const isOpen = open === m
          return (
            <li key={m} className={`month ${m === thisMonth ? 'current' : ''}`}>
              <button className="month-row" onClick={() => setOpen(isOpen ? null : m)} aria-expanded={isOpen}>
                <span className="month-name">{formatMonth(m)}</span>
                <span className="bar">
                  <span className="bar-fill" style={{ width: `${(t.expected / max) * 100}%` }} />
                  <span className="bar-received" style={{ width: `${(t.received / max) * 100}%` }} />
                </span>
                <span className="amount muted-amount">{t.expected ? formatCents(t.expected) : '—'}</span>
                <span className="amount received-amount">{t.received ? formatCents(t.received) : '—'}</span>
                <span className="caret-sm">{isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && (
                <div className="month-detail">
                  <div className="detail-block">
                    <div className="detail-head">Expected</div>
                    {list.length === 0 && <p className="muted small">Nothing expected this month.</p>}
                    {list.map((r) => (
                      <IncomeLine key={r.id} row={r} />
                    ))}
                  </div>
                  <div className="detail-block">
                    <div className="detail-head">
                      Paychecks
                      {t.expected > 0 && (
                        <span className="muted small">
                          {' '}
                          · {t.received >= t.expected
                            ? `${formatCents(t.received - t.expected)} over expected`
                            : `${formatCents(t.expected - t.received)} still to come`}
                        </span>
                      )}
                    </div>
                    {pays.length === 0 && <p className="muted small">No paychecks logged yet.</p>}
                    {pays.map((p) => (
                      <button key={p.id} className="paycheck-line" onClick={() => setPaycheck({ month: m, initial: p })}>
                        <span className="paycheck-date">{formatDate(p.paid_on, today)}</span>
                        <span className="grow muted">{p.source ?? ''}</span>
                        <span className="received-amount">{formatCents(p.amount_cents)}</span>
                      </button>
                    ))}
                    <button className="add-line" onClick={() => setPaycheck({ month: m })}>
                      + Add paycheck
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="muted small legend-note">
        <span className="swatch" style={{ background: 'var(--c-income-soft)' }} /> expected
        <span className="swatch" style={{ background: 'var(--c-income)' }} /> received · click a month to add paychecks
      </p>

      {adding && <IncomeForm onClose={() => setAdding(false)} />}
      {paycheck && <PaycheckForm month={paycheck.month} initial={paycheck.initial} onClose={() => setPaycheck(null)} />}
    </>
  )
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const t of items) m.set(key(t), [...(m.get(key(t)) ?? []), t])
  return m
}

function IncomeLine({ row }: { row: Income }) {
  const { run } = useStore()
  const [amount, setAmount] = useState(centsToInput(row.amount_cents))
  const cents = parseCents(amount)

  return (
    <div className="income-line">
      <span className="grow">{row.source}</span>
      <input
        aria-label={`Expected from ${row.source}`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => {
          if (cents !== null && cents !== row.amount_cents) run(() => api.updateIncome(row.id, { amount_cents: cents }))
        }}
        inputMode="decimal"
        size={9}
      />
      <button
        className="icon-btn"
        aria-label="Remove"
        title="Remove"
        onClick={() => run(() => api.deleteIncome(row.id))}
      >
        ✕
      </button>
    </div>
  )
}
