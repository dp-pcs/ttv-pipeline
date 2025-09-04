
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { Navigation } from '@/components/layout/navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VisionWeave - AI Video Generation Platform',
  description: 'Generate stunning videos from text prompts with AI-powered keyframe generation and video stitching.',
  keywords: ['AI video', 'video generation', 'text to video', 'keyframes', 'VisionWeave'],
  authors: [{ name: 'VisionWeave Team' }],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-192.png', sizes: '192x192', type: 'image/png' }
    ],
    apple: [
      { url: '/assets/Favicons (visionweave_logo)/favicon-57.png', sizes: '57x57', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-60.png', sizes: '60x60', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-72-precomposed.png', sizes: '72x72', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-76.png', sizes: '76x76', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-114-precomposed.png', sizes: '114x114', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-120-precomposed.png', sizes: '120x120', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-144-precomposed.png', sizes: '144x144', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-152-precomposed.png', sizes: '152x152', type: 'image/png' },
      { url: '/assets/Favicons (visionweave_logo)/favicon-180-precomposed.png', sizes: '180x180', type: 'image/png' }
    ]
  },
  other: [
    {
      rel: 'mask-icon',
      url: '/assets/Favicons (visionweave_logo)/favicon-192.png',
      color: '#4f46e5'
    }
  ]
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="min-h-screen bg-background text-foreground">
            <Navigation />
            <main className="relative">
              {children}
            </main>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
