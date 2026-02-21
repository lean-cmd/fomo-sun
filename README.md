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

## Umami Analytics (Zero-Cost Self-Hosting)

This project now supports Umami tracking via env vars in `/src/app/layout.tsx`.

### Architecture (100% free tier)

- Umami OSS on Vercel Hobby
- Supabase Postgres (Free plan)
- FOMO Sun loads the Umami tracker script from your Umami deployment

### 1) Fork and deploy Umami on Vercel

1. Fork the official repo: [https://github.com/umami-software/umami](https://github.com/umami-software/umami)
2. In Vercel, click **Add New -> Project -> Import Git Repository** and select your fork.
3. Keep the default Next.js settings (Install: `npm install`, Build: `npm run build`).
4. Add environment variables before first deploy (step 3 below).

### 2) Create Supabase database and copy connection strings

1. Create a Supabase project in a region near your Vercel deployment.
2. In Supabase: **Settings -> Database -> Connection string -> Connection Pooling**.
3. Copy **Transaction mode** string and use it as `DATABASE_URL` (pooler port `6543`), for example:

```bash
DATABASE_URL=postgres://[user].[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

4. Copy the **Session mode / direct** string and use it as `DIRECT_DATABASE_URL` (port `5432`) for Prisma migrations.

### 3) Set Umami environment variables (Vercel -> Settings -> Environment Variables)

```bash
DATABASE_URL=postgres://...:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_DATABASE_URL=postgres://...:5432/postgres
APP_SECRET=<strong-random-secret>
```

Generate a secure `APP_SECRET`:

```bash
openssl rand -base64 32
```

Note: current Umami code can derive a secret from `DATABASE_URL` if `APP_SECRET` is omitted, but you should set `APP_SECRET` explicitly in production.

### 4) Initialize schema (current Umami v3 flow)

1. In your Umami fork, update `prisma/schema.prisma` datasource to include direct URL for migrations:

```prisma
datasource db {
  provider     = "postgresql"
  url          = env("DATABASE_URL")
  directUrl    = env("DIRECT_DATABASE_URL")
  relationMode = "prisma"
}
```

2. Commit and redeploy on Vercel.
3. `npm run build` in Umami runs Prisma migration deployment (`prisma migrate deploy`) via Umami's DB check/build scripts.
4. Manual fallback (if needed):

```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

5. SQL fallback (only if Prisma migration cannot run in your environment): execute `prisma/migrations/*/migration.sql` in order inside Supabase SQL Editor.

### 5) Finish Umami setup

1. Open your Umami URL.
2. Log in with default credentials (`admin` / `umami`) on first boot.
3. Change the password immediately.
4. Create a Website in Umami and copy its `Website ID`.

### 6) Wire FOMO Sun to Umami

Set these in `.env.local` and Vercel for this project:

```bash
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://<your-umami-domain>/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=<website-id-uuid>

# Optional
NEXT_PUBLIC_UMAMI_HOST_URL=https://<your-umami-domain>
NEXT_PUBLIC_UMAMI_DOMAINS=fomosun.com,www.fomosun.com
```

If you want proxying through your app domain (ad-block bypass pattern), use `/stats/script.js` with a Vercel rewrite.

### React / Next.js integration snippet

```tsx
import Script from 'next/script';

<Script
  id="umami-analytics"
  src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL!}
  strategy="afterInteractive"
  data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID!}
/>
```

### CLI setup in this repo

```bash
npm run umami:setup -- --host https://<your-umami-domain> --website-id <website-id-uuid> --domains fomosun.com,www.fomosun.com
```

Validation check (with app running):

```bash
npm run umami:check -- --url http://localhost:3000 --expect-script-url https://<your-umami-domain>/script.js --expect-website-id <website-id-uuid>
```

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

## Tourism Enrichment (Swiss Tourism Layer)

`/api/v1/sunny-escapes` now enriches each returned destination with a `tourism` object:

- `description_short`
- `description_long`
- `highlights[]`
- `tags[]`
- `hero_image`
- `official_url`
- `pois_nearby[]`

### Providers

Provider order:

1. `discover.swiss` (official, when configured)
2. `geo.admin.ch` SearchServer enrichment (open government endpoint)
3. Local curated fallback from destination catalog

### Environment variables

Set these in `.env.local` and Vercel (Project -> Settings -> Environment Variables):

```bash
# Optional official Swiss tourism provider
SWISS_TOURISM_DISCOVER_SUBSCRIPTION_KEY=...
SWISS_TOURISM_DISCOVER_SEARCH_URL=...
SWISS_TOURISM_DISCOVER_DETAIL_URL=... # optional template

# Optional KV cache backend (24h TTL)
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

Template variables supported in search/detail URLs:

- `{query}` / `{name}`
- `{lat}` / `{lon}`
- `{region}`
- `{detail_id}` (detail template only)

If provider keys are missing or upstream fails, the API does **not** fail. It returns cached/fallback tourism enrichment.

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
