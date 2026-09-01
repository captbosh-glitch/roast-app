// Static, zero-cost roast content -- no API calls, no latency, no
// per-request cost. Categories match the hole-logging triggers exactly.

export const ROASTS = {
  parOrBetter: [
    "Bet you can't do that again, Tiger.",
    'Even a broken clock is right twice a day.',
    "Don't get used to it.",
    'Someone call the tour -- we might have a late bloomer.',
    'A wild good shot appeared.',
    "That's one for the highlight reel. Just the one, though.",
    'Careful, your ego just leveled up.',
    "Bold of you to peak on hole {hole}.",
  ],
  bogey: [
    'A respectable disaster.',
    "That's a bogey. The golf gods remain unimpressed.",
    'Still better than your last round. Probably.',
    "One over. One step closer to a good excuse.",
    'A solid, forgettable hole.',
    "Not great, not a crime scene either.",
  ],
  doubleBogeyOrWorse: [
    "Not to echo the thoughts in your head, but maybe golf isn't for you.",
    "That hole owes YOU an apology at this point.",
    'Somewhere, a golf instructor just felt a disturbance.',
    "Was that a golf swing or a cry for help?",
    "The scorecard is judging you. We're just reading it out loud.",
    'A humbling experience, delivered directly to your ego.',
    "That's not a score, it's a warning label.",
  ],
  waterHazard: [
    'The fish in that lake know your ball by name.',
    "You've officially donated to the lake's ball collection.",
    'That water hazard has a better short game than you.',
    "Somewhere, a duck is now wearing your ball as a hat.",
    'Splash. Just splash.',
    "The lake said thank you for the contribution.",
  ],
  sandTrap: [
    "Enjoy your new timeshare in the bunker.",
    'You brought a beach vacation to a golf course.',
    "That's not a golf shot, that's a sandcastle attempt.",
    'The trap wins again. It always wins.',
    "Congratulations on your impromptu sand therapy session.",
  ],
  threePutt: [
    "Three putts. On purpose? We have questions.",
    'The green just humbled you in front of everyone.',
    "That putter has left the chat.",
    "Three putts is a personality trait at this point.",
    'Somewhere, a mini-golf course is offering you a scholarship.',
  ],
}

/**
 * Picks a context-aware roast line for a just-logged hole.
 * Priority: water hazard > sand trap > three-putt > score relative to par.
 * `hole` lets a line reference the hole number via {hole} -- optional,
 * most lines don't use it.
 */
export function getRoastForHole({ hole, par, strokes, putts, water = 0, sand = 0 }) {
  let category
  if (water > 0) category = 'waterHazard'
  else if (sand > 0) category = 'sandTrap'
  else if (putts >= 3) category = 'threePutt'
  else {
    const relative = strokes - par
    category = relative <= 0 ? 'parOrBetter' : relative === 1 ? 'bogey' : 'doubleBogeyOrWorse'
  }

  const lines = ROASTS[category]
  const line = lines[Math.floor(Math.random() * lines.length)]
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
    parts.push("Genuinely, no notes. Unsettling.")
  } else if (totalWater === 0 && totalSand === 0) {
    parts.push('At least the hazards stayed out of it.')
  }

  return parts.join(' ')
}
