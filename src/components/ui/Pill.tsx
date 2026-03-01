import type { HTMLAttributes } from 'react'
import { cx } from '@/components/ui/cx'

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  active?: boolean
}

export function Pill({ className, active = false, ...props }: PillProps) {
  return (
    <span
      className={cx(
        'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
        active
          ? 'border-amber-300 bg-amber-100 text-amber-800'
          : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]',
        className
      )}
      {...props}
    />
  )
}
