import { useEffect, type ReactNode } from 'react'
import { formatWhole } from '../money'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

type Tone = 'default' | 'good' | 'bad' | 'warn' | 'accent'

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className={`stat tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="progress-wrap">
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      {label !== undefined && <span className="progress-label">{label || `${pct}% paid`}</span>}
    </div>
  )
}

export interface Segment {
  key: string
  label: string
  value: number
  color: string
}

/** Horizontal stacked bar with a legend; zero-value segments are hidden. */
export function StackedBar({ segments }: { segments: Segment[] }) {
  const shown = segments.filter((s) => s.value > 0)
  const total = shown.reduce((s, x) => s + x.value, 0)
  if (total === 0) return null
  return (
    <div>
      <div className="stacked">
        {shown.map((s) => (
          <div
            key={s.key}
            className="stacked-seg"
            style={{ flexGrow: s.value, background: s.color }}
            title={`${s.label}: ${formatWhole(s.value)}`}
          />
        ))}
      </div>
      <ul className="legend">
        {shown.map((s) => (
          <li key={s.key}>
            <span className="swatch" style={{ background: s.color }} />
            {s.label} <strong>{formatWhole(s.value)}</strong>
            <span className="muted"> · {Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Section({
  title,
  aside,
  action,
  children,
}: {
  title: ReactNode
  aside?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h3>{title}</h3>
        {aside && <span className="section-aside">{aside}</span>}
        <span className="spacer" />
        {action}
      </div>
      {children}
    </section>
  )
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        {icon}
      </div>
      <div className="empty-title">{title}</div>
      {children && <div className="empty-body">{children}</div>}
    </div>
  )
}

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
