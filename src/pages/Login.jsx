import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-bg text-white flex flex-col items-center px-6 pt-20">
      <div className="w-24 h-24 rounded-3xl bg-orange flex items-center justify-center mb-8">
        <span className="font-display text-white text-4xl">BB</span>
      </div>

      <h1 className="font-display text-4xl text-center leading-tight mb-2">
        GET ROASTED.<br />GET BETTER.
      </h1>
      <p className="text-muted font-body mb-10">Track activities. Earn roasts.</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <label className="block text-muted text-sm tracking-widest font-body font-semibold mb-2">
          EMAIL
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="marcus@example.com"
          className="w-full bg-panel border border-panel-border rounded-2xl px-5 py-4 text-white font-body mb-5 focus:border-orange outline-none"
        />

        <label className="block text-muted text-sm tracking-widest font-body font-semibold mb-2">
          PASSWORD
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-panel border border-panel-border rounded-2xl px-5 py-4 text-white font-body outline-none focus:border-orange"
        />

        <div className="text-right mt-3 mb-6">
          <button type="button" className="text-orange font-body text-sm">
            Forgot password?
          </button>
        </div>

        {error && <p className="text-red-400 font-body text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-orange text-white font-display text-lg py-4 rounded-2xl mb-5 disabled:opacity-60"
        >
          {submitting ? 'SIGNING IN...' : 'SIGN IN'}
        </button>

        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1 h-px bg-panel-border" />
          <span className="text-muted font-body text-sm">OR</span>
          <div className="flex-1 h-px bg-panel-border" />
        </div>

        <Link
          to="/signup"
          className="block text-center w-full border-2 border-orange text-orange font-display text-lg py-4 rounded-2xl"
        >
          CREATE ACCOUNT
        </Link>

        <p className="text-muted font-body text-sm text-center mt-6">
          By signing in you agree to our Terms & Privacy Policy
        </p>
      </form>
    </div>
  )
}
