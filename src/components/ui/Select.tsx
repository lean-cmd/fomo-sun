import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from '@/components/ui/cx'

type SelectProps = ComponentPropsWithoutRef<'select'> & {
  icon?: ReactNode
  shellClassName?: string
}

export function Select({ className, shellClassName, icon, children, ...props }: SelectProps) {
  return (
    <label className={cx('relative inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] text-[var(--muted)]', shellClassName)}>
      {icon}
      <select className={cx('bg-transparent focus:outline-none pr-4', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
    </label>
  )
}
