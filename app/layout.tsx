import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Outbindr — Panel Simulator',
  description: 'Configure your panel. Pitch your idea. Get scored by AI judges.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Outbindr — Panel Simulator',
    description: 'Configure your panel. Pitch your idea. Get scored by AI judges.',
    images: [{ url: '/logo.png' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
