import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FileSpreadsheet, Play } from 'lucide-react'
import type { Element } from '@/contracts.ts'
import { Button } from '@/components/Button/Button.tsx'
import { Select } from '@/components/Select/Select.tsx'
import { Panel } from '@/components/Panel/Panel.tsx'
import { useLocale } from '@/i18n/index.tsx'
import { useFactory } from '@/app/factory.tsx'
import type { RunParams } from '@/app/run.tsx'
import {
  DEFAULT_PRICE_USD_PER_T,
  ELEMENTS,
  FACTORY_ORDER,
  FACTORY_REPORT_FILE,
  MAX_CAPEX_CLASS,
  toElement,
  toFactoryId,
} from '@/lib/domain.ts'
import styles from './SetupView.module.css'

export function SetupView() {
  const { t } = useLocale()
  const { factory, setFactory } = useFactory()
  const navigate = useNavigate()

  const [element, setElement] = useState<Element>('element_28')
  const [price, setPrice] = useState<number>(DEFAULT_PRICE_USD_PER_T.element_28)
  const [capexLimit, setCapexLimit] = useState<number>(MAX_CAPEX_CLASS)

  const factoryOptions = FACTORY_ORDER.map((f) => ({ value: f, label: t.factory.names[f] }))
  const elementOptions = ELEMENTS.map((e) => ({ value: e, label: t.elements[e] }))
  const capexOptions = Array.from({ length: MAX_CAPEX_CLASS }, (_, i) => i + 1).map((c) => ({
    value: String(c),
    label: t.capexClasses[c] ?? String(c),
  }))

  const handleElement = (value: string) => {
    const el = toElement(value)
    setElement(el)
    setPrice(DEFAULT_PRICE_USD_PER_T[el])
  }

  const handleRun = () => {
    void navigate('/run', { state: { element, price, capexLimit } satisfies RunParams })
  }

  return (
    <div className={styles.screen}>
      <Panel className={styles.card}>
        <h2 className={styles.heading}>{t.setup.heading}</h2>

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>{t.setup.factoryField}</span>
            <Select
              value={factory}
              options={factoryOptions}
              onChange={(v) => setFactory(toFactoryId(v))}
              ariaLabel={t.setup.factoryField}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.label}>{t.setup.reportFile}</span>
            <div className={styles.file}>
              <FileSpreadsheet size={18} aria-hidden="true" className={styles.fileIcon} />
              <span className={styles.fileName}>{FACTORY_REPORT_FILE[factory]}</span>
            </div>
            <span className={styles.hint}>{t.setup.reportFileHint}</span>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>{t.setup.targetElement}</span>
            <Select
              value={element}
              options={elementOptions}
              onChange={handleElement}
              ariaLabel={t.setup.targetElement}
            />
            <span className={styles.hint}>{t.setup.directionDecrease}</span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t.setup.price}</span>
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

          <label className={styles.field}>
            <span className={styles.label}>{t.setup.capexLimit}</span>
            <Select
              value={String(capexLimit)}
              options={capexOptions}
              onChange={(v) => setCapexLimit(Number(v))}
              ariaLabel={t.setup.capexLimit}
            />
          </label>
        </div>

        <div className={styles.actions}>
          <Button variant="primary" onClick={handleRun} className={styles.runButton}>
            <Play size={16} aria-hidden="true" /> {t.setup.run}
          </Button>
          <span className={styles.runHint}>{t.setup.runHint}</span>
        </div>
      </Panel>
    </div>
  )
}
