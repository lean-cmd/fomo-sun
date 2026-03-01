import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '@/components/ui/cx'

type CardProps = ComponentPropsWithoutRef<'div'> & {
  tone?: 'default' | 'muted' | 'warning'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const toneClasses: Record<NonNullable<CardProps['tone']>, string> = {
  default: 'fomo-card border-[var(--border)] bg-[var(--surface)]',
  muted: 'fomo-card border-[var(--border)] bg-[var(--surface-2)]',
  warning: 'fomo-card border-amber-200 bg-amber-50',
}

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

export function Card({ className, tone = 'default', padding = 'none', ...props }: CardProps) {
  return (
    <div
      className={cx(toneClasses[tone], paddingClasses[padding], className)}
      {...props}
    />
  )
}
