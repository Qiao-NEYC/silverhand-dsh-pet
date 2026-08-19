// Silverhand desktop pet — DSH Host half.
//
// Responsibilities:
//   1. Read the Silverhand sprite atlas from disk (lazily, cached).
//   2. Serve it to the browser over HTTP, with a base64 data-URI fallback.
//   3. Derive the pet's current state from agent lifecycle events and expose
//      it to the Client half over the package-private RPC (`getState`).
//
// This file is a plain-JavaScript Cordis plugin BODY. It is evaluated as the
// body of an async function with only the documented Host builtins available
// (`ctx`, `harness`, `console`, `btoa`/`atob` [UTF-8 text], `TextEncoder`,
// `TextDecoder`) plus any service declared in `inject`. There is no `require`,
// `process`, `Buffer`, `fetch`, or native timer.
//
// To run it as a dynamic package, paste this exact body into `code.host` of a
// `cordis_define` call (see README.md). For a persistent install, see README.

// Absolute path to the migrated sprite atlas. Change this to wherever you keep
// the file. Forward slashes are safe on Windows.
const SPRITE_PATH = 'D:/DeepSeekHarness/Silverhand/assets/spritesheet.webp'
// HTTP route the browser loads the atlas from (same origin as the Web GUI).
const ROUTE_PATH = '/silverhand-pet/spritesheet.webp'
const MAX_BYTES = 32 * 1024 * 1024

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

return {
  name: 'silverhand-pet-host',
  inject: ['fs', 'webServer', 'agents'],

  apply(ctx) {
    // ---- sprite bytes (lazy + cached) -------------------------------------
    let bytesPromise = null
    function loadBytes() {
      if (bytesPromise === null) {
        bytesPromise = (async () => {
          const target = await ctx.fs.resolve(SPRITE_PATH)
          return await ctx.fs.readBytes(target, undefined, MAX_BYTES)
        })()
      }
      return bytesPromise
    }

    // Pure-JS RFC 4648 base64 (the sandbox `btoa` is UTF-8 text only, so it
    // would corrupt raw binary bytes — this encodes the bytes directly).
    function bytesToBase64(bytes) {
      let out = ''
      for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i]
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
        const n = (b0 << 16) | (b1 << 8) | b2
        out += B64[(n >> 18) & 63]
        out += B64[(n >> 12) & 63]
        out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '='
        out += i + 2 < bytes.length ? B64[n & 63] : '='
      }
      return out
    }

    async function spriteDataUri() {
      const bytes = await loadBytes()
      return 'data:image/webp;base64,' + bytesToBase64(bytes)
    }

    // ---- agent state ------------------------------------------------------
    // The pet's visible state. `transient` is a short-lived reaction that
    // overrides the derived running/idle baseline until it expires.
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
    // defer to the real answerers via next(). Untagged listeners (dynamic
    // packages) are admitted for every agent-scoped dispatch, so this fires
    // for approvals across all sessions.
    const offApproval = ctx.on('approval/request', (req, next) => {
      waitingUntil = Date.now() + 60000
      return next()
    })

    // ---- HTTP route (primary delivery) ------------------------------------
    const offRoute = ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PATH,
      handler: async (_req, res) => {
        try {
          const bytes = await loadBytes()
          res.writeHead(200, {
            'Content-Type': 'image/webp',
            'Content-Length': String(bytes.length),
            'Cache-Control': 'public, max-age=86400',
          })
          res.end(bytes)
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Silverhand sprite unavailable: ' + (error && error.message ? error.message : String(error)))
        }
      },
    })

    // ---- private RPC for the Client half ----------------------------------
    const offState = harness.handle('getState', () => ({ state: currentState() }))
    const offSprite = harness.handle('getSprite', async () => ({ dataUri: await spriteDataUri() }))

    // ---- cleanup ----------------------------------------------------------
    return () => {
      offState()
      offSprite()
      offRoute()
      offApproval()
      offSessionStart()
      offCreated()
      offResult()
      offError()
      offStatus()
    }
  },
}
