# FOMO Sun ☀️

**Stop chasing clouds. Find sun.**

Escape the fog in minutes. Get 3-5 sunny destinations within 1-4 hours, with real-time sun scores, travel times, and trip plans.

Covers Switzerland, Black Forest, and Alsace.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy

Push to GitHub, then connect to [Vercel](https://vercel.com). The `vercel.json` is preconfigured for Frankfurt edge (fra1).

## Stack

- **Framework:** Next.js 14 + TypeScript + Tailwind
- **Weather:** MeteoSwiss Open Data (CC BY 4.0)
- **Routing:** OJP (Swiss) + openrouteservice (cross-border)
- **Hosting:** Vercel

## API

```
GET /api/v1/sunny-escapes?lat=47.56&lon=7.59&max_travel_h=2&mode=both&limit=5
```

See [llms.txt](/public/llms.txt) for AI agent integration.

---

Built with ♥ and AI in Basel
