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
// readingLine(true) from src/lib.js: where a decade rests on mobile, below the sticky plane.
const MOBILE_LINE = 0.81

// A trackpad is a stream of many small wheel deltas (a mouse is one big one per notch) — that
// difference is precisely what broke, so drive real wheel events rather than synthetic ones.
const trackpad = async (page, dy, steps = 30) => {
  await page.mouse.move(756, 500)
  for (let i = 0; i < steps; i++) await page.mouse.wheel(0, dy)
}

// A finger drag: real touch events through the browser's gesture recognizer.
const swipe = async (cdp, { x, y, dy, steps = 20 }) => {
  const pt = (py) => [{ x, y: py, radiusX: 12, radiusY: 12, force: 1, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y) })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y - (dy * i) / steps) })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

const scrollY = (page) => page.evaluate(() => window.scrollY)
// Park a decade on the reading line. Negative index counts from the end. Mirrors
// scrollToReadingLine() in src/lib.js rather than calling it — the whole point of a black-box
// check is that it computes the expected position independently.
const goToStep = (page, i, line = 0.5) =>
  page.evaluate(
    ({ i, line }) => {
      const r = [...document.querySelectorAll('.step')].at(i).getBoundingClientRect()
      const top = r.top + window.scrollY + r.height / 2 - window.innerHeight * line
      window.scrollTo({ top, behavior: 'instant' })
    },
    { i, line },
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
const park = async (page, i, line = 0.5) => {
  await goToStep(page, i, line)
  await settle(page)
}

// How far the nearest decade is from the reading line it should have come to rest on. `line` is
// readingLine() from lib.js — 0.5 on desktop, 0.81 on mobile, where the sticky plane sits on top.
const offBy = (page, line = 0.5) =>
  page.evaluate((f) => {
    const at = window.innerHeight * f
    const d = [...document.querySelectorAll('.step')].map((s) => {
      const r = s.getBoundingClientRect()
      return Math.abs(r.top + r.height / 2 - at)
    })
    return Math.round(Math.min(...d))
  }, line)

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
  console.log('\n\x1b[1mMobile 390×700 (touch)\x1b[0m')
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 700 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  })
  const mp = await mobile.newPage()
  const mErrors = []
  mp.on('pageerror', (e) => mErrors.push(String(e)))
  await mp.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await mp.waitForSelector('.step', { timeout: 15_000 })
  const mcdp = await mobile.newCDPSession(mp)

  // The hero must fit the visible viewport: the 100vh → 100dvh fix, the mobile type/padding trim,
  // and `min-height: calc(100dvh - var(--topbar))` — without that last one the hero runs a full
  // topbar taller than the screen and the cue, parked at its bottom edge, falls under the fold.
  // All three are asserted now; the cue used to trail below and be merely reported.
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
    'headline, story tabs and scroll cue are above the fold (mobile)',
    cue.h1 <= cue.vh && cue.tabs <= cue.vh && cue.cueBottom <= cue.vh,
    `h1 ends ${Math.round(cue.h1)}px, tabs ${Math.round(cue.tabs)}px, cue ${Math.round(
      cue.cueBottom,
    )}px of ${cue.vh}px`,
  )

  // Touch swipe must scroll at all — there is no wheel event on a phone.
  await mp.evaluate(() => window.scrollTo(0, 0))
  await settle(mp)
  const mBefore = await scrollY(mp)
  await swipe(mcdp, { x: 195, y: 600, dy: 420 })
  await settle(mp)
  const mMoved = (await scrollY(mp)) - mBefore
  check('touch swipe scrolls the page', mMoved > 200, `moved ${Math.round(mMoved)}px`)

  // Settling has to work off a finger too, against the mobile reading line (below the plane).
  await park(mp, 3, MOBILE_LINE)
  await swipe(mcdp, { x: 195, y: 600, dy: 260 })
  await settle(mp)
  const mOff = await offBy(mp, MOBILE_LINE)
  check('touch swipe settles onto a decade', mOff < 16, `came to rest ${mOff}px off a decade`)

  // The sticky graphic must leave room for a caption.
  await park(mp, 4, MOBILE_LINE)
  const layout = await mp.evaluate(() => {
    const g = document.querySelector('.journey-graphic').getBoundingClientRect()
    const a = document.querySelector('.step-inner.active')?.getBoundingClientRect()
    return {
      vh: window.innerHeight,
      graphicBottom: g.bottom,
      graphicH: g.height,
      capTop: a?.top,
      capBottom: a?.bottom,
    }
  })
  check(
    'sticky graphic leaves room for captions',
    layout.graphicH < layout.vh * 0.62,
    `graphic ${Math.round(layout.graphicH)}px of ${layout.vh}px (${Math.round((layout.graphicH / layout.vh) * 100)}%)`,
  )
  check(
    'active caption sits below the graphic, fully on screen',
    layout.capTop >= layout.graphicBottom - 4 && layout.capBottom <= layout.vh,
    `caption ${Math.round(layout.capTop)}–${Math.round(layout.capBottom)}px, graphic ends ${Math.round(layout.graphicBottom)}px, vh ${layout.vh}px`,
  )
  // The sticky plane pins below the topbar; if the topbar is taller than that offset the
  // plane's top gets clipped behind it.
  const clip = await mp.evaluate(() => {
    const bar = document.querySelector('.topbar').getBoundingClientRect()
    const plane = document.querySelector('.moodspace').getBoundingClientRect()
    return { barBottom: bar.bottom, planeTop: plane.top }
  })
  check(
    'sticky plane is not clipped by the topbar',
    clip.planeTop >= clip.barBottom - 1,
    `plane top ${Math.round(clip.planeTop)}px, topbar ends ${Math.round(clip.barBottom)}px`,
  )
  const mClear = await arrowClearance(mp)
  check(
    'arrows clear the caption text and jump-to-top (mobile)',
    mClear.ok,
    `${mClear.gap}px past the caption, ${mClear.vGap}px above .to-top`,
  )

  const mFrom = await activeDecade(mp)
  await arrow(mp, 'Next step').click()
  await settle(mp)
  const mTo = await activeDecade(mp)
  const mOffStep = await offBy(mp, MOBILE_LINE)
  check(
    'the down arrow steps one decade (mobile)',
    mTo === mFrom + 10 && mOffStep < 16,
    `${mFrom}s → ${mTo}s, ${mOffStep}px off`,
  )

  if (SHOTS) await mp.screenshot({ path: `${SHOT_DIR}/mobile-journey.png` })

  // The touch-action fix: a swipe starting ON the coda chart must still scroll the page.
  await mp.evaluate(() => document.querySelector('.beat')?.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await settle(mp)
  const chart = await mp.evaluate(() => {
    const r = document.querySelector('.fig-plot svg').getBoundingClientRect()
    const ta = getComputedStyle(document.querySelector('.fig-plot svg')).touchAction
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), ta }
  })
  check('coda chart allows vertical panning', chart.ta === 'pan-y', `touch-action: ${chart.ta}`)
  const cBefore = await scrollY(mp)
  await swipe(mcdp, { x: chart.x, y: chart.y, dy: 300 })
  await settle(mp)
  const cMoved = (await scrollY(mp)) - cBefore
  check('swipe starting on the coda chart scrolls the page', cMoved > 150, `moved ${Math.round(cMoved)}px`)

  await tabAndDiveIn(mp, 'mobile')

  check('no page errors (mobile)', mErrors.length === 0, mErrors.slice(0, 3).join(' | '))

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
