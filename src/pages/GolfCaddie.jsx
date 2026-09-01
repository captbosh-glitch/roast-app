import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useGolfGPS, getDistanceInYards } from '../lib/golfGps'
import { PEBBLE_CREEK } from '../lib/pebbleCreekCourse'
import { getRoastForHole } from '../lib/roastDatabase'
import { generatePostRoundReport } from '../lib/postRoundSummary'
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
  const [mode, setMode] = useState('auto') // 'auto' | 'locked'
  const [activeHoleNumber, setActiveHoleNumber] = useState(1)
  const [scorecard, setScorecard] = useState(emptyScorecard())
  const [showScorecard, setShowScorecard] = useState(false)
  const [logPromptHole, setLogPromptHole] = useState(null)
  const [saving, setSaving] = useState(false)
  const [roastPopup, setRoastPopup] = useState(null)
  const [showPostRoundReport, setShowPostRoundReport] = useState(false)

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
    setScorecard(emptyScorecard())
    setActiveHoleNumber(1)
    setMode('auto')
    setShowPostRoundReport(false)
  }

  async function postRoundSummaryToFeed(report) {
    setSaving(true)
    try {
      const name = profile?.screen_name ?? 'Someone'
      const { error } = await supabase.from('feed_posts').insert({
        user_id: user.id,
        group_id: profile.group_id,
        activity_type: report.scoreRelativeToPar <= 0 ? 'GOLF_GREAT' : 'GOLF_FAIL',
        body: `${name}'s round at ${PEBBLE_CREEK.name} -- "${report.badgeTitle}": ${report.headlineRoast} ${report.detailedRoast}`,
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
        onClick={() => setShowPostRoundReport(true)}
        disabled={holesLogged === 0}
        className="block w-full text-center border-2 border-orange text-orange font-display text-base py-3 rounded-2xl disabled:opacity-30"
      >
        📋 Post-Round Report ({holesLogged}/18 logged)
      </button>

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
          holesLogged={holesLogged}
          saving={saving}
          onPost={() => postRoundSummaryToFeed(postRoundReport)}
          onClose={() => setShowPostRoundReport(false)}
        />
      )}
    </Layout>
  )
}

function LogHolePrompt({ holeNumber, hole, existing, saving, onCancel, onSubmit }) {
  const [strokes, setStrokes] = useState(existing?.strokes ?? hole.par)
  const [putts, setPutts] = useState(existing?.putts ?? 2)
  const [fairwayHit, setFairwayHit] = useState(existing?.fairwayHit ?? null)
  const [gir, setGir] = useState(existing?.gir ?? null)
  const [water, setWater] = useState(existing?.water ?? 0)
  const [sand, setSand] = useState(existing?.sand ?? 0)
  const [penalties, setPenalties] = useState(existing?.penalties ?? 0)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-[#0F0F0F] border border-panel-border rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <p className="font-display text-2xl text-golf mb-4">
          Hole {holeNumber} · Par {hole.par}
        </p>

        <div className="flex justify-between mb-4">
          <NumberField label="STROKES" value={strokes} onChange={setStrokes} min={1} />
          <NumberField label="PUTTS" value={putts} onChange={setPutts} min={0} />
        </div>

        <div className="flex gap-3 mb-4">
          {hole.par !== 3 && (
            <ToggleField label="Fairway Hit" value={fairwayHit} onChange={setFairwayHit} />
          )}
          <ToggleField label="GIR" value={gir} onChange={setGir} />
        </div>

        <p className="text-muted font-body text-xs tracking-widest font-semibold mb-2">
          HAZARDS
        </p>
        <div className="flex justify-between mb-6">
          <NumberField label="WATER 💧" value={water} onChange={setWater} min={0} />
          <NumberField label="SAND 🏖️" value={sand} onChange={setSand} min={0} />
          <NumberField label="PENALTY ⚠️" value={penalties} onChange={setPenalties} min={0} />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-panel-border text-muted font-body py-3 rounded-xl"
          >
            Skip
          </button>
          <button
            onClick={() => onSubmit({ strokes, putts, fairwayHit, gir, water, sand, penalties })}
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

function PostRoundReportModal({ report, holesLogged, saving, onPost, onClose }) {
  const relative = report.scoreRelativeToPar

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4">
      <div className="bg-[#0F0F0F] border border-orange rounded-2xl p-6 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-2xl text-orange">Post-Round Report</p>
          <button onClick={onClose} className="text-muted text-xl">
            ✕
          </button>
        </div>

        {holesLogged < 18 && (
          <p className="text-yellow-400 font-body text-xs mb-4">
            Only {holesLogged}/18 holes logged so far -- this report reflects what&rsquo;s been logged.
          </p>
        )}

        {/* Badge title -- the funny "certification" this round earned */}
        <div className="bg-orange text-black rounded-xl px-4 py-2 text-center mb-5">
          <p className="font-display text-lg">🏆 {report.badgeTitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-panel rounded-xl p-3 text-center">
            <p className="font-display text-2xl">{report.totalScore}</p>
            <p className="text-muted font-body text-xs">Total Score</p>
          </div>
          <div className="bg-panel rounded-xl p-3 text-center">
            <p className="font-display text-2xl">
              {relative === 0 ? 'E' : relative > 0 ? `+${relative}` : relative}
            </p>
            <p className="text-muted font-body text-xs">Net vs Par</p>
          </div>
          <div className="bg-panel rounded-xl p-3 text-center">
            <p className="font-display text-2xl">{report.totalPutts}</p>
            <p className="text-muted font-body text-xs">Total Putts</p>
          </div>
          <div className="bg-panel rounded-xl p-3 text-center">
            <p className="font-display text-2xl">
              {report.totalWater}💧 {report.totalSand}🏖️
            </p>
            <p className="text-muted font-body text-xs">Water / Sand</p>
          </div>
        </div>

        <div className="bg-orange/10 border border-orange/40 rounded-2xl p-4 mb-5">
          <p className="text-orange font-body text-xs tracking-widest font-semibold mb-2">
            ROUND ROAST
          </p>
          <p className="font-body text-white text-sm font-semibold mb-2">{report.headlineRoast}</p>
          <p className="font-body text-muted text-sm">{report.detailedRoast}</p>
        </div>

        <button
          onClick={onPost}
          disabled={saving}
          className="w-full bg-orange text-white font-display text-lg py-4 rounded-2xl disabled:opacity-60"
        >
          {saving ? 'POSTING...' : 'POST TO GROUP FEED'}
        </button>
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
