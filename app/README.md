# The Sound of Time — 100 years of mood

An interactive, scroll-driven journey through a century of recorded music's mood
(dataset B, 1922–2021), built on the Realm 3 exploration in [`../notebooks`](../notebooks).

You travel decade by decade through the valence×energy plane while four "dials"
(valence, energy, danceability, minor-key share) update and a **representative
Spotify track** for each decade plays — then four standalone beats unpack *how* and
*why* the sound changed, ending on the honest twist that music's mood tracks neither
the economy nor public sentiment.

## Quick start

```bash
# from the repo root, once: fetch data + export the app artifacts
bash scripts/download_data.sh
python scripts/export_app_data.py        # -> app/public/data/{timeline,tracks,world}.json

# then run the app (needs Node ≥18 — e.g. `nvm install --lts`)
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle in app/dist/ (deployable as a static site)
```

## How it's built

- **Python computes, React reads.** All numbers come from `analysis/common.py` (the
  same loaders the notebooks use); `scripts/export_app_data.py` does every derivation
  (per-decade aggregates, representative-track selection, and the economy join +
  z-scoring) and writes compact JSON to `public/data/` (~9 KB total). The app only
  reads and renders — the browser never sees the 587k-row dataset.
- **Vite + React (plain JSX)**, charts hand-rolled in SVG with `d3-scale`/`d3-shape`
  (no chart library), following the repo's `dataviz` conventions (accessible palette,
  light/dark, one axis — never dual).
- **Structure:** `src/components/` (the sticky journey — `MoodSpace`, `Readouts`,
  `TrackEmbed`), `src/charts/` (`LineFig` + the four beats), `src/lib.js` (data
  loading, the scroll hooks, palette/caption constants).

Phase 1 (this) is the guided journey. Phase 2 (planned): a free-explore mode with a
song search that places any track in mood-space and finds its acoustic neighbors.

Song previews are embedded from Spotify and require a network connection; the
representative track per decade is the most popular track nearest that decade's mood
centre, with a direct link as fallback.
