import NotionContent from '@/components/notion-content'
import { getAboutPage, isNotionConfigured } from '@/lib/notion-cms'
import { Card } from '@/components/ui'
import ContentPageHeader from '@/components/ContentPageHeader'

export const revalidate = 300

export default async function AboutPage() {
  let content: JSX.Element

  if (!isNotionConfigured()) {
    content = (
      <Card tone="warning" className="max-w-3xl mx-auto px-4 py-3 text-amber-900 text-sm">
        Notion CMS is not configured. Add `NOTION_TOKEN` in your secure environment to load About content.
      </Card>
    )
  } else {
    const about = await getAboutPage()

    if (!about) {
      content = (
        <Card className="max-w-3xl mx-auto px-4 py-6 text-slate-600 text-sm">
          About page could not be loaded from Notion.
        </Card>
      )
    } else {
      content = (
        <Card className="max-w-3xl mx-auto px-5 py-7 sm:px-8 sm:py-9">
          <header className="mb-7">
            <p className="text-[12px] uppercase tracking-[1.4px] text-slate-500 font-semibold">About</p>
            <h1 className="fomo-font-display text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 leading-tight">
              {about.title}
            </h1>
          </header>
          <NotionContent blocks={about.blocks} />
        </Card>
      )
    }
  }

  return (
    <div className="min-h-screen fomo-warm-bg fomo-grid-bg">
      <ContentPageHeader section="About" />
      <main className="px-4 py-8 sm:px-6">
        {content}
      </main>
    </div>
  )
}
