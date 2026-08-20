// Silverhand desktop pet — DSH host half (installable package entry).
//
// Runs in the ordinary DSH Node process (NOT the dynamic sandbox), so it can
// read its own bundled asset via import.meta.url and write HTTP responses with
// Buffer directly. Serves two routes on the Web GUI origin:
//
//   GET /silverhand-pet/spritesheet.webp  -> the sprite atlas (cached)
//   GET /silverhand-pet/state             -> { state } JSON (agent state)
//
// The Client half polls /state and renders /spritesheet.webp.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SPRITE = readFileSync(join(here, '..', 'assets', 'spritesheet.webp'))
const ROUTE_SPRITE = '/silverhand-pet/spritesheet.webp'
const ROUTE_STATE = '/silverhand-pet/state'

export default {
  inject: ['webServer', 'agents'],

  apply(ctx) {
    // ---- agent state ------------------------------------------------------
    // `transient` is a short-lived reaction that overrides the derived
    // running/idle baseline until it expires.
    let lastStatus = 'idle'
    let transient = null // { state, until }
    let waitingUntil = 0

    function setTransient(state, ms) {
      transient = { state, until: Date.now() + ms }
    }

    function currentState() {
      if (Date.now() < waitingUntil) return 'waiting'
      if (transient !== null) {
        if (Date.now() < transient.until) return transient.state
        transient = null
      }
      const agents = ctx.agents.list()
      for (let i = 0; i < agents.length; i += 1) {
        if (agents[i].status === 'running') return 'running'
      }
      return 'idle'
    }

    const offStatus = ctx.on('agent/status', (payload) => {
      waitingUntil = 0
      const next = payload && payload.status
      if (lastStatus === 'running' && next === 'idle') setTransient('jumping', 1600)
      if (next === 'idle' || next === 'running') lastStatus = next
    })
    const offError = ctx.on('agent/error', () => {
      waitingUntil = 0
      setTransient('failed', 2600)
    })
    const offResult = ctx.on('tools/result', () => {
      waitingUntil = 0
      setTransient('review', 1800)
    })
    const offCreated = ctx.on('agent/created', () => setTransient('waving', 3200))
    const offSessionStart = ctx.on('agent/session-start', () => setTransient('waving', 3200))
    // Observe the approval waterfall WITHOUT vetoing it: set "waiting", then
    // defer to the real answerers via next(). Untagged listeners (host
    // composition plugins) are admitted for every agent-scoped dispatch.
    const offApproval = ctx.on('approval/request', (req, next) => {
      waitingUntil = Date.now() + 60000
      return next()
    })

    // ---- HTTP routes ------------------------------------------------------
    const offSprite = ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_SPRITE,
      handler: (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'image/webp',
          'Content-Length': SPRITE.length,
          'Cache-Control': 'public, max-age=86400',
        })
        res.end(SPRITE)
      },
    })

    const offState = ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_STATE,
      handler: (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        })
        res.end(JSON.stringify({ state: currentState() }))
      },
    })

    // ---- cleanup ----------------------------------------------------------
    return () => {
      offState()
      offSprite()
      offApproval()
      offSessionStart()
      offCreated()
      offResult()
      offError()
      offStatus()
    }
  },
}
