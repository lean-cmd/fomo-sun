import Link from 'next/link'
import NotionContent from '@/components/notion-content'
import { getAboutPage, isNotionConfigured } from '@/lib/notion-cms'

export const revalidate = 300

export default async function AboutPage() {
  if (!isNotionConfigured()) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="max-w-3xl mx-auto rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
          Notion CMS is not configured. Add `NOTION_TOKEN` in your secure environment to load About content.
        </div>
      </main>
    )
  }

  const about = await getAboutPage()

  if (!about) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="max-w-3xl mx-auto rounded-xl border border-slate-200 bg-white px-4 py-6 text-slate-600 text-sm">
          About page could not be loaded from Notion.
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <article className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white px-5 py-7 sm:px-8 sm:py-9">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">
          ← Back to app
        </Link>
        <header className="mt-4 mb-7">
          <p className="text-[11px] uppercase tracking-[1.4px] text-slate-500 font-semibold">About</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 leading-tight" style={{ fontFamily: 'Sora' }}>
            {about.title}
          </h1>
        </header>
        <NotionContent blocks={about.blocks} />
      </article>
    </main>
  )
}
