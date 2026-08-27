import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const TAGS = [
  { key: 'Great', icon: '✅', color: 'text-green-400 border-green-500' },
  { key: 'Failed', icon: '❌', color: 'text-red-400 border-red-500' },
  { key: 'Water', icon: '💧', color: 'text-blue-400 border-blue-500' },
  { key: 'Sand', icon: '🏖️', color: 'text-yellow-400 border-yellow-500' },
  { key: 'Tree', icon: '🌲', color: 'text-green-400 border-green-500' },
  { key: 'Out of Bounds', icon: '🚧', color: 'text-orange-400 border-orange-500' },
  { key: 'Lost Ball', icon: '❓', color: 'text-red-400 border-red-500' },
]

function NumberPicker({ label, value, onChange, min = 0 }) {
  return (
    <div className="flex flex-col items-center flex-1">
      <p className="text-muted text-xs tracking-widest font-body font-semibold mb-2">{label}</p>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-9 h-9 rounded-full bg-panel border border-panel-border text-white text-lg mb-1"
        aria-label={`Increase ${label}`}
      >
        +
      </button>
      <span className="font-display text-3xl mb-1">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 h-9 rounded-full bg-panel border border-panel-border text-white text-lg"
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
    </div>
  )
}

export default function GolfMode() {
  const { user, profile } = useAuth()
  const [courseName, setCourseName] = useState('')
  const [hole, setHole] = useState(1)
  const [par, setPar] = useState(4)
  const [score, setScore] = useState(4)
  const [putts, setPutts] = useState(2)
  const [selectedTag, setSelectedTag] = useState(null)
  const [ballPosition, setBallPosition] = useState(null) // {x, y} percentage within the diagram
  const [location, setLocation] = useState(null) // {lat, lng} or 'denied' or 'unavailable'
  const [capturingLocation, setCapturingLocation] = useState(false)
  const [logging, setLogging] = useState(false)

  function handleDiagramTap(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setBallPosition({ x, y })
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setLocation('unavailable')
      return
    }
    setCapturingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setCapturingLocation(false)
      },
      () => {
        // Permission denied or another error -- this should never block
        // logging a hole, just means no location gets attached.
        setLocation('denied')
        setCapturingLocation(false)
      },
      { timeout: 8000 }
    )
  }

  async function handleLogShot() {
    setLogging(true)
    try {
      const hasRealLocation = location && typeof location === 'object'

      const { error } = await supabase.from('golf_holes').insert({
        user_id: user.id,
        course_name: courseName || null,
        hole_number: hole,
        par,
        score,
        putts,
        notable_tag: selectedTag,
        latitude: hasRealLocation ? location.lat : null,
        longitude: hasRealLocation ? location.lng : null,
      })
      if (error) throw error

      if (selectedTag) {
        const name = profile?.screen_name ?? 'Someone'
        const relativeToPar = score - par
        const parDescription =
          relativeToPar === 0 ? 'even par' : relativeToPar > 0 ? `+${relativeToPar}` : `${relativeToPar}`

        const messages = {
          Great: `${name} nailed hole ${hole} (${parDescription}). Someone's showing off.`,
          Failed: `${name} fell apart on hole ${hole} -- ${score} strokes on a par ${par}.`,
          Water: `${name} found the water on hole ${hole}. Splash.`,
          Sand: `${name} is building sandcastles in the trap on hole ${hole}.`,
          Tree: `${name}'s ball is now a permanent tree ornament on hole ${hole}.`,
          'Out of Bounds': `${name} sent one out of bounds on hole ${hole}. Bold strategy.`,
          'Lost Ball': `${name} lost a ball on hole ${hole}. RIP.`,
        }

        await supabase.from('feed_posts').insert({
          user_id: user.id,
          group_id: profile.group_id,
          activity_type: selectedTag === 'Great' ? 'GOLF_GREAT' : 'GOLF_FAIL',
          body: messages[selectedTag] ?? `${name} logged hole ${hole}.`,
        })
      }

      // Reset for the next hole, but keep the course name and advance
      // the hole number automatically.
      setHole((h) => Math.min(18, h + 1))
      setSelectedTag(null)
      setBallPosition(null)
    } catch (err) {
      alert(`Couldn't log hole: ${err.message ?? err}`)
    } finally {
      setLogging(false)
    }
  }

  return (
    <Layout>
      <p className="text-golf text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        GOLF MODE
      </p>
      <h1 className="font-display text-4xl text-golf mb-6">FORE!</h1>

      <p className="text-golf font-display text-lg mb-2">Course</p>
      <input
        value={courseName}
        onChange={(e) => setCourseName(e.target.value)}
        placeholder="Where are you playing today?"
        className="w-full bg-[#08150C] border border-golf/40 rounded-2xl px-5 py-4 text-white font-body mb-6 outline-none focus:border-golf"
      />

      {/* Schematic hole diagram -- not a real map. Tap to mark roughly
          where your ball landed; this is for fun/visual reference, not
          precise GPS yardage (see README for why). */}
      <div
        onClick={handleDiagramTap}
        className="relative w-full rounded-2xl overflow-hidden mb-3 cursor-crosshair"
        style={{ height: '280px', background: 'linear-gradient(180deg, #1B4D2E 0%, #143A22 100%)' }}
      >
        <div
          className="absolute rounded-full"
          style={{ top: '8%', left: '50%', width: '90px', height: '90px', transform: 'translateX(-50%)', background: '#2E7D46' }}
        />
        <div className="absolute" style={{ top: '10%', left: '50%', transform: 'translateX(-50%)', fontSize: '28px' }}>
          🚩
        </div>
        <div
          className="absolute rounded-full opacity-80"
          style={{ top: '35%', left: '20%', width: '55px', height: '38px', background: '#C4A46A' }}
        />
        <div
          className="absolute rounded-full opacity-80"
          style={{ top: '48%', right: '15%', width: '65px', height: '48px', background: '#2E6FA8' }}
        />
        {ballPosition && (
          <div
            className="absolute w-4 h-4 rounded-full bg-white border-2 border-golf shadow-lg"
            style={{ left: `${ballPosition.x}%`, top: `${ballPosition.y}%`, transform: 'translate(-50%, -50%)' }}
          />
        )}
        <p className="absolute bottom-2 left-2 text-white/60 font-body text-xs">Tap to mark your ball</p>
      </div>

      <button
        onClick={captureLocation}
        disabled={capturingLocation}
        className="text-golf font-body text-sm mb-6 disabled:opacity-60"
      >
        {capturingLocation
          ? '📍 Getting your location...'
          : location && typeof location === 'object'
          ? `📍 Location captured (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`
          : location === 'denied'
          ? '📍 Location unavailable -- tap to try again'
          : '📍 Capture my location'}
      </button>

      <p className="text-muted text-sm tracking-widest font-body font-semibold mb-3">
        WHAT HAPPENED?
      </p>
      <div className="grid grid-cols-4 gap-2 mb-6">
        {TAGS.map((tag) => (
          <button
            key={tag.key}
            onClick={() => setSelectedTag(selectedTag === tag.key ? null : tag.key)}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-body text-xs font-semibold ${
              selectedTag === tag.key ? tag.color + ' bg-white/5' : 'border-panel-border text-muted'
            }`}
          >
            <span className="text-xl">{tag.icon}</span>
            {tag.key}
          </button>
        ))}
      </div>

      <div className="flex justify-between border-y border-panel-border py-4 mb-6">
        <NumberPicker label="HOLE" value={hole} onChange={setHole} min={1} />
        <NumberPicker label="PAR" value={par} onChange={setPar} min={3} />
        <NumberPicker label="SCORE" value={score} onChange={setScore} min={1} />
        <NumberPicker label="PUTTS" value={putts} onChange={setPutts} min={0} />
      </div>

      <button
        onClick={handleLogShot}
        disabled={logging}
        className="w-full bg-golf text-black font-display text-lg py-4 rounded-2xl disabled:opacity-60"
      >
        {logging ? 'LOGGING...' : '⛳ LOG HOLE'}
      </button>
    </Layout>
  )
}
