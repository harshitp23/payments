import { useMemo, useState } from 'react'
import * as api from '../api'
import { centsToInput, formatCents, formatWhole, parseCents } from '../money'
import { incomeTotal } from '../rollup'
import { formatMonth, monthsBetween } from '../schedule'
import { useStore } from '../store'
import type { Income } from '../types'
import { IncomeForm } from './forms'
import { Empty, PageHead, Stat } from './ui'

export default function IncomeView() {
  const { data, today, semester } = useStore()
  const [adding, setAdding] = useState(false)
  const [scope, setScope] = useState<'semester' | 'all'>(semester ? 'semester' : 'all')
  const [open, setOpen] = useState<string | null>(null)

  const { months, rows } = useMemo(() => {
    const all = data.income
    if (scope === 'semester' && semester) {
      const months = monthsBetween(semester.start_date, semester.end_date)
      return { months, rows: all.filter((r) => months.includes(r.month)) }
    }
    if (all.length === 0) return { months: [], rows: all }
    return { months: monthsBetween(all[0].month, all[all.length - 1].month), rows: all }
  }, [data.income, scope, semester])

  const byMonth = new Map<string, Income[]>()
  for (const r of rows) byMonth.set(r.month, [...(byMonth.get(r.month) ?? []), r])
  const tot = incomeTotal(rows)
  const max = Math.max(1, ...months.map((m) => incomeTotal(byMonth.get(m) ?? []).expected))
  const thisMonth = today.slice(0, 8) + '01'

  return (
    <>
      <PageHead
        title="Income"
        subtitle="What you expect to earn, month by month."
        action={
          <button className="primary" onClick={() => setAdding(true)}>
            + Add income
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
        <Stat label="Expected total" value={formatWhole(tot.expected)} tone="good" />
        <Stat label="Received so far" value={formatWhole(tot.received)} />
        <Stat label="Average / month" value={formatWhole(months.length ? tot.expected / months.length : 0)} />
      </div>

      {rows.length === 0 ? (
        <Empty icon="💼" title="No income added yet">
          <p>Add your job's expected monthly pay and see the breakdown here.</p>
          <button className="primary" onClick={() => setAdding(true)}>
            Add income
          </button>
        </Empty>
      ) : (
        <ul className="months">
          {months.map((m) => {
            const list = byMonth.get(m) ?? []
            const t = incomeTotal(list)
            const isOpen = open === m
            return (
              <li key={m} className={`month ${m === thisMonth ? 'current' : ''}`}>
                <button className="month-row" onClick={() => setOpen(isOpen ? null : m)} aria-expanded={isOpen}>
                  <span className="month-name">{formatMonth(m)}</span>
                  <span className="bar">
                    <span className="bar-fill" style={{ width: `${(t.expected / max) * 100}%` }} />
                    <span
                      className="bar-received"
                      style={{ width: `${(Math.min(t.received, t.expected) / max) * 100}%` }}
                    />
                  </span>
                  <span className="amount">{formatCents(t.expected)}</span>
                  <span className="caret-sm">{isOpen ? '▴' : '▾'}</span>
                </button>
                {isOpen && (
                  <div className="month-detail">
                    {list.length === 0 && <p className="muted small">Nothing expected this month.</p>}
                    {list.map((r) => (
                      <IncomeLine key={r.id} row={r} />
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {rows.length > 0 && (
        <p className="muted small legend-note">
          <span className="swatch" style={{ background: 'var(--c-income-soft)' }} /> expected
          <span className="swatch" style={{ background: 'var(--c-income)' }} /> received · click a month to edit
        </p>
      )}

      {adding && <IncomeForm onClose={() => setAdding(false)} />}
    </>
  )
}

function IncomeLine({ row }: { row: Income }) {
  const { run } = useStore()
  const [amount, setAmount] = useState(centsToInput(row.amount_cents))
  const cents = parseCents(amount)
  const received = row.received_cents !== null

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
      <label className="check">
        <input
          type="checkbox"
          checked={received}
          onChange={(e) =>
            run(() => api.updateIncome(row.id, { received_cents: e.target.checked ? (cents ?? row.amount_cents) : null }))
          }
        />
        received
      </label>
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
