# Decision log

Chronological record of scoping decisions for this take-home. Not auto-loaded — read when you need
the "why" behind [CLAUDE.md](../CLAUDE.md). Dates absolute.

## 2026-07-16 — Kickoff & scoping

### The brief
Roche/Genentech Scientific SWE assessment ([programming_assesment.md](programming_assesment.md)):
using Spotify data (or similar), find an interesting pattern/story and communicate it via
visualization(s). Timebox ~2–4h suggested. Deliverables emailed to
hughes.laura@gene.com within 7 days: overview, viz/tool, AI disclosure, "what's next," code repo w/
quick-start.

### Ways of working — human + Claude (honest disclosure)
This is a genuine human+AI collaboration and is presented as such — none of it is solo work.
- **Jesse** owns the questions, hypotheses, framing, and every judgement / scope call: the
  "are genres real?" intuition, the decade / over-time angle, the mood-over-time and
  islands-of-popularity ideas, the "listen to your acoustic neighbors" app feature, and the decision
  of which story to build.
- **Claude Code** (Anthropic, Opus 4.8) does the hands-on execution under that direction: writing the
  data-download and analysis code, authoring and running the notebooks, surfacing data caveats
  (e.g. that a high eta² was ~90% driven by one genre), and drafting these docs — all reviewed and
  steered by Jesse, iterating on feedback.
A fuller AI-disclosure write-up (representative prompts + how outputs were reviewed) ships with the
README deliverable.

### Environment reality (verified, not assumed)
- Bare devcontainer (Roche `ona-base:2.0`): **no** python/node/R, **no** Kaggle CLI/creds. Only
  `curl`/`wget`. But `apt` + `sudo` work → we install the stack ourselves.
- **Key unblock:** the Kaggle *download* endpoint returns real ZIPs (magic `PK\x03\x04`) with **no
  auth** — `GET https://www.kaggle.com/api/v1/datasets/download/<owner>/<slug>`. No credentials needed.

### Chosen question(s)
Two driving intuitions from the project owner (Jesse):
1. **Are genres real?** — liking one song doesn't mean you'll like another of the same genre more than
   a random one; maybe genre is a weak proxy for what actually makes songs *sound* alike.
2. **How has music changed over the decades?** — does the sound of music drift, cycle, or converge over
   time, and does its mood track the mood of the era?

These expanded, via brainstorm, into 5 realms to explore wide, then commit to one for the app:
1. **Are genres real?** within- vs between-genre variance; genre classifier + confusion matrix;
   PCA/UMAP overlap; nearest-neighbor "same-genre lift."
2. **Music as fashion / recurrence** — decade-to-decade similarity matrix; detrend + FFT/autocorr to
   tell genuine cycles from monotonic drift.
3. **Mood over time vs the decade's mood** — valence/energy per year, annotated events, mood-space
   trajectory. **Richest thread — we plan to drill in further:** join an external US misery-index /
   sentiment series, and break mood arcs down per-genre and per-decade. Correlational only.
4. **Is music converging to a formula?** — per-year dispersion *and* the multivariate "how many
   archetypes?" view (cluster perplexity, effective dimensionality). Homogenization vs diversification.
5. **Islands of popularity** *(added mid-exploration)* — do popular songs cluster into acoustic
   "islands"? Popularity heatmap over the sound-space, neighbor-popularity lift, k-means hit-islands.

### Approach
Explore all 5 wide in notebook(s) → **checkpoint with user** → build **one** polished React app on the
single strongest story. Python does heavy compute and exports compact static artifacts; React is a
static site consuming them (hostable as a link; keeps 232k/600k rows out of the browser).

### Data decisions
- Dataset A `zaheenhamidani/ultimate-spotify-tracks-db` for genre work (has genre; **no year**; also
  labels the same track under multiple genres — useful built-in evidence of genre fuzziness).
- Dataset B `yamaerenay/spotify-dataset-19212020-600k-tracks` for all time-based realms (has `year`).
  Fallback `ektanegi/spotifydata-19212020`. The 160k variant returned an error blob — **do not use**.
- Assessment explicitly allows combining/"similar" data → using B + a small external mood series is
  in-scope.

### Ideas considered and NOT pursued (for now)
- "What makes a hit?" and standalone "mood map" — folded in only as lenses, not primary.
- "Has pop gotten sadder?", "loudness war / rise of electronic", "shorter & faster songs" — good, but
  left out to keep scope tight (Jesse added "converging to a formula?" first, then "islands of
  popularity" mid-exploration).
- **genre × year** analyses (genre birth/death, revival by name) — hard: A has genre but no year, B has
  year but weak genre. Avoid unless we find a clean join.
- Anything needing **lyrics** or **user-listening data** — out of scope (would need new sources); noted
  as "what's next."

### Documentation approach (added same day)
- Exploration is documented as **step-by-step notebooks** (`notebooks/00` setup + `01–05`, one per
  realm), each leading the reader question → step → plot → takeaway. Fast throwaway analysis scripts
  were replaced by these.
- Notebooks are **generated by `scripts/build_notebooks.py`** (nbformat) and executed via nbconvert, so
  they're reproducible from source. Shared loading/cleaning lives in `analysis/common.py`; edit the
  builder rather than the .ipynb by hand.

### Open risks / honesty notes
- Time-feature trends are often **monotonic drift** (production tech), not cycles — the fashion story
  may partly falsify; report it honestly ("mostly drifts, here's what recurs").
- Mood-vs-decade is correlational, not causal.
- **Early decades are thin *and* unrepresentative (affects all time realms 2–4).** The 1920s–40s are
  only ~6.6% of dataset B (1920s 7.6k, 1930s 13k, 1940s 18k; 1922 has just 276 tracks) — but N is the
  smaller issue. What survives on Spotify from that era is a **survivorship/reissue sample** (34.9%
  have no artist genre tag; classical 16.6% + jazz 12.3% dominate vs ~2% each later; rock/pop barely
  exist yet), not what listeners actually heard. And features are computed on **low-fidelity mono
  transfers**, which mechanically inflates `acousticness` and deflates `energy`/`loudness` for
  recording-tech reasons, not artistic ones. So: keep pre-1950 points in the trend lines (the 100-year
  arc needs them), but **never anchor a headline number on the 1920s–40s alone.** Rigorous comparisons
  should start ~1950–60 (the shift-share decomposition anchors at 1960s→2010s; the economics overlay
  starts 1948 and drops years <200 tracks — the retracted "escapism" signal was exactly this bias
  biting). Notebook 03 Step 1 flags the sparse/unrepresentative catalog inline.

## 2026-07-16 — Realm 3 deep-dive (mood over time)

Drilled into the richest thread. Reframed mood as **multiple near-independent axes** (valence, energy,
tonality) rather than one dial, after finding `valence` ⟂ `mode` (r≈0.01).
- **New signal — tonality:** added `mode` (major/minor); minor-key share rises 26%→45% (corr 0.85/yr).
  Cleaner than valence and its own story.
- **Rigor — genre decomposition:** shift-share (Oaxaca) of the 1960s→2010s valence change shows the
  decline is **within-genre (−0.057)**, not a mix artifact (mix effect +0.020 actually masks it). This
  needed a genre for dataset B, so we **resolved the earlier "avoid genre×B" call**: `attach_genre()`
  joins each track's lead `id_artists` → artist `genres` (artists.csv) → coarse supergenre (~72% named
  coverage). Honest about the uncovered ~28%.
- **External data (committed to earlier):** `load_misery()` + `download_data.sh` now fetch US
  unemployment (UNRATE) + CPI (CPIAUCNS→inflation) from **FRED's `fredgraph.csv`, no auth** — same
  ethos as the Kaggle downloads. Later added **consumer sentiment (UMCSENT)** via `load_sentiment()`
  to test *perceived* vs *objective* conditions (Jesse's point: people feel worse than reality lately).
- **Escapism claim retracted (honesty fix).** The first pass reported a detrended valence↔misery
  ~+0.31 ("brighter music in hard times"). A start-year robustness check shows it's **driven by the
  volatile late-1940s / thin catalog** — ~0 from 1960 on. Music valence robustly tracks **neither**
  the economy nor sentiment year-to-year. The perception–reality gap *does* show in the human data
  (sentiment vs misery), and music valence + sentiment co-drift down recently, but that's not linkage.
  Reframed Step 7 around this honest null; corrected findings.md. Minor-key rise tracks neither.
- Also surfaced supporting textures (loudness war, explicit rise, streaming-era shortening).
- Scope unchanged: still notebook-only for this realm; no app artifacts yet.

## 2026-07-16 — The app, Phase 1: "The Sound of Time" (guided journey)

Committed to Realm 3 as the story and built the single polished deliverable: a scroll-driven
"music journey over time" (`app/`). Flow agreed with Jesse: **hybrid guided→explore**, **Spotify
embeds**, opening on a *question* ("Music from the 1920s is different — but how?"), featuring
valence/energy/danceability + tonality, and keeping the "sad banger" as the emotional centrepiece.

- **Phase 1 = the guided journey (beats 1–6)**, shippable on its own. Phase 2 (free explore + song
  search) deferred — it needs a popularity-stratified searchable subset export.
- **Architecture as planned:** Python computes → `scripts/export_app_data.py` writes ~9 KB of JSON
  (`app/public/data/{timeline,tracks,world}.json`) from the *same* `common.py` loaders, so app
  numbers match the notebook exactly. *All* derivation (aggregates, representative-track selection,
  the economy join + z-scoring) happens in the export; React only reads + renders. The 587k-row
  dataset never hits the browser.
- **Stack:** Vite + React (plain JSX); charts hand-rolled in SVG with `d3-scale`/`d3-shape` (no chart
  lib). Followed the `dataviz` skill — validated the categorical palette with its script, and used
  **one axis** for the economy beat (z-scored valence/misery/sentiment) rather than a dual-axis.
- **Representative track per decade** = most-popular track nearest the decade's mood centroid (so the
  embed *sounds* like the dot). Surfaced fitting picks (Take Five → … → Juice WRLD).
- **Env:** devcontainer had no Node; installed via nvm (Node 24 LTS). Verified end-to-end by driving a
  headless Chromium (Playwright) and screenshotting every beat in light + dark (0 console errors);
  removed Playwright + the driver afterward to keep app deps to react/d3/vite only.
- Honesty carried into the app: the closing beat states music tracks neither the economy nor
  sentiment, and the footer flags the "why" as hypotheses, not this dataset's answer.

## 2026-07-16 — App: one journey → four (a story-switcher)

Jesse liked the decade-journey graphic and wanted **multiple journeys, each telling a different
story**, with example songs picked *for the specific metrics each journey plots*. Turned the single
mood journey + three static "beats" (which already named the stories) into **one tabbed journey**
(chosen over stacking four full journeys, to avoid 4× scroll and make stories comparable):
- **Four planes:** Mood (valence×energy), The beat (energy×danceability), Two kinds of sad
  (valence×minor-key), Why so intense (energy×acousticness). Tabs swap the plane, tracks, captions,
  highlighted dials, and the spotlight colour; the 11-decade scroll column persists.
- **Tracks are now per-journey.** `export_app_data.py` picks each decade's 3 representative tracks
  nearest the centroid **in the z-space of that journey's two plotted metrics** (for the sad journey,
  the tonal axis is per-track `mode`). `tracks.json` is now nested `{journeyId: {decade: [...]}}`
  (still a few KB). `timeline.json`/`world.json` unchanged.
- The year-based "Does music mirror the world?" beat stays as a closing coda (not a decade plane).
- **AI disclosure:** the component generalization (`MoodSpace`/`Journey` props, the export loop) and
  the 33 new per-decade captions (beat/sad/intensity) are Claude-generated, reviewed by Jesse.

### What's next — better song picking
Current pick (in `export_app_data.py`): per journey, per decade, take the top-100 tracks by popularity,
then the 3 nearest that plane's centroid in the z-space of its two plotted metrics. It's simple and
"sounds like the dot," but has clear room to improve:
- **Diversity guard.** The 3 picks can bunch up — same lead artist, a remaster/alt-version of the same
  song, or a track that resurfaces across journeys/decades. Enforce distinct artists, de-dupe
  remasters/live/alternate versions (normalize the title), and optionally forbid repeats across cells.
- **Blend popularity with centrality** instead of a hard top-100 cut: score each track by
  `w·(popularity, normalized *within* the decade) − distance-to-centroid`, so a very central but
  slightly-less-famous track can win and the thin early decades (low absolute popularity) aren't
  over-filtered.
- **Show the spread, not just the mean.** Optionally surface one track *at* the centroid plus one or two
  that represent the decade's variance (e.g. quadrant extremes), so the embed conveys range, not only
  the average point.
- **Better recognizability for old decades.** `popularity` is a present-day snapshot biased against
  pre-1960s tracks; fold in a name-recognition proxy or a small editorial allowlist for early decades.
- **Let the reader choose.** A "most central ↔ most iconic" toggle to trade representativeness for
  familiarity, reusing the same scoring with a different weight.
