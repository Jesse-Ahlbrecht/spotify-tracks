# Exploration findings (checkpoint)

Wide pass over all four realms. Numbers from `analysis/*.py`; figures in `analysis/figures/`.

## Realm 1 — Are genres real?  (dataset A, 176.8k unique tracks, 26 genres)
- **19.9%** of tracks carry 2+ genre labels (max 8) — genre boundaries are officially fuzzy.
- Genre explains **~39%** of audio-feature variance on average (eta²): high for speechiness (0.72),
  near-zero for tempo (0.06).
- Predicting genre from audio: **38.6%** (gradient boosting) vs **5.5%** majority baseline → 7× chance,
  but still wrong ~61% of the time.
- **Nearest-neighbor lift = 6.0×**: a track's 10 acoustic neighbors share its genre 25.4% of the time
  vs 4.3% for a random pair. So genre *does* predict similarity — yet **~3 of 4 acoustic neighbors are
  a different genre.** PCA: one clean cluster (spoken word), everything else overlaps.
- **Verdict:** genres are *real-ish* — a real but weak signal. Directly answers the user's spark.

## Realm 2 — Music as fashion / recurrence  (dataset B, 586.6k tracks, 1922–2021)
- Decade-similarity matrix shows a **strong diagonal band and no off-diagonal glow**: each decade
  resembles its neighbors and nothing older. Music **drifts one way; it does not recur like fashion.**
- Feature trends = clean "electrification" arc: acousticness/instrumentalness/speechiness collapse,
  energy/loudness/danceability rise, crossover ~1970–80.

## Realm 3 — Mood over time  (dataset B)
- **Energy** surges 0.30→0.66 (1920s→2020s); **valence** drifts down late (0.56→0.51, sharper post-2000);
  danceability rises then plateaus. Visible valence/danceability dip around the 1940s (WWII).
- Event annotations are suggestive, not causal. External misery-index overlay still TODO (extension).

## Realm 4 — Converging to a formula?  (dataset B)
- **Per feature:** per-year dispersion declines, with a **step-down around 2000** (~0.95 → ~0.86) — mild
  homogenization. Caveat: early years noisy (small catalog).
- **Multivariate (fewer archetypes?):** cluster-perplexity of the joint feature distribution, balanced
  to equal N/decade, traces an **inverted-U**: effective # of song archetypes rises ~9 (1920s) → ~21
  (1970s–90s) then **falls to ~15 by the 2020s**. Effective dimensionality rose then plateaued (~6
  style-axes); mean radius drifted down. So recent music **clumps into fewer archetypes** along the same
  axes rather than collapsing in dimensionality. Post-1990 decline (large fresh catalogs) is the robust
  part; early rise may be understated by survivorship in old catalog.

## Realm 5 — Islands of popularity  (dataset A, added)
- Popularity is **not** uniform across sound-space: a hexbin popularity map shows a bright "hit island"
  (high energy/danceability, low acousticness) and cold zones (acoustic/spoken-word).
- **Neighbor-popularity lift:** a song's 10 acoustic neighbors climb from ~26 → ~44 mean popularity as
  the song's own popularity rises (monotonic); top-decile songs' neighbors are well above the ~37 mean.
  Popularity is spatially autocorrelated — hits cluster.
- k-means (12 clusters) ranks some acoustic clusters far above others in mean popularity ("hit islands"
  with representative genre + example track).
- **Verdict:** yes, hits form acoustic islands — with the caveat that `popularity` is a recent snapshot,
  so islands reflect *today's* winning sounds. Ties directly to the app's Spotify-listen side feature.

## Story options for the ONE app
- **A. "Are genres real?"** — interactive sound-space explorer: pick a song → see its acoustic
  neighbors and how many cross genres; genre-confusion heatmap; color by genre vs by sound. Most
  *interactive/personal*, ties back to the original question.
- **B. "100 years: the sound of time"** — timeline explorer unifying realms 2–4 (electrification +
  mood + homogenization) into one coherent narrative. Most *cohesive story*, strong visuals.
