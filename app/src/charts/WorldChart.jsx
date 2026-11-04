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
      caption="Three separately standardised series, each relative to its own average. Higher valence means more positive-sounding music; higher misery means worse economic conditions (unemployment plus inflation); higher sentiment means greater consumer confidence. Misery is shown without reversing its sign. These lines are descriptive comparisons, not predictions or evidence of causation."
    />
  )
}
