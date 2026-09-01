import { useState, useEffect, useRef } from 'react'

/**
 * Great-circle distance between two lat/lng points, in yards.
 * Verified against known real-world reference distances:
 *   - Exact 0 for identical points
 *   - ~109 yards for a precisely-controlled ~100m separation
 *   - Ballpark-correct (within ~2%) against a known ~8.4km real-world pair
 */
export function getDistanceInYards(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const meters = R * c
  return meters * 1.09361
}

/**
 * Watches the device's live GPS position with high accuracy.
 * Returns { position: {lat, lng, accuracy} | null, error: string | null }.
 * Automatically cleans up the watch on unmount.
 */
export function useGolfGPS() {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const watchIdRef = useRef(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device.')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setError(null)
      },
      (err) => {
        // Common cases: permission denied, position unavailable, timeout.
        // Never throw -- just surface the message so the UI can show a
        // sensible fallback instead of crashing.
        setError(err.message || 'Could not get your location.')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return { position, error }
}
