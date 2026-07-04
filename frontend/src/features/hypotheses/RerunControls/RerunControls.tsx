import { useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  Element,
  ExtractResponse,
  KpiContract,
  ParseConstraintsResponse,
  RerunAction,
} from '@/contracts.ts'
import { Button } from '@/components/Button/Button.tsx'
import { Select } from '@/components/Select/Select.tsx'
import type { SelectOption } from '@/components/Select/Select.tsx'
import { useT } from '@/i18n/index.tsx'
import { ELEMENTS, toElement } from '@/lib/domain.ts'
import { PACK_WEIGHTS } from '@/lib/score.ts'
import styles from './RerunControls.module.css'

interface RerunControlsProps {
  extract: ExtractResponse
  contract: KpiContract
  pending: boolean
  onApply: (actions: RerunAction[]) => void
  onParseText: (text: string) => Promise<ParseConstraintsResponse>
  onReset: () => void
}

export function RerunControls({
  extract,
  contract,
  pending,
  onApply,
  onParseText,
  onReset,
}: RerunControlsProps) {
  const t = useT()
  const factors = extract.entities.filter((n) => n.tags.includes('controllable'))
  const excluded = contract.excluded_factors ?? []
  const currentCostWeight = contract.weights_override?.cost ?? PACK_WEIGHTS.cost

  const [factorId, setFactorId] = useState('')
  const [costWeight, setCostWeight] = useState(currentCostWeight)
  const [element, setElement] = useState<Element>('element_28')
  const [price, setPrice] = useState(contract.prices_usd_per_t.element_28)
  const [textConstraint, setTextConstraint] = useState('')
  const [parseResult, setParseResult] = useState<ParseConstraintsResponse | null>(null)
  const [parseError, setParseError] = useState('')

  const currentPrice = contract.prices_usd_per_t[element]

  const factorOptions: SelectOption[] = [
    { value: '', label: t.board.noExclusion },
    ...factors.map((f) => ({ value: f.id, label: f.label, disabled: excluded.includes(f.id) })),
  ]

  const elementOptions: SelectOption[] = ELEMENTS.map((el) => ({
    value: el,
    label: t.elements[el],
  }))

  const handleElementChange = (value: string) => {
    const next = toElement(value)
    setElement(next)
    setPrice(contract.prices_usd_per_t[next])
  }

  const handleApply = () => {
    const actions: RerunAction[] = []
    if (factorId !== '') {
      actions.push({ kind: 'exclude_factor', payload: { factor_id: factorId } })
    }
    if (costWeight !== currentCostWeight) {
      actions.push({ kind: 'change_weight', payload: { dimension: 'cost', value: costWeight } })
    }
    if (price !== currentPrice) {
      actions.push({ kind: 'change_price', payload: { element, usd_per_t: price } })
    }
    if (actions.length > 0) {
      onApply(actions)
      setFactorId('')
    }
  }

  const handleTextApply = () => {
    const text = textConstraint.trim()
    if (text.length === 0) {
      return
    }
    setParseError('')
    void onParseText(text)
      .then((result) => {
        setParseResult(result)
        if (result.actions.length > 0) {
          onApply(result.actions)
        }
      })
      .catch((err: unknown) => {
        setParseResult(null)
        setParseError(err instanceof Error ? err.message : String(err))
      })
  }

  return (
    <div className={styles.controls}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t.board.rerunTitle}</h3>
      </div>
      <div className={styles.row}>
        <label className={styles.control}>
          <span className={styles.label}>{t.board.excludeFactor}</span>
          <Select
            className={styles.select}
            value={factorId}
            options={factorOptions}
            onChange={setFactorId}
            ariaLabel={t.board.excludeFactor}
          />
        </label>

        <label className={styles.control}>
          <span className={styles.label}>
            {t.board.costWeight}: <b>{costWeight.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.05}
            value={costWeight}
            onChange={(e) => setCostWeight(Number(e.target.value))}
            className={styles.slider}
            style={{ '--fill': `${(costWeight / 0.5) * 100}%` } as CSSProperties}
          />
        </label>

        <label className={styles.control}>
          <span className={styles.label}>{t.board.priceElement}</span>
          <Select
            className={styles.select}
            value={element}
            options={elementOptions}
            onChange={handleElementChange}
            ariaLabel={t.board.priceElement}
          />
        </label>

        <label className={styles.control}>
          <span className={styles.label}>{t.board.price}</span>
          <input
            type="number"
            min={0}
            step={100}
            value={price}
            onChange={(e) => {
              const next = Number(e.target.value)
              setPrice(Number.isFinite(next) && next >= 0 ? next : 0)
            }}
            className={styles.number}
          />
        </label>

        <div className={styles.actions}>
          <Button variant="primary" onClick={handleApply} disabled={pending}>
            {t.board.apply}
          </Button>
          <Button variant="ghost" onClick={onReset} disabled={pending}>
            {t.board.reset}
          </Button>
        </div>
      </div>
      <div className={styles.textRow}>
        <label className={styles.textControl}>
          <span className={styles.label}>{t.board.textConstraint}</span>
          <textarea
            className={styles.textarea}
            value={textConstraint}
            rows={2}
            placeholder={t.board.textConstraintPlaceholder}
            onChange={(e) => setTextConstraint(e.target.value)}
          />
        </label>
        <Button variant="secondary" onClick={handleTextApply} disabled={pending}>
          {t.board.applyTextConstraint}
        </Button>
      </div>
      {(parseResult !== null || parseError.length > 0) && (
        <div className={styles.parseResult}>
          {parseResult !== null && parseResult.actions.length > 0 && (
            <span>
              {t.board.parsedActions}: {parseResult.actions.map((a) => a.kind).join(', ')}
            </span>
          )}
          {parseResult !== null && parseResult.unparsed.length > 0 && (
            <span>
              {t.board.unparsedConstraint}: {parseResult.unparsed.join(', ')}
            </span>
          )}
          {parseError.length > 0 && <span>{parseError}</span>}
        </div>
      )}
    </div>
  )
}
