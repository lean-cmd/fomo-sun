import Link from 'next/link'

type ContentPageHeaderProps = {
  section: 'Blog' | 'About'
}

export default function ContentPageHeader({ section }: ContentPageHeaderProps) {
  const rightHref = section === 'Blog' ? '/about' : '/blog'
  const rightLabel = section === 'Blog' ? 'About' : 'Blog'

  return (
    <header className="fomo-page-header sticky top-0 z-40 backdrop-blur">
      <div className="max-w-3xl mx-auto px-3 h-[62px] grid grid-cols-[1fr_auto_1fr] items-center">
        <div className="min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 transition hover:text-slate-900"
          >
            ← Back to app
          </Link>
        </div>

        <div className="justify-self-center text-center leading-none">
          <p className="fomo-font-display text-[17px] font-semibold tracking-[0.03em] text-slate-900">FOMO Sun</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.13em] text-slate-500">{section}</p>
        </div>

        <div className="flex justify-end">
          <Link
            href={rightHref}
            className="text-[11px] font-medium text-slate-500 transition hover:text-slate-800"
          >
            {rightLabel}
          </Link>
        </div>
      </div>
    </header>
  )
}
