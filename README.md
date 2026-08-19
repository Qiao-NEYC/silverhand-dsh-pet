# Silverhand — DSH Desktop Pet

A desktop pet for the **DeepSeek Harness** Web GUI. Silverhand (a cyberpunk
mercenary with a silver cybernetic arm) lives in the bottom-right corner and
reacts to what the agent is doing — idle breathing, active work, reviewing
output, waving hello, celebrating a finished turn, sulking on an error, and
waiting for your approval.

The character artwork is migrated **as-is** from the Codex pet format — no
redesign, just the original `spritesheet.webp` + `pet.json`.

## Features

- Renders in the frame-wide `shell.overlay` layer, fixed to the bottom-right.
- Click-through by default (only the pet itself is interactive).
- Reacts to real agent state, driven by DSH host events:
  - `idle` / `running` from `agent/status`
  - `review` from `tools/result`
  - `failed` from `agent/error`
  - `waving` from `agent/created` / `agent/session-start`
  - `jumping` when a turn finishes (`running` → `idle`)
  - `waiting` while an approval request is open (`approval/request`)
- Drag the pet to move it — it walks left/right in the drag direction.
- Hover to see the current state; click (no movement) to make it jump.
- The sprite atlas is embedded directly in `src/host.js`, so the plugin is
  fully self-contained — clone it anywhere and it works with zero config.

## Layout

```
Silverhand/
├── README.md
├── LICENSE
├── .gitignore
├── package.json
├── assets/
│   ├── pet.json            # migrated Codex manifest
│   └── spritesheet.webp    # migrated sprite atlas (8×9, 192×208 cells)
├── src/
│   ├── host.js             # DSH host half (asset + state)
│   └── client.js           # DSH client half (renderer)
├── scripts/
│   ├── embed-sprite.js     # regenerate the embedded atlas in src/host.js
│   ├── analyze_frames.py   # measure per-row frame counts / diffs
│   └── contact_sheet.py    # render a labeled contact sheet
└── docs/
    └── sprite-atlas.md     # atlas layout + state mapping
```

## Anatomy

A DSH plugin is a Cordis plugin split into two halves:

- **Host** (`src/host.js`) runs in the DSH Node process. It embeds the sprite
  atlas as base64 (no filesystem path), serves it over HTTP (with a data-URI
  fallback), and derives the pet state from agent events. It exposes two
  package-private RPC methods: `getState` and `getSprite`.
- **Client** (`src/client.js`) runs in the browser. It registers into
  `shell.overlay`, renders the sprite, and polls `getState` every 300 ms,
  animating the matching atlas row.

The two halves communicate over the package-private RPC (`harness.handle` on
the Host, `host.call` on the Client).

## Run it (dynamic package)

The quickest way to try it is the DSH dynamic-plugin mechanism. In a DSH
session, load the two source files and pass their contents as `code.host` /
`code.client` to `cordis_define`, then `cordis_run`.

> No setup needed: the sprite is embedded in `src/host.js`, so both halves
> work straight out of the box on any machine.

## Persistent install

A dynamic package does not survive a process restart. To install permanently,
copy the plugin into a preset composition:

1. Copy this repo into a stable location (e.g. keep it where it is).
2. Add the two halves as plugin rows in a `cordis.yml` composition — one row
   for the host half, one for the client half — pointing at `src/host.js` and
   `src/client.js`, or inline their bodies.
3. Mount that preset for the sessions that should show the pet.

See the DSH composition docs for the exact `cordis.yml` schema for your
deployment. The `inject` declarations matter: the host half needs `webServer`
and `agents`; the client half needs `slots` and `timer`.

## Configuration

All tunables are constants at the top of each half:

- `src/host.js` — `ROUTE_PATH` and the per-state transient durations in the
  event listeners. The sprite is the embedded `SPRITE_B64` block; after
  replacing `assets/spritesheet.webp`, regenerate it with
  `node scripts/embed-sprite.js`.
- `src/client.js` — `ANIMS` (row / frame count / cadence per animation),
  `STATE_ANIM` (state → animation), `PET_W` / `PET_H` (display size), and the
  `CSS` block (position, shadow, hover).

## Asset provenance

The artwork was migrated from the local Codex pet directory
(`~/.codex/pets/silverhand/`). It is **your asset** — before publishing this
repo to GitHub, confirm you hold (or have) the right to redistribute the
`sprite` and the Silverhand likeness. The code in this repository is MIT
licensed; the sprite's licensing is yours to state.

## Development helpers

```bash
# Regenerate the embedded sprite after changing assets/spritesheet.webp
node scripts/embed-sprite.js

# Report per-row opaque-cell counts and consecutive-frame deltas
python scripts/analyze_frames.py

# Render a labeled contact sheet (full + zoomed ambiguous rows)
python scripts/contact_sheet.py
```

`analyze_frames.py` / `contact_sheet.py` require Python 3 with `Pillow` and
`numpy`.
