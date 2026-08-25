// Browser checks for the scrolling rework. Everything here is a behaviour the old JS wheel
// hijacker got wrong, so these are regression tests, not smoke tests.
//
//   node scripts/check-scroll.mjs [--url http://localhost:5173] [--headed] [--shots]
//
// Gestures are driven as real wheel / touch input so the browser's own scroll pipeline is what
// is under test, not synthetic DOM events. Note Input.synthesizeScrollGesture with
// gestureSourceType 'touch' is a no-op in this Chromium build — hence the hand-rolled drag.

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i > -1 ? process.argv[i + 1] : d
}
const APP_URL = arg('--url', 'http://localhost:5173')
const ORIGIN = new URL(APP_URL).origin
const HEADED = process.argv.includes('--headed')
const SHOTS = process.argv.includes('--shots')
const SHOT_DIR = 'test-results'

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const near = (a, b, tol) => Math.abs(a - b) <= tol

// A trackpad is a stream of many small wheel deltas (a mouse is one big one per notch) — that
// difference is precisely what broke, so drive real wheel events rather than synthetic ones.
const trackpad = async (page, dy, steps = 30) => {
  await page.mouse.move(756, 500)
  for (let i = 0; i < steps; i++) await page.mouse.wheel(0, dy)
}

// A finger drag: real touch events through the browser's gesture recognizer. `dy` is travel up the
// page (a scroll-down flick); `dx` is sideways, for the deck's song carousel.
const swipe = async (cdp, { x, y, dy = 0, dx = 0, steps = 20 }) => {
  const pt = (px, py) => [{ x: px, y: py, radiusX: 12, radiusY: 12, force: 1, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x, y) })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pt(x + (dx * i) / steps, y - (dy * i) / steps),
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

const scrollY = (page) => page.evaluate(() => window.scrollY)
// The reading line from src/lib.js — 0.5 everywhere since the deck landed and retired the 0.81
// mobile variant that used to clear the sticky plane.
const LINE = 0.5
// Park a decade on the reading line. Negative index counts from the end. Mirrors
// scrollToReadingLine() in src/lib.js rather than calling it — the whole point of a black-box
// check is that it computes the expected position independently.
const goToStep = (page, i) =>
  page.evaluate(
    ({ i, line }) => {
      const r = [...document.querySelectorAll('.step')].at(i).getBoundingClientRect()
      const top = r.top + window.scrollY + r.height / 2 - window.innerHeight * line
      window.scrollTo({ top, behavior: 'instant' })
    },
    { i, line: LINE },
  )
// Wait until scrolling has actually STOPPED, rather than sleeping a fixed guess. The stillness
// window must exceed useSettleToStep's IDLE (100ms in lib.js), or this would return in the gap
// between the reader stopping and the settle glide starting, and everything downstream would
// measure the wrong moment. `cap` is a ceiling, not the expected wait — hitting it is a legitimate
// outcome for the checks that deliberately watch for motion that should never come.
// LEAD comes first because stillness alone is a trap: a click-triggered smooth scroll takes a frame
// or two to start, so polling immediately would see "not moving" and return before it ever moved.
// The lead-in also covers the IntersectionObserver → React render that follows a scroll.
const LEAD = 260
const STILL = 180
const settle = async (page, cap = 2500) => {
  await page.evaluate(() => {
    window.__sT0 = performance.now()
    window.__sY = null
  })
  await page
    .waitForFunction(
      ({ lead, still }) => {
        const t = performance.now()
        if (t - window.__sT0 < lead) return false
        const y = window.scrollY
        if (window.__sY !== y) {
          window.__sY = y
          window.__sT = t
          return false
        }
        return t - window.__sT >= still
      },
      { lead: LEAD, still: STILL },
      { polling: 'raf', timeout: cap },
    )
    .catch(() => {})
}
// `behavior: 'instant'` on purpose: the bare form inherits `scroll-behavior: smooth`, so from deep
// in the page this would animate thousands of pixels and race whatever we measure next.
const toTop = async (page) => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await settle(page)
}

// Park a decade on the reading line and wait for the page to stop moving — the pair that opens
// almost every check below.
const park = async (page, i) => {
  await goToStep(page, i)
  await settle(page)
}

// How far the nearest decade is from the reading line it should have come to rest on.
const offBy = (page) =>
  page.evaluate((f) => {
    const at = window.innerHeight * f
    const d = [...document.querySelectorAll('.step')].map((s) => {
      const r = s.getBoundingClientRect()
      return Math.abs(r.top + r.height / 2 - at)
    })
    return Math.round(Math.min(...d))
  }, LINE)

// ---- decade arrow helpers ---------------------------------------------------
// Which decade the journey is actually showing, read off the active CAPTION — never off the
// control, so a check can catch the arrows and the observer disagreeing.
// parseInt, not Number: the caption reads "1920s".
const activeDecade = (page) =>
  page.evaluate(() => parseInt(document.querySelector('.step-inner.active .step-decade')?.textContent, 10))

// .decade-arrows.show flips visibility and opacity together, so one of them tells the whole story
// — and visibility is the one that decides whether the buttons are still in the tab order.
const arrowState = (page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.decade-arrows')).visibility)

const arrow = (page, name) => page.getByRole('button', { name })

// aria-disabled, not the DOM property — see the note in DecadeArrows.jsx for why the real
// attribute cannot be used here.
const inert = (page, name) =>
  arrow(page, name).evaluate((el) => el.getAttribute('aria-disabled') === 'true')
const arrowsDisabled = async (page) => ({
  prev: await inert(page, 'Previous step'),
  next: await inert(page, 'Next step'),
})

// Fixed chrome in the page's own gutter: it must not sit over the caption column, nor over the
// jump-to-top button.
const arrowClearance = (page) =>
  page.evaluate(() => {
    const box = (s) => document.querySelector(s)?.getBoundingClientRect()
    const nav = box('.decade-arrows')
    const gap = Math.round(nav.left - box('.step-inner.active').right)
    const vGap = Math.round(box('.to-top').top - nav.bottom)
    return { gap, vGap, ok: gap >= 0 && vGap > 0 }
  })

// An svg sized by viewBox alone renders its CSS font sizes as USER units, so text shrinks with the
// chart — the regression this whole rework exists to fix. Both charts are checked, so measure once.
const renderedPx = (page, svgSel, textSels) =>
  page.evaluate(
    ({ svgSel, textSels }) => {
      const svg = document.querySelector(svgSel)
      if (!svg) return null
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width
      return Object.fromEntries(
        textSels.map((s) => {
          const e = document.querySelector(s)
          return [s, e ? +(parseFloat(getComputedStyle(e).fontSize) * scale).toFixed(1) : null]
        }),
      )
    },
    { svgSel, textSels },
  )

// The page the reader is on — not merely one with players, since the ±1 window mounts three.
const READING = '.deck-page:has(.step-inner.active)'

// The spotlighted decade's label sits beside its dot, and the outermost svg clips by default — so
// at the decade whose dot is furthest right it used to render as "192". Both geometries flip the
// label to the dot's left when it would not fit, so check both.
const labelInsidePlane = async (page, where) => {
  const m = await page.evaluate(() => {
    const svg = document.querySelector('.moodspace')
    const lab = document.querySelector('.ms-now-label')
    if (!svg || !lab) return null
    const s = svg.getBoundingClientRect(), l = lab.getBoundingClientRect()
    return {
      text: lab.textContent,
      inside: l.left >= s.left - 1 && l.right <= s.right + 1,
      detail: `${Math.round(l.left)}..${Math.round(l.right)} within ${Math.round(s.left)}..${Math.round(s.right)}`,
    }
  })
  check(`the decade label is not clipped by the plane's edge (${where})`, !!m && m.inside, `“${m?.text}” ${m?.detail}`)
}

// Measure a block that should have been scrolled fully into the readable strip, and assert it.
const clearOfBar = async (page, name, topSel, botSel) => {
  const m = await page.evaluate(
    ([topSel, botSel]) => {
      const box = (s) => document.querySelector(s)?.getBoundingClientRect()
      return {
        barBottom: box('.topbar').bottom,
        top: box(topSel)?.top,
        bottom: box(botSel)?.bottom,
        label: document.querySelector(topSel)?.textContent.slice(0, 32),
        vh: window.innerHeight,
      }
    },
    [topSel, botSel],
  )
  check(
    name,
    m.top > m.barBottom && m.bottom <= m.vh,
    `“${m.label}” at ${Math.round(m.top)}px, block ends ${Math.round(m.bottom)}px of ${m.vh}px,` +
      ` topbar ends ${Math.round(m.barBottom)}px`,
  )
}

// Picking a story is two hops: the tab lands that story's explainer screen, and its "Dive in"
// button lands the first decade. Both must clear the sticky topbar, at both breakpoints.
const tabAndDiveIn = async (page, where) => {
  await toTop(page)
  await page.getByRole('tab', { name: 'Two kinds of sad' }).click()
  await settle(page)
  await clearOfBar(
    page,
    `tab switch scrolls that story's intro into view, clear of the topbar (${where})`,
    '.journey-intro h2',
    '.journey-intro .explore-btn',
  )

  await page.locator('.journey-intro .explore-btn').click()
  await settle(page)
  await clearOfBar(
    page,
    `"Dive in" scrolls the first decade into view, clear of the topbar (${where})`,
    '.step-inner.active',
    '.step-inner.active',
  )
}

// ---- mobile: the deck ------------------------------------------------------
// Portrait phones get one decade per screen under a pinned compact plane; landscape puts the plane
// beside the pages instead, because its scarce axis is height. Both are checked here — the layout
// differs but every promise below is the same.
// Spread across the range that actually exists, shortest to tallest. The first cut of the deck was
// checked at 667 and 700 only — both near the bottom of the range — which hid the fact that a page
// is one viewport tall while its content is a fixed height, so the leftover grew with the screen:
// 18% of an SE, 40% of a Pro Max. The tall pair is the guard against that coming back.
const MOBILE_VIEWPORTS = [
  { width: 375, height: 667, label: 'mobile 375×667' },
  { width: 390, height: 844, label: 'mobile 390×844' },
  { width: 430, height: 932, label: 'mobile 430×932' },
  { width: 844, height: 390, label: 'landscape 844×390' },
  // Wider than the 900px width breakpoint but only 430 tall — the case that used to fall through
  // to the desktop layout in a window far too short for it.
  { width: 932, height: 430, label: 'landscape 932×430' },
]
// Balanced breathing room reads as design; much past this reads as a hole you scroll through.
const DEAD_SPACE_BUDGET = 0.3

// Scroll a decade page to the top of the viewport — the deck's own resting position, rather than
// the desktop reading line.
// Negative counts from the end, so a check about "the last decade" stays about the last decade
// when the dataset gains one.
const goToPage = async (page, i) => {
  await page.evaluate((i) => {
    const steps = [...document.querySelectorAll('.step')]
    steps.at(i)?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, i)
  await settle(page)
}

// The ±1 player window follows the DEBOUNCED active decade, so the page you just landed on gets its
// players a beat after it gets the caption. Anything measuring them has to wait for that, or it
// races the debounce — which it lost about one run in three.
const awaitPlayers = (page) =>
  page.waitForSelector(`${READING} .embed-list`, { timeout: 5000 }).catch(() => null)

async function runMobile(browser, { width, height, label }) {
  console.log(`\n\x1b[1m${label} (touch)\x1b[0m`)
  const ctx = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  })
  const mp = await ctx.newPage()
  const mErrors = []
  mp.on('pageerror', (e) => mErrors.push(String(e)))
  await mp.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await mp.waitForSelector('.step', { timeout: 15_000 })
  const cdp = await ctx.newCDPSession(mp)
  // A flick worth one page, from low on the screen. Sized off the viewport so it means the same
  // gesture on a 667px phone and a 932px one.
  const flick = async () => {
    await swipe(cdp, { x: Math.round(width / 2), y: Math.round(height * 0.8), dy: Math.round(height * 0.6) })
    await settle(mp)
  }

  // The story tabs are the first choice the page asks for, so they cannot be below the fold.
  // Measured before the landscape rework: every tab sat at top: 392px in a 390px-tall viewport.
  const cue = await mp.evaluate(() => {
    const box = (s) => document.querySelector(s).getBoundingClientRect()
    return {
      h1: box('.hero h1').bottom,
      tabs: box('.story-toggle').bottom,
      cueBottom: box('.scroll-cue').bottom,
      vh: window.innerHeight,
    }
  })
  check(
    `headline, story tabs and scroll cue are above the fold (${label})`,
    cue.h1 <= cue.vh && cue.tabs <= cue.vh && cue.cueBottom <= cue.vh,
    `h1 ends ${Math.round(cue.h1)}px, tabs ${Math.round(cue.tabs)}px, cue ${Math.round(cue.cueBottom)}px of ${cue.vh}px`,
  )

  // Each opening screen must actually BE a screen. With mandatory snap they are snap points, so a
  // block shorter than the viewport rests at the top and shows a slice of the next one below it —
  // which is what a `min-height: 0` left over from an earlier trim did to the landscape hero.
  const screens = await mp.evaluate(() => {
    const vh = window.innerHeight
    const bar = document.querySelector('.topbar').getBoundingClientRect().height
    return ['.hero', '.journey-intro'].map((s) => {
      const h = document.querySelector(s).getBoundingClientRect().height
      return { s, h: Math.round(h), need: Math.round(vh - bar), ok: h >= vh - bar - 2 }
    })
  })
  check(
    `the hero and explainer each fill a screen (${label})`,
    screens.every((s) => s.ok),
    screens.map((s) => `${s.s} ${s.h}px of ${s.need}px`).join(', '),
  )

  // 44px is the floor for a finger. `.to-top` is not in the list because the deck does not render
  // it — the check below asserts exactly that.
  const targets = await mp.evaluate(() => {
    const small = []
    for (const el of document.querySelectorAll('.story-seg, .explore-btn')) {
      const r = el.getBoundingClientRect()
      if (r.height > 0 && r.height < 44) small.push(`${el.className.split(' ')[0]} ${Math.round(r.height)}px`)
    }
    return small
  })
  check(`tap targets are at least 44px (${label})`, targets.length === 0, targets.join(', '))

  // Nothing may scroll sideways except the carousel itself.
  const overflow = await mp.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }))
  check(
    `no horizontal page overflow (${label})`,
    overflow.sw <= overflow.cw + 1,
    `${overflow.sw} > ${overflow.cw}`,
  )

  // The deck carries no fixed chrome: a swipe is the pager, so the arrows' ~54px gutter buys
  // nothing, and jump-to-top would float over the songs half of every page.
  const chromeGone = await mp.evaluate(() => ({
    arrows: document.querySelector('.decade-arrows') === null,
    toTop: document.querySelector('.to-top') === null,
  }))
  check(
    `no fixed arrows or jump-to-top on the deck (${label})`,
    chromeGone.arrows && chromeGone.toTop,
    `arrows gone: ${chromeGone.arrows}, jump-to-top gone: ${chromeGone.toTop}`,
  )

  // Touch swipe must scroll at all — there is no wheel event on a phone.
  await toTop(mp)
  const mBefore = await scrollY(mp)
  await flick()
  const mMoved = (await scrollY(mp)) - mBefore
  check(`touch swipe scrolls the page (${label})`, mMoved > 150, `moved ${Math.round(mMoved)}px`)

  // The promise of the deck: a decade, its caption and its songs on one screen at once. This is
  // what the stacked layout could not do — measured, the caption ran off the bottom every time.
  await goToPage(mp, 3)
  await awaitPlayers(mp)
  const pg = await mp.evaluate((READING) => {
    const vh = window.innerHeight
    const page = document.querySelector(READING) ?? document.querySelector('.deck-page')
    const q = (s) => page?.querySelector(s)?.getBoundingClientRect()
    // "On screen" has to mean clear of the sticky chrome, not merely below y=0: a heading at
    // top: 4px is on screen by coordinates and invisible in fact, which is how a clipped decade
    // heading slipped past this check once. But the plane only occludes when it is ABOVE the
    // content — in landscape it sits beside it, and then the topbar is the only thing overhead.
    // The plot itself, not its container: side by side the container is stretched to the full band
    // by design, so measuring it would make the emptiness check below pass trivially.
    const planeBox = document.querySelector('.moodspace')?.getBoundingClientRect()
    const pageBox = page?.getBoundingClientRect()
    const sideBySide = !!planeBox && !!pageBox && planeBox.right <= pageBox.left + 1
    const chrome = sideBySide
      ? document.querySelector('.topbar').getBoundingClientRect().bottom
      : (planeBox?.bottom ?? 0)
    const on = (r) => !!r && r.top >= chrome - 1 && r.bottom <= vh
    const dec = q('.step-decade'), cap = q('.step-inner p'), list = q('.embed-list')
    const tail = q('.embed-dots') ?? list
    return {
      vh,
      chrome: Math.round(chrome),
      decade: page?.querySelector('.step-decade')?.textContent,
      decOn: on(dec), capOn: on(cap), listOn: on(list),
      where: [dec, cap, list].map((r) => (r ? `${Math.round(r.top)}..${Math.round(r.bottom)}` : 'none')).join(' '),
      // Empty page above the first thing on it and below the last — what a reader scrolls through.
      // Side by side, the plane counts as content: it fills its own column, so a gap beside it is
      // not an empty screen. Measuring only the text column would call a full page 36% empty.
      gapAbove: dec ? Math.round(Math.min(dec.top, sideBySide ? planeBox.top : dec.top) - chrome) : null,
      gapBelow: tail && pageBox
        ? Math.round(pageBox.bottom - Math.max(tail.bottom, sideBySide ? planeBox.bottom : tail.bottom))
        : null,
    }
  }, READING)
  check(
    `decade, caption and songs are all clear of the plane and on screen (${label})`,
    pg.decOn && pg.capOn && pg.listOn,
    `${pg.decade}: decade/caption/songs at ${pg.where}; plane ends ${pg.chrome}px, vh ${pg.vh}px`,
  )

  const dead = (pg.gapAbove ?? 0) + (pg.gapBelow ?? 0)
  check(
    `a decade page is not mostly empty (${label})`,
    dead <= pg.vh * DEAD_SPACE_BUDGET,
    `${pg.gapAbove}px above + ${pg.gapBelow}px below = ${dead}px, ` +
      `${Math.round((dead / pg.vh) * 100)}% of ${pg.vh}px (budget ${DEAD_SPACE_BUDGET * 100}%)`,
  )

  // The regression that shipped: the plane sizes by viewBox alone, so its CSS font sizes are user
  // units. At the old 560-wide geometry a 13px tick rendered at ~7px on this screen.
  const textPx = await renderedPx(mp, '.moodspace', ['.ms-tick', '.ms-axis-title'])
  check(
    `plane text renders at a legible size (${label})`,
    textPx && textPx['.ms-tick'] >= 9,
    `tick ${textPx?.['.ms-tick']}px, axis title ${textPx?.['.ms-axis-title']}px rendered`,
  )

  // Decade 0 is the mood journey's rightmost dot — the case that clipped.
  await goToPage(mp, 0)
  await labelInsidePlane(mp, label)
  await goToPage(mp, 3)
  await awaitPlayers(mp)

  // All three songs reachable — the stacked layout hid tracks 2 and 3 outright — and reachable by
  // the gesture the layout advertises, without dragging the page with them.
  const carousel = await mp.evaluate((READING) => {
    const el = document.querySelector(`${READING} .embed-list`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      tracks: el.querySelectorAll('iframe').length,
      scrollable: el.scrollWidth > el.clientWidth + 5,
      cx: Math.round(r.left + r.width / 2),
      cy: Math.round(r.top + r.height / 2),
    }
  }, READING)
  check(
    `all three songs are present and swipeable (${label})`,
    carousel && carousel.tracks === 3 && carousel.scrollable,
    `${carousel?.tracks} players, scrollable: ${carousel?.scrollable}`,
  )
  if (carousel) {
    const yBefore = await scrollY(mp)
    await swipe(cdp, { x: carousel.cx, y: carousel.cy, dx: -Math.round(width * 0.65) })
    await mp.waitForTimeout(900)
    const after = await mp.evaluate((READING) => {
      // Scoped to the page being read: the ±1 window mounts three carousels, and an unscoped
      // query reads the previous decade's dots, which have not moved.
      const pg = document.querySelector(READING)
      return {
        left: Math.round(pg.querySelector('.embed-list').scrollLeft),
        y: Math.round(window.scrollY),
        dot: [...pg.querySelectorAll('.embed-dot')].findIndex((d) => d.classList.contains('on')),
      }
    }, READING)
    // Which song it lands on depends on momentum against track width, so assert the promise —
    // a sideways swipe reaches a later song and leaves the page where it was — not an index.
    check(
      `sideways swipe reaches another song without scrolling the page (${label})`,
      after.left > 50 && after.dot >= 1 && Math.abs(after.y - yBefore) < 12,
      `scrollLeft ${after.left}px, now on song ${after.dot + 1}, page moved ${Math.abs(after.y - yBefore)}px`,
    )
  }

  // A ±1 decade window: three decades × three tracks. Mounting only the current decade was tried
  // and reverted — its players then load as you arrive, which reads as the embed blanking out
  // mid-scroll. This is the ceiling, so a wider window cannot creep back in unnoticed.
  const frames = await mp.evaluate(() => document.querySelectorAll('.embed-list iframe').length)
  check(`the player window stays at ±1 decade (${label})`, frames <= 9, `${frames} iframes`)

  // A swipe down moves exactly one decade — no skipping, no sticking.
  const dBefore = await activeDecade(mp)
  await flick()
  const dAfter = await activeDecade(mp)
  check(
    `a swipe advances exactly one decade (${label})`,
    dAfter === dBefore + 10,
    `${dBefore}s → ${dAfter}s`,
  )

  if (SHOTS) await mp.screenshot({ path: `${SHOT_DIR}/deck-${width}x${height}.png` })

  // Mandatory snap's failure mode: nothing past the last decade is a snap point, so the scroller
  // refuses to rest there and drags the reader back. Swipe hard off the end and check the page
  // actually stays down — and that the footer's bottom is reachable at all.
  await goToPage(mp, -1)
  const endY = await scrollY(mp)
  for (let i = 0; i < 4; i++) await flick()
  const past = await mp.evaluate(() => ({
    y: Math.round(window.scrollY),
    max: Math.round(document.documentElement.scrollHeight - window.innerHeight),
    footerSeen: (() => {
      const f = document.querySelector('.footer')?.getBoundingClientRect()
      return !!f && f.top < window.innerHeight
    })(),
  }))
  check(
    `can scroll past the last decade to the footer (${label})`,
    past.y > endY + 100 && past.footerSeen,
    `${endY} → ${past.y} of ${past.max}, footer in view: ${past.footerSeen}`,
  )
  await goToPage(mp, 3)
  await awaitPlayers(mp)

  // The touch-action fix: a swipe starting ON the coda chart must still scroll the page.
  await mp.evaluate(() => document.querySelector('.beat')?.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await settle(mp)
  const chart = await mp.evaluate(() => {
    const el = document.querySelector('.fig-plot svg')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), ta: getComputedStyle(el).touchAction }
  })
  if (chart) {
    check(`coda chart allows vertical panning (${label})`, chart.ta === 'pan-y', `touch-action: ${chart.ta}`)
    // Same viewBox-text trap as the plane: the wide geometry rendered these at ~5px, and spent a
    // 120-unit right margin on direct labels the HTML legend above already duplicates.
    const figText = await renderedPx(mp, '.fig-plot svg', ['.tick'])
    const named = await mp.evaluate(() => ({
      direct: document.querySelectorAll('.direct-label').length,
      legend: document.querySelectorAll('.fig-legend .legend-item').length,
    }))
    check(
      `coda chart text is legible and its series are still named (${label})`,
      figText['.tick'] >= 9 && named.direct === 0 && named.legend >= 2,
      `tick ${figText['.tick']}px, ${named.direct} svg labels, ${named.legend} legend entries`,
    )
    const cBefore = await scrollY(mp)
    await swipe(cdp, { x: chart.x, y: chart.y, dy: 300 })
    await settle(mp)
    const cMoved = (await scrollY(mp)) - cBefore
    check(`swipe starting on the coda chart scrolls the page (${label})`, cMoved > 100, `moved ${Math.round(cMoved)}px`)
  }

  await tabAndDiveIn(mp, label)

  // The one thing emulation cannot do on its own: a phone's URL bar collapses as you scroll, which
  // re-resolves every dvh unit and reflows the page under an animating jump. Growing the viewport
  // mid-scroll is the closest stand-in — the jump must still land its target.
  await toTop(mp)
  await mp.getByRole('tab', { name: 'The beat' }).click()
  await mp.waitForTimeout(80)
  await mp.setViewportSize({ width, height: height + 60 })
  await settle(mp)
  await clearOfBar(
    mp,
    `a jump survives the URL bar collapsing mid-scroll (${label})`,
    '.journey-intro h2',
    '.journey-intro h2',
  )
  await mp.setViewportSize({ width, height })

  check(`no page errors (${label})`, mErrors.length === 0, mErrors.slice(0, 3).join(' | '))
  await ctx.close()
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADED })
  if (SHOTS) await mkdir(SHOT_DIR, { recursive: true })

  // ---------------------------------------------------------------- desktop
  const desktop = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  const page = await desktop.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // Only OUR console. The Spotify embeds report their own Sentry/CORS failures into the shared
  // console, non-deterministically — that used to fail this check about one run in three, for
  // something no change here could ever fix. Filtering by origin keeps the check honest: anything
  // thrown by our own bundle still lands.
  page.on('console', (m) => {
    const from = m.location()?.url ?? ''
    if (m.type() === 'error' && from.startsWith(ORIGIN)) errors.push(m.text())
  })

  // Installed before app code runs: counts any attempt to cancel a scroll gesture. The original
  // bug was preventDefault() on wheel events, so this is the sharpest possible probe.
  await page.addInitScript(() => {
    window.__prevented = 0
    const pd = Event.prototype.preventDefault
    Event.prototype.preventDefault = function () {
      if (this.type === 'wheel' || this.type === 'touchmove') window.__prevented++
      return pd.call(this)
    }
  })
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.step', { timeout: 15_000 })
  const cdp = await desktop.newCDPSession(page)

  console.log('\n\x1b[1mDesktop 1512×982\x1b[0m')


  // The gesture itself must run completely unimpeded — this is what CSS scroll-snap broke,
  // turning a 420px flick into 0px of travel by re-snapping mid-gesture.
  await page.evaluate(() => window.scrollTo(0, 3000))
  await settle(page)
  const before = await scrollY(page)
  await trackpad(page, 14, 30)
  const during = await scrollY(page)
  check(
    'trackpad gesture is not fought while it runs',
    during - before >= 300,
    `travelled ${Math.round(during - before)}px during the gesture (CSS snap managed 0px)`,
  )

  // ...and once it goes quiet, the page settles onto a decade.
  await settle(page)
  const landed = await offBy(page)
  check('settles onto a decade after the gesture', landed < 12, `came to rest ${landed}px off a decade`)

  // Slow deliberate notches must make forward progress. Settling to the plain *nearest* decade
  // fails this: one 100px notch against 589px spacing always rounds backwards, so the reader is
  // pinned. Measured before the direction guard: six notches 250ms apart moved 0px.
  await page.evaluate(() => window.scrollTo(0, 3000))
  await settle(page)
  const slowFrom = await scrollY(page)
  await page.mouse.move(756, 500)
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 100)
    await page.waitForTimeout(300)
  }
  await settle(page)
  const slowTo = await scrollY(page)
  const slowOff = await offBy(page)
  // At least a full decade forward, landing on one. Notches arriving mid-glide are partly
  // absorbed, so this is about direction and progress, not a precise distance.
  check(
    'slow deliberate notches advance (no pin-back)',
    slowTo - slowFrom > 400 && slowOff < 12,
    `4 notches 300ms apart moved ${Math.round(slowTo - slowFrom)}px, ${slowOff}px off a decade`,
  )

  const prevented = await page.evaluate(() => window.__prevented)
  check('nothing calls preventDefault on a scroll gesture', prevented === 0, `${prevented} cancelled events`)

  // Interrupting a glide must not strand the reader between decades. Fresh input cancels the
  // glide by design; the bug was that the follow-up settle then declined to finish, because the
  // "leave a small nudge alone" rule keyed off distance travelled rather than off whether the
  // reader was actually parked on a decade.
  await park(page, 4)
  await trackpad(page, 20, 20) // starts a glide
  await page.waitForTimeout(190) // ...land a nudge in the middle of it
  await page.mouse.wheel(0, 25)
  await settle(page)
  const stranded = await offBy(page)
  check('a nudge mid-glide does not strand you between decades', stranded < 12, `${stranded}px off a decade`)

  // Sub-pixel sign jitter (a near-horizontal two-finger swipe) must not bounce between steps.
  const jitterFrom = await scrollY(page)
  await page.mouse.move(756, 500)
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, i % 2 ? 3 : -3)
  await settle(page)
  const jitter = Math.abs((await scrollY(page)) - jitterFrom)
  check('trackpad: ±3px jitter does not jump a section', jitter < 300, `drifted ${Math.round(jitter)}px`)

  // The alignment fix: the active caption's midline must sit on the plane's midline.
  await park(page, 5)
  const align = await page.evaluate(() => {
    const mid = (s) => {
      const r = document.querySelector(s)?.getBoundingClientRect()
      return r ? r.top + r.height / 2 : null
    }
    return {
      plane: mid('.moodspace'),
      caption: mid('.step-inner.active'),
      embedH: getComputedStyle(document.querySelector('.journey')).getPropertyValue('--embed-h'),
    }
  })
  check(
    'caption is centred on the plane, not the viewport',
    align.plane != null && align.caption != null && near(align.plane, align.caption, 12),
    `plane mid ${Math.round(align.plane)}px vs caption mid ${Math.round(align.caption)}px (--embed-h ${align.embedH.trim()})`,
  )
  if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/desktop-alignment.png` })

  // The active caption must be the one on the plane's midline, at any scroll position.
  const activeIsOnPlane = await page.evaluate(() => {
    const p = document.querySelector('.moodspace').getBoundingClientRect()
    const planeMid = p.top + p.height / 2
    const rows = [...document.querySelectorAll('.step-inner')].map((el) => {
      const r = el.getBoundingClientRect()
      return { active: el.classList.contains('active'), d: Math.abs(r.top + r.height / 2 - planeMid) }
    })
    const closest = rows.reduce((a, b) => (b.d < a.d ? b : a))
    return closest.active
  })
  check('the caption on the plane midline is the active one', activeIsOnPlane)

  await park(page, 0)
  await labelInsidePlane(page, 'desktop')

  // ---- decade arrows: stepping without scrolling --------------------------
  // They must float over the journey and nothing else, land exactly where a scroll would have
  // settled, and never fight — or be fought by — the settle glide.
  await toTop(page)
  const atTop = await arrowState(page)
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
  await settle(page)
  const atFoot = await arrowState(page)
  await page.evaluate(() => document.querySelector('.journey-intro').scrollIntoView({ block: 'start', behavior: 'instant' }))
  await settle(page)
  const atIntro = await arrowState(page)
  await park(page, 5)
  const onJourney = await arrowState(page)
  check(
    'arrows show over the explainer and the journey, nowhere else',
    atTop === 'hidden' && atFoot === 'hidden' && atIntro === 'visible' && onJourney === 'visible',
    `hero ${atTop}, footer ${atFoot}, explainer ${atIntro}, journey ${onJourney}`,
  )
  if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/desktop-arrows.png` })

  // One click, one decade, landing on the reading line.
  const stepFrom = await activeDecade(page)
  await arrow(page, 'Next step').click()
  await settle(page)
  const stepOne = await activeDecade(page)
  const stepOff = await offBy(page)
  check(
    'the down arrow steps exactly one decade',
    stepOne === stepFrom + 10 && stepOff < 12,
    `${stepFrom}s → ${stepOne}s, ${stepOff}px off`,
  )

  // The jump arms useSettleToStep's idle timer like any other scroll. It must be a no-op: the
  // settle computes its target from the same readingLineY() the click used.
  const jumped = await scrollY(page)
  await settle(page)
  const afterSettle = await scrollY(page)
  check(
    'the settler does not drag an arrow step off target',
    near(jumped, afterSettle, 3),
    `${Math.round(jumped)} → ${Math.round(afterSettle)}`,
  )

  // Two clicks compose, which they only do if `active` has caught up in between (the observer
  // fires mid-scroll, not at the end).
  await arrow(page, 'Next step').click()
  await page.waitForTimeout(400)
  await arrow(page, 'Next step').click()
  await settle(page)
  const stepTwo = await activeDecade(page)
  check('consecutive arrow clicks compose', stepTwo === stepOne + 20, `${stepOne}s → ${stepTwo}s`)

  // A glide in flight rewrites scrollY every frame from a `start` captured before the click, so
  // without the SETTLE_CANCEL abort it silently drags the page back off the step. That window — ~620ms
  // after any gesture ends — is exactly when a struggling scroller reaches for the arrows.
  // Asserted on direction of travel, not on a decade: `active` can advance between the gesture and
  // the click, so "previous" has no fixed answer here. What is fixed is the sign — the glide was
  // heading forward, so if the click wins the page must end up BEHIND where it was when pressed,
  // and on a decade. Pinning an expected decade instead made this flaky for exactly that reason.
  await park(page, 2)
  await trackpad(page, 20, 20) // starts a glide, travelling forward
  await page.waitForTimeout(150) // ...press while it runs
  const yAtPress = await scrollY(page)
  await arrow(page, 'Previous step').click()
  await settle(page)
  const yAfter = await scrollY(page)
  const outrankedOff = await offBy(page)
  check(
    'an arrow click outranks a settle glide in flight',
    yAfter < yAtPress && outrankedOff < 12,
    `glide heading forward from ${Math.round(yAtPress)}, ended ${Math.round(yAfter)} (${outrankedOff}px off a decade)`,
  )

  await park(page, 0)
  const atFirst = await arrowsDisabled(page)
  await park(page, -1)
  const atLastEnd = await arrowsDisabled(page)
  check(
    'only the far end of the ladder disables an arrow',
    !atFirst.prev && !atFirst.next && !atLastEnd.prev && atLastEnd.next,
    `first decade ${JSON.stringify(atFirst)}, last ${JSON.stringify(atLastEnd)}`,
  )

  // The whole point of the ladder: ↑ from the first decade must climb out of the journey rather
  // than dead-end, through the explainer and on to the landing screen.
  await park(page, 0)
  await arrow(page, 'Previous step').click()
  await settle(page)
  const onIntro = await page.evaluate(() => ({
    top: Math.round(document.querySelector('.journey-intro').getBoundingClientRect().top),
    h2: Math.round(document.querySelector('.journey-intro h2').getBoundingClientRect().top),
    bar: Math.round(document.querySelector('.topbar').getBoundingClientRect().bottom),
    shown: getComputedStyle(document.querySelector('.decade-arrows')).visibility,
  }))
  check(
    '↑ from the first decade climbs out to the explainer',
    Math.abs(onIntro.top) < 4 && onIntro.h2 > onIntro.bar && onIntro.shown === 'visible',
    `explainer parked at ${onIntro.top}px, its h2 at ${onIntro.h2}px clear of the ${onIntro.bar}px topbar, arrows ${onIntro.shown}`,
  )

  await arrow(page, 'Previous step').click()
  await settle(page)
  const backAtTop = await scrollY(page)
  check('↑ again reaches the landing screen', backAtTop === 0, `scrollY ${Math.round(backAtTop)}`)

  // ...and the ladder runs the other way too, explainer → first decade.
  await page.evaluate(() => document.querySelector('.journey-intro').scrollIntoView({ block: 'start', behavior: 'instant' }))
  await settle(page)
  await arrow(page, 'Next step').click()
  await settle(page)
  const downTo = await activeDecade(page)
  const downOff = await offBy(page)
  check(
    '↓ from the explainer lands the first decade',
    downTo === 1920 && downOff < 12,
    `landed ${downTo}s, ${downOff}px off`,
  )

  // Keyboard is the input of last resort when the wheel misbehaves, so it has to work.
  await park(page, 4)
  const kbdFrom = await activeDecade(page)
  await arrow(page, 'Next step').focus()
  await page.keyboard.press('Enter')
  await settle(page)
  const kbdTo = await activeDecade(page)
  check(
    'arrows are operable from the keyboard',
    kbdTo === kbdFrom + 10,
    `${kbdFrom}s → ${kbdTo}s`,
  )

  // Geometry: the arrows live in the page's own gutter. 1512px has 190px to spare and would never
  // catch a collision — 1200px is where the 901–1280px padding rule has to earn its keep.
  const clearWide = await arrowClearance(page)
  await page.setViewportSize({ width: 1200, height: 900 })
  await park(page, 5)
  const clearNarrow = await arrowClearance(page)
  await page.setViewportSize({ width: 1512, height: 982 })
  check(
    'arrows clear the caption column and the jump-to-top button',
    clearWide.ok && clearNarrow.ok,
    `1512px: ${clearWide.gap}px past the caption, ${clearWide.vGap}px above .to-top; 1200px: ${clearNarrow.gap}px / ${clearNarrow.vGap}px`,
  )

  // Re-run the sharpest probe: the original check ran before the arrows existed.
  const preventedAfter = await page.evaluate(() => window.__prevented)
  check(
    'arrow interaction never cancels a scroll gesture',
    preventedAfter === 0,
    `${preventedAfter} cancelled events`,
  )

  // The settle must not trap the reader at the last decade — that is exactly how a snap zone
  // with nothing beyond it turns into a dead end.
  await park(page, -1)
  const atLast = await scrollY(page)
  await trackpad(page, 60, 12)
  await settle(page)
  const escaped = await scrollY(page)
  check(
    'can scroll out of the journey (no dead end at the last decade)',
    escaped > atLast + 400,
    `${Math.round(atLast)} → ${Math.round(escaped)} (+${Math.round(escaped - atLast)}px)`,
  )

  // ...and once past it, prose scrolls freely with no settling at all.
  const footerFrom = await scrollY(page)
  await trackpad(page, 20, 5)
  const footerDuring = await scrollY(page)
  await settle(page)
  const footerAfter = await scrollY(page)
  check(
    'no settling in the coda/footer',
    near(footerAfter, footerDuring, 50), // slack for Chrome's own wheel-scroll animation tail
    `${Math.round(footerFrom)} → ${Math.round(footerDuring)} → ${Math.round(footerAfter)} after settling`,
  )

  // Reduced motion must turn off smooth scrolling — the tab switcher defers to this.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const rm = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)
  check('reduced motion disables smooth scrolling', rm === 'auto', `scroll-behavior: ${rm}`)

  // ...and must disable settling too: it is motion the reader did not ask for.
  const rmPage = await desktop.newPage()
  await rmPage.emulateMedia({ reducedMotion: 'reduce' })
  await rmPage.setViewportSize({ width: 1512, height: 982 })
  await rmPage.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await rmPage.waitForSelector('.step')
  await rmPage.evaluate(() => window.scrollTo(0, 3000))
  await settle(rmPage)
  await rmPage.mouse.move(756, 500)
  for (let i = 0; i < 6; i++) await rmPage.mouse.wheel(0, 14)
  const rmDuring = await scrollY(rmPage)
  await settle(rmPage)
  const rmAfter = await scrollY(rmPage)
  check('reduced motion disables settling', near(rmAfter, rmDuring, 40), `${rmDuring} → ${rmAfter}`)
  await rmPage.close()
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  // The cue parks at the hero's bottom edge, so it only shows if the hero ends at the fold.
  await toTop(page)
  const heroCue = await page.evaluate(() => {
    const r = document.querySelector('.scroll-cue').getBoundingClientRect()
    return { bottom: r.bottom, vh: window.innerHeight }
  })
  check(
    'scroll cue is above the fold (desktop)',
    heroCue.bottom <= heroCue.vh,
    `cue ends ${Math.round(heroCue.bottom)}px of ${heroCue.vh}px`,
  )

  await tabAndDiveIn(page, 'desktop')

  check('no console/page errors (desktop)', errors.length === 0, errors.slice(0, 3).join(' | '))

  // ----------------------------------------------------------------- mobile
  // Sequential, not parallel: these drive real touch gestures and assert on settle timings, so
  // five contexts competing for CPU would trade ~45s of wall clock for flakes in the checks most
  // worth trusting. See MOBILE_VIEWPORTS for why the list spans the range it does.
  for (const vp of MOBILE_VIEWPORTS) await runMobile(browser, vp)

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (SHOTS) console.log(`screenshots in ${SHOT_DIR}/`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
