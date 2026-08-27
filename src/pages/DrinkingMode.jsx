import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const DRINK_TYPES = [
  { key: 'Beer', icon: '🍺' },
  { key: 'Wine', icon: '🍷' },
  { key: 'Cocktail', icon: '🍹' },
  { key: 'Shot', icon: '🥃' },
]

// The redesigned pace scale: purely qualitative, icon-based, no BAC
// number and no "legal limit" framing -- per the agreed redesign, since
// a precise-looking percentage next to a legal threshold risks implying
// it's a reliable signal for whether someone's okay to drive, which
// self-estimated BAC genuinely isn't.
const PACE_TIERS = [
  { max: 0, icon: '🏜️', label: 'Bone Dry' },
  { max: 2, icon: '💧', label: 'Getting Started' },
  { max: 4, icon: '🌊', label: 'Cruising' },
  { max: 6, icon: '🍺', label: 'Well Hydrated' },
  { max: Infinity, icon: '🌧️', label: 'Drenched' },
]

// "Tonight" is a rolling 6-hour window rather than requiring an
// explicit start/end -- simplest way to give a meaningful "tonight"
// total without needing session-boundary logic.
const TONIGHT_WINDOW_MS = 6 * 60 * 60 * 1000

function paceTierFor(count) {
  return PACE_TIERS.find((t) => count <= t.max)
}

export default function DrinkingMode() {
  const { user, profile } = useAuth()
  const [drinkType, setDrinkType] = useState('Beer')
  const [quantity, setQuantity] = useState(1)
  const [tonightTotal, setTonightTotal] = useState(0)
  const [logging, setLogging] = useState(false)
  const [loadingTotal, setLoadingTotal] = useState(true)

  async function loadTonightTotal() {
    setLoadingTotal(true)
    const since = new Date(Date.now() - TONIGHT_WINDOW_MS).toISOString()
    const { data, error } = await supabase
      .from('drink_logs')
      .select('quantity')
      .eq('user_id', user.id)
      .gte('created_at', since)

    if (!error) {
      const total = (data ?? []).reduce((sum, row) => sum + row.quantity, 0)
      setTonightTotal(total)
    }
    setLoadingTotal(false)
  }

  useEffect(() => {
    if (user) loadTonightTotal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const currentTier = paceTierFor(tonightTotal)
  const currentTierIndex = PACE_TIERS.indexOf(currentTier)

  async function handleLogDrinks() {
    setLogging(true)
    try {
      const { error } = await supabase.from('drink_logs').insert({
        user_id: user.id,
        drink_type: drinkType,
        quantity,
      })
      if (error) throw error

      const newTotal = tonightTotal + quantity
      const name = profile?.screen_name ?? 'Someone'
      const tier = paceTierFor(newTotal)

      await supabase.from('feed_posts').insert({
        user_id: user.id,
        group_id: profile.group_id,
        activity_type: 'DRINK_LOG',
        body: `${name} logged ${quantity} ${drinkType.toLowerCase()}${quantity === 1 ? '' : 's'} tonight. Pace check: ${tier.label} ${tier.icon}`,
      })

      setTonightTotal(newTotal)
      setQuantity(1)
    } catch (err) {
      alert(`Couldn't log drinks: ${err.message ?? err}`)
    } finally {
      setLogging(false)
    }
  }

  async function handleRegret() {
    if (!confirm('Post this to the group feed? There\'s no undo on a good roast.')) return

    setLogging(true)
    try {
      const name = profile?.screen_name ?? 'Someone'
      const { error } = await supabase.from('feed_posts').insert({
        user_id: user.id,
        group_id: profile.group_id,
        activity_type: 'DRINK_REGRET',
        body: `${name} just hit "I Regret This" after ${tonightTotal} drink${tonightTotal === 1 ? '' : 's'} tonight. ${currentTier.label} ${currentTier.icon}`,
      })
      if (error) throw error
    } catch (err) {
      alert(`Couldn't post: ${err.message ?? err}`)
    } finally {
      setLogging(false)
    }
  }

  return (
    <Layout>
      <p className="text-drink text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        DRINKING MODE
      </p>
      <h1 className="font-display text-4xl text-drink mb-8">Belly Up to the Bar</h1>

      <div className="bg-panel border border-panel-border rounded-2xl p-6 mb-6">
        <p className="text-muted text-sm tracking-widest font-body font-semibold mb-4">
          TONIGHT&rsquo;S PACE
        </p>
        <div className="flex items-center justify-between mb-3">
          {PACE_TIERS.map((tier, i) => (
            <span
              key={tier.label}
              className="text-3xl transition-all"
              style={{
                opacity: i === currentTierIndex ? 1 : 0.25,
                transform: i === currentTierIndex ? 'scale(1.3)' : 'scale(1)',
              }}
              aria-hidden="true"
            >
              {tier.icon}
            </span>
          ))}
        </div>
        <p className="text-center font-display text-2xl text-drink">
          {loadingTotal ? '...' : currentTier.label}
        </p>
        <p className="text-center text-muted font-body text-sm">
          {loadingTotal ? '' : `${tonightTotal} drink${tonightTotal === 1 ? '' : 's'} in the last 6 hours`}
        </p>
      </div>

      <p className="text-muted text-sm tracking-widest font-body font-semibold mb-3">
        DRINK TYPE
      </p>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {DRINK_TYPES.map((d) => (
          <button
            key={d.key}
            onClick={() => setDrinkType(d.key)}
            className={`flex flex-col items-center gap-1 py-4 rounded-2xl border-2 font-body font-semibold text-sm ${
              drinkType === d.key
                ? 'border-drink text-drink bg-drink/10'
                : 'border-panel-border text-muted'
            }`}
          >
            <span className="text-2xl">{d.icon}</span>
            {d.key}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between bg-panel border border-panel-border rounded-2xl px-5 py-4 mb-6">
        <div>
          <p className="font-body font-semibold">Log how many</p>
          <p className="text-muted font-body text-sm">{drinkType} · 1 unit each</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-9 h-9 rounded-full bg-black/30 text-white text-lg"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="font-display text-3xl text-drink w-8 text-center">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="w-9 h-9 rounded-full bg-black/30 text-white text-lg"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={handleLogDrinks}
        disabled={logging}
        className="w-full bg-drink text-white font-display text-lg py-4 rounded-2xl mb-4 disabled:opacity-60"
      >
        {logging ? 'LOGGING...' : 'LOG DRINKS'}
      </button>

      <button
        onClick={handleRegret}
        disabled={logging}
        className="w-full bg-red-600 text-white font-display text-lg py-4 rounded-2xl disabled:opacity-60"
      >
        I REGRET THIS
      </button>
    </Layout>
  )
}
