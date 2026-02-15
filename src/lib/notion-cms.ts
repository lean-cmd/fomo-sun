const NOTION_API_BASE = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'
const CMS_REVALIDATE_SECONDS = 300

const DEFAULT_BLOG_DB_ID = '74e516e02e41417eaecaf46238b68f9e'
const DEFAULT_ABOUT_PAGE_ID = '308d1a98835a813a8b18f3a0d1cb60ab'

export interface NotionRichText {
  plain_text: string
  href?: string | null
  text?: { content?: string; link?: { url: string } | null }
  annotations?: {
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    underline?: boolean
    code?: boolean
    color?: string
  }
}

export interface NotionBlock {
  id: string
  type: string
  has_children?: boolean
  [key: string]: unknown
  children?: NotionBlock[]
}

interface NotionDatabaseQueryResponse {
  results: NotionPage[]
}

interface NotionBlockChildrenResponse {
  results: NotionBlock[]
  has_more: boolean
  next_cursor: string | null
}

interface NotionPage {
  id: string
  properties: Record<string, NotionProperty>
}

type NotionProperty = {
  type: string
  title?: NotionRichText[]
  rich_text?: NotionRichText[]
  checkbox?: boolean
  date?: { start?: string | null } | null
  multi_select?: Array<{ name: string }>
  select?: { name: string } | null
  number?: number | null
}

export interface BlogPostMeta {
  id: string
  slug: string
  title: string
  publishDate: string | null
  tags: string[]
  status: string | null
  wordCount: number | null
  excerpt: string
}

export interface BlogPostContent {
  meta: BlogPostMeta
  blocks: NotionBlock[]
}

export interface AboutPageContent {
  id: string
  title: string
  blocks: NotionBlock[]
}

function notionToken() {
  return process.env.NOTION_TOKEN || ''
}

function blogDatabaseId() {
  return process.env.NOTION_BLOG_DB_ID || DEFAULT_BLOG_DB_ID
}

function aboutPageId() {
  return process.env.NOTION_ABOUT_PAGE_ID || DEFAULT_ABOUT_PAGE_ID
}

export function isNotionConfigured() {
  return Boolean(notionToken())
}

function readPlainText(rich: NotionRichText[] | undefined) {
  return (rich || []).map(r => r.plain_text || '').join('').trim()
}

function valueAsTitle(property: NotionProperty | undefined) {
  if (!property) return ''
  if (property.type === 'title') return readPlainText(property.title)
  if (property.type === 'rich_text') return readPlainText(property.rich_text)
  return ''
}

function valueAsDate(property: NotionProperty | undefined) {
  if (!property || property.type !== 'date') return null
  return property.date?.start || null
}

function valueAsCheckbox(property: NotionProperty | undefined) {
  if (!property || property.type !== 'checkbox') return false
  return Boolean(property.checkbox)
}

function valueAsMultiSelect(property: NotionProperty | undefined) {
  if (!property || property.type !== 'multi_select') return []
  return (property.multi_select || []).map(v => v.name).filter(Boolean)
}

function valueAsSelect(property: NotionProperty | undefined) {
  if (!property || property.type !== 'select') return null
  return property.select?.name || null
}

function valueAsNumber(property: NotionProperty | undefined) {
  if (!property || property.type !== 'number') return null
  return typeof property.number === 'number' ? property.number : null
}

function normalizeSlug(raw: string, fallbackId: string) {
  const clean = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return clean || fallbackId.replace(/-/g, '')
}

async function notionFetch<T>(path: string, init?: RequestInit, revalidate = CMS_REVALIDATE_SECONDS): Promise<T> {
  const token = notionToken()
  if (!token) {
    throw new Error('NOTION_TOKEN is missing')
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
    ...(init?.headers || {}),
  }

  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    headers,
    next: { revalidate },
  } as RequestInit & { next: { revalidate: number } })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Notion API ${response.status}: ${body}`)
  }

  return response.json() as Promise<T>
}

async function fetchPage(pageId: string) {
  return notionFetch<NotionPage>(`/pages/${pageId}`)
}

async function fetchBlockChildren(
  blockId: string,
  options: { recursive?: boolean; pageSize?: number } = {}
): Promise<NotionBlock[]> {
  const recursive = options.recursive ?? true
  const pageSize = options.pageSize ?? 100
  const collected: NotionBlock[] = []
  let cursor: string | null = null

  do {
    const qs = new URLSearchParams({ page_size: String(pageSize) })
    if (cursor) qs.set('start_cursor', cursor)

    const data = await notionFetch<NotionBlockChildrenResponse>(`/blocks/${blockId}/children?${qs.toString()}`)
    collected.push(...(data.results || []))
    cursor = data.has_more ? data.next_cursor : null
  } while (cursor)

  if (!recursive) return collected

  return Promise.all(
    collected.map(async block => {
      if (!block.has_children) return block
      const children = await fetchBlockChildren(block.id, { recursive: true, pageSize })
      return { ...block, children }
    })
  )
}

function toBlogMeta(page: NotionPage, excerpt: string): BlogPostMeta {
  const title = valueAsTitle(page.properties?.Name)
  const slugRaw = valueAsTitle(page.properties?.Slug)
  const publishDate = valueAsDate(page.properties?.['Publish Date'])
  const tags = valueAsMultiSelect(page.properties?.Tags)
  const status = valueAsSelect(page.properties?.Status)
  const wordCount = valueAsNumber(page.properties?.['Word Count'])

  return {
    id: page.id,
    slug: normalizeSlug(slugRaw, page.id),
    title: title || 'Untitled post',
    publishDate,
    tags,
    status,
    wordCount,
    excerpt,
  }
}

function firstBlockLineText(blocks: NotionBlock[]) {
  for (const block of blocks) {
    const content = block[block.type] as { rich_text?: NotionRichText[] } | undefined
    const line = readPlainText(content?.rich_text)
    if (line) return line
  }
  return ''
}

async function fetchPageExcerpt(pageId: string) {
  try {
    const blocks = await fetchBlockChildren(pageId, { recursive: false, pageSize: 8 })
    const text = firstBlockLineText(blocks)
    if (!text) return 'Latest build notes from FOMO Sun.'
    if (text.length <= 140) return text
    return `${text.slice(0, 137)}...`
  } catch {
    return 'Latest build notes from FOMO Sun.'
  }
}

export async function listBlogPosts(): Promise<BlogPostMeta[]> {
  if (!isNotionConfigured()) return []

  const data = await notionFetch<NotionDatabaseQueryResponse>(`/databases/${blogDatabaseId()}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Show on Site',
        checkbox: { equals: true },
      },
      sorts: [{ property: 'Publish Date', direction: 'descending' }],
      page_size: 100,
    }),
  })

  const pages = data.results || []
  const enriched = await Promise.all(
    pages
      .filter(page => valueAsCheckbox(page.properties?.['Show on Site']))
      .map(async page => {
        const excerpt = await fetchPageExcerpt(page.id)
        return toBlogMeta(page, excerpt)
      })
  )

  return enriched.sort((a, b) => {
    const da = a.publishDate ? new Date(a.publishDate).getTime() : 0
    const db = b.publishDate ? new Date(b.publishDate).getTime() : 0
    return db - da
  })
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPostContent | null> {
  if (!isNotionConfigured()) return null

  const normalized = normalizeSlug(slug, slug)
  const data = await notionFetch<NotionDatabaseQueryResponse>(`/databases/${blogDatabaseId()}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        and: [
          {
            property: 'Slug',
            rich_text: { equals: normalized },
          },
          {
            property: 'Show on Site',
            checkbox: { equals: true },
          },
        ],
      },
      page_size: 1,
    }),
  })

  const page = data.results?.[0]
  if (!page) return null

  const [excerpt, blocks] = await Promise.all([
    fetchPageExcerpt(page.id),
    fetchBlockChildren(page.id, { recursive: true, pageSize: 100 }),
  ])

  return {
    meta: toBlogMeta(page, excerpt),
    blocks,
  }
}

export async function getAboutPage(): Promise<AboutPageContent | null> {
  if (!isNotionConfigured()) return null

  const pageId = aboutPageId()
  const [page, blocks] = await Promise.all([
    fetchPage(pageId),
    fetchBlockChildren(pageId, { recursive: true, pageSize: 100 }),
  ])

  return {
    id: page.id,
    title: valueAsTitle(page.properties?.title) || valueAsTitle(page.properties?.Name) || 'About',
    blocks,
  }
}
