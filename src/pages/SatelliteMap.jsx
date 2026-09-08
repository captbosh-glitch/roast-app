import { useState } from 'react'
import {
  buildTileGrid,
  latLngToGridPosition,
  gridPositionToLatLng,
} from '../lib/satelliteTiles'
import { getDistanceInYards } from '../lib/golfGps'
import { calculateHeading } from '../lib/geoUtils'

const ZOOM = 19
const GRID_PX = 256 * 3 // 3x3 grid of 256px tiles
// Largest square that stays fully inside a rotated GRID_PX square at
// any angle is GRID_PX/sqrt(2) ≈ 543px -- using a smaller viewport
// than that guarantees no blank corners ever show, at any rotation.
const VIEWPORT_PX = 480

/**
 * Rotates a point (relative to a shared center) by `angleDeg` degrees
 * clockwise, matching CSS's rotate() convention in a Y-down screen
 * coordinate system. Verified via round-trip testing (rotating then
 * applying the inverse recovers the original point exactly) before
 * ever being wired into this UI.
 */
function rotatePoint(x, y, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: x * Math.cos(rad) - y * Math.sin(rad),
    y: x * Math.sin(rad) + y * Math.cos(rad),
  }
}

/**
 * A static (no pan/zoom) satellite "eagle-eye" view centered on a
 * hole's green, built from Esri's free World Imagery tiles -- no API
 * key, no paid mapping library. Trades true interactivity for zero
 * dependency risk; tapping still sets a target marker and shows a
 * live distance to it.
 *
 * Optionally rotates so the green is always "up" relative to the
 * player's current position -- achieved by rotating the whole tile
 * image via CSS (verified inverse-rotation math keeps tap-to-target
 * accurate even while rotated), rather than a real map SDK's native
 * camera rotation.
 */
export default function SatelliteMap({ greenLat, greenLng, playerPosition }) {
  const [target, setTarget] = useState(null)
  const [imageErrors, setImageErrors] = useState({})
  const [rotateToGreen, setRotateToGreen] = useState(true)

  const grid = buildTileGrid(greenLat, greenLng, ZOOM)
  const greenPos = latLngToGridPosition(greenLat, greenLng, grid)
  const playerPos = playerPosition
    ? latLngToGridPosition(playerPosition.lat, playerPosition.lng, grid)
    : null
  const targetPos = target ? latLngToGridPosition(target.lat, target.lng, grid) : null

  const targetDistance =
    target && playerPosition
      ? getDistanceInYards(playerPosition.lat, playerPosition.lng, target.lat, target.lng)
      : null

  // Heading from the player's current position to the green -- rotating
  // the display by the negative of this makes that direction point up.
  // Falls back to north-up (0) if we don't have a live position yet.
  const heading =
    rotateToGreen && playerPosition
      ? calculateHeading(playerPosition, { lat: greenLat, lng: greenLng })
      : 0

  function handleTap(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    // Tap position relative to the viewport's own center (rotation in
    // CSS happens around the element's center by default).
    const dx = e.clientX - rect.left - VIEWPORT_PX / 2
    const dy = e.clientY - rect.top - VIEWPORT_PX / 2

    // Undo the display rotation to find the corresponding position in
    // the tile grid's own unrotated coordinate space.
    const unrotated = rotatePoint(dx, dy, heading)
    const gridX = unrotated.x + GRID_PX / 2
    const gridY = unrotated.y + GRID_PX / 2

    setTarget(gridPositionToLatLng(gridX, gridY, grid))
  }

  return (
    <div className="mb-4">
      <div
        onClick={handleTap}
        className="relative rounded-2xl overflow-hidden border border-panel-border cursor-crosshair mx-auto bg-black"
        style={{ width: VIEWPORT_PX, height: VIEWPORT_PX, maxWidth: '100%', aspectRatio: '1 / 1' }}
      >
        {/* Rotated inner content -- tiles and markers move together as
            one group, so markers stay correctly placed on the terrain
            regardless of rotation. */}
        <div
          className="absolute transition-transform duration-300"
          style={{
            width: GRID_PX,
            height: GRID_PX,
            left: '50%',
            top: '50%',
            marginLeft: -GRID_PX / 2,
            marginTop: -GRID_PX / 2,
            transform: `rotate(${-heading}deg)`,
          }}
        >
          {grid.tiles.map((tile) => {
            const key = `${tile.tileX}-${tile.tileY}`
            if (imageErrors[key]) {
              // A failed tile fetch (offline, or Esri rate limiting) --
              // never let one bad tile break the whole view.
              return (
                <div
                  key={key}
                  className="absolute bg-panel"
                  style={{ left: tile.gridX * 256, top: tile.gridY * 256, width: 256, height: 256 }}
                />
              )
            }
            return (
              <img
                key={key}
                src={tile.url}
                alt=""
                onError={() => setImageErrors((prev) => ({ ...prev, [key]: true }))}
                className="absolute"
                style={{ left: tile.gridX * 256, top: tile.gridY * 256, width: 256, height: 256 }}
              />
            )
          })}

          {/* Green/pin marker -- counter-rotated so the flag itself
              stays visually upright even as the terrain rotates. */}
          <div
            className="absolute text-2xl"
            style={{
              left: greenPos.x,
              top: greenPos.y,
              transform: `translate(-50%, -100%) rotate(${heading}deg)`,
            }}
          >
            🚩
          </div>

          {/* Live player position */}
          {playerPos && (
            <div
              className="absolute w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg"
              style={{ left: playerPos.x, top: playerPos.y, transform: 'translate(-50%, -50%)' }}
            />
          )}

          {/* Tap-to-set target marker */}
          {targetPos && (
            <div
              className="absolute w-4 h-4 rounded-full bg-golf border-2 border-white shadow-lg"
              style={{ left: targetPos.x, top: targetPos.y, transform: 'translate(-50%, -50%)' }}
            />
          )}
        </div>

        {/* Compass indicator, rotates with the map so it always points
            to true north, helping orient a rotated view. */}
        <div
          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-red-400 font-bold text-xs transition-transform duration-300"
          style={{ transform: `rotate(${-heading}deg)` }}
        >
          N
        </div>

        <p className="absolute bottom-1 right-1 text-white/50 font-body text-[9px]">
          Tiles © Esri
        </p>
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-muted font-body text-xs">Tap the map to measure a layup distance</p>
        <div className="flex items-center gap-3">
          {target && (
            <button onClick={() => setTarget(null)} className="text-muted font-body text-xs underline">
              Clear target
            </button>
          )}
          <button
            onClick={() => setRotateToGreen((v) => !v)}
            className="text-golf font-body text-xs underline"
          >
            {rotateToGreen ? '🧭 Rotating to green' : '⬆️ North up'}
          </button>
        </div>
      </div>

      {targetDistance !== null && (
        <p className="text-golf font-display text-xl text-center mt-1">
          {Math.round(targetDistance)} yds to target
        </p>
      )}
    </div>
  )
}
