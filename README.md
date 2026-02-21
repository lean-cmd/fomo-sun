# FOMO Sun

FOMO Sun helps users find nearby destinations with better sunshine than their current location, ranked by practical travel time and net sun gain.

Live: [fomosun.com](https://fomosun.com)

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Core Routes

- `/` user experience (hero + ranked sunny escapes)
- `/admin` diagnostics and weather/source tuning
- `/admin/stamps` stamp gallery
- `/blog` and `/about` (Notion-backed content)
- `/api/v1/sunny-escapes` main ranking API

## Stack

- Next.js 14 + TypeScript + Tailwind
- Vercel hosting
- MeteoSwiss + Open-Meteo weather inputs
- OJP/openrouteservice travel inputs
- Notion CMS integration

## Ops Notes

- Detailed setup docs (analytics, release process, and backups) are maintained in the Notion MVP Build Hub.
- Umami helper commands in this repo:

```bash
npm run umami:setup -- --help
npm run umami:check -- --url http://localhost:3000
```
