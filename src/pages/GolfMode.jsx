import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

/**
 * Simplified landing page for Golf -- the full experience (schematic
 * hole view, GPS distance, satellite map, hazard tracking, drink
 * logging, roasts, scorecard, post-round report) all lives in the GPS
 * Caddie now. This page is just the entry point into it.
 */
export default function GolfMode() {
  return (
    <Layout>
      <p className="text-golf text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        GOLF MODE
      </p>
      <h1 className="font-display text-4xl text-golf mb-8">FORE!</h1>

      <p className="text-muted font-body mb-8">
        Live GPS distance, a satellite view of every hole, hazard tracking, and a full
        scorecard with post-round roasts -- all in one place.
      </p>

      <Link
        to="/mode/golf/caddie"
        className="block text-center bg-golf text-black font-display text-lg py-4 rounded-2xl"
      >
        ⛳ Open GPS Caddie
      </Link>
    </Layout>
  )
}
