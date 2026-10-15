import type { Metadata } from 'next'
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ContinuityShell } from '@/components/layout/continuity-shell'

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Continuity — AI Video Generation',
  description: 'Multi-scene video generation built on the v2 Plan → Approve → Run → Result contract.',
  keywords: ['AI video', 'video generation', 'keyframes', 'Continuity'],
  authors: [{ name: 'Continuity' }],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/assets/Favicons (visionweave_logo)/favicon-180-precomposed.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${hanken.variable} ${mono.variable} ${hanken.className}`}>
        <ContinuityShell>
          {children}
        </ContinuityShell>
        <Toaster />
      </body>
    </html>
  )
}
