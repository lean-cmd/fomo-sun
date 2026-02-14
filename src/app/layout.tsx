import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FOMO Sun — Stop chasing clouds. Find sun.',
  description: 'Escape the fog in minutes. Sunny destinations within 1–4 hours, with real-time sun scores, travel times, and trip plans. Switzerland, Black Forest & Alsace.',
  keywords: ['sun escape', 'fog escape', 'sunny day trip', 'Switzerland', 'Nebel', 'Black Forest', 'Alsace', 'FOMO Sun'],
  openGraph: {
    title: 'FOMO Sun — Stop chasing clouds. Find sun.',
    description: 'The fog ends somewhere. We know where.',
    type: 'website',
    locale: 'en_CH',
    siteName: 'FOMO Sun',
  },
  icons: { icon: '/favicon.svg' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'FOMO Sun',
              url: 'https://fomosun.com',
              description: 'Find sunny destinations within 1–4 hours. Real-time sun scores and trip plans.',
              applicationCategory: 'TravelApplication',
              operatingSystem: 'Web',
              areaServed: [
                { '@type': 'Country', name: 'Switzerland' },
                { '@type': 'Country', name: 'Germany' },
                { '@type': 'Country', name: 'France' },
              ],
            }),
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-100 py-5 px-4 text-center">
          <p className="text-[10px] text-gray-400">
            Weather: <a href="https://www.meteoswiss.admin.ch" className="underline hover:text-gray-500">MeteoSwiss</a> (CC BY 4.0) · Routing: <a href="https://opentransportdata.swiss" className="underline hover:text-gray-500">OJP</a> · <a href="/api/v1/sunny-escapes" className="hover:text-gray-500">API</a> · <a href="/llms.txt" className="hover:text-gray-500">llms.txt</a>
          </p>
          <p className="text-[11px] text-gray-300 mt-1">
            Built with <span className="text-amber-500">&#9829;</span> and AI in Basel
          </p>
        </footer>
      </body>
    </html>
  )
}
