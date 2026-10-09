import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setState('idle')
    } else {
      setState('sent')
    }
  }

  return (
    <main className="narrow">
      <h1>Payments</h1>
      {state === 'sent' ? (
        <p>
          Check <strong>{email}</strong> for a sign-in link. You can close this tab; the link opens the app
          signed in.
        </p>
      ) : (
        <form onSubmit={submit} className="stack">
          <label>
            Email
            <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" className="primary" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </main>
  )
}
