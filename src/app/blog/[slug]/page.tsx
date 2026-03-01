import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import NotionContent from '@/components/notion-content'
import { getBlogPostBySlug, isNotionConfigured } from '@/lib/notion-cms'
import { Card, Pill } from '@/components/ui'
import ContentPageHeader from '@/components/ContentPageHeader'

export const revalidate = 300

type BlogDetailProps = {
  params: { slug: string }
}

function formatDate(value: string | null) {
  if (!value) return 'Unscheduled'
  return new Date(value).toLocaleDateString('en-CH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export async function generateMetadata({ params }: BlogDetailProps): Promise<Metadata> {
  if (!isNotionConfigured()) {
    return {
      title: 'Blog | FOMO Sun',
    }
  }

  const post = await getBlogPostBySlug(params.slug)
  if (!post) {
    return { title: 'Post not found | FOMO Sun' }
  }

  return {
    title: `${post.meta.title} | FOMO Sun`,
    description: post.meta.excerpt,
    openGraph: {
      title: post.meta.title,
      description: post.meta.excerpt,
      type: 'article',
      url: `https://fomosun.com/blog/${post.meta.slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: BlogDetailProps) {
  if (!isNotionConfigured()) {
    return (
      <div className="min-h-screen fomo-warm-bg fomo-grid-bg">
        <ContentPageHeader section="Blog" />
        <main className="px-4 py-8 sm:px-6">
          <Card tone="warning" className="max-w-3xl mx-auto px-4 py-3 text-amber-900 text-sm">
            Notion CMS is not configured. Add `NOTION_TOKEN` in your secure environment to load post content.
          </Card>
        </main>
      </div>
    )
  }

  const post = await getBlogPostBySlug(params.slug)
  if (!post) notFound()

  return (
    <div className="min-h-screen fomo-warm-bg fomo-grid-bg">
      <ContentPageHeader section="Blog" />
      <main className="px-4 py-8 sm:px-6">
      <Card className="max-w-3xl mx-auto px-5 py-7 sm:px-8 sm:py-9">
        <Link href="/blog" className="text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">
          ← Back to blog
        </Link>

        <header className="mt-4 mb-7">
          <p className="text-[12px] text-slate-500 font-medium fomo-font-mono">
            {formatDate(post.meta.publishDate)}
            {post.meta.wordCount ? ` · ${post.meta.wordCount} words` : ''}
          </p>
          <h1 className="fomo-font-display text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 leading-tight">
            {post.meta.title}
          </h1>
          {post.meta.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.meta.tags.map(tag => (
                <Pill key={tag}>
                  {tag}
                </Pill>
              ))}
            </div>
          )}
        </header>

        <NotionContent blocks={post.blocks} />
      </Card>
      </main>
    </div>
  )
}
