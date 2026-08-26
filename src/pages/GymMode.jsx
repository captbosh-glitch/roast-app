import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const COMMON_EXERCISES = [
  'Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row',
  'Pull-Up', 'Dip', 'Bicep Curl', 'Tricep Extension', 'Leg Press',
  'Lat Pulldown', 'Incline Bench Press', 'Romanian Deadlift', 'Lunge',
]

function NumberPicker({ label, value, onChange, min = 0 }) {
  function handleTyped(e) {
    const raw = e.target.value
    if (raw === '') {
      onChange(min)
      return
    }
    const parsed = parseInt(raw, 10)
    if (!Number.isNaN(parsed)) {
      onChange(Math.max(min, parsed))
    }
  }

  return (
    <div className="flex flex-col items-center flex-1">
      <p className="text-muted text-sm tracking-widest font-body font-semibold mb-3">{label}</p>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-10 h-10 rounded-full bg-panel border border-panel-border text-white text-xl mb-2"
        aria-label={`Increase ${label}`}
      >
        +
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={handleTyped}
        className="font-display text-4xl mb-2 bg-transparent text-center w-20 outline-none focus:text-orange"
        aria-label={`${label} value, tap to type a number directly`}
      />
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-10 h-10 rounded-full bg-panel border border-panel-border text-white text-xl"
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
    </div>
  )
}

export default function GymMode() {
  const { user, profile } = useAuth()
  const [exercise, setExercise] = useState('Bench Press')
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState(8)
  const [weight, setWeight] = useState(135)
  const [failed, setFailed] = useState(false)
  const [history, setHistory] = useState([])
  const [logging, setLogging] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  async function loadHistory() {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('gym_sets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setHistory(data ?? [])
    setLoadingHistory(false)
  }

  useEffect(() => {
    if (user) loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleLogSet() {
    if (!profile) {
      alert('Still loading your profile -- give it a second and try again.')
      return
    }

    setLogging(true)

    try {
      // PR check: is this weight higher than any previous non-failed set
      // logged for this exact exercise by this user?
      const { data: priorSets, error: priorError } = await supabase
        .from('gym_sets')
        .select('weight_lbs')
        .eq('user_id', user.id)
        .eq('exercise', exercise)
        .eq('failed', false)

      if (priorError) throw priorError

      const priorMax = (priorSets ?? []).reduce((max, s) => Math.max(max, s.weight_lbs), 0)
      const isPr = !failed && weight > priorMax

      const { error: insertError } = await supabase.from('gym_sets').insert({
        user_id: user.id,
        exercise,
        sets,
        reps,
        weight_lbs: weight,
        failed,
        is_pr: isPr,
      })

      if (insertError) throw insertError

      // Failed sets and PRs both make the roast feed -- that's the whole
      // point of the app. Ordinary successful sets don't post.
      if (failed || isPr) {
        const name = profile?.screen_name ?? 'Someone'
        const body = failed
          ? `${name} couldn't finish their set of ${exercise} at ${weight}lbs. The bar said no.`
          : `${name} just hit a new PR on ${exercise}: ${sets}×${reps} @ ${weight}lbs!`

        const { error: postError } = await supabase.from('feed_posts').insert({
          user_id: user.id,
          group_id: profile.group_id,
          activity_type: failed ? 'GYM_FAIL' : 'GYM_PR',
          body,
        })

        if (postError) throw postError
      }

      setFailed(false)
      loadHistory()
    } catch (err) {
      alert(`Couldn't log set: ${err.message ?? err}`)
    } finally {
      // Always runs, whether the try succeeded, threw, or hit any of the
      // early returns above -- the button can never get stuck on
      // "LOGGING..." again, regardless of what actually went wrong.
      setLogging(false)
    }
  }

  return (
    <Layout>
      <p className="text-gym text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        GYM MODE
      </p>
      <h1 className="font-display text-4xl text-gym mb-8">Log Set</h1>

      <p className="text-gym font-display text-xl mb-2">Exercise</p>
      <input
        list="exercise-options"
        value={exercise}
        onChange={(e) => setExercise(e.target.value)}
        className="w-full bg-[#1A0808] border border-gym/40 rounded-2xl px-5 py-4 text-white font-body mb-6 outline-none focus:border-gym"
      />
      <datalist id="exercise-options">
        {COMMON_EXERCISES.map((ex) => (
          <option key={ex} value={ex} />
        ))}
      </datalist>

      <div className="flex justify-between border-y border-panel-border py-6 mb-6">
        <NumberPicker label="SETS" value={sets} onChange={setSets} min={1} />
        <NumberPicker label="REPS" value={reps} onChange={setReps} min={1} />
        <NumberPicker label="LBS" value={weight} onChange={setWeight} min={0} />
      </div>

      <button
        type="button"
        onClick={() => setFailed((f) => !f)}
        className={`w-full rounded-2xl py-4 font-body font-bold mb-4 border-2 transition-colors ${
          failed
            ? 'bg-red-600 border-red-600 text-white'
            : 'bg-transparent border-panel-border text-muted'
        }`}
      >
        💪 FAILED SET
      </button>

      <button
        onClick={handleLogSet}
        disabled={logging}
        className="w-full bg-orange text-white font-display text-lg py-4 rounded-2xl mb-8 disabled:opacity-60"
      >
        {logging ? 'LOGGING...' : 'LOG SET'}
      </button>

      <p className="text-muted text-sm tracking-widest font-body font-semibold mb-4">
        SESSION HISTORY
      </p>
      {loadingHistory ? (
        <p className="text-muted font-body text-sm">Loading...</p>
      ) : history.length === 0 ? (
        <p className="text-muted font-body text-sm">No sets logged yet. Log your first one above.</p>
      ) : (
        <div className="space-y-3">
          {history.map((h) => (
            <div
              key={h.id}
              className={`flex items-center justify-between bg-panel border rounded-2xl px-5 py-4 ${
                h.failed ? 'border-red-600' : 'border-panel-border'
              }`}
            >
              <div>
                <p className="font-body font-semibold">{h.exercise}</p>
                <p className="text-muted font-body text-sm">
                  {h.sets} × {h.reps} @ {h.weight_lbs} lbs
                </p>
              </div>
              {h.failed && (
                <span className="text-red-400 border border-red-600 rounded-lg px-2 py-1 text-xs font-bold font-body">
                  FAIL
                </span>
              )}
              {h.is_pr && !h.failed && (
                <span className="text-green-400 border border-green-600 rounded-lg px-2 py-1 text-xs font-bold font-body">
                  PR
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
