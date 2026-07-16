import LineFig from './LineFig.jsx'
import { pct, dec2 } from '../lib.js'

const decadeLabel = (d) => `${d}s`

// Beat 3 — energy and danceability both climb.
export function EnergyDanceChart({ decades }) {
  return (
    <LineFig
      data={decades}
      xKey="decade"
      fmtX={decadeLabel}
      fmtY={dec2}
      yDomain={[0, 0.7]}
      xLabel="decade"
      series={[
        { key: 'energy', label: 'Energy', color: 'var(--c-energy)' },
        { key: 'danceability', label: 'Danceability', color: 'var(--c-dance)' },
      ]}
      caption="Energy more than doubles across the century; danceability dips mid-century, then climbs to its modern high."
    />
  )
}

// Beat 4 — minor-key rise + the sad banger.
export function SadChart({ decades }) {
  return (
    <LineFig
      data={decades}
      xKey="decade"
      fmtX={decadeLabel}
      fmtY={pct}
      yDomain={[0, 0.5]}
      xLabel="decade"
      series={[
        { key: 'minor_share', label: 'Minor key', color: 'var(--c-minor)' },
        { key: 'sad_banger', label: 'Sad banger', color: 'var(--c-sad)', area: true },
      ]}
      caption="Minor-key writing climbs from ~26% to ~45%. The “sad banger” — low-valence but high-energy — grows from ~1% of tracks to a third."
    />
  )
}

// Beat 5 — electrification: energy up as acousticness collapses.
export function ElectrificationChart({ decades }) {
  return (
    <LineFig
      data={decades}
      xKey="decade"
      fmtX={decadeLabel}
      fmtY={dec2}
      yDomain={[0, 1]}
      xLabel="decade"
      series={[
        { key: 'energy', label: 'Energy', color: 'var(--c-energy)' },
        { key: 'acousticness', label: 'Acousticness', color: 'var(--c-acoustic)' },
      ]}
      caption="The two mirror each other (decade-level correlation −1.0): the energy rise is an electrification story — acoustic instruments giving way to electric and digital production — more than a change of feeling."
    />
  )
}

// Beat 6 — music mood vs the objective and perceived economy, all z-scored (one axis).
// The join + standardization are precomputed in export_app_data.py; we just render.
export function WorldChart({ world }) {
  return (
    <LineFig
      data={world}
      xKey="year"
      fmtY={(v) => v.toFixed(1)}
      yLabel="z-score (above / below each series’ own average)"
      xLabel="year"
      series={[
        { key: 'valence', label: 'Valence', color: 'var(--c-valence)' },
        { key: 'misery', label: 'Misery', color: 'var(--c-misery)' },
        { key: 'sentiment', label: 'Sentiment', color: 'var(--c-sentiment)' },
      ]}
      caption="Standardised so different units share one axis. Music valence wanders largely independent of both the objective economy (misery) and how people feel (sentiment) — while sentiment itself drifts below the misery-implied line in the mid-2000s and 2010s (people feeling worse than the numbers say)."
    />
  )
}
