import type { ButtonHTMLAttributes } from 'react'
import { cx } from '@/lib/cx.ts'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ variant = 'secondary', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'ghost' && styles.ghost,
        className,
      )}
      {...rest}
    />
  )
}
