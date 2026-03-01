import type { ButtonHTMLAttributes } from 'react'
import { cx } from '@/components/ui/cx'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'neutral' | 'primary' | 'ghost'
  size?: 'sm' | 'md'
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  neutral: 'border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] hover:border-slate-300',
  primary: 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
  ghost: 'border border-transparent bg-transparent text-[var(--muted)] hover:text-[var(--text)]',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-7 px-2 text-[10px]',
  md: 'h-8 px-2.5 text-[11px]',
}

export function Button({ className, variant = 'neutral', size = 'md', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('inline-flex items-center gap-1.5 rounded-lg font-medium transition', sizeClasses[size], variantClasses[variant], className)}
      {...props}
    />
  )
}
