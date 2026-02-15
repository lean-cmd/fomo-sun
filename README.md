# FOMO Sun

**Stop chasing clouds. Find sun.**

The fog ends somewhere. We know where.

FOMO Sun recommends sunny destinations reachable within 1-4 hours when your city is stuck under fog. Built for the Rhine Valley, Swiss Mittelland, and surrounding regions.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Notion CMS (Blog + About)

Routes:

- `/blog`
- `/blog/[slug]`
- `/about`

Environment variables (set in `.env.local` and Vercel):

```bash
NOTION_TOKEN=secret_xxx
NOTION_BLOG_DB_ID=74e516e02e41417eaecaf46238b68f9e
NOTION_ABOUT_PAGE_ID=308d1a98835a813a8b18f3a0d1cb60ab
```

Setup:

1. Create a Notion integration at `https://www.notion.so/my-integrations`.
2. Put the token in your secure environment as `NOTION_TOKEN` (never paste secrets into chat).
3. Share the Blog database and About page with that integration.
4. Set `Slug` and `Show on Site = true` on posts to publish them on `/blog`.

Content refresh uses ISR (`revalidate: 300`), so changes in Notion appear on the site within a few minutes.

## Deploy

```bash
npx vercel
```

## Tech Stack

Next.js 14, TypeScript, Tailwind CSS, Vercel (Frankfurt edge)

## Data Sources

- Weather: MeteoSwiss (CC BY 4.0)
- Routing: OJP / openrouteservice

---

Built with love and AI in Basel · [fomosun.com](https://fomosun.com)
