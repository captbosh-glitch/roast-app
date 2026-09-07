import { RAW_COURSES } from './golfCoursesRaw'
import { PEBBLE_CREEK } from './pebbleCreekCourse'
import { getDistanceInYards } from './golfGps'

/**
 * @typedef {Object} GPSCoordinates
 * @property {number} lat
 * @property {number} lng
 */

/**
 * @typedef {Object} Hole
 * @property {number} number
 * @property {number} par
 * @property {number} yards
 * @property {number} lat
 * @property {number} lng
 */

/**
 * @typedef {Object} Course
 * @property {string} id
 * @property {string} name
 * @property {string} location
 * @property {number} centerLat
 * @property {number} centerLng
 * @property {number} parTotal
 * @property {number} parFront9
 * @property {number} parBack9
 * @property {number} totalYardage
 * @property {boolean} coordinatesVerified
 * @property {Hole[]} holes
 */

/**
 * @typedef {Object} ActiveGolfRound
 * @property {string} courseId
 * @property {string} roundSessionId
 * @property {Date} roundStartTime
 * @property {number} activeHoleNumber
 */

/**
 * Converts a raw course (either the new golfCourses.json shape, or
 * Pebble Creek's original shape) into one consistent internal Course
 * shape. Total par and yardage are always DERIVED by summing the
 * actual holes, never trusted from a separately-stored total field --
 * 8 of the 10 courses in the new dataset had totals that didn't
 * actually match their own hole-by-hole data, so deriving them avoids
 * ever displaying a number that contradicts the real holes.
 */
function normalizeCourse(raw) {
  // Pebble Creek's existing shape already has flat hole.lat/hole.lng
  // and top-level centerLat/centerLng.
  if (raw.centerLat !== undefined) {
    const holes = raw.holes.map((h) => ({
      number: h.number,
      par: h.par,
      yards: h.yards,
      lat: h.lat,
      lng: h.lng,
    }))
    // Pebble Creek stores a full street address rather than a
    // "City, State" location string like the other courses -- derive
    // a comparable one (e.g. "Colts Neck, NJ") from it.
    const addressParts = (raw.address ?? '').split(',').map((s) => s.trim())
    const city = addressParts[addressParts.length - 2]
    const stateZip = addressParts[addressParts.length - 1]
    const state = stateZip ? stateZip.split(' ')[0] : ''
    const location = city && state ? `${city}, ${state}` : raw.address ?? ''
    return finishNormalizing(raw.name, raw.name, location, raw.centerLat, raw.centerLng, holes, raw.coordinatesVerified ?? false, 'pebble-creek-colts-neck')
  }

  // New golfCourses.json shape: courseId/courseName/greenCoordinates/etc.
  const holes = raw.holes.map((h) => ({
    number: h.holeNumber,
    par: h.par,
    yards: h.yardage,
    lat: h.greenCoordinates.lat,
    lng: h.greenCoordinates.lng,
  }))
  return finishNormalizing(
    raw.courseId,
    raw.courseName,
    raw.location,
    raw.centerCoordinates.lat,
    raw.centerCoordinates.lng,
    holes,
    false,
    raw.courseId
  )
}

function finishNormalizing(id, name, location, centerLat, centerLng, holes, coordinatesVerified, idOverride) {
  const front9 = holes.filter((h) => h.number <= 9)
  const back9 = holes.filter((h) => h.number > 9)
  const parFront9 = front9.reduce((s, h) => s + h.par, 0)
  const parBack9 = back9.reduce((s, h) => s + h.par, 0)
  const totalYardage = holes.reduce((s, h) => s + h.yards, 0)

  return {
    id: idOverride ?? id,
    name,
    location,
    centerLat,
    centerLng,
    parTotal: parFront9 + parBack9,
    parFront9,
    parBack9,
    totalYardage,
    coordinatesVerified,
    holes,
  }
}

/** All available courses, normalized to one consistent shape. */
export const ALL_COURSES = [
  normalizeCourse(PEBBLE_CREEK),
  ...RAW_COURSES.map(normalizeCourse),
]

/** Looks up a single course by its id. Returns undefined if not found. */
export function getCourseById(courseId) {
  return ALL_COURSES.find((c) => c.id === courseId)
}

/** Returns all courses at a given location string (exact match). */
export function getCoursesByLocation(location) {
  return ALL_COURSES.filter((c) => c.location === location)
}

/** Every distinct location, for grouping in a course picker. */
export function getAllLocations() {
  return [...new Set(ALL_COURSES.map((c) => c.location))]
}

/**
 * Live remaining yardage from a player's position to a given hole's
 * green -- a thin, course-aware wrapper around the already-verified
 * Haversine distance function in golfGps.js, rather than a second,
 * separately-tested distance formula.
 */
export function calculateRemainingYardage(course, holeNumber, playerLat, playerLng) {
  const hole = course.holes.find((h) => h.number === holeNumber)
  if (!hole) return null
  return getDistanceInYards(playerLat, playerLng, hole.lat, hole.lng)
}

/** Total yardage and par for a course -- same numbers already stored
 * on the normalized course object, exposed here as a function per the
 * requested helper API. */
export function getRoundTotals(course) {
  return {
    totalYardage: course.totalYardage,
    totalPar: course.parTotal,
    parFront9: course.parFront9,
    parBack9: course.parBack9,
  }
}
