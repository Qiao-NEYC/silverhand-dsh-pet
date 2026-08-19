// Silverhand desktop pet — DSH Client half.
//
// Renders the pet in the bottom-right corner of the Web GUI via the
// frame-wide `shell.overlay` slot, animates the sprite atlas, and reacts to
// the agent state streamed from the Host half (`getState`).
//
// This file is a plain-JavaScript Cordis plugin BODY evaluated in the browser
// with these direct symbols: `React` (createElement/useState/useEffect/…),
// `console`, `styles` (styles.insert), `host` (host.call). Native timers and
// `fetch` are shadowed with teaching traps — use `ctx.interval` (after
// injecting `timer`) and `host.call` instead. `requestAnimationFrame`,
// `Image`, `document`, `Date`, and pointer events are ordinary browser
// globals and available.
//
// Interaction: drag the pet anywhere; a click (no movement) makes it jump.

const HTTP_URL = '/silverhand-pet/spritesheet.webp'
const COLS = 8
const ROWS = 9

// Atlas row -> animation. Frame counts match the actual non-empty columns in
// the V1 sprite sheet (see docs/sprite-atlas.md).
const ANIMS = {
  idle:         { row: 0, frames: 6, ms: 220 },
  runningRight: { row: 1, frames: 8, ms: 120 },
  runningLeft:  { row: 2, frames: 8, ms: 120 },
  running:      { row: 7, frames: 8, ms: 120 },
  failed:       { row: 5, frames: 8, ms: 160 },
  review:       { row: 8, frames: 8, ms: 160 },
  waving:       { row: 3, frames: 8, ms: 160 },
  jumping:      { row: 4, frames: 8, ms: 140 },
  waiting:      { row: 6, frames: 6, ms: 180 },
}

// Host state -> animation.
const STATE_ANIM = {
  idle: 'idle',
  running: 'running',
  failed: 'failed',
  review: 'review',
  waving: 'waving',
  jumping: 'jumping',
  waiting: 'waiting',
}

const PET_W = 144
const PET_H = 156

const CSS = `
.silverhand-pet {
  position: fixed;
  z-index: 9999;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.30));
  transition: transform 0.15s ease;
}
.silverhand-pet:hover:not(.silverhand-pet--dragging) { transform: translateY(-4px) scale(1.03); }
.silverhand-pet--dragging { cursor: grabbing; transition: none; }
.silverhand-pet__sprite {
  width: ${PET_W}px;
  height: ${PET_H}px;
  background-repeat: no-repeat;
  background-color: transparent;
}
.silverhand-pet__bubble {
  margin-top: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font: 500 11px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #ffffff;
  background: rgba(18, 18, 24, 0.72);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  white-space: nowrap;
}
.silverhand-pet:hover .silverhand-pet__bubble { opacity: 1; }
`

return {
  name: 'silverhand-pet',
  inject: ['slots', 'timer'],

  apply(ctx) {
    const disposeStyles = styles.insert(CSS)

    // Shared override state (single pet instance):
    //   manualUntil — a click keeps the pet jumping for a moment before the
    //                 next poll re-syncs with the Host state.
    //   isDragging  — true while a drag is in progress, so the poll does not
    //                 overwrite the walk animation mid-drag.
    let manualUntil = 0
    let isDragging = false

    function SilverhandPet() {
      const [sprite, setSprite] = React.useState(HTTP_URL)
      const [anim, setAnim] = React.useState('idle')
      const [frame, setFrame] = React.useState(0)
      // Position: null means the default corner; otherwise { left, top } in px.
      const [pos, setPos] = React.useState(null)
      const [dragging, setDragging] = React.useState(false)

      // Load the atlas; if the HTTP route is unavailable, fall back to the
      // base64 data URI the Host serves over RPC.
      React.useEffect(() => {
        let alive = true
        const img = new Image()
        img.onerror = () => {
          host.call('getSprite').then((r) => {
            if (alive && r && r.dataUri) setSprite(r.dataUri)
          }).catch(() => {})
        }
        img.src = HTTP_URL
        return () => { alive = false }
      }, [])

      // Poll the Host for the derived agent state.
      React.useEffect(() => {
        const poll = () => {
          if (isDragging || Date.now() < manualUntil) return
          host.call('getState').then((r) => {
            if (r && r.state) setAnim(STATE_ANIM[r.state] || 'idle')
          }).catch(() => {})
        }
        poll()
        return ctx.interval(poll, 300)
      }, [])

      // Advance the frame on the current animation's cadence.
      React.useEffect(() => {
        const a = ANIMS[anim]
        let i = 0
        let last = Date.now()
        let raf
        const tick = () => {
          const now = Date.now()
          if (now - last >= a.ms) {
            last = now
            i = (i + 1) % a.frames
            setFrame(i)
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
      }, [anim])

      // Drag to move. A pointer press without meaningful movement is a click
      // (jump). Position is tracked in screen coordinates; the pet switches
      // from the default corner (right/bottom) to left/top once dragged.
      const onPointerDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        e.preventDefault()
        const el = e.currentTarget
        const rect = el.getBoundingClientRect()
        const start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top }
        let moved = false
        let rafPending = false
        let latestX = e.clientX
        let latestY = e.clientY
        let lastX = e.clientX
        try { el.setPointerCapture(e.pointerId) } catch (_) {}
        manualUntil = 0
        isDragging = true
        setDragging(true)

        const move = (ev) => {
          latestX = ev.clientX
          latestY = ev.clientY
          if (rafPending) return
          rafPending = true
          requestAnimationFrame(() => {
            rafPending = false
            const dx = latestX - start.x
            const dy = latestY - start.y
            if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true
            if (moved) {
              setPos({ left: start.left + dx, top: start.top + dy })
              // Walk by the LATEST tick's horizontal delta — not the total
              // offset from the drag start — so reversing direction mid-drag
              // flips the walk immediately.
              const deltaX = latestX - lastX
              if (deltaX < -1) setAnim('runningLeft')
              else if (deltaX > 1) setAnim('runningRight')
              lastX = latestX
            }
          })
        }

        const end = () => {
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerup', end)
          el.removeEventListener('pointercancel', end)
          isDragging = false
          setDragging(false)
          if (!moved) {
            manualUntil = Date.now() + 1500
            setAnim('jumping')
            setFrame(0)
          }
        }

        el.addEventListener('pointermove', move)
        el.addEventListener('pointerup', end)
        el.addEventListener('pointercancel', end)
      }

      const bgStyle = {
        backgroundImage: 'url("' + sprite + '")',
        backgroundSize: (COLS * 100) + '% ' + (ROWS * 100) + '%',
        backgroundPosition:
          (frame * 100 / (COLS - 1)) + '% ' +
          (ANIMS[anim].row * 100 / (ROWS - 1)) + '%',
      }

      const positionStyle = pos
        ? { left: Math.round(pos.left) + 'px', top: Math.round(pos.top) + 'px' }
        : { right: '18px', bottom: '18px' }

      return React.createElement(
        'div',
        {
          className: 'silverhand-pet' + (dragging ? ' silverhand-pet--dragging' : ''),
          title: 'Silverhand · ' + anim + ' — 拖动移动，点击跳跃',
          style: positionStyle,
          onPointerDown: onPointerDown,
        },
        React.createElement('div', { className: 'silverhand-pet__sprite', style: bgStyle }),
        React.createElement('div', { className: 'silverhand-pet__bubble' }, anim),
      )
    }

    ctx.slots.inject('shell.overlay', () =>
      ctx.slots.register(
        { name: 'shell.overlay', id: 'silverhand-pet', order: 100, label: 'Silverhand' },
        SilverhandPet,
      ),
    )

    return disposeStyles
  },
}
