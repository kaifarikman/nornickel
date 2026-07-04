import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const docsRoot = resolve(here, '../../docs')
const dest = resolve(here, '../src/mocks/fixtures')

const MAP = [
  ['fixtures/board.json', 'board.json'],
  ['fixtures/extract_response.json', 'extract_response.json'],
  ['fixtures/diagnostics_kgmk.json', 'diagnostics_kgmk.json'],
  ['fixtures/diagnostics_nof_vkr.json', 'diagnostics_nof_vkr.json'],
  ['fixtures/diagnostics_nof_med.json', 'diagnostics_nof_med.json'],
  ['fixtures/diagnostics_tof.json', 'diagnostics_tof.json'],
  ['golden/expert_hypotheses.json', 'expert_hypotheses.json'],
]

mkdirSync(dest, { recursive: true })

let copied = 0
for (const [from, to] of MAP) {
  const src = resolve(docsRoot, from)
  if (!existsSync(src)) {
    console.error(`[sync:fixtures] missing source: ${src}`)
    process.exit(1)
  }
  copyFileSync(src, resolve(dest, to))
  copied += 1
}

console.log(`[sync:fixtures] copied ${copied} fixtures from ${docsRoot} → ${dest}`)
