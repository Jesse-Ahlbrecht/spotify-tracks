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
