import { NotionBlock, NotionRichText } from '@/lib/notion-cms'
import type { ReactNode } from 'react'

type ListType = 'bulleted_list_item' | 'numbered_list_item'

function richClasses(text: NotionRichText) {
  const a = text.annotations || {}
  const classes: string[] = []
  if (a.bold) classes.push('font-semibold')
  if (a.italic) classes.push('italic')
  if (a.underline) classes.push('underline')
  if (a.strikethrough) classes.push('line-through')
  if (a.code) classes.push('font-mono text-[0.92em] bg-slate-100 px-1 py-0.5 rounded')
  return classes.join(' ')
}

function renderRichText(rich: NotionRichText[] | undefined) {
  if (!rich || rich.length === 0) return null

  return rich.map((text, idx) => {
    const key = `${text.plain_text}-${idx}`
    const url = text.text?.link?.url || text.href
    const className = richClasses(text)

    if (url) {
      return (
        <a key={key} href={url} className={`text-sky-700 hover:underline underline-offset-2 ${className}`} target="_blank" rel="noopener noreferrer">
          {text.plain_text}
        </a>
      )
    }

    return (
      <span key={key} className={className}>
        {text.plain_text}
      </span>
    )
  })
}

function blockRichText(block: NotionBlock) {
  const payload = block[block.type] as { rich_text?: NotionRichText[] } | undefined
  return payload?.rich_text
}

function blockCaption(block: NotionBlock) {
  const payload = block[block.type] as { caption?: NotionRichText[] } | undefined
  return payload?.caption
}

function blockText(block: NotionBlock) {
  return blockRichText(block)?.map(t => t.plain_text || '').join('').trim() || ''
}

function imageUrl(block: NotionBlock) {
  const payload = block.image as
    | { type?: 'external' | 'file'; external?: { url?: string }; file?: { url?: string } }
    | undefined
  if (!payload) return ''
  if (payload.type === 'external') return payload.external?.url || ''
  if (payload.type === 'file') return payload.file?.url || ''
  return ''
}

function BlockChildren({ block }: { block: NotionBlock }) {
  const children = block.children || []
  if (!children.length) return null
  return (
    <div className="mt-2 ml-4 border-l border-slate-200 pl-4">
      <NotionContent blocks={children} />
    </div>
  )
}

function ListBlock({ blocks, type }: { blocks: NotionBlock[]; type: ListType }) {
  const isBullet = type === 'bulleted_list_item'
  const ListTag = isBullet ? 'ul' : 'ol'
  const listClass = isBullet ? 'list-disc' : 'list-decimal'

  return (
    <ListTag className={`${listClass} pl-5 space-y-1.5 text-slate-700 text-[15px] leading-7`}>
      {blocks.map(block => (
        <li key={block.id}>
          <span>{renderRichText(blockRichText(block))}</span>
          <BlockChildren block={block} />
        </li>
      ))}
    </ListTag>
  )
}

function SingleBlock({ block }: { block: NotionBlock }) {
  const text = blockText(block)

  if (block.type === 'paragraph') {
    if (!text) return <div className="h-2" />
    return <p className="text-slate-700 text-[16px] leading-7">{renderRichText(blockRichText(block))}</p>
  }

  if (block.type === 'heading_1') {
    return <h1 className="fomo-font-display text-3xl font-extrabold text-slate-900 tracking-tight">{renderRichText(blockRichText(block))}</h1>
  }

  if (block.type === 'heading_2') {
    return <h2 className="fomo-font-display text-2xl font-bold text-slate-900 mt-4">{renderRichText(blockRichText(block))}</h2>
  }

  if (block.type === 'heading_3') {
    return <h3 className="fomo-font-display text-xl font-semibold text-slate-900 mt-3">{renderRichText(blockRichText(block))}</h3>
  }

  if (block.type === 'quote') {
    return (
      <blockquote className="border-l-4 border-amber-300 bg-amber-50/60 text-slate-700 px-4 py-3 rounded-r-lg">
        {renderRichText(blockRichText(block))}
      </blockquote>
    )
  }

  if (block.type === 'divider') {
    return <hr className="border-slate-200 my-3" />
  }

  if (block.type === 'code') {
    const payload = block.code as { language?: string } | undefined
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-950 overflow-hidden">
        <div className="px-3 py-1.5 text-[11px] text-slate-300 border-b border-slate-800">{payload?.language || 'code'}</div>
        <pre className="p-3 overflow-auto text-[13px] leading-6 text-slate-100 font-mono">{text}</pre>
      </div>
    )
  }

  if (block.type === 'callout') {
    const payload = block.callout as { icon?: { emoji?: string } } | undefined
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sky-900">
        <div className="flex items-start gap-2">
          <span className="text-lg leading-none mt-0.5">{payload?.icon?.emoji || 'ℹ️'}</span>
          <div className="text-[15px] leading-7">{renderRichText(blockRichText(block))}</div>
        </div>
      </div>
    )
  }

  if (block.type === 'to_do') {
    const payload = block.to_do as { checked?: boolean } | undefined
    return (
      <div className="flex items-start gap-2 text-slate-700 text-[15px] leading-7">
        <input type="checkbox" checked={Boolean(payload?.checked)} readOnly className="mt-1" />
        <span>{renderRichText(blockRichText(block))}</span>
      </div>
    )
  }

  if (block.type === 'toggle') {
    return (
      <details className="rounded-lg border border-slate-200 px-3 py-2 bg-white">
        <summary className="cursor-pointer font-medium text-slate-800">{renderRichText(blockRichText(block))}</summary>
        <div className="mt-2">
          <BlockChildren block={block} />
        </div>
      </details>
    )
  }

  if (block.type === 'image') {
    const url = imageUrl(block)
    if (!url) return null
    const caption = blockCaption(block)
    return (
      <figure className="space-y-2">
        <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-[16/9]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={blockText(block) || 'Blog image'}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        {caption && caption.length > 0 && <figcaption className="text-sm text-slate-500">{renderRichText(caption)}</figcaption>}
      </figure>
    )
  }

  if (block.type === 'bookmark') {
    const payload = block.bookmark as { url?: string } | undefined
    if (!payload?.url) return null
    return (
      <a href={payload.url} target="_blank" rel="noopener noreferrer" className="inline-flex text-sky-700 hover:underline underline-offset-2">
        {payload.url}
      </a>
    )
  }

  return null
}

export default function NotionContent({ blocks }: { blocks: NotionBlock[] }) {
  const rows: ReactNode[] = []

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]

    if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
      const listType = block.type
      const grouped: NotionBlock[] = [block]
      let j = i + 1
      while (j < blocks.length && blocks[j].type === listType) {
        grouped.push(blocks[j])
        j += 1
      }
      rows.push(<ListBlock key={`${listType}-${block.id}`} blocks={grouped} type={listType} />)
      i = j - 1
      continue
    }

    rows.push(<SingleBlock key={block.id} block={block} />)
  }

  return <div className="space-y-4">{rows}</div>
}
