/**
 * @typedef {Object} LatLng
 * @property {number} lat
 * @property {number} lng
 */

/**
 * Compass heading (0-360, 0 = north) from one point to another.
 * Verified against known cardinal directions (due north/east/south/
 * west all return exactly 0/90/180/270) before ever being wired into
 * any UI.
 */
export function calculateHeading(from, to) {
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180
  const dLng = ((to.lng - from.lng) * Math.PI) / 180

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  const heading = (Math.atan2(y, x) * 180) / Math.PI
  return (heading + 360) % 360
}
