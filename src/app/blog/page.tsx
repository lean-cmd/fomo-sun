import Link from 'next/link'
import { listBlogPosts, isNotionConfigured } from '@/lib/notion-cms'

export const revalidate = 300

function formatDate(value: string | null) {
  if (!value) return 'Unscheduled'
  return new Date(value).toLocaleDateString('en-CH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function BlogIndexPage() {
  const configured = isNotionConfigured()
  const posts = configured ? await listBlogPosts() : []

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <p className="text-[11px] uppercase tracking-[1.4px] text-slate-500 font-semibold">FOMO Sun</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2" style={{ fontFamily: 'Sora' }}>
            Build in public
          </h1>
          <p className="text-slate-600 mt-3 text-[16px] leading-7">
            Product notes, release updates, and architecture decisions behind fomosun.com.
          </p>
        </header>

        {!configured && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
            Notion CMS is not configured. Add `NOTION_TOKEN` in your secure environment to load blog content.
          </div>
        )}

        {configured && posts.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-slate-600 text-sm">
            No blog posts are currently published (`Show on Site = true`).
          </div>
        )}

        <div className="space-y-3">
          {posts.map(post => (
            <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 hover:border-slate-300 transition-colors">
              <p className="text-[11px] text-slate-500 font-medium">
                {formatDate(post.publishDate)}
                {post.wordCount ? ` · ${post.wordCount} words` : ''}
                {post.status ? ` · ${post.status}` : ''}
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900" style={{ fontFamily: 'Sora' }}>
                <Link href={`/blog/${post.slug}`} className="hover:text-amber-600 transition-colors">
                  {post.title}
                </Link>
              </h2>
              <p className="text-[15px] text-slate-600 mt-2 leading-7">{post.excerpt}</p>
              {post.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {post.tags.map(tag => (
                    <span key={tag} className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
