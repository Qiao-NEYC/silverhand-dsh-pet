// Regenerates the embedded sprite atlas inside src/host.js from
// assets/spritesheet.webp, so the plugin is fully self-contained (no
// filesystem path needed at runtime).
//
// Usage:  node scripts/embed-sprite.js
//
// Run this whenever assets/spritesheet.webp changes, then commit src/host.js.
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SPRITE = path.join(ROOT, 'assets', 'spritesheet.webp')
const HOST = path.join(ROOT, 'src', 'host.js')
const WRAP = 100 // base64 chars per line

const START = '// --- BEGIN EMBEDDED SPRITE (generated) ---'
const END = '// --- END EMBEDDED SPRITE ---'

const b64 = fs.readFileSync(SPRITE).toString('base64')
const lines = []
for (let i = 0; i < b64.length; i += WRAP) lines.push(b64.slice(i, i + WRAP))
const embedded = 'const SPRITE_B64 = `' + lines.join('\n') + '`'

const host = fs.readFileSync(HOST, 'utf8')
const i1 = host.indexOf(START)
const i2 = host.indexOf(END)
if (i1 < 0 || i2 < 0 || i2 <= i1) {
  console.error('markers not found in src/host.js')
  process.exit(1)
}
const updated =
  host.slice(0, i1 + START.length) + '\n' + embedded + '\n' + host.slice(i2)
fs.writeFileSync(HOST, updated)
console.log(
  `embedded ${b64.length} base64 chars (${lines.length} lines) into src/host.js`,
)
