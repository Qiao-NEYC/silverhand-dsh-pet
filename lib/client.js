// Silverhand desktop pet — DSH client half (installable browser module).
//
// Runs as a plain browser module (NOT the dynamic sandbox), so it can use
// fetch, setInterval, requestAnimationFrame and document directly. It polls
// the Host's /silverhand-pet/state route and renders the sprite served from
// /silverhand-pet/spritesheet.webp.
window.__ModuleLoader__.load({
  id: "silverhand-dsh-pet",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    const HTTP_URL = '/silverhand-pet/spritesheet.webp'
    const STATE_URL = '/silverhand-pet/state'
    const COLS = 8
    const ROWS = 9

    // Atlas row -> animation (see docs/sprite-atlas.md).
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

    const name = "silverhand-pet"
    const inject = ["slots"]

    function apply(ctx) {
      const style = document.createElement("style")
      style.dataset.silverhand = "1"
      style.textContent = CSS
      document.head.appendChild(style)

      let manualUntil = 0
      let isDragging = false

      function SilverhandPet() {
        const [anim, setAnim] = React.useState('idle')
        const [frame, setFrame] = React.useState(0)
        const [pos, setPos] = React.useState(null)
        const [dragging, setDragging] = React.useState(false)

        // Poll the Host for the derived agent state.
        React.useEffect(() => {
          const poll = () => {
            if (isDragging || Date.now() < manualUntil) return
            fetch(STATE_URL)
              .then((r) => r.json())
              .then((d) => { if (d && d.state) setAnim(STATE_ANIM[d.state] || 'idle') })
              .catch(() => {})
          }
          poll()
          const timer = setInterval(poll, 300)
          return () => clearInterval(timer)
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

        // Drag to move; a press without movement is a click (jump). Walk
        // direction follows the latest tick's horizontal delta.
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
          backgroundImage: 'url("' + HTTP_URL + '")',
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

      return () => style.remove()
    }

    exports.apply = apply
    exports.inject = inject
    exports.name = name
    return module.exports
  }
})
