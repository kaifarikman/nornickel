import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cx } from '@/lib/cx.ts'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  ariaLabel?: string
  className?: string
}

export function Select({ value, options, onChange, ariaLabel, className }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : options[0]

  useEffect(() => {
    if (!open) {
      return
    }
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, selectedIndex])

  const commit = (index: number) => {
    const option = options[index]
    if (option === undefined || option.disabled === true) {
      return
    }
    onChange(option.value)
    setOpen(false)
  }

  const step = (delta: number) => {
    let next = activeIndex
    for (let i = 0; i < options.length; i += 1) {
      next = (next + delta + options.length) % options.length
      if (options[next]?.disabled !== true) {
        break
      }
    }
    setActiveIndex(next)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      step(-1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      commit(activeIndex)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      <button
        type="button"
        role="combobox"
        className={cx(styles.trigger, open && styles.triggerOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className={styles.value}>{selected?.label}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cx(styles.chevron, open && styles.chevronOpen)}
        />
      </button>
      {open && (
        <ul className={styles.list} role="listbox" id={listId} aria-label={ariaLabel}>
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled === true}
              className={cx(
                styles.option,
                index === activeIndex && styles.optionActive,
                option.disabled === true && styles.optionDisabled,
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(index)
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={14} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
