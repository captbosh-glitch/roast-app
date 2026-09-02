import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useGolfGPS, getDistanceInYards } from '../lib/golfGps'
import { PEBBLE_CREEK } from '../lib/pebbleCreekCourse'
import { getRoastForHole } from '../lib/roastDatabase'
import { generatePostRoundReport, getDrinkRoastLine } from '../lib/postRoundSummary'
import SatelliteMap from '../components/SatelliteMap'
import Layout from '../components/Layout'

function emptyScorecard() {
  const card = {}
  for (const hole of PEBBLE_CREEK.holes) {
    card[hole.number] = {
      strokes: hole.par,
      putts: 2,
      fairwayHit: null,
      gir: null,
      water: 0,
      sand: 0,
      penalties: 0,
      logged: false,
    }
  }
  return card
}

export default function GolfCaddie() {
  const { user, profile } = useAuth()
  const { position, error: gpsError } = useGolfGPS()

  const [roundSessionId, setRoundSessionId] = useState(crypto.randomUUID())
  const [roundStartTime, setRoundStartTime] = useState(new Date())
  const [mode, setMode] = useState('auto') // 'auto' | 'locked'
  const [activeHoleNumber, setActiveHoleNumber] = useState(1)
  const [scorecard, setScorecard] = useState(emptyScorecard())
  const [showScorecard, setShowScorecard] = useState(false)
  const [logPromptHole, setLogPromptHole] = useState(null)
  const [saving, setSaving] = useState(false)
  const [roastPopup, setRoastPopup] = useState(null)
  const [showPostRoundReport, setShowPostRoundReport] = useState(false)
  const [drinkType, setDrinkType] = useState('Beer')
  const [tonightTotal, setTonightTotal] = useState(0)

  async function loadTonightDrinks() {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('drink_logs')
      .select('quantity')
      .eq('user_id', user.id)
      .gte('created_at', since)
    setTonightTotal((data ?? []).reduce((sum, r) => sum + r.quantity, 0))
  }

  useEffect(() => {
    if (user) loadTonightDrinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleLogDrink() {
    setSaving(true)
    try {
      const { error } = await supabase.from('drink_logs').insert({
        user_id: user.id,
        drink_type: drinkType,
        quantity: 1,
      })
      if (error) throw error
      await loadTonightDrinks()
    } catch (err) {
      alert(`Couldn't log drink: ${err.message ?? err}`)
    } finally {
      setSaving(false)
    }
  }

  const [roundDrinks, setRoundDrinks] = useState(0)

  async function openPostRoundReport() {
    const { data } = await supabase
      .from('drink_logs')
      .select('quantity')
      .eq('user_id', user.id)
      .gte('created_at', roundStartTime.toISOString())
    setRoundDrinks((data ?? []).reduce((sum, r) => sum + r.quantity, 0))
    setShowPostRoundReport(true)
  }

  const activeHole = PEBBLE_CREEK.holes.find((h) => h.number === activeHoleNumber)
  const liveDistance = position
    ? getDistanceInYards(position.lat, position.lng, activeHole.lat, activeHole.lng)
    : null

  // Auto-detect: find the nearest green to the player's current
  // position and treat it as the active hole -- unless the player has
  // manually locked onto a specific hole (e.g. playing an approach from
  // an adjacent fairway that happens to be physically closer to a
  // different hole's green).
  useEffect(() => {
    if (mode !== 'auto' || !position) return

    let nearestHole = null
    let nearestDist = Infinity
    for (const hole of PEBBLE_CREEK.holes) {
      const d = getDistanceInYards(position.lat, position.lng, hole.lat, hole.lng)
      if (d < nearestDist) {
        nearestDist = d
        nearestHole = hole.number
      }
    }

    if (nearestHole && nearestHole !== activeHoleNumber) {
      // Auto-advancing to a new hole -- prompt to log the one just left,
      // if it hasn't been logged yet.
      if (!scorecard[activeHoleNumber]?.logged) {
        setLogPromptHole(activeHoleNumber)
      }
      setActiveHoleNumber(nearestHole)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, mode])

  function selectHoleManually(holeNumber) {
    setActiveHoleNumber(holeNumber)
    setMode('locked')
  }

  function resumeAutoTracking() {
    setMode('auto')
  }

  async function submitHoleLog(holeNumber, { strokes, putts, fairwayHit, gir, water, sand, penalties }) {
    setSaving(true)
    try {
      const hole = PEBBLE_CREEK.holes.find((h) => h.number === holeNumber)
      const { error } = await supabase.from('golf_holes').insert({
        user_id: user.id,
        course_name: PEBBLE_CREEK.name,
        hole_number: holeNumber,
        par: hole.par,
        score: strokes,
        putts,
        fairway_hit: fairwayHit,
        gir,
        water_hazards: water,
        sand_traps: sand,
        penalties,
        round_session_id: roundSessionId,
        latitude: position?.lat ?? null,
        longitude: position?.lng ?? null,
      })
      if (error) throw error

      setScorecard((prev) => ({
        ...prev,
        [holeNumber]: { strokes, putts, fairwayHit, gir, water, sand, penalties, logged: true },
      }))
      setLogPromptHole(null)

      // Immediate on-screen roast, right after a successful save.
      setRoastPopup(getRoastForHole({ hole: holeNumber, par: hole.par, strokes, putts, water, sand }))
    } catch (err) {
      alert(`Couldn't save hole score: ${err.message ?? err}`)
    } finally {
      setSaving(false)
    }
  }

  function startNewRound() {
    if (!confirm('Start a new round? This clears your current scorecard (already-logged holes stay saved).')) return
    setRoundSessionId(crypto.randomUUID())
    setRoundStartTime(new Date())
    setScorecard(emptyScorecard())
    setActiveHoleNumber(1)
    setMode('auto')
    setShowPostRoundReport(false)
  }

  async function postRoundSummaryToFeed(report, drinkLine) {
    setSaving(true)
    try {
      const name = profile?.screen_name ?? 'Someone'
      const drinkPart = drinkLine ? ` ${drinkLine}` : ''
      const { error } = await supabase.from('feed_posts').insert({
        user_id: user.id,
        group_id: profile.group_id,
        activity_type: report.scoreRelativeToPar <= 0 ? 'GOLF_GREAT' : 'GOLF_FAIL',
        body: `${name}'s round at ${PEBBLE_CREEK.name} -- "${report.badgeTitle}": ${report.headlineRoast} ${report.detailedRoast}${drinkPart}`,
      })
      if (error) throw error
      alert('Posted to the group feed!')
    } catch (err) {
      alert(`Couldn't post round summary: ${err.message ?? err}`)
    } finally {
      setSaving(false)
    }
  }

  const front9 = PEBBLE_CREEK.holes.filter((h) => h.number <= 9)
  const back9 = PEBBLE_CREEK.holes.filter((h) => h.number > 9)

  function totalsFor(holes) {
    let strokes = 0
    let par = 0
    let putts = 0
    let water = 0
    let sand = 0
    let penalties = 0
    let anyLogged = false
    for (const h of holes) {
      par += h.par
      if (scorecard[h.number]?.logged) {
        const entry = scorecard[h.number]
        strokes += entry.strokes
        putts += entry.putts
        water += entry.water ?? 0
        sand += entry.sand ?? 0
        penalties += entry.penalties ?? 0
        anyLogged = true
      }
    }
    return { strokes, par, putts, water, sand, penalties, anyLogged }
  }

  const frontTotals = totalsFor(front9)
  const backTotals = totalsFor(back9)
  const overallStrokes = frontTotals.strokes + backTotals.strokes
  const overallPar = frontTotals.par + backTotals.par
  const overallPutts = frontTotals.putts + backTotals.putts
  const overallWater = frontTotals.water + backTotals.water
  const overallSand = frontTotals.sand + backTotals.sand
  const holesLogged = PEBBLE_CREEK.holes.filter((h) => scorecard[h.number]?.logged).length

  // Build the array the report generator expects, from whichever holes
  // have actually been logged so far.
  const loggedHolesData = PEBBLE_CREEK.holes
    .filter((h) => scorecard[h.number]?.logged)
    .map((h) => {
      const entry = scorecard[h.number]
      return {
        par: h.par,
        strokes: entry.strokes,
        putts: entry.putts,
        waterHazards: entry.water ?? 0,
        sandTraps: entry.sand ?? 0,
        penaltyBalls: entry.penalties ?? 0,
      }
    })
  const postRoundReport =
    loggedHolesData.length > 0 ? generatePostRoundReport(loggedHolesData, PEBBLE_CREEK.name) : null
  const drinkRoastLine = postRoundReport
    ? getDrinkRoastLine({
        totalDrinks: roundDrinks,
        totalWater: postRoundReport.totalWater,
        totalSand: postRoundReport.totalSand,
        totalScore: postRoundReport.totalScore,
        scoreRelativeToPar: postRoundReport.scoreRelativeToPar,
      })
    : null

  return (
    <Layout>
      <p className="text-golf text-sm tracking-widest font-body font-semibold mt-4 mb-1">
        GPS CADDIE
      </p>
      <h1 className="font-display text-3xl text-golf mb-1">{PEBBLE_CREEK.name}</h1>
      {!PEBBLE_CREEK.coordinatesVerified && (
        <p className="text-yellow-400 font-body text-xs mb-4">
          ⚠️ Hole coordinates are AI-estimated, not yet field-verified. Distances may be off --
          please report anything that looks wrong.
        </p>
      )}

      {gpsError && (
        <div className="bg-red-900/30 border border-red-600 rounded-2xl p-4 mb-4">
          <p className="text-red-300 font-body text-sm">📍 {gpsError}</p>
        </div>
      )}

      {/* Live distance display */}
      <div className="bg-panel border border-panel-border rounded-2xl p-6 mb-4 text-center">
        <p className="text-muted font-body text-sm mb-1">
          Hole {activeHole.number} · Par {activeHole.par} · {activeHole.yards} yds
        </p>
        <p className="font-display text-6xl text-golf mb-1">
          {liveDistance !== null ? Math.round(liveDistance) : '--'}
        </p>
        <p className="text-muted font-body text-sm">yards to pin</p>
        {position?.accuracy && (
          <p className="text-muted font-body text-xs mt-2">
            GPS accuracy: ±{Math.round(position.accuracy)}m
          </p>
        )}
      </div>

      {/* Satellite eagle-eye view */}
      <SatelliteMap
        greenLat={activeHole.lat}
        greenLng={activeHole.lng}
        playerPosition={position}
      />

      {/* Auto/Manual mode indicator */}
      <div className="flex items-center justify-between bg-panel border border-panel-border rounded-2xl px-5 py-3 mb-4">
        <p className="font-body text-sm">
          {mode === 'auto' ? (
            <span className="text-golf">🛰️ Auto-tracking nearest hole</span>
          ) : (
            <span className="text-orange">🔒 Hole Locked (manual)</span>
          )}
        </p>
        {mode === 'locked' && (
          <button
            onClick={resumeAutoTracking}
            className="text-golf font-body text-sm underline"
          >
            Resume Auto-Tracking
          </button>
        )}
      </div>

      {/* Manual hole selector */}
      <div className="grid grid-cols-6 gap-2 mb-6">
        {PEBBLE_CREEK.holes.map((h) => (
          <button
            key={h.number}
            onClick={() => selectHoleManually(h.number)}
            className={`rounded-lg py-2 font-body text-sm font-semibold border-2 relative ${
              h.number === activeHoleNumber
                ? 'border-golf text-golf bg-golf/10'
                : 'border-panel-border text-muted'
            }`}
          >
            {h.number}
            {scorecard[h.number]?.logged && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500" />
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setLogPromptHole(activeHoleNumber)}
          className="flex-1 bg-golf text-black font-display text-base py-3 rounded-2xl"
        >
          Log Hole {activeHoleNumber} Score
        </button>
        <button
          onClick={() => setShowScorecard(true)}
          className="flex-1 border-2 border-golf text-golf font-display text-base py-3 rounded-2xl"
        >
          View Scorecard
        </button>
      </div>

      <button onClick={startNewRound} className="text-muted font-body text-sm underline mb-4">
        Start new round
      </button>

      <button
        onClick={openPostRoundReport}
        disabled={holesLogged === 0}
        className="block w-full text-center border-2 border-orange text-orange font-display text-base py-3 rounded-2xl disabled:opacity-30"
      >
        📋 Post-Round Report ({holesLogged}/18 logged)
      </button>

      <p className="text-muted text-sm tracking-widest font-body font-semibold mt-6 mb-3">
        DRINK TYPE
      </p>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {['Beer', 'Wine', 'Cocktail', 'Shot'].map((d) => (
          <button
            key={d}
            onClick={() => setDrinkType(d)}
            className={`py-3 rounded-xl border-2 font-body font-semibold text-sm ${
              drinkType === d ? 'border-drink text-drink bg-drink/10' : 'border-panel-border text-muted'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between bg-panel border border-panel-border rounded-2xl px-5 py-4">
        <div>
          <p className="font-body font-semibold">Drinks tonight</p>
          <p className="text-muted font-body text-sm">{tonightTotal} logged in the last 6 hours</p>
        </div>
        <button
          onClick={handleLogDrink}
          disabled={saving}
          className="bg-drink text-white font-body font-semibold text-sm px-4 py-2 rounded-xl disabled:opacity-60"
        >
          + Log {drinkType}
        </button>
      </div>

      {/* Log Hole Score prompt */}
      {logPromptHole !== null && (
        <LogHolePrompt
          holeNumber={logPromptHole}
          hole={PEBBLE_CREEK.holes.find((h) => h.number === logPromptHole)}
          existing={scorecard[logPromptHole]}
          saving={saving}
          onCancel={() => setLogPromptHole(null)}
          onSubmit={(values) => submitHoleLog(logPromptHole, values)}
        />
      )}

      {/* Scorecard modal */}
      {showScorecard && (
        <ScorecardModal
          scorecard={scorecard}
          front9={front9}
          back9={back9}
          frontTotals={frontTotals}
          backTotals={backTotals}
          overallStrokes={overallStrokes}
          overallPar={overallPar}
          onClose={() => setShowScorecard(false)}
        />
      )}

      {/* Immediate per-hole roast, shown right after a successful save */}
      {roastPopup && (
        <RoastPopup roast={roastPopup} onClose={() => setRoastPopup(null)} />
      )}

      {/* Post-Round Report */}
      {showPostRoundReport && postRoundReport && (
        <PostRoundReportModal
          report={postRoundReport}
          drinkRoastLine={drinkRoastLine}
          holesLogged={holesLogged}
          saving={saving}
          courseName={PEBBLE_CREEK.name}
          playerName={profile?.screen_name ?? 'Golfer'}
          playerAvatarUrl={profile?.avatar_url}
          onShareRound={() => postRoundSummaryToFeed(postRoundReport, drinkRoastLine)}
          onClose={() => setShowPostRoundReport(false)}
        />
      )}
    </Layout>
  )
}

function LogHolePrompt({ holeNumber, hole, existing, saving, onCancel, onSubmit }) {
  const [strokes, setStrokes] = useState(existing?.strokes ?? hole.par)
  const [putts, setPutts] = useState(existing?.putts ?? 2)
  // "Great"/"Failed" are mutually-exclusive quality flags (map to
  // fairwayHit/gir). Water/Sand/Tree/OOB/Lost Ball are tap-to-increment
  // event counts. Note: the database only has 3 hazard columns (water,
  // sand, penalties), so Tree/Out of Bounds/Lost Ball all consolidate
  // into the same `penalties` count -- still captured, just not broken
  // out individually in the data.
  const [quality, setQuality] = useState(
    existing?.fairwayHit === true && existing?.gir === true
      ? 'Great'
      : existing?.fairwayHit === false
      ? 'Failed'
      : null
  )
  const [water, setWater] = useState(existing?.water ?? 0)
  const [sand, setSand] = useState(existing?.sand ?? 0)
  const [penalties, setPenalties] = useState(existing?.penalties ?? 0)

  const EVENTS = [
    { key: 'Great', icon: '✅', color: 'text-green-400 border-green-500', type: 'quality' },
    { key: 'Failed', icon: '❌', color: 'text-red-400 border-red-500', type: 'quality' },
    { key: 'Water', icon: '💧', color: 'text-blue-400 border-blue-500', type: 'counter', value: water, set: setWater },
    { key: 'Sand', icon: '🏖️', color: 'text-yellow-400 border-yellow-500', type: 'counter', value: sand, set: setSand },
    { key: 'Tree', icon: '🌲', color: 'text-green-400 border-green-500', type: 'counter', value: penalties, set: setPenalties },
    { key: 'Out of Bounds', icon: '🚧', color: 'text-orange-400 border-orange-500', type: 'counter', value: penalties, set: setPenalties },
    { key: 'Lost Ball', icon: '❓', color: 'text-red-400 border-red-500', type: 'counter', value: penalties, set: setPenalties },
  ]

  function handleEventTap(event) {
    if (event.type === 'quality') {
      setQuality(quality === event.key ? null : event.key)
    } else {
      event.set(event.value + 1)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-[#0F0F0F] border border-panel-border rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <p className="font-display text-2xl text-golf mb-4">
          Hole {holeNumber} · Par {hole.par}
        </p>

        <div className="flex justify-between mb-6">
          <NumberField label="STROKES" value={strokes} onChange={setStrokes} min={1} />
          <NumberField label="PUTTS" value={putts} onChange={setPutts} min={0} />
        </div>

        <p className="text-muted text-sm tracking-widest font-body font-semibold mb-3">
          WHAT HAPPENED?
        </p>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {EVENTS.map((event) => {
            const isActive = event.type === 'quality' ? quality === event.key : event.value > 0
            return (
              <button
                key={event.key}
                onClick={() => handleEventTap(event)}
                className={`relative flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-body text-xs font-semibold ${
                  isActive ? event.color + ' bg-white/5' : 'border-panel-border text-muted'
                }`}
              >
                <span className="text-xl">{event.icon}</span>
                {event.key}
                {event.type === 'counter' && event.value > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-golf text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {event.value}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-panel-border text-muted font-body py-3 rounded-xl"
          >
            Skip
          </button>
          <button
            onClick={() =>
              onSubmit({
                strokes,
                putts,
                fairwayHit: quality === 'Great' ? true : quality === 'Failed' ? false : null,
                gir: quality === 'Great' ? true : quality === 'Failed' ? false : null,
                water,
                sand,
                penalties,
              })
            }
            disabled={saving}
            className="flex-1 bg-golf text-black font-display py-3 rounded-xl disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange, min }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-muted font-body text-xs mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-full bg-panel border border-panel-border text-white"
        >
          −
        </button>
        <span className="font-display text-2xl w-8 text-center">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-full bg-panel border border-panel-border text-white"
        >
          +
        </button>
      </div>
    </div>
  )
}

function ToggleField({ label, value, onChange }) {
  return (
    <div className="flex-1">
      <p className="text-muted font-body text-xs mb-1">{label}</p>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(true)}
          className={`flex-1 py-2 rounded-lg text-xs font-body font-semibold ${
            value === true ? 'bg-green-600 text-white' : 'bg-panel text-muted'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => onChange(false)}
          className={`flex-1 py-2 rounded-lg text-xs font-body font-semibold ${
            value === false ? 'bg-red-600 text-white' : 'bg-panel text-muted'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}

function RoastPopup({ roast, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger the enter animation on the next tick after mount.
    const t = setTimeout(() => setVisible(true), 10)
    // Auto-dismiss after a few seconds -- still tap-to-close early.
    const autoClose = setTimeout(onClose, 4500)
    return () => {
      clearTimeout(t)
      clearTimeout(autoClose)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const CATEGORY_STYLES = {
    eagle: { border: 'border-green-400', text: 'text-green-300', label: 'EAGLE?!' },
    birdie: { border: 'border-green-500', text: 'text-green-400', label: 'BIRDIE.' },
    par: { border: 'border-golf', text: 'text-golf', label: 'PAR.' },
    bogey: { border: 'border-yellow-500', text: 'text-yellow-400', label: 'BOGEY.' },
    doubleBogey: { border: 'border-orange-500', text: 'text-orange-400', label: 'DOUBLE.' },
    tripleOrWorse: { border: 'border-red-500', text: 'text-red-400', label: 'ROUGH.' },
    water: { border: 'border-blue-500', text: 'text-blue-400', label: 'SPLASH.' },
    sand: { border: 'border-yellow-500', text: 'text-yellow-400', label: 'BEACH DAY.' },
    threePutt: { border: 'border-orange-500', text: 'text-orange-400', label: 'YIKES.' },
  }
  const style = CATEGORY_STYLES[roast.category] ?? CATEGORY_STYLES.bogey

  return (
    <div
      className="fixed inset-x-4 bottom-6 z-50 flex justify-center"
      onClick={onClose}
    >
      <div
        className={`bg-[#0F0F0F] border-2 ${style.border} rounded-2xl p-5 max-w-sm w-full shadow-2xl transition-all duration-300 ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4'
        }`}
      >
        <p className={`font-display text-xl ${style.text} mb-1`}>{style.label}</p>
        <p className="font-body text-white">{roast.line}</p>
        <p className="text-muted font-body text-xs mt-2">Tap to dismiss</p>
      </div>
    </div>
  )
}

function PostRoundReportModal({
  report,
  drinkRoastLine,
  holesLogged,
  saving,
  courseName = 'Pebble Creek Golf Club',
  playerAvatarUrl,
  playerName = 'Golfer',
  onShareRound,
  onClose,
}) {
  const {
    totalScore,
    totalPar,
    scoreRelativeToPar,
    totalPutts,
    totalWater,
    totalSand,
    totalPenalties,
    headlineRoast,
    detailedRoast,
    badgeTitle,
  } = report

  const formattedScore =
    scoreRelativeToPar > 0
      ? `+${scoreRelativeToPar}`
      : scoreRelativeToPar === 0
      ? 'E'
      : `${scoreRelativeToPar}`

  // Color theme changes dynamically based on performance
  const isBadRound = scoreRelativeToPar >= 10 || totalWater >= 3 || totalSand >= 4

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4">
      {holesLogged < 18 && (
        <p className="text-yellow-400 font-body text-xs text-center mb-2 max-w-md mx-auto">
          Only {holesLogged}/18 holes logged so far -- this report reflects what&rsquo;s been logged.
        </p>
      )}

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 font-sans mx-auto my-4">
        {/* Header Banner */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isBadRound ? 'bg-rose-950/40 border-rose-900/50' : 'bg-emerald-950/40 border-emerald-900/50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="relative">
              {playerAvatarUrl ? (
                <img
                  src={playerAvatarUrl}
                  alt={playerName}
                  className="w-11 h-11 rounded-full border-2 border-amber-500 object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-slate-800 border-2 border-amber-500 flex items-center justify-center text-xl font-bold text-amber-400">
                  {playerName.charAt(0)}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                Burned
              </span>
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 leading-tight">{playerName}</h3>
              <p className="text-xs text-slate-400">{courseName}</p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-xl font-bold p-1 rounded-lg transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="p-6 space-y-6">
          {/* Badge Title Header */}
          <div className="text-center space-y-1">
            <span className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-full uppercase tracking-wider">
              {badgeTitle}
            </span>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <span className="text-5xl font-black tracking-tight text-white">{totalScore}</span>
              <div className="text-left">
                <span
                  className={`text-xl font-black block ${
                    scoreRelativeToPar > 0
                      ? 'text-rose-400'
                      : scoreRelativeToPar < 0
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  ({formattedScore})
                </span>
                <span className="text-xs text-slate-400 font-medium">Par {totalPar}</span>
              </div>
            </div>
          </div>

          {/* Headline & Sarcastic Burn Box */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 translate-x-2 -translate-y-2 text-6xl opacity-5 select-none font-black text-rose-500">
              🔥
            </div>
            <p className="text-sm font-semibold text-rose-300 leading-snug">{headlineRoast}</p>
            <p className="text-xs text-slate-300 leading-relaxed italic">{detailedRoast}</p>
          </div>

          {drinkRoastLine && (
            <div className="bg-drink/10 border border-drink/40 rounded-xl p-4">
              <p className="text-drink font-body text-xs tracking-widest font-semibold mb-1">
                🍺 BEVERAGE REPORT
              </p>
              <p className="text-xs text-slate-200 leading-relaxed italic">{drinkRoastLine}</p>
            </div>
          )}

          {/* Round Stat Highlights Grid */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-slate-800/50 border border-slate-700/50 p-2.5 rounded-xl">
              <span className="text-lg font-bold text-slate-100 block">{totalPutts}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Putts
              </span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 p-2.5 rounded-xl">
              <span className="text-lg font-bold text-cyan-400 block">{totalWater}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Water
              </span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 p-2.5 rounded-xl">
              <span className="text-lg font-bold text-amber-300 block">{totalSand}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Sand
              </span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 p-2.5 rounded-xl">
              <span className="text-lg font-bold text-rose-400 block">{totalPenalties}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Penalty
              </span>
            </div>
          </div>

          {/* Action / Live Feed Sharing Button */}
          {onShareRound && (
            <button
              onClick={onShareRound}
              disabled={saving}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              <span>{saving ? '🔥 Posting...' : '🔥 Post Round to Live Group Feed'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ScorecardModal({ scorecard, front9, back9, frontTotals, backTotals, overallStrokes, overallPar, onClose }) {
  function HoleRow({ hole }) {
    const entry = scorecard[hole.number]
    const relative = entry?.logged ? entry.strokes - hole.par : null
    return (
      <tr className="border-b border-panel-border/50">
        <td className="py-2 text-center font-body text-sm">{hole.number}</td>
        <td className="py-2 text-center font-body text-sm text-muted">{hole.par}</td>
        <td className="py-2 text-center font-body text-sm text-muted">{hole.yards}</td>
        <td className="py-2 text-center font-body text-sm font-semibold">
          {entry?.logged ? entry.strokes : '-'}
        </td>
        <td
          className={`py-2 text-center font-body text-sm font-semibold ${
            relative === null ? 'text-muted' : relative < 0 ? 'text-green-400' : relative > 0 ? 'text-red-400' : 'text-white'
          }`}
        >
          {relative === null ? '-' : relative === 0 ? 'E' : relative > 0 ? `+${relative}` : relative}
        </td>
      </tr>
    )
  }

  const overallRelative = overallStrokes - overallPar

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4">
      <div className="bg-[#0F0F0F] border border-panel-border rounded-2xl p-5 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-2xl text-golf">Scorecard</p>
          <button onClick={onClose} className="text-muted text-xl">
            ✕
          </button>
        </div>

        <table className="w-full mb-4">
          <thead>
            <tr className="border-b border-panel-border">
              <th className="py-2 text-muted font-body text-xs">HOLE</th>
              <th className="py-2 text-muted font-body text-xs">PAR</th>
              <th className="py-2 text-muted font-body text-xs">YDS</th>
              <th className="py-2 text-muted font-body text-xs">SCORE</th>
              <th className="py-2 text-muted font-body text-xs">+/-</th>
            </tr>
          </thead>
          <tbody>
            {front9.map((h) => (
              <HoleRow key={h.number} hole={h} />
            ))}
          </tbody>
        </table>
        <div className="flex justify-between font-body text-sm mb-4 px-1">
          <span className="text-muted">Front 9</span>
          <span className="font-semibold">
            {frontTotals.anyLogged ? frontTotals.strokes : '-'} / Par {frontTotals.par}
          </span>
        </div>

        <table className="w-full mb-4">
          <tbody>
            {back9.map((h) => (
              <HoleRow key={h.number} hole={h} />
            ))}
          </tbody>
        </table>
        <div className="flex justify-between font-body text-sm mb-4 px-1">
          <span className="text-muted">Back 9</span>
          <span className="font-semibold">
            {backTotals.anyLogged ? backTotals.strokes : '-'} / Par {backTotals.par}
          </span>
        </div>

        <div className="border-t border-golf pt-4 flex justify-between items-center">
          <p className="font-display text-xl text-golf">TOTAL</p>
          <p className="font-display text-3xl">
            {overallStrokes || '-'}{' '}
            <span className="text-lg text-muted">
              ({overallRelative === 0 ? 'E' : overallRelative > 0 ? `+${overallRelative}` : overallRelative})
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
