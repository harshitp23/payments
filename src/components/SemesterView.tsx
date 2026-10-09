import { useMemo, useState } from 'react'
import { formatWhole } from '../money'
import { groupByCommitment, semesterRollup } from '../rollup'
import { formatDate, totals, type Occurrence } from '../schedule'
import { useStore } from '../store'
import type { Bucket, Commitment } from '../types'
import ItemForm from './ItemForm'
import ItemRow from './ItemRow'
import { SemesterForm } from './forms'
import { Empty, PageHead, Progress, Section, Stat } from './ui'

type Editing = { bucket: Bucket; initial?: Commitment } | null

export default function SemesterView() {
  const { data, ledger, today, semester } = useStore()
  const [editing, setEditing] = useState<Editing>(null)
  const [semForm, setSemForm] = useState<'new' | 'edit' | null>(null)

  const roll = useMemo(
    () => (semester ? semesterRollup(data, semester, ledger, today) : null),
    [data, semester, ledger, today],
  )

  if (!semester || !roll) {
    return (
      <>
        <PageHead title="Semester" />
        <Empty icon="🎓" title="No semester yet">
          <button className="primary" onClick={() => setSemForm('new')}>
            Set up a semester
          </button>
        </Empty>
        {semForm && <SemesterForm onClose={() => setSemForm(null)} />}
      </>
    )
  }

  const all = [...roll.college, ...roll.stay, ...roll.other]
  const t = totals(all)

  function list(bucket: Bucket, occs: Occurrence[], icon: string, label: string, hint: string) {
    const groups = groupByCommitment(occs)
    const tt = totals(occs)
    return (
      <Section
        title={`${icon} ${label}`}
        aside={occs.length > 0 && `${formatWhole(tt.total)} · ${formatWhole(tt.remaining)} left`}
        action={
          <button className="ghost small" onClick={() => setEditing({ bucket })}>
            + Add
          </button>
        }
      >
        {groups.length === 0 ? (
          <p className="muted small">{hint}</p>
        ) : (
          <ul className="items">
            {groups.map((g) => (
              <ItemRow
                key={g.commitment.id}
                commitment={g.commitment}
                occurrences={g.occurrences}
                onEdit={() => setEditing({ bucket: g.commitment.bucket, initial: g.commitment })}
              />
            ))}
          </ul>
        )}
      </Section>
    )
  }

  return (
    <>
      <PageHead
        title={`${semester.name} · fixed costs`}
        subtitle={`${formatDate(semester.start_date, today)} – ${formatDate(semester.end_date, today)}`}
        action={
          <div className="row">
            <button className="ghost" onClick={() => setSemForm('edit')}>
              Edit semester
            </button>
            <button className="ghost" onClick={() => setSemForm('new')}>
              + New semester
            </button>
          </div>
        }
      />

      <div className="stats">
        <Stat label="Total fixed costs" value={formatWhole(t.total)} />
        <Stat label="Paid" value={formatWhole(t.paid)} tone="good" sub={<Progress value={t.paid} max={t.total} label="" />} />
        <Stat label="Left to pay" value={formatWhole(t.remaining)} tone={t.remaining > 0 ? 'warn' : 'default'} />
      </div>

      {list('college', roll.college, '🎓', 'College', 'Tuition, fees, books, health insurance…')}
      {list('stay', roll.stay, '🏠', 'Stay', 'Rent, utilities, internet, deposit…')}
      {roll.other.length > 0 && list('other', roll.other, '📌', 'Other', '')}

      {editing && (
        <ItemForm
          bucket={editing.bucket}
          initial={editing.initial}
          semester={semester}
          onClose={() => setEditing(null)}
        />
      )}
      {semForm && <SemesterForm initial={semForm === 'edit' ? semester : null} onClose={() => setSemForm(null)} />}
    </>
  )
}
