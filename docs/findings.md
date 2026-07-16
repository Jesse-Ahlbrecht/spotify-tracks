# Exploration findings (checkpoint)

Wide pass over all four realms. Numbers from `analysis/*.py`; figures in `analysis/figures/`.

> **Data caveat (all time realms).** Dataset B's 1920s–40s are thin (~6.6% of tracks) *and*
> unrepresentative — a survivorship/reissue sample (classical/jazz-heavy, a third with no genre tag)
> on lo-fi mono transfers that inflate `acousticness` / deflate `energy`. Trend lines include them;
> headline claims don't rest on them. Details in [decisions.md](decisions.md) → Open risks.

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

## Realm 3 — Mood over time  (dataset B) — *drilled in; mood as multiple axes*
- **Mood is several near-independent dials, and they disagree.** `valence` and `mode` are ~uncorrelated
  (r≈0.01), so tonality and positivity are *separate* stories tracked separately.
- **Energy** surges 0.30→0.66 (1920s→2020s); **valence** sags (0.56→0.51, sharper post-2000).
- **Tonality (new headline):** minor-key share climbs **26% → 45%** (corr 0.85 with year) — a cleaner
  "darkening" trend than valence. Music is increasingly written in the "sad" tonality.
- **The valence decline is driven by genres darkening, not by the mix.** Shift-share (Oaxaca)
  decomposition of the 1960s→2010s change (Δ −0.044, ~98% of tracks via artist-genre join):
  **within-genre −0.057**, between-genre (mix) **+0.020**, interaction −0.007. Valence fell *within*
  almost every supergenre; the mix actually drifted slightly *brighter*, **masking** part of the
  within-genre darkening (both mechanisms are real changes — the decomposition says which dominates).
- **Supporting textures:** loudness war (−14.8→−7.3 dB), explicit lyrics 0.07%→23%, duration peaks
  ~4 min then shrinks in the streaming 2020s (3.4 min).
- **The "sad banger" (sadder *and* more intense together):** low-valence + high-energy tracks grew
  ~1% (1920s) → **33%** (2020s). Energy⊥valence (decade corr ≈ 0) so they're separate trends: the
  **energy** rise is an electrification story (decade corr(energy, loudness)=+0.97, acousticness=−1.00);
  the **sadder** trend isn't the economy (see below) — likely genre/aesthetic + streaming + cultural
  (hypotheses, notebook "Why & outlook"). Outlook: minor keys still climbing, energy plateauing.
- **External overlays (FRED, no-auth) — music mood is its own trajectory.** Tested vs the *objective*
  economy (misery index) and *perceived* conditions (U. Michigan consumer sentiment). Detrended,
  valence↔misery is **not robust**: +0.31 over 1948–2021 but **~0 from 1960 on** — the signal is a
  thin-catalog late-1940s artifact, so the earlier "escapism" read is **retracted**. Valence↔sentiment
  ≈ −0.07 (no link either). What *is* real: a **perception–reality gap** in the human data (sentiment
  runs below misery-implied levels in the mid-2000s/post-2008/2020s — people feeling worse than the
  numbers say; corr(sentiment,−misery)=+0.66 overall). Music valence and sentiment both drift down
  recently, but co-drift over ~70 noisy years ≠ linkage. Minor-key rise tracks neither → secular drift.

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
