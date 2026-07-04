import styles from './FieldHint.module.css'

interface FieldHintProps {
  text: string
}

export function FieldHint({ text }: FieldHintProps) {
  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.trigger} aria-label={text}>
        !
      </button>
      <span role="tooltip" className={styles.tooltip}>
        {text}
      </span>
    </span>
  )
}
