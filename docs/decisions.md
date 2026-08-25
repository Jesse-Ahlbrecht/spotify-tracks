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

## 2026-08-23 — Scrolling: delete the wheel hijacker, let the browser drive

Jesse reported the app scrolled correctly with a PC mouse but not on a Mac trackpad and not on
mobile. The cause was `useSectionScroll` in `app/src/lib.js` — a hand-rolled wheel handler that
mapped one wheel event to one decade hop:
- It called `preventDefault()` **before** checking whether a glide was already running. A mouse
  emits ~1 discrete event per notch, so this was invisible; a trackpad emits 60-120 events/s plus
  an inertial tail, so ~15-25 momentum events per flick were cancelled and thrown away. One flick
  either felt frozen or skipped several decades.
- Any non-zero `deltaY` was a full hop — no accumulator, no threshold, `deltaMode` ignored. Trackpad
  sub-pixel deltas and sign jitter on near-horizontal swipes made the direction oscillate.
- Touch never fires `wheel`, so mobile got no guidance at all. The comment claiming touch was
  "disabled (native)" described an accident, not a design.
- Its rAF loop wrote `scrollTop` per frame while `html { scroll-behavior: smooth }` was set, so each
  frame restarted a browser smooth-scroll that never finished — and it declared completion on
  elapsed time rather than on arrival, so its "am I animating" flag cleared early. Browser-dependent,
  which is exactly the "works on Windows, not on the Mac" symptom.

**Decision: input is never intercepted; the page settles onto a decade only after scrolling stops.**
Wheel hijacking is input-device-dependent by construction — there is no reliable way to tell a
deliberate trackpad gesture from its own momentum tail — so the `preventDefault` path is gone for
good. `useSettleToStep` replaces it: every listener is `passive`, nothing calls `preventDefault`, and
it wakes only after scrolling has gone quiet (100ms, or 40ms once the page is already crawling and
the momentum is spent), then glides to a decade. Any fresh
input cancels a glide in flight. The gesture itself is therefore never touched, which is the property
the old code violated. The tab-switcher's custom easing became `scrollIntoView({ block: 'center' })`,
with `behavior` deliberately omitted so it defers to CSS and the reduced-motion query handles it free.

Getting there took three measured dead ends, all of which *looked* correct in review:

**1. CSS `scroll-snap` — abandoned.** The plan was `scroll-snap-type: y proximity` (the four
`scroll-snap-align` declarations had sat in the stylesheet all along, inert, because nothing ever set
`scroll-snap-type`). With 60vh snap areas Chromium re-snaps after *every* discrete wheel event, so
input gets dragged back to the step it started on. Measured: a 30×14px trackpad flick travelled
**0px**; five 100px mouse notches travelled **0px**. Same stickiness as the JS hijacker, relocated
into CSS. Lesson: "let CSS do it" is not automatically safer than JS — it needed the same
verification, and would have shipped without it.

**2. Settling to the *nearest* decade — a trap.** The obvious rule pins the reader. One mouse notch
is ~100px against a ~589px decade spacing, so "nearest" is always the decade you just left. Measured
before the fix: six 100px notches 250ms apart (i.e. slower than the idle timer) netted **0px** — the
page bounced 2821 → 2845 → 2821 forever. The fix is to settle only in the *direction of travel* and
never back past where the gesture began. After it: 250ms notches advance two decades, 500ms notches
advance one decade *per notch* — the original mouse feel the hijacker was written to produce, now
without touching the input.

**3. The "ignore a small nudge" rule has to key off position, not distance.** First written as a
`MIN_TRAVEL` floor on how far the gesture moved, which strands the reader: interrupting a glide
(scrolling again while it runs) cancels it by design, but leaves the page between decades having
travelled almost nothing, and a distance test then refuses to finish the job. Caught only because one
profiling run in six ended 400px from where it should have. It now asks whether the reader is
*parked* on a decade — if they are, a small gesture leaves them alone; if they are stranded, it
always finishes.

**Smoothing (Jesse: "a pause and then a jump up").** Two separate causes. The jump was
`scrollTo({ behavior: 'smooth' })`, whose curve starts at full speed and so lurches off a standstill;
it is now a rAF glide with quadratic ease-in-out, 200–520ms scaled by distance, writing
`behavior: 'instant'` per frame so the global `scroll-behavior: smooth` cannot re-animate underneath
it. Cubic easing was tried first and felt *worse* — its ease-in is so slow that the opening frames
move sub-pixel, which reads as more dead time, not less. The pause was the idle timer: now 100ms
normally but 40ms once scrolling is already crawling (momentum spent), so the common case does not
wait out a delay sized for a fast flick. Measured end-to-end: ~150ms from input stopping to the glide
starting. Frame-level smoothness is *not* verified — headless frame pacing is unreliable and gave
contradictory readings; only the timings and end positions above are measured.

**Captions are centred on the plane, not the viewport.** The sticky column centres
(plane + gap + players) as one group, so the plane's midline sits above the viewport's by exactly
half of what hangs below it — the caption looked ~165px too low. `useHeight()` measures the player
stack and publishes it as `--embed-h`, which `.step-inner` turns into a `translateY`. Measured rather
than hardcoded because the stack's height changes with the embed markup and the track count (and is
different again on mobile, where only one player shows). Shifting the inner content rather than the
`.step` box keeps every box the same height, so the active-step band is untouched.

Three mobile blockers fixed alongside:
- `.fig-plot svg { touch-action: none }` (added for the coda chart's tooltip) swallowed every swipe
  starting on the chart — full-width on a phone. Now `pan-y`; the tooltip only reads `clientX`.
- Hero `100vh` → `100dvh`: mobile Safari's `vh` assumes a hidden URL bar, pushing the scroll cue below
  the fold. Steps deliberately stay `vh` — `dvh` there would reflow the page as the bar collapses.
- The `<900px` sticky graphic (plane + three Spotify iframes) could fill an entire phone screen,
  leaving no caption visible. The plane is capped at 28dvh (it is the block's only variable-height
  child) and one player shows instead of three, with `scroll-padding-top: 62dvh` and a matching
  IntersectionObserver band — both derived from the 0.81 reading line — so steps land in the caption
  strip below the plane rather than behind it.

Also fixed while measuring: the mobile topbar wrapped to two lines (~90px) while the sticky plane
pinned at `top: 68px`, clipping the plane's top edge — the topbar is now compact on mobile and the
offset matches. The mobile hero was trimmed (type, padding) from ~900px to ~740px; the scroll cue
still falls just below a 700px fold, because the lede runs four sentences. Shortening that is a copy
call, not a layout one, so it is left alone and asserted as "headline + tabs above the fold".

**Verification: `app/scripts/check-scroll.mjs` (`npm run check:scroll`).** 38 Playwright checks over
desktop 1512×982 and mobile 390×700, driving real wheel events and real touch drags so the browser's
own scroll pipeline is what's exercised. Every dead end above is now a named regression guard: the
gesture is not fought while it runs, slow notches advance instead of pinning, `preventDefault` is
never called on a scroll gesture, there is no dead end at the last decade, nothing settles in the
coda/footer, reduced motion disables settling, the caption midline equals the plane midline, and a
swipe starting on the coda chart still scrolls. Both dead ends were found by measurement and neither
was visible by reading the code — that is the argument for keeping this script.

Timing-sensitive by nature; five consecutive clean runs, with one transient failure observed once and
not reproduced. Playwright is a devDependency only — the shipped bundle is still react + d3. (The
2026-07-14 entry removed Playwright after a one-off screenshot pass; it is back deliberately.)

**AI disclosure:** diagnosis, the replacement, and the check script are Claude-generated, reviewed by
Jesse. The mobile sizing constants were tuned against emulated 390×700 Chromium, not a real handset.

## 2026-08-23 — Each journey opens on an explainer screen

Jesse: each journey should start with a screen explaining, at a high level, how music changed and
what the plotted variables mean, ending on "do you want to dive in?".

Before this, the tab switcher dropped you straight onto a scatter plane with two unfamiliar axes.
The only framing was one line under the toggle listing the two metrics' glosses — easy to scroll
past, and it said nothing about the arc you were about to travel.

**Shape: a full-width section between the hero and the plane**, not a step inside the scroll
column. A step-0 intro would have meant re-indexing `useActiveStep`, the settle targets and the
mobile reading band — all of which the 2026-08-23 scroll rework had just finished tuning — and it
would have squeezed the copy into the narrow caption column. As a standalone section it sits above
the first `.step`, which is outside `useSettleToStep`'s `EDGE` range, so it scrolls freely with no
settle opt-out needed.

Each journey gained an `intro: { title, hook }` in `JOURNEYS`; the axis cards are derived from
`VAR_INFO` via the journey's `x`/`y`, so a new journey needs no new component code. `splitAxis()`
moved from `MoodSpace.jsx` into `lib.js` and is now shared by the plane and the cards. The hero's
duplicate metric line and its CSS went with it. Picking a tab now lands that story's intro rather
than its first decade; the intro's button makes the second hop.

**Dropped the dot-size encoding.** Each journey used to map a third metric (`minor_share`, or
`sad_banger` on the sad journey) to the spotlight's radius. Writing the explainer made the cost
visible: it needed a third card to explain a channel nobody asked about, and a plane that claims to
be about two things reads better when it is about two things. `sizeKey`, the d3 size scale and the
`sad_banger` metric entry are gone; the marker is a constant radius. `sad_banger` was left computed
and exported for a while afterwards; the cleanup pass below removed it from
`scripts/export_app_data.py` and regenerated `timeline.json`, so the export no longer carries a
column nothing reads. (Every other value in the regenerated file is byte-identical, and
`tracks.json` is unchanged — the sad journey's *track picking* uses `valence`/`minor`, not
`sad_banger`.)

**No raw feature values in the copy.** The first draft quoted the actual dial readings ("energy
climbs from 0.28 to 0.63"). Jesse cut them: they are on Spotify's arbitrary 0–1 scale and mean
nothing to a reader who has not yet seen the plane, which prints the numbers anyway two screens
down. The hooks now carry shape and direction only — except proportions of songs ("one song in four
to nearly one in two"), which are plain enough to keep.

**Verification:** `npm run check:scroll` is now 27 checks, 27 passing. The existing "tab switch
scrolls the first decade into view" guard was rewritten rather than deleted — the behaviour it
described changed on purpose, so it now asserts the tab lands the *intro* clear of the topbar, and a
new check asserts "Dive in" then lands the first decade, preserving the original intent one hop
later. Both run on mobile too, which previously had no tab-switch coverage; that caught two real
bugs measurement found and reading would not have:
- The reveal animated `transform: translateY(24px)`. A translated element is scrolled into view at
  its *translated* position, so the fade-in then yanked the section 24px out from under the reader.
  The intro is a scroll target, so it fades only — `.beat` keeps its slide.
- `justify-content: center` on a screen-tall block put the first line behind the sticky topbar on a
  390×700 phone, and the content ran 724px against a 700px viewport, pushing the button off-screen.
  Mobile is now top-aligned below the topbar with trimmed type; the button lands with ~40px to
  spare. Removing the third card bought most of that room back.

**Correction: the hooks flattened valence.** Three of the four shipped hooks described how positive
music sounds as essentially static — "slipped only slightly, and mostly in the last twenty years"
(mood) and "barely moves until the 2000s" (sad). Checking the decade means says otherwise: valence
runs 0.600 (1920s) → 0.495 (1950s, its century low) → 0.580 (the 1970s–80s plateau) → 0.503 today.
Down, up, then down again. The *net* change is small, and the copy had quietly sold that flat net as
the story, hiding a mid-century trough larger than the modern slide. The mood hook now names the
arc, and the sad hook makes the sharper true claim: minor-key share has a direction (it rises nearly
every decade), valence has none — only one kind of sad is actually a trend. The beat hook's "energy
rises without pause" was wrong on its own terms too; energy hits its century *floor* in the 1940s
and rolls over in the 2020s, which the journey's own 2020 caption ("energy finally levels off")
already said. Same pass fixed `SAD_CAPTIONS[2010]`, which called a 39.6% minor share "a third".
The per-decade captions needed no changes — they had tracked the real curve all along.

**AI disclosure:** the component, styles, intro copy and the two new checks are Claude-generated,
reviewed by Jesse. Mobile sizing was tuned against emulated 390×700 Chromium, not a real handset.
The valence correction above was also Claude-generated, prompted by Jesse catching the flattening.

### Follow-up: `scroll-padding-top` deleted; the reading line has one owner again

A cleanup pass over the above. The intro initially shipped with
`.journey-intro { scroll-margin-top: -62dvh }` — a *negative* scroll-margin whose only job was to
cancel `html { scroll-padding-top: 62dvh }`. That padding is document-wide but served exactly one
call site (landing a decade on the 0.81 reading line via `scrollIntoView({block:'center'})`), so
adding a second scroll target meant the new target had to pay, and the rule became "anything
scrolled to on mobile that isn't a decade must remember to cancel 62dvh". The `0.81` had also
spread to four places.

Both CSS rules are gone. `lib.js` now exports `scrollToReadingLine(sel)`, built from the same
`readingLine()` that `useSettleToStep` and the observer band already share — it computes the target
position instead of asking the browser to centre and then correcting for it. `62dvh` no longer
exists in CSS, `0.81` lives in one place (plus a deliberate independent copy in the check script),
and plain `scrollIntoView` works again for every other target.

Two more from the same pass:
- **The settle's top boundary was derived, and wrong on mobile.** `useSettleToStep` bounded itself
  with `y < T[0] - EDGE`, but `T[0]` is a *reading-line position*, which sits up to a viewport away
  from the block it belongs to. On mobile (line 0.81, no column padding) that put the boundary ~69px
  inside the explainer, so the settle armed while the reader was still on it — while three comments
  and this log claimed it could not. It now bounds off the step column's own box. The bottom edge
  deliberately stays `T[n]`: the column's trailing padding runs a viewport past the last decade, and
  arming that far down would snap the coda back.
- **`min-height: 100dvh` → `100svh` on the intro.** `dvh` re-resolves as the mobile URL bar
  collapses; on a mid-page section that reflows all 11 steps below it mid-scroll — the exact hazard
  `.hero`'s own comment rules out. `.hero` keeps `dvh` (above the fold, nothing below it to shift).

Also deduped: `.dial` was a fourth copy of the card recipe and `.dial-role` a third copy of
`.kicker`; the recipe is now one grouped selector over `.moodspace, .embed, .fig-plot, .dial`, and
the dials just use `.kicker`. CSS bundle 9.57 → 9.03 kB. `.journey-graphic`'s hardcoded `top: 52px`
now reads `var(--topbar)`, so the new token unifies rather than adding a third encoding of the bar's
height.

### Follow-up: the scroll cue was under the fold all along

Jesse, on the new landing page: "it is now not clear that I need to scroll down." Measuring found a
pre-existing bug the explainer had merely made obvious. `.hero` is `min-height: 100dvh`, but the
hero starts *below* the 72px sticky topbar — so it was always exactly one topbar taller than the
screen, and `.scroll-cue`, parked at its bottom edge by `margin-top: auto`, hung ~28px under the
fold at every viewport size. Removing the hero's metric line widened the gap above the cue and made
the missing affordance impossible to ignore.

Fixed with a `--topbar` token (72px, 52px on mobile) and `min-height: calc(100dvh - var(--topbar))`
on both the hero and the new intro screen; the cue also went from `--muted` at 0.85rem to `--ink-2`
at 0.95rem, since it is the only thing telling you the page continues. Two checks cover it now: a
new desktop "scroll cue is above the fold", and the mobile hero check — which previously *reported*
the cue as below the fold and "copy-length bound" — upgraded to assert it. The token also replaced
the hardcoded 60px top padding on the mobile intro.

### Follow-up: the cue is a button, and the intro drops its question

Two trims from Jesse. The hero's scroll cue became a real `<button>` carrying `.explore-btn` (the
same pill as "Dive in"), scrolling to the selected story's intro — the same hop the tab switcher
makes, now shared as `toIntro()`. And the intro's "Ready to dive in?" line went: the button already
asks, and a prose question above a button labelled "Dive in ↓" is the same sentence twice.

Making the cue a button surfaced a small a11y problem the decorative version hid: the `bob`
animation was on the element itself, so as a click target it moved under the pointer forever —
Playwright refused to click it ("element is not stable") and anyone aiming at it would have had the
same fight. The animation now lives on an inner `.cue-arrow` span, so the pill is stationary and the
arrow still bobs.

## 2026-08-23 — Decade arrows: a way through the century that isn't scrolling

Jesse: "the scrolling does not always work well — can we add arrows to scroll through the decades?"
Fair. Even with the hijacker gone, wheel and trackpad behaviour varies by device, and until now
scrolling was the *only* way to advance a decade. There was no click affordance anywhere in the
journey.

What shipped is `DecadeArrows.jsx`: two chevrons fixed to the right margin, vertically centred,
stepping one **section** per press. Not just decades — the page flattens into one ladder (landing
screen → explainer → a rung per decade), so holding ↑ walks all the way back out to the top instead
of dead-ending on the 1920s. The arrows show over the explainer and the journey, and stand down on
the landing screen (its own cue takes over) and past the end of the journey (where "jump to top"
does). Which rung you are on comes from `useSectionAtLine('.hero, .journey-intro, .journey')`, and
inside the journey from `useActiveStep` as before.

**It took four passes to get there, and every one of them removed something.** The first attempt was
a full decade rail — a pill-shaped card of eleven tick marks with the active year labelled, on the
theory that a rail doubles as a position indicator in a way bare arrows cannot. Jesse stripped the
card, then the pill around the year, then reduced it to a line with a single dot that unfolded the
whole century on hover, then cut the timeline entirely. The reasoning that survives: this control
sits on screen for the entire journey, and the plane already shows you where in the century you are.
A second position indicator in the margin was answering a question nothing was asking, and each
version of it cost real caption width — the rail's gutter peaked at **152px** of `padding-right`
below 1430px, against **74px** below 1280px for the arrows alone. The chevrons are drawn as SVG
rather than typed as ↑/↓ because the glyphs carry a font's own weight and terminals and never quite
match at 34px.

Worth recording as a process note, not just a design one: the rail was *fully built and green on 42
checks* before it was cut. Nothing was wrong with it. It was simply more than the question needed,
and the only way that became obvious was seeing it on screen.

**It never owns the current decade.** The arrows scroll and let `useActiveStep`'s
IntersectionObserver follow, exactly as a wheel gesture would. There is no second source of truth,
so the control, the plane and the captions cannot drift apart. `active` is read only to pick the
target and to decide when an arrow is disabled.

**Reuse, not reinvention.** A press is `scrollToReadingLine('.step', i)` — the same function "Dive
in" uses, which already knows the reading line is 0.5 desktop / 0.81 mobile and already omits
`behavior` so the reduced-motion override wins. It gained one optional index argument. Nothing new
knows how to scroll.

**The race that was real, and the one that wasn't.** A press arms `useSettleToStep`'s idle timer
like any other scroll, but that turns out to be harmless: the settle recomputes its target from the
same `readingLineY()` the press used, so `glide()` returns early on a <2px distance. Measured —
5427 → 5427. The genuine bug was the other direction: for up to ~620ms after any gesture ends a
settle glide may be in flight, and its rAF loop rewrites the scroll position every frame from a
`start` captured *before* the press. Left alone it silently swallowed the step — the worst failure
shape for a control whose users are already fighting the scroll. Fixed by having the settler listen
for a `SETTLE_CANCEL` event beside the `wheel` and `touchstart` listeners it already has, dispatched
by `scrollToReadingLine` — the invariant is "a deliberate jump outranks a settle in progress", so it
belongs on the jump, not on the arrows. The handler abandons the whole cycle (`clearTimeout(timer);
stop(); from = null`), not just the rAF: a jump teleports the page, so a timer still armed from
before it would wake up and reason about a `from`/`y` pair straddling the teleport. Rejected:
binding the existing `stop()` to `pointerdown`, which would freeze a glide on any click (a Spotify
play button included) and miss keyboard activation entirely.

**`aria-disabled`, not `disabled` — and this one is load-bearing.** A press starts a smooth scroll;
the rung changes as the page travels; setting the real `disabled` attribute on the button the reader
just clicked **cancels that scroll dead**. Measured: the climb from the explainer to the landing
screen stopped at 371px instead of 0, every time, at exactly the moment the hero entered the reading
band and the up arrow went inert. It took four probes to pin down, because setting `disabled` on a
*programmatically* focused button does not do this — only on one the user actually clicked. So the
ends are marked with `aria-disabled` and the handler no-ops, which says the same thing to assistive
tech without taking focus away mid-jump.

**Geometry.** The page's right gutter is `24 + max(0, (W − 1180) / 2)`; the arrows reach
`--arrow-size + --arrow-inset` in and want a little slack past that. At 1512px there is 190px, so
nothing fires — which is exactly why the check also runs at 1200px, where the `901–1280px` rule has
to earn its keep. Both gutters are `calc()`d from those two custom properties rather than
hand-evaluated, so resizing a chevron cannot leave a stale number in a different section; mobile
overrides the properties and the gutters follow. Measured 6px of clearance at 390px.

14 new checks (41 total, all green), including both races as named assertions and a re-read of the
`preventDefault` counter *after* all arrow interaction — the original probe ran before the control
existed. Flagged and not built: `.to-top` has the same latent "invisible but still tabbable" issue
the arrows' `visibility` toggle fixes; and a ≥100ms main-thread stall mid-step could still let the
settler land an intermediate decade (recoverable by pressing again, so no guard was pre-built).

Two test flakes fixed rather than tolerated. `no console/page errors (desktop)` failed about one run
in three on a CORS error from Spotify's *own* Sentry reporting inside the embed iframe; the console
listener now filters by origin, so our bundle's errors still land and the iframe's do not. And "an
arrow click outranks a settle glide" originally asserted a specific decade, which is not
well-defined — `active` can advance between the gesture and the press. It now asserts the sign of
travel (the glide was heading forward; if the press wins the page must end up behind where it was
pressed, and on a decade), which is what the check actually means. Verified load-bearing by removing
the `SETTLE_CANCEL` listener: the page ends at 3659 instead of 3070.

A `/simplify` pass then folded the feature's one-off `useOnScreen` hook back into `useInView` as a
`once: false` option (the two differed by one branch), moved the arrows onto the ref `useInView`
already returns instead of reaching up at their own ancestor with `document.querySelector`, reverted
`scrollToReadingLine` to its original one-argument form (the caller addresses a step with
`.step[data-step="i"]`, the same index channel `useActiveStep` reads back, rather than widening a
shared primitive for one call site), and dropped a clamp that the end guards already made
unreachable.

Then the deferred items from that pass were cleared too:
- **`toTop` / `toIntro` had the same swallowed-jump bug** the arrows had just fixed. Both now live in
  `lib.js` beside `scrollToReadingLine` and cancel a settle first, so the rule is a property of
  jumping rather than something each caller remembers. The page arrows reuse them for the top two
  rungs, which is what made the ladder cheap to build.
- **`.to-top` toggles `visibility`** as well as opacity — it was invisible but still a tab stop.
- **`settle()` in the check script waits for a condition instead of sleeping a guess.** It polls per
  frame for the scroll to hold still, with the stillness window (180ms) deliberately longer than
  `useSettleToStep`'s 100ms `IDLE` — shorter and it would return in the gap *before* the settle
  glide starts, and every measurement downstream would be taken at the wrong moment. A 260ms lead-in
  comes first for the same class of reason: a click-triggered smooth scroll takes a frame or two to
  begin, so polling immediately sees "not moving" and returns before it ever moved. Both traps were
  found by breaking the suite, not by reasoning. Result: 47 waits, 27.4s, **zero cap hits** — down
  from ~39s of blind sleeping, and no per-call magic numbers left to drift. The `goToStep` + `settle`
  pair that opened eleven checks is now `park()`.

**AI disclosure:** the control, the CSS, the settle-cancel fix and the new checks are
Claude-generated from Jesse's brief and successive design cuts, reviewed by Jesse. The `activeDecade`
test helper shipped broken first (`Number("1920s")` → NaN) and was caught by six red checks, not by
reading.

## 2026-08-23 — Mobile: a deck, not the desktop layout squeezed

**Jesse, on a real handset: "the button at the beginning does not work, the layout does not work in
general. At the top it should show the decade and then below that show the songs, swiping to the
right should allow me to play the other songs as well."**

The `<900px` branch had been the two-column scrolly stacked: sticky plane across the top, captions
scrolling under it. Measured on a 390×700 phone, that block took **56% of the screen** and the
caption it was meant to leave room for started at 647px of 700 — off the bottom. The plane's own
text rendered at **7.4px**, because the svg sizes by viewBox alone and its CSS font sizes are user
units, so shrinking a 560-wide plane into a phone column shrinks the type with it. And nine Spotify
iframes were mounted to show one player.

**Decision: mobile renders a different tree, not the same one reflowed.** One decade per screen,
under a pinned compact plane — vertical swipe for time, horizontal for that decade's songs. This is
the shape Jesse asked for, and it is the shape that fits: the three things a decade needs (its name,
its caption, its music) do not co-exist on a 700px screen any other way.

- **The plane got a second geometry rather than a scale factor.** `MoodSpace` and `LineFig` each
  carry a `{ wide, compact }` dimension table, with compact picked so one user unit is about one CSS
  px at phone width. Ticks now render at **13.4px / 12.9px** (plane) and **11.3px** (coda). The
  margins and tick counts come down; the type does not. Compact also drops the plane's
  "← sadder / happier →" descriptors (they collide first, and the axis name still says what it is)
  and the coda's SVG direct labels, which reclaims the 120-unit right margin they existed for — the
  HTML legend above already names every series.
- **All three songs, reachable.** The old rule was `iframe:not(:first-child) { display: none }` —
  two thirds of each decade's music simply unreachable. Now a horizontally snapping track with
  dots. Deliberately **no `touch-action` on the carousel**: the browser's own direction locking
  picks pan-x, and pinning it would kill vertical scrolling over most of the screen — the same
  mistake `.fig-plot` made with `none`.
- **Nine iframes → three.** The ±1 decade window exists for the desktop cross-fade; the deck shows
  one page at a time and has nothing to cross-fade, so only the settled decade mounts.
- **`scroll-snap` is back, and this is not a contradiction of the 2026-08-23 entry above.** That
  failure was 60vh proximity regions fought by *desktop wheel* events, which re-snapped after every
  discrete notch. Full-screen pages driven by touch are the case snap is built for. `proximity`, not
  `mandatory`, because the coda and footer are not page-sized and mandatory would refuse to rest
  inside them. `useSettleToStep` is switched off on mobile — two things steering one scroll is what
  the whole scroll rework was about.
- **The 0.81 reading line is gone.** It existed to push captions below the sticky plane. A deck page
  is exactly one viewport tall, so centring it *is* aligning its top: `readingLine` is now a
  constant 0.5, serving both layouts, and the constant that used to be triplicated across `lib.js`,
  CSS and the check script is down to one place that no longer varies.
- **The decade arrows are desktop-only.** A swipe is the deck's pager, and their fixed right gutter
  cost ~54px of a 375px screen. This retires a feature from the device it was arguably most for; the
  argument is that the gesture it substitutes for is the one that now works.
- **Landscape got a real layout, not a smaller one.** At 844×390 every story tab sat at `top: 392px`
  — the entire hero below the fold, `elementFromPoint` returning null for all four. Landscape's
  scarce axis is height and its spare one is width, so the plane moves *beside* the pages and the
  explainer goes three-across. Guarded by a `max-height: 460px` query, not a width one.

**The button bug: not reproduced, and probably already fixed.** Simulating URL-bar collapse (growing
the viewport mid-scroll) at 390 and 375 did not break the tab or "Dive in" jumps. The likeliest
culprit is the swallowed-jump bug fixed in `03fb3ec` earlier the same day: for ~620ms after any
gesture a settle glide rewrites scroll position every frame from a `start` captured before the
click. On a phone *every tap follows a touch gesture*, so it would fire almost every time and almost
never under a desktop mouse. `SETTLE_CANCEL` fixes it. Recorded as unconfirmed rather than closed —
the honest state is that the mechanism fits and the symptom is gone in emulation.

**Verification: 79/79 checks**, the mobile block now parameterised over **390×700, 375×667 and
844×390** instead of one viewport. New guards are aimed squarely at what shipped broken: rendered
SVG text ≥9 CSS px on both charts, decade + caption + songs on screen together, all three songs
present and reachable by a real sideways touch drag without the page moving, ≤3 iframes, 44px tap
targets, no horizontal overflow, and a jump surviving a viewport resize mid-scroll. The desktop
checks are untouched and still green.

Also fixed alongside: hover styling moved behind `@media (hover: hover)` (on touch it latched after
a tap and read as stuck state), the first `:focus-visible` rules in the stylesheet, `.to-top` up to a
44px target with `env(safe-area-inset-bottom)`, `viewport-fit=cover` so that env() resolves, and
`pointercancel`/`pointerup` clearing the coda tooltip — on touch `pan-y` claims any vertical drag and
fires `pointercancel`, never `pointerleave`, so it used to stay up indefinitely.

**Still unverified:** a real handset. Emulation is what passed while Jesse's phone failed, so the
same caveat as last time applies with more force — the checks are necessary, not sufficient.

**AI disclosure:** the deck, the compact chart geometries, the carousel, the landscape layout and the
extended checks are Claude-generated from Jesse's brief and the three design cuts he chose (plane
pinned above the decade; deck over arrows; desktop untouched), reviewed by Jesse. The diagnosis that
the old layout's caption fell off the bottom, and that the chart text rendered at 7px, came from
measurement before any code changed — neither was visible by reading the CSS.

### Follow-ups from Jesse's first pass on the deck

Five things caught by looking at it, four of which the checks had missed:

- **Story tabs: a column, not a wrapped grid.** Four tabs at `flex: 1 1 40%` wrapped into two ragged
  rows of unequal pills, and the selected one read as a stray rather than one of a set. Stacked, every
  choice is the same shape and full width. It costs ~100px of a hero that had 14px of slack, paid for
  by the lede's last sentence (`Pick a story below…` — redundant with four labelled buttons directly
  beneath it, so hidden on mobile via `.lede-tail`, not deleted) plus a tighter type scale. The
  toggle needs an explicit `width: 100%`: the hero is a flex column and `margin: … auto` centres a
  flex item at content width, which as a column is just the longest label. Landscape stays one row.
- **The decade heading was clipped behind the plane.** `useSizeVar` published `contentRect.height`,
  so `--plane-h` missed the plane's own 18px of padding and its border, and the page padded itself
  19px short. Now border-box. **The check had passed** because it asked whether the heading was below
  `y = 0` — true, and invisible, since the plane paints over it. It now measures against the plane's
  bottom edge, or the topbar's where the two sit side by side.
- **Empty pages.** Only the settled decade mounts players, so every other page collapsed to a caption
  and left ~220px blank inside a full-height page. Two fixes: an `.embed-slot` that reserves their
  height whether or not they are mounted, so a page is the same shape before and after they load,
  and mounting keyed off `active` rather than the debounced `settled` — a page is on screen the
  moment it is active, and waiting 140ms showed it empty. Content is also centred in the band below
  the plane rather than top-aligned, which was pooling the whole difference into one slab at the
  bottom. Trailing space on the settled page: 220px → 50px.
- **Spotify embeds now use `?theme=0`.** The default samples a background from the album art, so
  three players in a row were three unrelated colours fighting the page and each other.
- **"swipe for all 3" is gone.** The dots say there are three and which one you are on; a hint that
  restates the control is noise.

The first three are the interesting ones: all three were visible in a glance at the screen and none
were visible to a passing check. The heading clip in particular is the sharpest reminder here — a
green check asserting the wrong predicate is worse than no check, because it buys false confidence.

Three more from the same pass:

- **The decade label was clipped to "192".** It parks beside the spotlighted dot, and the outermost
  `<svg>` clips by default, so at the decade whose dot is furthest right it ran off the edge. It now
  flips to the dot's left when it would not fit. This affected the wide geometry too — desktop was
  within 14px of the same bug — so the guard runs at all four viewports.
- **The players lost their card.** `.embed` takes the app's shared raised-surface treatment, which on
  a deck page wrapped a white card around Spotify's own dark rounded card — and on an otherwise
  plain-text page that outer box was the only frame on screen. Stripped on mobile only.
- **"Sounds like the 1920s" is gone from the carousel**, for the same reason as the swipe hint: the
  decade heading sits directly above it, so it named the decade twice.

**Verification: 86/86**, six of seven consecutive runs fully clean. The one failure was
`an arrow click outranks a settle glide in flight` — a desktop check this work does not touch, and
the same transient the 2026-08-23 entry above already records as observed once and not reproduced.
Recording it again rather than quietly re-running until green: it is a real flake in a real check,
and the honest rate is ~1 in 7, not zero.

### Second round of follow-ups — the ones the viewports hid

Everything below came from Jesse looking at real device sizes. The pattern is worth naming: each
bug was invisible because the harness sampled the wrong part of the range, not because the check
logic was wrong.

- **Landscape phones were getting the desktop layout.** `MOBILE` was width-only, and a phone in
  landscape is 932×430 — *wider* than 900, so it fell through to the two-column desktop tree in a
  430px-tall window: plane clipped top and bottom, players entirely below the fold. The breakpoint
  is now `(max-width: 900px), (max-height: 500px) and (max-width: 1200px)` in both `lib.js` and
  `index.css`, with the height arm bounded by width so a short-but-wide desktop window is unaffected.
  The landscape case had been "tested" at 844×390 — which is under 900 wide, so it never exercised
  this at all.
- **A deck page was mostly empty on a tall phone.** Content is a fixed height while a page is one
  viewport tall, so the leftover grew with the screen: 18% of an SE, **40% of a Pro Max**. The plane
  is the only thing that can absorb it, but its height is bound by viewBox aspect against available
  *width*, so it never grows. Fixed with a second compact geometry (`compactTall`, 320×290 against
  320×210) used on tall portrait screens and in landscape, where the plane gets a full-height column
  of its own. Now 18–24% portrait and 11–13% landscape. The two viewports originally checked, 667
  and 700, were the two shortest cases in the range.
- **Snap: proximity → mandatory.** Proximity let a scroll rest anywhere, and anywhere on a deck page
  means the caption half-swallowed by the sticky plane — a page only clears the plane at its snapped
  position. Mandatory requires that *every* full-screen block be a snap point: the first attempt
  gave them only to `.deck-page`, and the hero, having none, was snapped off-screen the instant you
  touched the page, taking the story tabs with it. The coda and footer are snap points too and are
  taller than a phone screen, which the spec lets scroll freely once entered. Guarded by a new
  "can scroll past the last decade to the footer" check — mandatory snap's failure mode is exactly
  the dead end the original scroll rework exists to prevent.
- **`scroll-snap-stop: always`.** A hard flick sailed past decades — measured, one swipe went
  1950s → 1970s. Now a swipe is worth exactly one decade however hard it is thrown.
- **The embed blanked mid-scroll** — Jesse spotted it, and it was a direct cost of the previous
  round's "9 iframes → 3". Mounting only the current decade means its players load *as you arrive*,
  and you watch the rectangle fill. Reverted to the ±1 window desktop uses, for the reason already
  in the log: a neighbour costs nothing to keep mounted and is already there when you reach it. The
  check now asserts ≤9 as a ceiling rather than ≤3 as a goal.
- **The landscape hero stopped short.** A `min-height: 0` left over from when its content ran 445px;
  after the type trims it is ~330px, so the override only made the hero end early and bleed the
  explainer into the same screen. New check: the hero and explainer each fill a screen.

Two harness bugs fixed alongside, both of which had been quietly passing: the dead-space measure
counted only the text column, which called a full landscape page 36% empty when the plane column
beside it was full; and the carousel checks used unscoped selectors, so once the ±1 window mounted
three carousels they read the *previous* decade's dots and saw them not move.

**Verification: 139/139**, five viewports — 375×667, 390×844, 430×932, 844×390, 932×430 — chosen to
span the range rather than cluster at one end, which is the mistake that made this round necessary.

### Spacing pass, from Jesse looking at real device sizes

- **Snap was parking every screen behind the topbar.** `scroll-snap-align: start` aligns to the top
  of the *scrollport*, which is under the sticky bar — so on load the page scrolled 52px, the hero's
  first line hid behind the topbar, and every full-height block (sized `100svh − topbar`) ended a
  topbar short of the bottom, stranding the scroll cue ~60px above the fold. `scroll-padding-top:
  var(--topbar)` fixes all of it in one line, and lets the blocks below stop padding for the bar
  themselves: `.deck-page` is now `100svh − topbar` tall and pads only for the plane.
- **Landscape** got real breathing room now that the hero fills the screen: space above the title
  8px → 30px, the gaps between title, lede and tabs 11px → 24/29px, and the cue 61px → 13px off the
  bottom. The sticky plane is stretched to the visible band and centres the plot inside it — left
  to size itself it hugged the top (8px above, 70px below), which also made the text column beside
  it, which *is* centred, read as sitting low.
- **Tall portrait screens** pooled all their slack in one place: `.scroll-cue`'s `margin-top: auto`
  claimed every pixel of free space, so the hero bunched against the topbar above a single 298px
  void. `justify-content: space-evenly` spreads it. On a decade page the same slack went above the
  plane rather than between the decade, its caption and its player — those are one thought and
  stay a group; Jesse's call, and the right one.
- **Jump-to-top is desktop-only**, joining the decade arrows. Fixed chrome costs more on a small
  screen than it returns, and on the deck it floated over the songs half of every page.

Two more harness bugs found while doing it, both previously green: the "fills a screen" check and
the dead-space check both measured `.deck-plane`, whose container is stretched to the full band by
design in landscape — so the emptiness check passed trivially. It measures `.moodspace` now.

**Verification: 139/139**, five viewports, two consecutive clean runs.
