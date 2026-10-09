import { useMemo, useState } from 'react'
import { formatWhole } from '../money'
import { EARLIEST, groupByCommitment } from '../rollup'
import { daysUntil, formatDate, occurrencesBetween, relativeDays, totals, type Occurrence } from '../schedule'
import { useStore } from '../store'
import type { Commitment, Trip } from '../types'
import ItemForm from './ItemForm'
import ItemRow from './ItemRow'
import { TripForm } from './forms'
import { Empty, PageHead, Progress, Section, Stat } from './ui'

type Editing =
  | { kind: 'trip'; trip?: Trip }
  | { kind: 'tripItem'; trip: Trip; initial?: Commitment }
  | { kind: 'estimate'; initial?: Commitment }
  | null

const FAR = '9999-12-31'

export default function Plans() {
  const { data, ledger, today } = useStore()
  const [editing, setEditing] = useState<Editing>(null)
  const [showPast, setShowPast] = useState(false)

  const { trips, estimates } = useMemo(() => {
    const occ = (c: Commitment) => occurrencesBetween(c, EARLIEST, FAR, ledger, today)
    const trips = data.trips.map((trip) => {
      const items = data.commitments.filter((c) => c.trip_id === trip.id && !c.is_archived).flatMap(occ)
      return { trip, items, t: totals(items), past: (trip.end_date ?? trip.start_date) < today }
    })
    const estimates = data.commitments.filter((c) => c.bucket === 'estimate' && !c.is_archived).flatMap(occ)
    return { trips, estimates }
  }, [data, ledger, today])

  const upcoming = trips.filter((x) => !x.past)
  const past = trips.filter((x) => x.past)
  const tripsTotal = upcoming.reduce((s, x) => s + x.t.total, 0)
  const estTotal = totals(estimates.filter((o) => o.status !== 'paid' || o.dueDate >= today)).total

  return (
    <>
      <PageHead
        title="Plans & estimates"
        subtitle="Trips and bigger spends you see coming."
        action={
          <div className="row">
            <button className="ghost" onClick={() => setEditing({ kind: 'estimate' })}>
              + Estimate
            </button>
            <button className="primary" onClick={() => setEditing({ kind: 'trip' })}>
              + Plan a trip
            </button>
          </div>
        }
      />

      <div className="stats">
        <Stat label="Total planned" value={formatWhole(tripsTotal + estTotal)} tone="accent" />
        <Stat label="Upcoming trips" value={formatWhole(tripsTotal)} sub={`${upcoming.length} trip${upcoming.length === 1 ? '' : 's'}`} />
        <Stat label="Other estimates" value={formatWhole(estTotal)} sub="shopping, gifts, events…" />
      </div>

      <h2 className="group-title">✈️ Trips</h2>
      {upcoming.length === 0 && (
        <Empty icon="🧳" title="No upcoming trips">
          <button className="primary" onClick={() => setEditing({ kind: 'trip' })}>
            Plan a trip
          </button>
        </Empty>
      )}
      <div className="trip-grid">
        {upcoming.map((x) => (
          <TripCard key={x.trip.id} {...x} setEditing={setEditing} />
        ))}
      </div>

      {past.length > 0 && (
        <>
          <button className="ghost small" onClick={() => setShowPast(!showPast)}>
            {showPast ? '▾' : '▸'} Past trips ({past.length})
          </button>
          {showPast && (
            <div className="trip-grid">
              {past.map((x) => (
                <TripCard key={x.trip.id} {...x} setEditing={setEditing} />
              ))}
            </div>
          )}
        </>
      )}

      <Section
        title="🛍️ Other estimates"
        aside={estimates.length > 0 && formatWhole(estTotal)}
        action={
          <button className="ghost small" onClick={() => setEditing({ kind: 'estimate' })}>
            + Add
          </button>
        }
      >
        {estimates.length === 0 ? (
          <p className="muted small">Shopping, gifts, concerts, a new laptop… rough numbers are fine.</p>
        ) : (
          <ul className="items">
            {groupByCommitment(estimates).map((g) => (
              <ItemRow
                key={g.commitment.id}
                commitment={g.commitment}
                occurrences={g.occurrences}
                sub={[g.commitment.category, formatDate(g.commitment.due_date, today)].filter(Boolean).join(' · ')}
                onEdit={() => setEditing({ kind: 'estimate', initial: g.commitment })}
              />
            ))}
          </ul>
        )}
      </Section>

      {editing?.kind === 'trip' && <TripForm initial={editing.trip} onClose={() => setEditing(null)} />}
      {editing?.kind === 'tripItem' && (
        <ItemForm bucket="trip" trip={editing.trip} initial={editing.initial} onClose={() => setEditing(null)} />
      )}
      {editing?.kind === 'estimate' && (
        <ItemForm bucket="estimate" initial={editing.initial} onClose={() => setEditing(null)} />
      )}
    </>
  )
}

function TripCard({
  trip,
  items,
  t,
  past,
  setEditing,
}: {
  trip: Trip
  items: Occurrence[]
  t: ReturnType<typeof totals>
  past: boolean
  setEditing: (e: Editing) => void
}) {
  const { today } = useStore()
  const byCat = new Map<string, number>()
  for (const o of items) {
    const k = o.commitment.category || 'other'
    byCat.set(k, (byCat.get(k) ?? 0) + o.netCents)
  }
  const days = daysUntil(trip.start_date, today)

  return (
    <article className={`trip ${past ? 'past' : ''}`}>
      <header className="trip-head">
        <div>
          <h3>{trip.name}</h3>
          <div className="muted small">
            {formatDate(trip.start_date, today)}
            {trip.end_date && ` – ${formatDate(trip.end_date, today)}`}
            {!past && days >= 0 && ` · ${relativeDays(trip.start_date, today)}`}
          </div>
        </div>
        <button className="icon-btn" onClick={() => setEditing({ kind: 'trip', trip })} aria-label="Edit trip" title="Edit trip">
          ✎
        </button>
      </header>

      <div className="trip-total">
        <span className="muted small">Trip estimate</span>
        <span className="big">{formatWhole(t.total)}</span>
      </div>
      {t.total > 0 && <Progress value={t.paid} max={t.total} label={`${formatWhole(t.paid)} booked / paid`} />}

      {byCat.size > 0 && (
        <div className="cat-chips">
          {[...byCat.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([cat, v]) => (
              <span key={cat} className="chip">
                {cat} <strong>{formatWhole(v)}</strong>
              </span>
            ))}
        </div>
      )}

      {items.length > 0 && (
        <ul className="items compact">
          {groupByCommitment(items).map((g) => (
            <ItemRow
              key={g.commitment.id}
              commitment={g.commitment}
              occurrences={g.occurrences}
              sub={g.commitment.category ?? undefined}
              onEdit={() => setEditing({ kind: 'tripItem', trip, initial: g.commitment })}
            />
          ))}
        </ul>
      )}

      <button className="ghost small add-line" onClick={() => setEditing({ kind: 'tripItem', trip })}>
        + Add expense (cab, stay, travel…)
      </button>
      {trip.notes && <p className="small muted">{trip.notes}</p>}
    </article>
  )
}
