import { useState } from 'react'
import {
  buildTileGrid,
  latLngToGridPosition,
  gridPositionToLatLng,
} from '../lib/satelliteTiles'
import { getDistanceInYards } from '../lib/golfGps'

const ZOOM = 19
const GRID_PX = 256 * 3 // 3x3 grid of 256px tiles

/**
 * A static (no pan/zoom) satellite "eagle-eye" view centered on a
 * hole's green, built from Esri's free World Imagery tiles -- no API
 * key, no paid mapping library. Trades true interactivity for zero
 * dependency risk; tapping still sets a target marker and shows a
 * live distance to it.
 */
export default function SatelliteMap({ greenLat, greenLng, playerPosition }) {
  const [target, setTarget] = useState(null)
  const [imageErrors, setImageErrors] = useState({})

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

  function handleTap(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setTarget(gridPositionToLatLng(x, y, grid))
  }

  return (
    <div className="mb-4">
      <div
        onClick={handleTap}
        className="relative rounded-2xl overflow-hidden border border-panel-border cursor-crosshair mx-auto bg-black"
        style={{ width: GRID_PX, height: GRID_PX, maxWidth: '100%', aspectRatio: '1 / 1' }}
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

        {/* Green/pin marker */}
        <div
          className="absolute text-2xl"
          style={{ left: greenPos.x, top: greenPos.y, transform: 'translate(-50%, -100%)' }}
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

        <p className="absolute bottom-1 right-1 text-white/50 font-body text-[9px]">
          Tiles © Esri
        </p>
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-muted font-body text-xs">Tap the map to measure a layup distance</p>
        {target && (
          <button onClick={() => setTarget(null)} className="text-muted font-body text-xs underline">
            Clear target
          </button>
        )}
      </div>

      {targetDistance !== null && (
        <p className="text-golf font-display text-xl text-center mt-1">
          {Math.round(targetDistance)} yds to target
        </p>
      )}
    </div>
  )
}
