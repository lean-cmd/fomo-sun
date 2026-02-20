import type { Metadata } from 'next'
import './globals.css'

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
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200/60 bg-white/50 py-4 px-4 mt-8">
          <div className="max-w-xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[10px] text-slate-500">
            <div>
              <span className="font-semibold tracking-wide text-slate-500">FOMO Sun</span> &copy; {new Date().getFullYear()}
            </div>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <a href="/blog" className="transition-colors hover:text-amber-600">Blog</a>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <a href="/about" className="transition-colors hover:text-amber-600">About</a>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <a href="/api/v1/sunny-escapes" className="transition-colors hover:text-amber-600">API Access</a>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <a href="/admin" className="transition-colors hover:text-amber-600">Admin Diagnostics</a>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <a href="/llms.txt" className="transition-colors hover:text-amber-600">llms.txt</a>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="whitespace-nowrap">
              Weather: <a href="https://www.meteoswiss.admin.ch" className="underline hover:text-amber-600 transition-colors">MeteoSwiss</a>
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="whitespace-nowrap">
              Routing: <a href="https://opentransportdata.swiss" className="underline hover:text-amber-600 transition-colors">OJP</a>
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <div>
              Built with <span className="text-amber-500 animate-pulse">&#9829;</span> and AI in Basel
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
