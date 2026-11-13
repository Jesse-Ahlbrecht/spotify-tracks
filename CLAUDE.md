# CLAUDE.md

"The Sound of Time": a proof-of-concept data story on how recorded music changed over a century
(Spotify audio features), explored in notebooks and told in one interactive React app.
Results: [docs/findings.md](docs/findings.md). Design rationale: [docs/design-notes.md](docs/design-notes.md).

## Shape
Notebooks explore 5 realms: (1) are genres real? (2) music as fashion/recurrence (3) mood vs the decade
(4) is music converging? (5) islands of popularity (do hits cluster acoustically?).
The app is built on realm 3. Four stories, each travelled two ways: the full journey (charts, a caption
and up to three songs per decade) or the quick version (one card and one song per decade, no charts).
Not built yet: search a favourite song → hear its acoustic neighbors via Spotify links
(`open.spotify.com/track/<track_id>`; track_id is a Spotify ID).

## Data — all download with NO Kaggle auth (`GET .../api/v1/datasets/download/<slug>` → zip)
- A `zaheenhamidani/ultimate-spotify-tracks-db` — ~232k, genre + audio features, **no year**. (Realms 1, 5)
- B `yamaerenay/spotify-dataset-19212020-600k-tracks` — ~600k, **has `year`** + features. (Realms 2–4, the app)
- US econ + sentiment (unemployment, inflation, consumer sentiment): fetched no-auth from FRED by `download_data.sh`. (Realm 3)
Raw data is git-ignored; fetch via `scripts/download_data.sh`.

## Architecture
Python does all heavy compute → exports compact artifacts to `app/public/data/` → React reads them.
Keep the browser payload to a few MB (stratified samples, per-year aggregates, precomputed matrices).

## Layout
`notebooks/00–05` narrated exploration (setup + one per realm) · `analysis/common.py` shared loaders/cleaning
· `scripts/` data download + notebook builder + app export · `app/` Vite+React · `data/raw/` (ignored) · `docs/`

## Commands
- Data: `bash scripts/download_data.sh`
- Python: `source .venv/bin/activate` then `jupyter lab`
- Rebuild+run notebooks: `python scripts/build_notebooks.py && jupyter nbconvert --to notebook --execute --inplace notebooks/*.ipynb`
- App data: `python scripts/export_app_data.py` (writes `app/public/data/*.json` from the same loaders)
- App: `cd app && npm install && npm run dev` / `npm run build` (needs Node 20.19+ or 22.12+)
- Scroll/layout checks: `cd app && npm run preview` then `npm run check:scroll -- --url http://localhost:4173`
  (Playwright, desktop + mobile-touch; add `--shots` for screenshots, `--headed` to watch)

## Notebooks
Authored via `scripts/build_notebooks.py` (nbformat) then executed with nbconvert, so they stay
reproducible. Edit the builder, not the .ipynb by hand. Each imports `analysis/common.py`.

## Conventions
- Terse, high-signal. Don't bloat this file — deep rationale goes in docs/, not here.
- Charts: follow the `dataviz` skill (color system, a11y).
- Be honest about limits (e.g. B has no genre; trends may be drift not cycles). Correlation ≠ causation.
- Phone behaviour must be checked in iOS Safari, not only Chromium emulation: Safari starts a Spotify
  embed only from a tap (see design-notes → Spotify players).

## Working style (Karpathy's laws, condensed; use judgment on trivial tasks)
1. **Think before coding** — state assumptions; if ambiguous, ask, don't guess; surface simpler options and push back when warranted.
2. **Simplicity first** — minimum code for the ask; no speculative features/abstractions/config/error-handling. If 200 lines could be 50, rewrite.
3. **Surgical changes** — touch only what the task needs; match existing style; don't refactor working code; remove only the orphans *your* change created; flag pre-existing dead code, don't delete.
4. **Goal-driven** — turn tasks into verifiable success criteria and loop until met (bug → failing test → make it pass).
