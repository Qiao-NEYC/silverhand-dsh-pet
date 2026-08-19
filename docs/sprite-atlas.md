# Silverhand Sprite Atlas

The pet is rendered from a single WebP **sprite atlas** migrated from the
Codex pet format. This document records the exact layout so the animation
mapping in `src/client.js` stays easy to audit and adjust.

## Source

- Migrated from `~/.codex/pets/silverhand/` (Codex V1 pet format).
- `assets/pet.json` — the original Codex manifest.
- `assets/spritesheet.webp` — the atlas (1,059,544 bytes, RGBA, transparent background).

## Geometry

| Property | Value |
| --- | --- |
| Format | WebP (RGBA, alpha) |
| Total size | 1536 × 1872 px |
| Grid | 8 columns × 9 rows |
| Cell | 192 × 208 px |
| Version | Codex **V1** (9 rows — no look-direction rows) |

## Rows

The atlas has 9 animation rows. Frame counts below were measured from the
actual non-transparent cells (see `scripts/analyze_frames.py`).

| Row | State | Frames (columns) | Cadence (ms/frame) |
| --- | --- | ---: | ---: |
| 0 | `idle` | 6 (0–5) | 220 |
| 1 | `running-right` | 8 (0–7) | 120 |
| 2 | `running-left` | 8 (0–7) | 120 |
| 3 | `waving` | 8 (0–7) | 160 |
| 4 | `jumping` | 8 (0–7) | 140 |
| 5 | `failed` | 8 (0–7) | 160 |
| 6 | `waiting` | 6 (0–5) | 180 |
| 7 | `running` | 8 (0–7) | 120 |
| 8 | `review` | 8 (0–7) | 160 |

> Rows 1 and 2 (`running-right` / `running-left`) are locomotion: the pet
> walks in the horizontal direction you drag it. The agent's *working* state
> maps to row 7 (`running` — "active task work") rather than literal
> foot-running.

## CSS mapping

The Client renders the atlas as a `background-image` on a `144 × 156` px div:

- `background-size: 800% 900%` (8 columns wide, 9 rows tall).
- `background-position: (col·100/7)% (row·100/8)%` selects one 192×208 cell.

## Agent state → animation

The Host derives a state string from agent lifecycle events; the Client maps it
to an animation row.

| Host state | Animation | Trigger (Host event) |
| --- | --- | --- |
| `idle` | `idle` | default; no agent running (`agent/status` → idle) |
| `running` | `running` | any agent running (`agent/status` → running) |
| `review` | `review` | a tool result just landed (`tools/result`) |
| `failed` | `failed` | a step/turn errored (`agent/error`) |
| `waving` | `waving` | an agent was created / session started |
| `jumping` | `jumping` | a running→idle transition (task finished) |
| `waiting` | `waiting` | an approval request is open (`approval/request`) |

Interaction (Client-side, independent of agent state):

| Gesture | Animation |
| --- | --- |
| Drag left | `running-left` (row 2) |
| Drag right | `running-right` (row 1) |
| Click (no movement) | `jumping` (row 4) |

Hovering shows the current state name in a small bubble.
