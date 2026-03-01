import Link from 'next/link'
import NotionContent from '@/components/notion-content'
import { getAboutPage, isNotionConfigured } from '@/lib/notion-cms'
import { Card } from '@/components/ui'

export const revalidate = 300

export default async function AboutPage() {
  if (!isNotionConfigured()) {
    return (
      <main className="min-h-screen fomo-warm-bg fomo-grid-bg px-4 py-10 sm:px-6">
        <Card tone="warning" className="max-w-3xl mx-auto px-4 py-3 text-amber-900 text-sm">
          Notion CMS is not configured. Add `NOTION_TOKEN` in your secure environment to load About content.
        </Card>
      </main>
    )
  }

  const about = await getAboutPage()

  if (!about) {
    return (
      <main className="min-h-screen fomo-warm-bg fomo-grid-bg px-4 py-10 sm:px-6">
        <Card className="max-w-3xl mx-auto px-4 py-6 text-slate-600 text-sm">
          About page could not be loaded from Notion.
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen fomo-warm-bg fomo-grid-bg px-4 py-10 sm:px-6">
      <Card className="max-w-3xl mx-auto px-5 py-7 sm:px-8 sm:py-9">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">
          ← Back to app
        </Link>
        <header className="mt-4 mb-7">
          <p className="text-[12px] uppercase tracking-[1.4px] text-slate-500 font-semibold">About</p>
          <h1 className="fomo-font-display text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 leading-tight">
            {about.title}
          </h1>
        </header>
        <NotionContent blocks={about.blocks} />
      </Card>
    </main>
  )
}
