# The Sound of Time — the app

An interactive journey through a century of recorded music (dataset B, 1922–2021), built on the
mood-over-time exploration in [`../notebooks`](../notebooks).

Four stories (Mood, The beat, Two kinds of sad, Why so intense), each opening on a short
explainer and travelled one of two ways:

- **Full journey:** scroll decade by decade; two bar charts update, a caption explains each decade,
  and up to three representative Spotify tracks play alongside. On a phone each decade is one
  full-screen page with its own chart, a sideways carousel of songs and a Next button. The Mood
  story ends on a coda that sets music's mood against the economy and consumer sentiment.
- **Quick version** ("Quick swipe"): one full-screen card per decade with a headline, one line of
  story and one song, and no charts.

On iPhone a song starts from a tap, not a swipe (see the design notes' "Spotify players").

## Quick start

```bash
# the data in public/data/ is committed; to regenerate it, from the repo root:
bash scripts/download_data.sh
python scripts/export_app_data.py        # -> app/public/data/{timeline,tracks,world}.json

# then run the app (needs Node 20.19+ or 22.12+)
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle in app/dist/ (deployable as a static site)
npm run check:scroll -- --url http://localhost:4173   # Playwright layout checks, after `npm run preview`
```

## How it's built

- **Python computes, React reads.** All numbers come from `analysis/common.py` (the same loaders
  the notebooks use); `scripts/export_app_data.py` does every derivation (per-decade shares of
  songs, representative-track selection, the economy join + z-scoring) and writes compact JSON to
  `public/data/` (~18 KB total). The browser never sees the 587k-row dataset.
- **Vite + React (plain JSX)**, charts hand-written in SVG with `d3-scale`/`d3-shape` (no chart
  library), one axis per chart, never dual.
- **Structure:** `src/components/` (`Journey` with its `ShareBars` charts and `TrackEmbed` song
  groups of `Player` embeds, `JourneyIntro`, `QuickFeed`, `DecadeArrows`, `Beat`), `src/charts/`
  (`LineFig` and the `WorldChart` coda), `src/lib.js` (data loading, scroll and player hooks, story
  definitions and captions).

Song previews are embedded from Spotify and need a network connection. Each decade's tracks are
picked from its 100 most popular songs as the ones nearest the decade's centre in the story's two
features.

See the [repo README](../README.md) for the full story and data sources, and
[`../docs/design-notes.md`](../docs/design-notes.md) for the design rationale.
