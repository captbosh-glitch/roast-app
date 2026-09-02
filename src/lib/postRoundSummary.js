// Generates a full sarcastic post-round summary from an array of
// per-hole results. Kept template-based (not a live LLM call) for the
// same zero-cost, zero-latency reasoning as roastDatabase.js.

/**
 * Evaluates an entire array of hole results and produces a full
 * sarcastic summary.
 *
 * Each entry in `holes` should look like:
 *   { par, strokes, putts, waterHazards, sandTraps, penaltyBalls }
 */
export function generatePostRoundReport(holes, courseName = 'the course') {
  const totalScore = holes.reduce((acc, h) => acc + h.strokes, 0)
  const totalPar = holes.reduce((acc, h) => acc + h.par, 0)
  const scoreRelativeToPar = totalScore - totalPar

  const totalPutts = holes.reduce((acc, h) => acc + (h.putts || 0), 0)
  const totalWater = holes.reduce((acc, h) => acc + (h.waterHazards || 0), 0)
  const totalSand = holes.reduce((acc, h) => acc + (h.sandTraps || 0), 0)
  const totalPenalties = holes.reduce((acc, h) => acc + (h.penaltyBalls || 0), 0)

  const tripleOrWorseCount = holes.filter((h) => h.strokes - h.par >= 3).length
  const birdieOrBetterCount = holes.filter((h) => h.strokes - h.par <= -1).length

  let headlineRoast = ''
  let detailedRoast = ''
  let badgeTitle = ''

  if (scoreRelativeToPar >= 20) {
    badgeTitle = 'Certified Yard Work Engineer'
    headlineRoast = `You shot a ${totalScore} (+${scoreRelativeToPar}). The groundskeeper at ${courseName} is sending you a bill for turf damage.`
    detailedRoast = `You accumulated ${tripleOrWorseCount} disaster holes today. At this point, taking your clubs on a walk in the park would yield the exact same score without the humiliation.`
  } else if (totalWater >= 3) {
    badgeTitle = 'Sons of Neptune / Lake Donator'
    headlineRoast = `You donated ${totalWater} balls to the water hazards today.`
    detailedRoast = `The aquatic life at ${courseName} officially recognizes you as their primary benefactor. Final score: ${totalScore} (+${scoreRelativeToPar}).`
  } else if (totalSand >= 4) {
    badgeTitle = 'Professional Beachcomber'
    headlineRoast = 'You spent so much time in the sand traps you should have packed sunblock.'
    detailedRoast = `You visited ${totalSand} bunkers today. If golf doesn't work out, you have a promising future in sandcastle architecture.`
  } else if (totalPutts >= 38) {
    badgeTitle = 'Pinball Machine Technician'
    headlineRoast = `${totalPutts} total putts. Your putter was practically glowing from friction.`
    detailedRoast = 'You averaged over 2 putts per hole. The green is meant for subtle finesse, not hockey slapshots.'
  } else if (scoreRelativeToPar > 0) {
    badgeTitle = 'Mid-HCP Delusionist'
    headlineRoast = `Finished with a ${totalScore} (+${scoreRelativeToPar}). Not terrible, but certainly nothing to brag about at the bar.`
    detailedRoast = `You had ${birdieOrBetterCount} moment(s) of brilliance offset by classic amateur mistakes. You'll convince yourself you're getting better and return next weekend anyway.`
  } else {
    badgeTitle = 'Glitch in the Matrix'
    headlineRoast = `Shot a ${totalScore} (${scoreRelativeToPar === 0 ? 'E' : scoreRelativeToPar}). Who did you pay to write down these scores?`
    detailedRoast = 'Statistically speaking, this was an anomaly. Enjoy the bragging rights today because regression to the mean is coming for you next round.'
  }

  return {
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
  }
}

/**
 * Weaves alcohol consumption into the roast, as a supplementary line
 * layered on top of the existing scenario-based report above (rather
 * than replacing that already-tested logic). Returns null when there's
 * nothing drink-related worth adding (0-2 drinks and a reasonable
 * score).
 */
export function getDrinkRoastLine({ totalDrinks, totalWater, totalSand, totalScore, scoreRelativeToPar }) {
  const totalHazards = totalWater + totalSand

  if (totalHazards >= 4 && totalDrinks >= 4) {
    return `${totalWater} water ball${totalWater === 1 ? '' : 's'} and ${totalDrinks} drink${totalDrinks === 1 ? '' : 's'} -- at least your liver and the lake are both full.`
  }
  if (totalDrinks === 0 && scoreRelativeToPar > 5) {
    return `You shot a ${totalScore} completely sober? That's actually impressive in the worst way.`
  }
  if (totalDrinks >= 6) {
    return `You logged ${totalDrinks} drinks across the round. You didn't play golf; you went day-drinking in a polo shirt with a golf cart.`
  }
  if (totalDrinks >= 3) {
    return `You had ${totalDrinks} drinks out there today. Your swing wasn't failing; your motor skills were.`
  }
  return null
}
