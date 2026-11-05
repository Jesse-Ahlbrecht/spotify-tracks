import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const source = readFileSync(new URL('../src/lib.js', import.meta.url), 'utf8')
const fn = name => source.slice(source.indexOf(`export function ${name}(`), source.indexOf('\n}', source.indexOf(`export function ${name}(`)) + 2).replace('export ', '')

test('jump to top leaves motion policy to CSS', () => {
  let options, cancelled = false
  const context = vm.createContext({ cancelSettle: () => { cancelled = true }, window: { scrollTo: o => { options = o } } })
  vm.runInContext(fn('scrollToTop') + '; scrollToTop()', context)
  assert.equal(cancelled, true)
  assert.equal(options.top, 0)
  assert.equal(Object.hasOwn(options, 'behavior'), false)
})

test('size observer reattaches after layout swap and removes stale height', () => {
  const ref = { current: null }, observers = [], values = new Map()
  let effect, nextDeps, deps, cleanup
  const host = { style: { setProperty: (k,v) => values.set(k,v), removeProperty: k => values.delete(k) } }
  const node = h => ({ offsetHeight: h, closest: () => host })
  class ResizeObserver {
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe(el) { this.el = el; this.callback([{ borderBoxSize: [{ blockSize: el.offsetHeight }] }]) }
    disconnect() { this.disconnected = true }
  }
  const context = vm.createContext({ useRef: () => ref, useEffect: (f,d) => {effect=f;nextDeps=d}, ResizeObserver })
  vm.runInContext(fn('useSizeVar'), context)
  function render(mobile, el) {
    context.useSizeVar('--height', '.journey', mobile)
    ref.current = el
    if (!deps || nextDeps.some((v,i) => v !== deps[i])) { cleanup?.(); cleanup=effect(); deps=nextDeps }
  }
  render(false, node(316)); assert.equal(values.get('--height'), '316px')
  render(true, null); assert.equal(observers[0].disconnected, true); assert.equal(values.has('--height'), false)
  render(false, node(280)); assert.equal(observers.length, 2); assert.equal(values.get('--height'), '280px')
  cleanup(); assert.equal(values.has('--height'), false)
})
