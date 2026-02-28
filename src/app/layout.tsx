import type { Metadata } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import { APP_RELEASE_VERSION } from '@/lib/release'

export const metadata: Metadata = {
  title: 'FOMO Sun — Stop chasing clouds. Find sun.',
  description: 'The fog ends somewhere. We know where. Get sunny destinations within 1-4 hours, with real-time sun scores, travel times, and trip plans.',
  keywords: ['sun escape', 'fog escape', 'sunny day trip', 'Switzerland weather', 'Nebel', 'Sonne finden', 'FOMO Sun'],
  openGraph: {
    title: 'FOMO Sun — Stop chasing clouds. Find sun.',
    description: 'The fog ends somewhere. We know where.',
    url: 'https://fomosun.com',
    type: 'website',
    locale: 'en_CH',
    siteName: 'FOMO Sun',
    images: [{ url: 'https://fomosun.com/api/og/default', width: 1200, height: 630 }],
  },
  icons: { icon: '/favicon.svg' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const umamiScriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || ''
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || ''
  const umamiHostUrl = process.env.NEXT_PUBLIC_UMAMI_HOST_URL || ''
  const umamiDomains = process.env.NEXT_PUBLIC_UMAMI_DOMAINS || ''
  const umamiEnabled = Boolean(umamiScriptUrl && umamiWebsiteId)

  return (
    <html lang="en" data-theme="light" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Jost:wght@300;400&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'FOMO Sun',
              url: 'https://fomosun.com',
              description: 'Find sunny destinations within 1-4 hours. Real-time sun scores, travel times, and trip plans.',
              applicationCategory: 'TravelApplication',
              operatingSystem: 'Web',
            }),
          }}
        />
        {umamiEnabled ? (
          <Script
            id="umami-analytics"
            src={umamiScriptUrl}
            strategy="afterInteractive"
            data-website-id={umamiWebsiteId}
            {...(umamiHostUrl ? { 'data-host-url': umamiHostUrl } : {})}
            {...(umamiDomains ? { 'data-domains': umamiDomains } : {})}
          />
        ) : null}
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200/60 bg-white/50 py-6 px-4 mt-8">
          <div className="max-w-xl mx-auto space-y-1.5 text-[10px] text-slate-400 font-medium">
            <div className="flex items-center justify-between gap-2">
              <span>fomosun.com &copy; {new Date().getFullYear()} · {APP_RELEASE_VERSION}</span>
              <div className="inline-flex items-center gap-2.5">
                <a href="/blog" className="transition-colors hover:text-amber-600">Blog</a>
                <a href="/about" className="transition-colors hover:text-amber-600">About</a>
              </div>
            </div>
            <p>Built with <span className="text-amber-500 animate-pulse">&#9829;</span> and AI in Basel</p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  )
}
