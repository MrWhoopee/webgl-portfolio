import type { Metadata } from 'next'
import './globals.css'
import LenisProvider from '@/components/LenisProvider'

export const metadata: Metadata = {
  title: 'Artemii — Full-Stack Developer',
  description: 'Portfolio of Artemii, a full-stack developer building production web applications with Next.js, Node.js and PostgreSQL.',
  openGraph: {
    title: 'Artemii — Full-Stack Developer',
    description: 'Full-stack developer — Next.js, Node.js, PostgreSQL. Site built with React Three Fiber.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no">
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  )
}
