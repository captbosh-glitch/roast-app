import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const MODES = [
  {
    key: 'golf',
    label: 'GOLF',
    color: 'golf',
    icon: '⛳',
    desc: 'GPS yardage, shot tracking & scorecards',
    quote: '"Miss the fairway. Own it."',
    to: '/mode/golf',
  },
  {
    key: 'gym',
    label: 'GYM',
    color: 'gym',
    icon: '🏋️',
    desc: 'Sets, reps, weight & failure tracking',
    quote: `"Can't finish a set? We'll tell everyone."`,
    to: '/mode/gym',
  },
  {
    key: 'bowling',
    label: 'BOWLING',
    color: 'bowling',
    icon: '🎳',
    desc: 'Pin selector, frame scoring & splits',
    quote: '"Gutter balls are social gold."',
    to: '/mode/bowling',
  },
  {
    key: 'drinking',
    label: 'DRINKING',
    color: 'drink',
    icon: '🍺',
    desc: 'Drink counter, pace meter & regret button',
    quote: '"One too many? We knew before you did."',
    to: '/mode/drinking',
  },
]

const colorClasses = {
  golf: { border: 'border-l-golf', text: 'text-golf' },
  gym: { border: 'border-l-gym', text: 'text-gym' },
  bowling: { border: 'border-l-bowling', text: 'text-bowling' },
  drink: { border: 'border-l-drink', text: 'text-drink' },
}

export default function ModeLauncher() {
  const { profile } = useAuth()

  return (
    <Layout>
      <p className="text-muted text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        WELCOME{profile?.screen_name ? `, ${profile.screen_name.toUpperCase()}` : ''}!
      </p>
      <h1 className="font-display text-4xl mb-8">Choose Your Mode</h1>

      <div className="space-y-4">
        {MODES.map((mode) => {
          const c = colorClasses[mode.color]
          return (
            <Link
              key={mode.key}
              to={mode.to}
              className={`flex items-center gap-4 bg-panel border border-panel-border ${c.border} border-l-4 rounded-2xl p-5`}
            >
              <div className="w-14 h-14 rounded-xl bg-black/30 flex items-center justify-center text-2xl flex-shrink-0">
                {mode.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-display text-xl ${c.text}`}>{mode.label}</p>
                <p className="text-white font-body text-sm">{mode.desc}</p>
                <p className={`font-body text-sm italic mt-1 ${c.text}`}>{mode.quote}</p>
              </div>
              <span className={`text-2xl ${c.text}`}>›</span>
            </Link>
          )
        })}
      </div>
    </Layout>
  )
}
