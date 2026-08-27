import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const PIN_ROWS = [
  [7, 8, 9, 10],
  [4, 5, 6],
  [2, 3],
  [1],
]

// Standard flat-roll-array bowling scoring algorithm. Verified against
// known reference games (perfect game = 300, gutter game = 0, all
// 5-5 spares = 150, etc.) plus a full simulated 10-frame game before
// this was ever wired into any UI.
function calculateScore(rolls) {
  let score = 0
  let rollIndex = 0
  const frameSubtotals = []

  for (let frame = 0; frame < 10; frame++) {
    if (rolls[rollIndex] === undefined) break

    if (rolls[rollIndex] === 10) {
      if (rolls[rollIndex + 1] === undefined || rolls[rollIndex + 2] === undefined) break
      score += 10 + rolls[rollIndex + 1] + rolls[rollIndex + 2]
      rollIndex += 1
    } else if ((rolls[rollIndex] ?? 0) + (rolls[rollIndex + 1] ?? 0) === 10) {
      if (rolls[rollIndex + 1] === undefined || rolls[rollIndex + 2] === undefined) break
      score += 10 + rolls[rollIndex + 2]
      rollIndex += 2
    } else {
      if (rolls[rollIndex + 1] === undefined) break
      score += rolls[rollIndex] + rolls[rollIndex + 1]
      rollIndex += 2
    }
    frameSubtotals.push(score)
  }

  return { score, frameSubtotals }
}

// Proper bowling notation: "X" only for a true first-ball strike, "/"
// for a roll that completes a spare -- NOT just "any roll of value 10",
// which was the bug (a gutter-then-10 was showing as "X" instead of
// the correct "0 /").
function frameNotation(frameIndex, frameRolls) {
  if (frameRolls.length === 0) return '-'
  if (frameIndex < 9) {
    if (frameRolls[0] === 10) return 'X'
    if (frameRolls.length === 2) {
      if (frameRolls[0] + frameRolls[1] === 10) return `${frameRolls[0]} /`
      return `${frameRolls[0]} ${frameRolls[1]}`
    }
    return `${frameRolls[0]}`
  }
  const symbols = []
  for (let i = 0; i < frameRolls.length; i++) {
    const r = frameRolls[i]
    if (r === 10) {
      symbols.push('X')
    } else if (i > 0 && frameRolls[i - 1] !== 10 && frameRolls[i - 1] + r === 10) {
      symbols.push('/')
    } else {
      symbols.push(`${r}`)
    }
  }
  return symbols.join(' ')
}

function isTenthFrameComplete(frameRolls) {
  if (frameRolls.length === 3) return true
  if (frameRolls.length === 2) {
    const sum = frameRolls[0] + frameRolls[1]
    return sum < 10
  }
  return false
}

function isFrameComplete(frameIndex, frameRolls) {
  if (frameIndex === 9) return isTenthFrameComplete(frameRolls)
  if (frameRolls[0] === 10) return true
  return frameRolls.length === 2
}

// Whether pins reset to a fresh 10 for the NEXT ball -- true at the
// start of a frame, right after a strike, or after completing a spare
// in the 10th frame's bonus ball.
// Which specific pin numbers are still available to tap for the
// CURRENT ball -- tracks actual pin identity (not just a count), so a
// pin you already knocked down visibly disappears as an option on the
// next ball, instead of remaining tappable.
//
// This walks the frame's roll history to find the most recent point
// pins reset to a fresh 10 (start of frame, right after a strike, or a
// completed spare in the 10th) and only counts pins knocked SINCE that
// point -- not the whole frame's history. Getting this wrong was the
// bug where a strike on the 10th frame's first ball incorrectly kept
// blocking pins for the third ball, since ball 2 (which itself reset
// the rack) was being unioned together with ball 1's original
// all-10-gone record instead of treated as its own fresh start.
function availablePins(frame) {
  const { rolls, pinSets, frameIndex } = frame
  let resetFromIndex = 0
  for (let i = 0; i < rolls.length; i++) {
    if (rolls[i] === 10) {
      resetFromIndex = i + 1
    } else if (frameIndex === 9 && i > 0 && rolls[i - 1] !== 10 && rolls[i - 1] + rolls[i] === 10) {
      resetFromIndex = i + 1
    }
  }
  const knocked = new Set()
  for (let i = resetFromIndex; i < pinSets.length; i++) {
    for (const p of pinSets[i]) knocked.add(p)
  }
  const available = new Set()
  for (let p = 1; p <= 10; p++) {
    if (!knocked.has(p)) available.add(p)
  }
  return available
}

export default function BowlingMode() {
  const { user, profile } = useAuth()
  const [gameSessionId, setGameSessionId] = useState(crypto.randomUUID())
  const [frames, setFrames] = useState([{ rolls: [], pinSets: [] }])
  const [selectedPins, setSelectedPins] = useState(new Set())
  // Distinguishes "haven't made a choice yet" from "explicitly chose
  // Gutter" -- both start out looking like an empty selection (size 0),
  // but only one of them should actually enable LOG ROLL.
  const [hasInteracted, setHasInteracted] = useState(false)
  const [drinkType, setDrinkType] = useState('Beer')
  const [tonightTotal, setTonightTotal] = useState(0)
  const [busy, setBusy] = useState(false)

  const currentFrameIndex = frames.length - 1
  const currentFrame = frames[currentFrameIndex]
  const gameOver = currentFrameIndex === 9 && isFrameComplete(9, currentFrame.rolls)

  const flatRolls = frames.flatMap((f) => f.rolls)
  const { score, frameSubtotals } = calculateScore(flatRolls)

  const available = availablePins({ ...currentFrame, frameIndex: currentFrameIndex })
  const ballLabel = currentFrame.rolls.length + 1

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

  function togglePin(pinNumber) {
    if (!available.has(pinNumber) && !selectedPins.has(pinNumber)) return
    setHasInteracted(true)
    setSelectedPins((prev) => {
      const next = new Set(prev)
      if (next.has(pinNumber)) {
        next.delete(pinNumber)
      } else if (next.size < available.size) {
        next.add(pinNumber)
      }
      return next
    })
  }

  function setQuickSelection(allAvailable) {
    setHasInteracted(true)
    setSelectedPins(allAvailable ? new Set(available) : new Set())
  }

  // Pure local navigation -- pushes the current ball's selection into
  // frame state and advances to the next ball/frame. Never touches the
  // database or the feed, so routine frames don't spam anyone.
  function handleAdvance() {
    const pinsKnocked = selectedPins.size
    const updatedRolls = [...currentFrame.rolls, pinsKnocked]
    const updatedPinSets = [...currentFrame.pinSets, new Set(selectedPins)]
    const nowComplete = isFrameComplete(currentFrameIndex, updatedRolls)

    const updatedFrames = [...frames]
    updatedFrames[currentFrameIndex] = { rolls: updatedRolls, pinSets: updatedPinSets }

    if (nowComplete && currentFrameIndex < 9) {
      updatedFrames.push({ rolls: [], pinSets: [] })
    }

    setFrames(updatedFrames)
    setSelectedPins(new Set())
    setHasInteracted(false)
  }

  // Manual, optional action for a roast-worthy moment (a strike, or a
  // total gutter ball) -- posts to the feed right now, independent of
  // whether/when the player advances the game. Doesn't touch frame state.
  async function handleLogRoll() {
    const pinsKnocked = selectedPins.size
    const isNotable = pinsKnocked === 10 || pinsKnocked === 0
    if (!isNotable) return

    setBusy(true)
    try {
      const name = profile?.screen_name ?? 'Someone'
      const body =
        pinsKnocked === 10
          ? `${name} just threw a STRIKE in frame ${currentFrameIndex + 1}! 🎳✨`
          : `${name} rolled a gutter ball in frame ${currentFrameIndex + 1}. Zero pins, zero shame... okay, some shame.`

      const { error } = await supabase.from('feed_posts').insert({
        user_id: user.id,
        group_id: profile.group_id,
        activity_type: pinsKnocked === 10 ? 'BOWL_STRIKE' : 'BOWL_GUTTER',
        body,
      })
      if (error) throw error
    } catch (err) {
      alert(`Couldn't post: ${err.message ?? err}`)
    } finally {
      setBusy(false)
    }
  }

  // Posts once, at the end of a full game, with the final score --
  // instead of the feed filling up with every individual frame.
  async function handleLogGame() {
    setBusy(true)
    try {
      const name = profile?.screen_name ?? 'Someone'
      const strikeCount = frames.filter((f) => f.rolls[0] === 10).length

      const { error: frameError } = await supabase.from('bowling_frames').insert(
        frames.map((f, i) => ({
          user_id: user.id,
          game_session_id: gameSessionId,
          frame_number: i + 1,
          rolls: f.rolls,
          running_score: frameSubtotals[i] ?? score,
        }))
      )
      if (frameError) throw frameError

      const { error: postError } = await supabase.from('feed_posts').insert({
        user_id: user.id,
        group_id: profile.group_id,
        activity_type: 'BOWL_GAME',
        body: `${name} finished a game with a score of ${score}${strikeCount > 0 ? ` (${strikeCount} strike${strikeCount === 1 ? '' : 's'})` : ''}.`,
      })
      if (postError) throw postError

      handleNewGame()
    } catch (err) {
      alert(`Couldn't log game: ${err.message ?? err}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleLogDrink() {
    setBusy(true)
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
      setBusy(false)
    }
  }

  function handleNewGame() {
    setGameSessionId(crypto.randomUUID())
    setFrames([{ rolls: [], pinSets: [] }])
    setSelectedPins(new Set())
    setHasInteracted(false)
  }

  const currentSelectionIsNotable =
    hasInteracted && (selectedPins.size === 10 || selectedPins.size === 0)

  return (
    <Layout>
      <p className="text-bowling text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        BOWLING MODE
      </p>
      <h1 className="font-display text-4xl text-bowling mb-6">Throw your Rock!</h1>

      <div className="flex items-center justify-between bg-panel border border-panel-border rounded-2xl px-5 py-4 mb-4">
        <p className="font-display text-xl text-bowling">
          {gameOver ? 'Game Over' : `Frame ${currentFrameIndex + 1} · Ball ${ballLabel}`}
        </p>
        <div className="text-right">
          <p className="text-muted font-body text-xs tracking-widest">SCORE</p>
          <p className="font-display text-3xl">{score}</p>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1 mb-6">
        {Array.from({ length: 10 }).map((_, i) => {
          const frame = frames[i]
          const notation = frame ? frameNotation(i, frame.rolls) : '-'
          return (
            <div
              key={i}
              className={`text-center border rounded-lg py-2 ${
                i === currentFrameIndex && !gameOver ? 'border-bowling' : 'border-panel-border'
              }`}
            >
              <p className="text-muted font-body text-[10px]">{i + 1}</p>
              <p className="font-body text-xs font-bold">{notation}</p>
              <p className="text-bowling font-body text-[10px]">{frameSubtotals[i] ?? ''}</p>
            </div>
          )
        })}
      </div>

      {gameOver ? (
        <button
          onClick={handleLogGame}
          disabled={busy}
          className="w-full bg-bowling text-black font-display text-lg py-4 rounded-2xl mb-6 disabled:opacity-60"
        >
          {busy ? 'LOGGING...' : `🎳 LOG GAME (Score: ${score})`}
        </button>
      ) : (
        <>
          <button onClick={handleNewGame} className="text-muted font-body text-sm underline mb-4">
            ↩ Reset game
          </button>

          <p className="text-muted text-sm tracking-widest font-body font-semibold text-center mb-3">
            TAP KNOCKED PINS · {selectedPins.size} DOWN
          </p>

          <div className="flex flex-col items-center gap-2 mb-4">
            {PIN_ROWS.map((row, i) => (
              <div key={i} className="flex gap-3">
                {row.map((pin) => {
                  const isAvailable = available.has(pin)
                  const isSelected = selectedPins.has(pin)
                  return (
                    <button
                      key={pin}
                      onClick={() => togglePin(pin)}
                      disabled={!isAvailable && !isSelected}
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-body font-bold border-2 transition-opacity ${
                        isSelected
                          ? 'bg-bowling border-bowling text-black'
                          : isAvailable
                          ? 'bg-panel border-panel-border text-white'
                          : 'bg-panel border-panel-border text-muted opacity-20'
                      }`}
                    >
                      {pin}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setQuickSelection(true)}
              className="flex-1 border border-bowling text-bowling rounded-xl py-2 font-body font-semibold text-sm"
            >
              All pins ✨
            </button>
            <button
              onClick={() => setQuickSelection(false)}
              className="flex-1 border border-red-600 text-red-400 rounded-xl py-2 font-body font-semibold text-sm"
            >
              Gutter 😬
            </button>
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={handleLogRoll}
              disabled={busy || !currentSelectionIsNotable}
              className="flex-1 border-2 border-orange text-orange font-display text-base py-3 rounded-2xl disabled:opacity-30"
            >
              🔥 LOG ROLL
            </button>
            <button
              onClick={handleAdvance}
              className="flex-1 bg-bowling text-black font-display text-base py-3 rounded-2xl"
            >
              {isFrameComplete(currentFrameIndex, [...currentFrame.rolls, selectedPins.size])
                ? 'NEXT FRAME →'
                : 'NEXT BALL →'}
            </button>
          </div>
          <p className="text-muted font-body text-xs text-center -mt-4 mb-6">
            LOG ROLL posts a strike/gutter to the feed without advancing.
            NEXT FRAME/BALL advances the game without posting anything.
          </p>
        </>
      )}

      <p className="text-muted text-sm tracking-widest font-body font-semibold mb-3">
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
          disabled={busy}
          className="bg-drink text-white font-body font-semibold text-sm px-4 py-2 rounded-xl disabled:opacity-60"
        >
          + Log {drinkType}
        </button>
      </div>
    </Layout>
  )
}
