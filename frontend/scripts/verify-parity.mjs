import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyRerun } from '../src/lib/rerun.ts'

const here = dirname(fileURLToPath(import.meta.url))
const base = (process.argv[2] ?? process.env.API_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '')

const fixtureBoard = JSON.parse(
  readFileSync(resolve(here, '../src/mocks/fixtures/board.json'), 'utf8'),
)
const fixtureExtract = JSON.parse(
  readFileSync(resolve(here, '../src/mocks/fixtures/extract_response.json'), 'utf8'),
)

const failures = []

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ok    ${name}`)
  } else {
    failures.push(`${name}${detail === '' ? '' : ` — ${detail}`}`)
    console.error(`  FAIL  ${name}${detail === '' ? '' : `\n        ${detail}`}`)
  }
}

async function postJson(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`POST ${base}${path} → ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function assertBoardShape(board, label) {
  check(`${label}: snapshot`, isObject(board?.snapshot) && typeof board.snapshot.hash === 'string')
  check(`${label}: kpi_contract`, isObject(board?.kpi_contract))
  check(
    `${label}: diagnostics`,
    isObject(board?.diagnostics) && Array.isArray(board.diagnostics.loss_cells),
  )
  check(
    `${label}: hypotheses`,
    Array.isArray(board?.hypotheses) && board.hypotheses.length > 0,
    `got ${board?.hypotheses?.length ?? 'none'}`,
  )
  for (const hyp of board?.hypotheses ?? []) {
    const range = hyp?.economic_effect?.value_usd_range
    const ok =
      typeof hyp?.id === 'string' &&
      typeof hyp?.rank === 'number' &&
      typeof hyp?.score_total === 'number' &&
      isObject(hyp?.score_breakdown) &&
      Array.isArray(range) &&
      range.length === 2 &&
      range.every((n) => typeof n === 'number')
    if (!ok) {
      check(
        `${label}: hypothesis ${hyp?.id ?? '?'} shape`,
        false,
        JSON.stringify(hyp).slice(0, 200),
      )
    }
  }
}

function mid(hyp) {
  const [lo, hi] = hyp.economic_effect.value_usd_range
  return (lo + hi) / 2
}

function magnitude(value) {
  return value > 0 ? Math.floor(Math.log10(value)) : -Infinity
}

function closeTo(a, b) {
  return Math.abs(a - b) <= Math.max(1, Math.abs(b) * 1e-6)
}

function diffRanges(label, expected, actual) {
  const rows = []
  for (const hyp of expected.hypotheses) {
    const other = actual.hypotheses.find((h) => h.id === hyp.id)
    const [elo, ehi] = hyp.economic_effect.value_usd_range
    const [alo, ahi] = other?.economic_effect.value_usd_range ?? [NaN, NaN]
    if (!closeTo(alo, elo) || !closeTo(ahi, ehi)) {
      rows.push(`    ${hyp.id}: expected [${elo}, ${ehi}]  got [${alo}, ${ahi}]`)
    }
  }
  check(label, rows.length === 0, rows.length === 0 ? '' : `\n${rows.join('\n')}`)
}

console.log(`verify-parity против ${base}\n`)

console.log('1. POST /run {factory_id: "kgmk"}')
const run = await postJson('/run', { factory_id: 'kgmk', pack_id: 'flotation-v1' })
check('run_id', typeof run.run_id === 'string' && run.run_id.length > 0)
assertBoardShape(run.board, 'board')

const fixtureTop = fixtureBoard.hypotheses.find((h) => h.rank === 1)
const liveTop = run.board.hypotheses.find((h) => h.rank === 1)
check(
  'топ-гипотеза совпадает с фикстурой',
  liveTop?.id === fixtureTop?.id,
  `fixture ${fixtureTop?.id}, backend ${liveTop?.id}`,
)
check(
  'порядок величины value топ-гипотезы',
  liveTop !== undefined && magnitude(mid(liveTop)) === magnitude(mid(fixtureTop)),
  `fixture ~1e${magnitude(mid(fixtureTop))}, backend ~1e${liveTop === undefined ? '?' : magnitude(mid(liveTop))}`,
)

console.log('\n2. POST /rerun change_price ×2')
const price = run.board.kpi_contract.prices_usd_per_t.element_28
const action = { kind: 'change_price', payload: { element: 'element_28', usd_per_t: price * 2 } }
const rerunBoard = await postJson('/rerun', { run_id: run.run_id, action })
assertBoardShape(rerunBoard, 'rerun board')
check(
  'snapshot.hash не изменился',
  rerunBoard.snapshot.hash === run.board.snapshot.hash,
  `${run.board.snapshot.hash} → ${rerunBoard.snapshot.hash}`,
)
for (const before of run.board.hypotheses) {
  const after = rerunBoard.hypotheses.find((h) => h.id === before.id)
  const [blo, bhi] = before.economic_effect.value_usd_range
  const [alo, ahi] = after?.economic_effect.value_usd_range ?? [NaN, NaN]
  if (before.economic_effect.addressable_tons.element_28 !== undefined) {
    check(
      `${before.id}: value_usd_range ×2`,
      closeTo(alo, blo * 2) && closeTo(ahi, bhi * 2),
      `[${blo}, ${bhi}] ×2 ждали [${blo * 2}, ${bhi * 2}], получили [${alo}, ${ahi}]`,
    )
  } else {
    check(
      `${before.id}: value_usd_range без element_28 не изменился`,
      closeTo(alo, blo) && closeTo(ahi, bhi),
      `[${blo}, ${bhi}] → [${alo}, ${ahi}]`,
    )
  }
}

console.log('\n3. Паритет с локальным applyRerun')
const local = applyRerun(run.board, fixtureExtract, action)
diffRanges('value_usd_range: backend == applyRerun', local, rerunBoard)

console.log('')
if (failures.length > 0) {
  console.error(`ПАРИТЕТ НАРУШЕН: ${failures.length} расхождений — бага одного из краёв.`)
  process.exit(1)
}
console.log('Паритет фикстура == бэк подтверждён.')
