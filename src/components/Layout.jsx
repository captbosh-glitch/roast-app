import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

function Logo() {
  return (
    <div className="w-11 h-11 rounded-2xl bg-orange flex items-center justify-center flex-shrink-0">
      <span className="font-display text-white text-lg">BB</span>
    </div>
  )
}

function RolloverMenu({ open, onClose }) {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const modeLinks = [
    { label: 'GOLF', to: '/mode/golf', color: 'text-golf' },
    { label: 'GYM', to: '/mode/gym', color: 'text-gym' },
    { label: 'BOWLING', to: '/mode/bowling', color: 'text-bowling' },
    { label: 'DRINKING', to: '/mode/drinking', color: 'text-drink' },
  ]

  function go(to) {
    onClose()
    navigate(to)
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <nav
        className={`fixed top-0 left-0 h-full w-72 bg-[#121212] z-50 p-8 transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main menu"
      >
        <p className="text-muted text-sm tracking-widest font-body font-semibold mb-3">MODE</p>
        <ul className="mb-8 space-y-4">
          {modeLinks.map((m) => (
            <li key={m.label}>
              <button
                onClick={() => go(m.to)}
                className={`${m.color} font-body font-bold tracking-wide text-lg text-left`}
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>
        <ul className="space-y-5">
          <li>
            <button onClick={() => go('/feed')} className="text-muted font-body font-bold tracking-wide text-lg">
              LIVE FEED
            </button>
          </li>
          <li>
            <button onClick={() => go('/group')} className="text-muted font-body font-bold tracking-wide text-lg">
              YOUR GROUP
            </button>
          </li>
          <li>
            <button onClick={() => go('/group/join')} className="text-muted font-body font-bold tracking-wide text-lg">
              JOIN / CREATE GROUP
            </button>
          </li>
          <li>
            <button onClick={() => go('/profile')} className="text-muted font-body font-bold tracking-wide text-lg">
              PROFILE
            </button>
          </li>
        </ul>
        <button
          onClick={async () => { await signOut(); go('/login') }}
          className="mt-10 text-sm text-muted underline font-body"
        >
          Sign out
        </button>
      </nav>
    </>
  )
}

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg text-white">
      <header className="flex items-center gap-9 px-6 py-5">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="flex flex-col gap-1.5 w-7"
        >
          <span className="h-0.5 w-full bg-muted" />
          <span className="h-0.5 w-full bg-muted" />
          <span className="h-0.5 w-full bg-muted" />
        </button>
        <Link to="/">
          <Logo />
        </Link>
      </header>

      <RolloverMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="px-6 pb-16">{children}</main>
    </div>
  )
}
