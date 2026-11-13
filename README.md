# The Sound of Time — 100 years of music, told through its numbers

A personal proof-of-concept data story: how the sound of recorded music changed over a century,
explored in notebooks and told in one interactive web app built on Spotify's audio features.

**→ Live demo:** <https://jesse-ahlbrecht.github.io/spotify-tracks/> (deployed from `app/` via GitHub Pages)

**→ The app in one line:** a journey through a century of recorded music (1922–2021), decade by
decade. Pick one of four stories and travel it two ways: the **full journey**, with charts, captions
and songs for every decade, or the **quick version**, one swipeable card and one song per decade.

---

## The question & the takeaway

The starting point was two questions: *are genres even real?* and *how has the sound of music
changed over the decades — does it drift, cycle, or converge, and does its mood mirror the mood of
the era?*

The notebooks explore **five "realms"**; the app is built on the strongest one, **mood over time**.
The takeaways:

- Across a century music grew **more intense** (a clean "electrification" arc — energy/loudness up,
  acousticness down), **more minor-key** (minor-key share climbs 26% → 45%, the cleanest trend of
  all), and **a little less positive** (valence sags, sharper after 2000). These threads **don't all
  point the same way** — "mood" is several near-independent dials that disagree.
- The valence decline is **within-genre, not a mix artifact** (shift-share/Oaxaca decomposition).
- Music's mood follows **its own trajectory** — tested against the economy (FRED misery index) and
  public sentiment (U. Michigan), it robustly tracks **neither**. The tempting "sad music in hard
  times" story falsifies once you drop the thin, unrepresentative pre-1950 catalog.

The other four realms (are genres real, music-as-fashion, converging-to-a-formula, islands-of-popularity)
live in the notebooks as narrated exploration. See [`docs/findings.md`](docs/findings.md) for the
full results and [`docs/design-notes.md`](docs/design-notes.md) for the reasoning behind the design.

## The app

Four stories, each with a short explainer screen first:
**Mood** (songs that sound happy / are high-energy), **The beat** (high-energy / danceable),
**Two kinds of sad** (sound sad / minor key), **Why so intense** (electric / high-energy).

- **Full journey.** Scroll decade by decade. Two bar charts update as you go, a caption explains
  each decade, and up to three representative Spotify tracks play alongside. On a phone each decade
  is one screen with its own chart, its songs a sideways swipe apart, and a Next button. The Mood
  story ends on a coda that sets music's mood against the economy and consumer sentiment.
- **Quick version** ("Quick swipe"). One full-screen card per decade with a headline, one line of
  story and one song. No charts.

On iPhone, Safari starts a song only from a tap, not from a swipe: tap Next (or the "Tap to play"
button that appears over a song that did not start).

## Design choices

- **Python computes, the browser only renders.** All heavy lifting runs in `analysis/` +
  `scripts/export_app_data.py`, which writes ~18 KB of compact JSON to `app/public/data/`. The
  587k-row dataset never reaches the browser — the app reads pre-computed aggregates and renders them.
- **Shares of songs, not scores.** Each story's two bar charts show, one bar per decade, the share
  of songs passing a plain test ("77% of songs are high-energy"), so the reader never has to
  interpret Spotify's 0–1 feature scale.
- **Hear the data.** Each decade's tracks are picked from its most popular songs as the ones
  nearest that decade's centre in the story's two features, so the songs *sound like the decade*.
- **Charts follow a small design system** (accessible palette, single axis only — the economy coda
  z-scores three series onto one axis rather than using a misleading dual axis).
- **Honest about limits.** Early decades are a lo-fi survivorship sample; the app and docs flag
  this, keep those points in the trend lines, but never anchor a headline number on them. All
  findings are correlational.

## Quick start

Two independent things live here: the **notebooks** (exploration) and the **app**. The app's data
files are committed, so you can run the app without touching Python or Kaggle.

### Run the app (no Python needed)

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle in app/dist/ (this is what GitHub Pages serves)
```

Needs Node 20.19+ or 22.12+ (Vite 8's requirement). Song previews embed from Spotify and need a
network connection.

### Reproduce the analysis & regenerate the data (optional)

```bash
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

bash scripts/download_data.sh          # fetches Kaggle datasets + FRED series, no auth needed
python scripts/export_app_data.py      # regenerates app/public/data/*.json from analysis/common.py

# rebuild + execute the exploration notebooks (they're generated from a script, then executed):
python scripts/build_notebooks.py
jupyter nbconvert --to notebook --execute --inplace notebooks/*.ipynb
```

Python 3.13 (see `.python-version`). Note that re-running the export can pick different songs for
some decades, because ties in `popularity` make the selection order-dependent; see
[design-notes.md](docs/design-notes.md#representative-tracks).

## Repo layout

| Path | What |
|------|------|
| `app/` | The Vite + React app. Charts hand-written in SVG (d3-scale/d3-shape, no chart library). |
| `notebooks/00–05` | Narrated exploration — setup, then one per realm, question → step → plot → takeaway. |
| `analysis/common.py` | Shared loaders + cleaning used by both notebooks and the app export (single source of truth). |
| `scripts/` | `download_data.sh` (data), `build_notebooks.py` (authors the notebooks), `export_app_data.py` (app data). |
| `docs/` | `findings.md` (results), `design-notes.md` (design rationale and data caveats). |
| `data/raw/` | Downloaded datasets — git-ignored; fetch via the script. |

## Data

- **A** — `zaheenhamidani/ultimate-spotify-tracks-db` (~232k, genre + audio features, no year) — genre and popularity realms.
- **B** — `yamaerenay/spotify-dataset-19212020-600k-tracks` (~600k, has `year` + features) — all time realms and the app.
- **US econ/sentiment** — unemployment, inflation, consumer sentiment, fetched no-auth from **FRED**.

All download with **no Kaggle auth** (`GET .../api/v1/datasets/download/<slug>` returns a real zip).
Raw data is git-ignored; `scripts/download_data.sh` fetches everything.

## Next steps

- **Free explore + song search.** Type any song, see where it sits, and hear its acoustic neighbors
  via Spotify (ties back to "are genres real?"). Needs a popularity-stratified searchable subset
  export.
- **Better representative-track picking** — a stable tie-break, diversity guards (distinct artists,
  de-dupe remasters), blending popularity with centrality, and a "most central ↔ most iconic"
  toggle. Sketch in [design-notes.md](docs/design-notes.md#representative-tracks).
- **The same journey, but for genres.** Step through **genres instead of decades**, hear a
  representative track for each, and see how much they overlap in sound: an interactive answer to
  "are genres real?" (realm 1 found ~3 of 4 acoustic neighbors are a *different* genre).
- **Look for *why* music got sadder.** The tonal darkening (minor-key 26% → 45%, valence sag) is
  the most striking finding and is still a hypothesis, not an answer. Candidate correlates beyond
  the economy: news-sentiment indices, major-event timelines, attention series, and generational
  cohort effects — plus **lyrics** (sentiment, themes) and **real listening data** to separate what
  artists *make* from what audiences *choose*. Strictly correlational and
  multiple-comparisons-aware.

Built with Claude Code; the analysis and its conclusions were checked by hand against the data.

## License

Released under the **GNU General Public License v3.0** — a copyleft license: you're free to use,
study, share, and modify this code, provided derivative works are distributed under the same terms.
Full text in [LICENSE](LICENSE). (The Spotify datasets and FRED series retain their own terms.)
