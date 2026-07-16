import LineFig from './LineFig.jsx'

// Coda — music mood vs the objective and perceived economy, all z-scored (one axis).
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
