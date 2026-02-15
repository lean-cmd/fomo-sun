import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import NotionContent from '@/components/notion-content'
import { getBlogPostBySlug, isNotionConfigured } from '@/lib/notion-cms'

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
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="max-w-3xl mx-auto rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
          Notion CMS is not configured. Add `NOTION_TOKEN` in your secure environment to load post content.
        </div>
      </main>
    )
  }

  const post = await getBlogPostBySlug(params.slug)
  if (!post) notFound()

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <article className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white px-5 py-7 sm:px-8 sm:py-9">
        <Link href="/blog" className="text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">
          ← Back to blog
        </Link>

        <header className="mt-4 mb-7">
          <p className="text-[12px] text-slate-500 font-medium">
            {formatDate(post.meta.publishDate)}
            {post.meta.wordCount ? ` · ${post.meta.wordCount} words` : ''}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 leading-tight" style={{ fontFamily: 'Sora' }}>
            {post.meta.title}
          </h1>
          {post.meta.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.meta.tags.map(tag => (
                <span key={tag} className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <NotionContent blocks={post.blocks} />
      </article>
    </main>
  )
}
