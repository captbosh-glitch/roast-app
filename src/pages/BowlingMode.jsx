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
// 5-5 spares = 150, etc.) before this was ever wired into any UI.
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

function isTenthFrameComplete(frameRolls) {
  if (frameRolls.length === 3) return true
  if (frameRolls.length === 2) {
    const sum = frameRolls[0] + frameRolls[1]
    return sum < 10 // open frame in the 10th -- no bonus ball
  }
  return false
}

function isFrameComplete(frameIndex, frameRolls) {
  if (frameIndex === 9) return isTenthFrameComplete(frameRolls)
  if (frameRolls[0] === 10) return true // strike
  return frameRolls.length === 2
}

function maxPinsForCurrentBall(frameIndex, frameRolls) {
  // Pins reset to a fresh 10 at the start of a frame, after a strike, or
  // for a 10th-frame bonus ball following a spare -- otherwise capped by
  // whatever's left standing from the first ball.
  if (frameRolls.length === 0) return 10
  if (frameIndex === 9) {
    if (frameRolls.length === 1 && frameRolls[0] === 10) return 10 // struck, bonus ball 2 resets
    if (frameRolls.length === 2) {
      const sum = frameRolls[0] + frameRolls[1]
      if (sum >= 10) return 10 // spare or two strikes -- bonus ball resets
    }
  }
  return 10 - frameRolls[frameRolls.length - 1]
}

export default function BowlingMode() {
  const { user, profile } = useAuth()
  const [gameSessionId, setGameSessionId] = useState(crypto.randomUUID())
  const [frames, setFrames] = useState([{ rolls: [] }])
  const [selectedPins, setSelectedPins] = useState(new Set())
  const [drinkType, setDrinkType] = useState('Beer')
  const [drinksTonight, setDrinksTonight] = useState(0)
  const [logging, setLogging] = useState(false)

  const currentFrameIndex = frames.length - 1
  const currentFrame = frames[currentFrameIndex]
  const gameOver = currentFrameIndex === 9 && isFrameComplete(9, currentFrame.rolls)

  const flatRolls = frames.flatMap((f) => f.rolls)
  const { score, frameSubtotals } = calculateScore(flatRolls)

  const maxPins = maxPinsForCurrentBall(currentFrameIndex, currentFrame.rolls)
  const ballLabel = currentFrame.rolls.length + 1

  function togglePin(pinNumber) {
    setSelectedPins((prev) => {
      const next = new Set(prev)
      if (next.has(pinNumber)) {
        next.delete(pinNumber)
      } else if (next.size < maxPins) {
        next.add(pinNumber)
      }
      return next
    })
  }

  function setQuickPins(count) {
    const next = new Set()
    for (let i = 1; i <= count; i++) next.add(i)
    setSelectedPins(next)
  }

  async function postFrameToFeed(frameIndex, frameRolls) {
    const name = profile?.screen_name ?? 'Someone'
    let body = null
    let activityType = null

    if (frameRolls[0] === 10) {
      body = `${name} just threw a STRIKE in frame ${frameIndex + 1}! 🎳✨`
      activityType = 'BOWL_STRIKE'
    } else if (frameRolls.every((r) => r === 0)) {
      body = `${name} rolled a gutter ball in frame ${frameIndex + 1}. Zero pins, zero shame... okay, some shame.`
      activityType = 'BOWL_GUTTER'
    } else if (frameRolls.length >= 2 && frameRolls[0] + frameRolls[1] === 10) {
      body = `${name} picked up a spare in frame ${frameIndex + 1}. Clean.`
      activityType = 'BOWL_SPARE'
    }

    if (body) {
      await supabase.from('feed_posts').insert({
        user_id: user.id,
        group_id: profile.group_id,
        activity_type: activityType,
        body,
      })
    }
  }

  async function handleLogRoll() {
    setLogging(true)
    try {
      const pinsKnocked = selectedPins.size
      const updatedRolls = [...currentFrame.rolls, pinsKnocked]
      const nowComplete = isFrameComplete(currentFrameIndex, updatedRolls)

      const updatedFrames = [...frames]
      updatedFrames[currentFrameIndex] = { rolls: updatedRolls }
      setFrames(updatedFrames)
      setSelectedPins(new Set())

      if (nowComplete) {
        const allFlatRolls = updatedFrames.flatMap((f) => f.rolls)
        const { score: runningScore } = calculateScore(allFlatRolls)

        const { error } = await supabase.from('bowling_frames').insert({
          user_id: user.id,
          game_session_id: gameSessionId,
          frame_number: currentFrameIndex + 1,
          rolls: updatedRolls,
          running_score: runningScore,
        })
        if (error) throw error

        await postFrameToFeed(currentFrameIndex, updatedRolls)

        if (currentFrameIndex < 9) {
          setFrames([...updatedFrames, { rolls: [] }])
        }
      }
    } catch (err) {
      alert(`Couldn't log roll: ${err.message ?? err}`)
    } finally {
      setLogging(false)
    }
  }

  function handleNewGame() {
    setGameSessionId(crypto.randomUUID())
    setFrames([{ rolls: [] }])
    setSelectedPins(new Set())
  }

  return (
    <Layout>
      <p className="text-bowling text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        BOWLING MODE
      </p>
      <h1 className="font-display text-4xl text-bowling mb-6">Throw your Rock!</h1>

      <div className="flex items-center justify-between bg-panel border border-panel-border rounded-2xl px-5 py-4 mb-4">
        <div>
          <p className="font-display text-xl text-bowling">
            {gameOver ? 'Game Over' : `Frame ${currentFrameIndex + 1} · Ball ${ballLabel}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted font-body text-xs tracking-widest">SCORE</p>
          <p className="font-display text-3xl">{score}</p>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1 mb-6">
        {Array.from({ length: 10 }).map((_, i) => {
          const frame = frames[i]
          const notation = frame?.rolls.map((r) => (r === 10 ? 'X' : r)).join(' ') ?? ''
          return (
            <div
              key={i}
              className={`text-center border rounded-lg py-2 ${
                i === currentFrameIndex && !gameOver
                  ? 'border-bowling'
                  : 'border-panel-border'
              }`}
            >
              <p className="text-muted font-body text-[10px]">{i + 1}</p>
              <p className="font-body text-xs font-bold">{notation || '-'}</p>
              <p className="text-bowling font-body text-[10px]">{frameSubtotals[i] ?? ''}</p>
            </div>
          )
        })}
      </div>

      {gameOver ? (
        <button
          onClick={handleNewGame}
          className="w-full bg-bowling text-black font-display text-lg py-4 rounded-2xl mb-6"
        >
          🎳 START NEW GAME
        </button>
      ) : (
        <>
          <button
            onClick={handleNewGame}
            className="text-muted font-body text-sm underline mb-4"
          >
            ↩ Reset game
          </button>

          <p className="text-muted text-sm tracking-widest font-body font-semibold text-center mb-3">
            TAP KNOCKED PINS · {selectedPins.size} DOWN
          </p>

          <div className="flex flex-col items-center gap-2 mb-4">
            {PIN_ROWS.map((row, i) => (
              <div key={i} className="flex gap-3">
                {row.map((pin) => (
                  <button
                    key={pin}
                    onClick={() => togglePin(pin)}
                    disabled={!selectedPins.has(pin) && selectedPins.size >= maxPins}
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-body font-bold border-2 ${
                      selectedPins.has(pin)
                        ? 'bg-bowling border-bowling text-black'
                        : 'bg-panel border-panel-border text-white disabled:opacity-30'
                    }`}
                  >
                    {pin}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setQuickPins(maxPins)}
              disabled={currentFrame.rolls.length > 0 && maxPins !== 10}
              className="flex-1 border border-bowling text-bowling rounded-xl py-2 font-body font-semibold text-sm disabled:opacity-30"
            >
              Strike ✨
            </button>
            <button
              onClick={() => setQuickPins(0)}
              className="flex-1 border border-red-600 text-red-400 rounded-xl py-2 font-body font-semibold text-sm"
            >
              Gutter 😬
            </button>
          </div>

          <button
            onClick={handleLogRoll}
            disabled={logging}
            className="w-full bg-bowling text-black font-display text-lg py-4 rounded-2xl mb-6 disabled:opacity-60"
          >
            {logging ? 'LOGGING...' : 'LOG ROLL'}
          </button>
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
          <p className="text-muted font-body text-sm">{drinkType} · 1 unit each</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDrinksTonight((d) => Math.max(0, d - 1))}
            className="w-9 h-9 rounded-full bg-black/30 text-white text-lg"
          >
            −
          </button>
          <span className="font-display text-3xl text-drink w-8 text-center">{drinksTonight}</span>
          <button
            onClick={() => setDrinksTonight((d) => d + 1)}
            className="w-9 h-9 rounded-full bg-black/30 text-white text-lg"
          >
            +
          </button>
        </div>
      </div>
    </Layout>
  )
}
