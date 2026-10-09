import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configError, supabase } from './supabase'
import SignIn from './components/SignIn'
import Dashboard from './components/Dashboard'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (configError) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (configError) {
    return (
      <main className="narrow">
        <h1>Payments</h1>
        <p className="error">{configError}</p>
      </main>
    )
  }
  if (!ready) return <main className="narrow muted">Loading…</main>
  if (!session) return <SignIn />
  return <Dashboard session={session} />
}
