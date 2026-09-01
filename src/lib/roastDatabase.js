// Static, zero-cost roast content -- no API calls, no latency, no
// per-request cost.

export const ROASTS = {
  eagle: [
    'Enjoy this moment. The golf gods accidentally miscounted your strokes.',
    'Did you take a shortcut through the woods, or are we testing you for PEDs?',
    "Statistically, that was a complete fluke. Don't get used to it.",
    "An eagle? Even a blind squirrel finds a nut twice a decade.",
    "Act like you've been here before. We both know you haven't.",
  ],
  birdie: [
    "Bet you can't do that again, Tiger.",
    'A birdie! The golf gods are setting you up for a massive collapse on the next hole.',
    'Even a broken clock is right twice a day.',
    "Don't start updating your handicap just yet. We all saw that slice off the tee.",
    'Nice shot! Did your guide dog help you line that one up?',
    'Careful, your ego is starting to outpace your swing speed.',
    "Pure luck, but hey, the scorecard doesn't take notes.",
  ],
  par: [
    'Look at you, pretending to be a golfer for four whole minutes.',
    'A solid par! Boring, predictable, and entirely uncharacteristic of your game.',
    'You managed not to ruin this hole. Outstanding restraint.',
    'Par. The highest form of mediocrity you can realistically hope to achieve today.',
    'Congratulations on performing at an average level.',
    'A par! Your golf ball is as shocked as the rest of us.',
  ],
  bogey: [
    "Not to echo the thoughts in your head, but maybe golf isn't for you.",
    'A bogey. Consistent with your life choices.',
    'You were so close to average, yet so far.',
    'That bogey felt personal. Mostly to the people watching you play.',
    "At least you didn't need a search party for your ball this time.",
    'Solid bogey. The local golf pro just felt a sudden disturbance in the Force.',
    "You're not playing golf, you're just taking your clubs on a very frustrating walk.",
  ],
  doubleBogey: [
    'Your swing looks like a shopping cart rolling down a flight of stairs.',
    'Double bogey. Have you considered taking up bowling? Fewer water hazards.',
    'That hole was painful to watch. And we were paying attention.',
    'You hit that ball with all the precision of a drunk toddler.',
    "That wasn't golf, that was a cry for help.",
    'If consistency is key, your double bogeys are masterclass.',
    'You should give up golf and give up taking up golf.',
  ],
  tripleOrWorse: [
    'We stopped counting, but the scorecard insists on holding you accountable.',
    'Is this a golf round or an expensive yard work simulation?',
    "Are you getting paid by the stroke? Because you're making a fortune right now.",
    'That hole belonged in a horror movie.',
    "Just put down an 'X' on the card and pretend you're enjoying your afternoon.",
    "I've seen better swings on a playground broken by a storm.",
    'If you hit the ball any more times on this hole, the course will charge you rent.',
  ],
  water: [
    'The local fish know your golf ball brand by first name.',
    'Are you playing golf or testing the local water quality?',
    'Titleist thanks you for your generous contribution to the lake bed.',
    "That ball didn't slice, it took a scuba diving vacation.",
    'Nice splash! 10/10 from the Olympic diving judges.',
    "You're single-handedly keeping the golf ball manufacturers in business.",
  ],
  sand: [
    'You spent so much time in the bunker, David Attenborough is filming a desert documentary on you.',
    'Did you bring a bucket and spade, or are you actually trying to play out of there?',
    "You've logged more sand time today than a lifeguard in Malibu.",
    "If you wanted to build a sandcastle, there's a beach down the road.",
    "Ah, back to your natural habitat. How's the beach condition today?",
  ],
  threePutt: [
    'Three putts? Did you forget which end of the putter to hold?',
    'That putt had line, pace, and absolutely no chance of going in.',
    "You tap it like you're trying not to wake up a sleeping baby.",
    "It's called a putting green, not a pinball machine.",
  ],
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Picks a context-aware roast line for a just-logged hole.
 * Priority: water hazard > sand trap (only if it actually cost strokes)
 * > three-putt > score relative to par (eagle through triple-or-worse).
 */
export function getRoastForHole({ hole, par, strokes, putts, water = 0, sand = 0 }) {
  const diff = strokes - par
  let category

  if (water > 0) {
    category = 'water'
  } else if (sand > 0 && diff > 0) {
    category = 'sand'
  } else if (putts >= 3) {
    category = 'threePutt'
  } else if (diff <= -2) {
    category = 'eagle'
  } else if (diff === -1) {
    category = 'birdie'
  } else if (diff === 0) {
    category = 'par'
  } else if (diff === 1) {
    category = 'bogey'
  } else if (diff === 2) {
    category = 'doubleBogey'
  } else {
    category = 'tripleOrWorse'
  }

  const line = getRandomItem(ROASTS[category])
  return { category, line: line.replace('{hole}', hole) }
}

/**
 * Synthesizes a round-level roast summary from aggregate stats. Kept
 * template-based (not a live LLM call) for the same zero-cost,
 * zero-latency reasoning as the per-hole roasts above.
 */
export function getRoundRoastSummary({ totalScore, totalPar, totalPutts, totalWater, totalSand }) {
  const relative = totalScore - totalPar
  const parText = relative === 0 ? 'even par' : relative > 0 ? `+${relative}` : `${relative}`

  const parts = []
  parts.push(`Total score: ${totalScore} (${parText}).`)

  if (totalWater > 0) {
    parts.push(`You donated ${totalWater} ball${totalWater === 1 ? '' : 's'} to the lake.`)
  }
  if (totalSand > 0) {
    parts.push(`Spent quality time in the sand ${totalSand} time${totalSand === 1 ? '' : 's'}.`)
  }
  if (totalPutts > 36) {
    parts.push(`${totalPutts} putts -- the green has never seen someone so committed to visiting twice.`)
  } else if (totalPutts > 0) {
    parts.push(`${totalPutts} total putts.`)
  }

  if (totalWater === 0 && totalSand === 0 && relative <= 0) {
    parts.push('Genuinely, no notes. Unsettling.')
  } else if (totalWater === 0 && totalSand === 0) {
    parts.push('At least the hazards stayed out of it.')
  }

  return parts.join(' ')
}
