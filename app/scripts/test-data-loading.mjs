import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

// Run the actual hook with a minimal state/effect host: no browser or external requests.
const source = await readFile(new URL('../src/lib.js', import.meta.url), 'utf8')
const hook = source.slice(source.indexOf('export function useData()'), source.indexOf('// ---- breakpoints')).replace('export function', 'function')
function host(fetch) {
  const state = []; let cursor, previous, cleanup, pending
  const context = vm.createContext({ BASE: '/', AbortController, fetch,
    useState(initial) {
      const i = cursor++
      if (!(i in state)) state[i] = initial
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }]
    },
    useEffect(effect, deps) {
      if (!previous || deps.some((x, i) => x !== previous[i])) {
        previous = deps; pending = effect
      }
    },
  })
  vm.runInContext(hook, context)
  return {
    render() {
      cursor = 0
      const value = context.useData()
      if (pending) { cleanup?.(); const effect = pending; pending = null; cleanup = effect() }
      return value
    },
    unmount() { cleanup?.() },
  }
}
const settle = () => new Promise(resolve => setImmediate(resolve))
for (const failure of ['network', 'http', 'json']) {
  test(`${failure} failure is visible and retry recovers`, async () => {
    let failing = true
    const app = host(async () => {
      if (failing && failure === 'network') throw Error('offline')
      return { ok: !(failing && failure === 'http'), status: 503,
        json: async () => { if (failing && failure === 'json') throw SyntaxError('bad JSON'); return { loaded: true } },
      }
    })
    app.render(); await settle()
    let view = app.render()
    assert.equal(view.data, null)
    assert.match(view.error, /could not be loaded/)
    failing = false; view.retry(); app.render(); await settle()
    view = app.render()
    assert.equal(view.error, null)
    assert.equal(view.data.timeline.loaded, true)
    app.unmount()
  })
}
test('unmount aborts requests and ignores late responses', async () => {
  const requests = []
  const app = host((url, { signal }) => new Promise(resolve => requests.push({ signal, resolve })))
  app.render(); app.unmount()
  assert.equal(requests.length, 3)
  assert.ok(requests.every(r => r.signal.aborted))
  requests.forEach(r => r.resolve({ ok: true, json: async () => ({ loaded: true }) }))
  await settle()
  assert.equal(app.render().data, null)
})
