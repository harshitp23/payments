import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import * as api from '../api'
import { currentSemester } from '../rollup'
import { indexLedger, todayIso } from '../schedule'
import { StoreContext, type Store } from '../store'
import Overview from './Overview'
import SemesterView from './SemesterView'
import Subscriptions from './Subscriptions'
import Plans from './Plans'
import IncomeView from './IncomeView'
import { SemesterForm } from './forms'

export type View = 'overview' | 'semester' | 'subscriptions' | 'plans' | 'income'

const NAV: { id: View; icon: string; label: string }[] = [
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'semester', icon: '🎓', label: 'Semester' },
  { id: 'subscriptions', icon: '🔁', label: 'Subscriptions' },
  { id: 'plans', icon: '✈️', label: 'Plans' },
  { id: 'income', icon: '💼', label: 'Income' },
]

function readView(): View {
  const h = window.location.hash.slice(1) as View
  return NAV.some((n) => n.id === h) ? h : 'overview'
}

export default function Dashboard({ session }: { session: Session }) {
  const [view, setView] = useState<View>(readView)
  const [data, setData] = useState<api.AllData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [semesterId, setSemesterId] = useState('')
  const [newSemester, setNewSemester] = useState(false)
  const today = todayIso()

  const go = useCallback((v: View) => {
    window.location.hash = v
    setView(v)
  }, [])

  useEffect(() => {
    const onHash = () => setView(readView())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const reload = useCallback(async () => {
    try {
      setData(await api.fetchAll())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn()
        await reload()
        return true
      } catch (e) {
        setError((e as Error).message)
        return false
      }
    },
    [reload],
  )

  const store = useMemo<Store | null>(() => {
    if (!data) return null
    const semester = data.semesters.find((s) => s.id === semesterId) ?? currentSemester(data.semesters, today)
    return { data, ledger: indexLedger(data.ledger), today, semester, setSemesterId, run }
  }, [data, semesterId, today, run])

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">₵</span> Payments
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className={view === n.id ? 'active' : ''}
              aria-current={view === n.id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                go(n.id)
              }}
            >
              <span className="nav-icon" aria-hidden>
                {n.icon}
              </span>
              <span className="nav-label">{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="muted small truncate" title={session.user.email}>
            {session.user.email}
          </span>
          <button className="ghost small" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          {store && store.data.semesters.length > 0 && (
            <label className="semester-picker">
              <span className="muted small">Semester</span>
              <select
                value={store.semester?.id ?? ''}
                onChange={(e) => (e.target.value === '__new' ? setNewSemester(true) : setSemesterId(e.target.value))}
              >
                {store.data.semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="__new">+ New semester…</option>
              </select>
            </label>
          )}
          <span className="spacer" />
          <button className="ghost small mobile-only" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </header>

        {error && (
          <div className="alert error-alert" role="alert">
            {error}
            <button className="link" onClick={() => setError(null)}>
              dismiss
            </button>
          </div>
        )}

        <main className="content">
          {!store ? (
            <div className="loading">Loading…</div>
          ) : (
            <StoreContext.Provider value={store}>
              {view === 'overview' && <Overview go={go} />}
              {view === 'semester' && <SemesterView />}
              {view === 'subscriptions' && <Subscriptions />}
              {view === 'plans' && <Plans />}
              {view === 'income' && <IncomeView />}
              {newSemester && <SemesterForm onClose={() => setNewSemester(false)} />}
            </StoreContext.Provider>
          )}
        </main>
      </div>
    </div>
  )
}
