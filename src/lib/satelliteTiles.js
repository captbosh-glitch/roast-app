// Dependency-free satellite tile math, using Esri's free World Imagery
// service (no API key required -- confirmed via Esri's own docs).
// Verified via round-trip testing (forward + inverse pixel math agree
// to floating-point precision) before ever being wired into any UI.

const TILE_SIZE = 256

export function latLngToGlobalPixel(lat, lng, zoom) {
  const n = Math.pow(2, zoom)
  const x = ((lng + 180) / 360) * n * TILE_SIZE
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE_SIZE
  return { x, y }
}

export function globalPixelToLatLng(px, py, zoom) {
  const n = Math.pow(2, zoom)
  const lng = (px / (n * TILE_SIZE)) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / (n * TILE_SIZE))))
  const lat = (latRad * 180) / Math.PI
  return { lat, lng }
}

// Esri tile URLs use {z}/{y}/{x} order (y before x) -- a real, easy
// mistake to make, so it's called out explicitly here.
export function esriTileUrl(tileX, tileY, zoom) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tileY}/${tileX}`
}

/**
 * Builds a 3x3 grid of tiles centered on (centerLat, centerLng) at the
 * given zoom, with each tile's global pixel origin -- everything a
 * static satellite view needs to render tiles and position markers
 * with real, verified pixel math.
 */
export function buildTileGrid(centerLat, centerLng, zoom) {
  const centerPixel = latLngToGlobalPixel(centerLat, centerLng, zoom)
  const centerTileX = Math.floor(centerPixel.x / TILE_SIZE)
  const centerTileY = Math.floor(centerPixel.y / TILE_SIZE)

  const tiles = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tileX = centerTileX + dx
      const tileY = centerTileY + dy
      tiles.push({
        tileX,
        tileY,
        url: esriTileUrl(tileX, tileY, zoom),
        // Pixel position of this tile's top-left corner, relative to
        // the grid's own top-left tile -- used to lay tiles out with
        // plain CSS positioning.
        gridX: dx + 1,
        gridY: dy + 1,
      })
    }
  }

  // Global pixel origin of the whole 3x3 grid's top-left corner --
  // needed to convert any lat/lng into a position within the grid.
  const gridOrigin = {
    x: (centerTileX - 1) * TILE_SIZE,
    y: (centerTileY - 1) * TILE_SIZE,
  }

  return { tiles, gridOrigin, zoom }
}

/**
 * Converts a lat/lng into pixel coordinates within a tile grid built
 * by buildTileGrid -- e.g. for positioning a marker with CSS
 * top/left.
 */
export function latLngToGridPosition(lat, lng, grid) {
  const pixel = latLngToGlobalPixel(lat, lng, grid.zoom)
  return {
    x: pixel.x - grid.gridOrigin.x,
    y: pixel.y - grid.gridOrigin.y,
  }
}

/**
 * Inverse of latLngToGridPosition -- converts a tap position within
 * the grid (in pixels) back into a real lat/lng, for the tap-to-set-
 * target feature.
 */
export function gridPositionToLatLng(x, y, grid) {
  return globalPixelToLatLng(x + grid.gridOrigin.x, y + grid.gridOrigin.y, grid.zoom)
}
