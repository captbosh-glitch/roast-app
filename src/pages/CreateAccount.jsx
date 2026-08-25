import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

export default function CreateAccount() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    const { error } = await signUp(email, password)
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/profile')
  }

  return (
    <Layout>
      <p className="text-muted text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        JOIN THE FUN
      </p>
      <h1 className="font-display text-4xl mb-8">Create Account</h1>

      <p className="text-muted text-sm tracking-widest font-body font-semibold text-center mb-4">
        CONTINUE WITH
      </p>
      {/* Social sign-in: visual placeholders for now -- real OAuth setup
          for each provider is separate follow-up work, not wired yet. */}
      <div className="flex justify-center gap-6 mb-8" aria-label="Social sign-in (coming soon)">
        {['G', '', 'f', 'a'].map((label, i) => (
          <button
            key={i}
            type="button"
            title="Coming soon"
            className="w-14 h-14 rounded-full bg-panel border border-panel-border flex items-center justify-center text-muted font-body font-bold opacity-60 cursor-not-allowed"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-px bg-panel-border" />
        <span className="text-muted font-body text-sm">OR</span>
        <div className="flex-1 h-px bg-panel-border" />
      </div>

      <form onSubmit={handleSubmit} className="max-w-sm">
        <input
          type="email"
          required
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-panel border border-panel-border rounded-2xl px-5 py-4 text-white font-body mb-5 outline-none focus:border-orange"
        />
        <input
          type="password"
          required
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-panel border border-panel-border rounded-2xl px-5 py-4 text-white font-body mb-5 outline-none focus:border-orange"
        />
        <input
          type="password"
          required
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full bg-panel border border-panel-border rounded-2xl px-5 py-4 text-white font-body mb-6 outline-none focus:border-orange"
        />

        {error && <p className="text-red-400 font-body text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-orange text-white font-display text-lg py-4 rounded-2xl disabled:opacity-60"
        >
          {submitting ? 'CREATING...' : 'CREATE ACCOUNT'}
        </button>
      </form>
    </Layout>
  )
}
