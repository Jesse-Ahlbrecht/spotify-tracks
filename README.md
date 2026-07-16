# The Sound of Time — 100 years of music, told through its numbers

A take-home data exploration for the Genentech/Roche Scientific SWE assessment: explore the
Spotify tracks data, find a story, and ship one polished interactive visualization.

**→ Live demo:** <https://jesse-ahlbrecht.github.io/spotify-tracks/> (deployed from `app/` via GitHub Pages)

**→ The app in one line:** a scroll-driven journey through a century of recorded music (1922–2021).
Pick one of four "stories," then travel decade by decade through a 2-D sound-space while a
**representative Spotify track for each decade actually plays**.

---

## The question & the takeaway

The spark was two intuitions: *are genres even real?* and *how has the sound of music changed over
the decades — does it drift, cycle, or converge, and does its mood mirror the mood of the era?*

We explored **five "realms"** wide in notebooks, then committed to the strongest one — **mood over
time** — for the app. The honest, slightly surprising takeaways:

- Across a century music grew **more intense** (a clean "electrification" arc — energy/loudness up,
  acousticness down), **more minor-key** (minor-key share climbs 26% → 45%, the cleanest trend of
  all), and **a little less positive** (valence sags, sharper after 2000). These threads **don't all
  point the same way** — "mood" is several near-independent dials that disagree.
- The valence decline is **within-genre, not a mix artifact** (shift-share/Oaxaca decomposition).
- Music's mood follows **its own trajectory** — tested against the economy (FRED misery index) and
  public sentiment (U. Michigan), it robustly tracks **neither**. The tempting "sad music in hard
  times" story falsifies once you drop the thin, unrepresentative pre-1950 catalog — and we say so.

The other four realms (are genres real, music-as-fashion, converging-to-a-formula, islands-of-popularity)
live in the notebooks as narrated exploration. See [`docs/findings.md`](docs/findings.md) for the
full results and [`docs/decisions.md`](docs/decisions.md) for the reasoning and every scope call.

## Design choices

- **Python computes, the browser only renders.** All heavy lifting runs in `analysis/` +
  `scripts/export_app_data.py`, which writes ~18 KB of compact JSON to `app/public/data/`. The
  587k-row dataset never reaches the browser — the app reads pre-computed aggregates and renders them.
- **One coherent story, four lenses.** Rather than four separate pages, the app is a single tabbed
  journey — the 11-decade scroll persists while tabs swap the plane, tracks, and captions:
  **Mood** (valence×energy), **The beat** (energy×danceability), **Two kinds of sad**
  (valence×minor-key), **Why so intense** (energy×acousticness).
- **Hear the data.** Each decade's dot links a real, representative track — the most popular track
  nearest that decade's centroid in the plotted metrics — so the embed *sounds like the dot*.
- **Charts follow a small design system** (accessible palette, light/dark, single-axis only — the
  economy coda z-scores three series onto one axis rather than using a misleading dual-axis).
- **Honesty is a first-class feature.** Early decades are a lo-fi survivorship sample; the app and
  docs flag this, keep those points in the trend lines, but never anchor a headline number on them.

## Quick start

Two independent things live here: the **notebooks** (exploration) and the **app** (the deliverable
viz). The app's data artifacts are committed, so you can run the app without touching Python or Kaggle.

### Run the app (no Python needed)

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle in app/dist/ (this is what GitHub Pages serves)
```

Needs Node ≥18 (`nvm install --lts`). Song previews embed from Spotify and need a network connection.

### Reproduce the analysis & regenerate the data (optional)

```bash
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

bash scripts/download_data.sh          # fetches Kaggle datasets + FRED series, no auth needed
python scripts/export_app_data.py      # regenerates app/public/data/*.json from analysis/common.py

# rebuild + execute the exploration notebooks (they're generated from a script, then executed):
python scripts/build_notebooks.py
jupyter nbconvert --to notebook --execute --inplace notebooks/*.ipynb
```

## Repo layout

| Path | What |
|------|------|
| `app/` | The deliverable: Vite + React scroll-story. Charts hand-rolled in SVG (d3-scale/d3-shape, no chart lib). |
| `notebooks/00–05` | Narrated exploration — one per realm, question → step → plot → takeaway. |
| `analysis/common.py` | Shared loaders + cleaning used by both notebooks and the app export (single source of truth). |
| `scripts/` | `download_data.sh` (data), `build_notebooks.py` (authors the notebooks), `export_app_data.py` (app artifacts). |
| `docs/` | `findings.md` (results), `decisions.md` (decision log + risks), `programming_assesment.md` (the brief). |
| `data/raw/` | Downloaded datasets — git-ignored; fetch via the script. |

## Data

- **A** — `zaheenhamidani/ultimate-spotify-tracks-db` (~232k, genre + audio features, no year) — genre realm.
- **B** — `yamaerenay/spotify-dataset-19212020-600k-tracks` (~600k, has `year` + features) — all time realms.
- **US econ/sentiment** — unemployment, inflation, consumer sentiment, fetched no-auth from **FRED**.

All download with **no Kaggle auth** (`GET .../api/v1/datasets/download/<slug>` returns a real zip).
Raw data is git-ignored; `scripts/download_data.sh` fetches everything.

## AI disclosure

This was a genuine human + AI collaboration and is presented as such.

- **Jesse Ahlbrecht** owns the questions, hypotheses, framing, and every judgement/scope call —
  the "are genres real?" spark, the over-time angle, choosing which story to build, the "listen to
  your acoustic neighbors" idea, and steering/reviewing everything below.
- **Claude Code** (Anthropic, Opus 4.8) did the hands-on execution under that direction: writing the
  download/analysis code, authoring and running the notebooks, building the React app, surfacing data
  caveats, and drafting the docs.

**How outputs were reviewed:** every analytical claim was checked against the data before it shipped —
which repeatedly changed the story. The standout: an early "brighter music in hard times / escapism"
correlation was **retracted** after a start-year robustness check showed it was an artifact of the
thin late-1940s catalog. A high genre-variance number was traced to being ~90% driven by a single
genre. Review was **deliberately uneven, by importance**: the code that shapes the conclusions — the
**data flow and dataset building in Python** (`analysis/common.py`, the exports, the notebook stats) —
was read, since a bug there would corrupt the story. Much of the **frontend plumbing**
(button handlers, scroll wiring, CSS, layout) was **not** read as closely — it was validated by
behavior instead: the app was driven beat-by-beat in a headless browser (light + dark, zero console
errors) and I trusted what I could see working over reading every line. Where the data couldn't support
a claim, we say so rather than smoothing it over. The running log is in [`docs/decisions.md`](docs/decisions.md).

## What's next

- **Phase 2 of the app — free explore + song search.** Type any song → place it in mood-space → hear
  its acoustic neighbors via Spotify (ties back to "are genres real?"). Needs a popularity-stratified
  searchable subset export.
- **Better representative-track picking** — diversity guards (distinct artists, de-dupe remasters),
  blend popularity with centrality, and a "most central ↔ most iconic" reader toggle. Detailed sketch
  in [`docs/decisions.md`](docs/decisions.md) → "What's next — better song picking."
- **The same journey, but for genres.** Reuse the exact scroll-story we built — the 2-D sound-space,
  the moving dots, the representative track that plays — except step through **genres instead of
  decades**. Travel from one genre to the next, hear a representative track for each, and *watch how
  much they overlap* in sound-space: the interactive answer to the original "are genres real?" spark
  (Realm 1 showed ~3 of 4 acoustic neighbors are a *different* genre). Same components and export
  pipeline, a genre axis instead of a time axis.
- **Chase down *why* music got sadder** — the tonal darkening (minor-key 26%→45%, valence sag) is
  the most striking finding and currently an honest hypothesis, not an answer. With more time I'd hunt
  for **cultural correlates** beyond the economy: e.g. news-sentiment / "anxiety" indices, major-event
  timelines, Google-Trends-style attention series, and generational cohort effects — plus bringing in
  **lyrics** (sentiment, themes) and **real listening data** to separate what artists *make* from what
  audiences *choose*. Strictly correlational and multiple-comparisons-aware, but it would turn "likely
  genre/streaming/culture" into testable, ranked candidate explanations.
