import type { Metadata } from 'next'
import './globals.css'
import LenisProvider from '@/components/LenisProvider'

export const metadata: Metadata = {
  title: 'Artemii — Full-Stack Developer',
  description: 'Portfolio of Artemii, a full-stack developer specializing in Next.js, React Three Fiber, and modern web experiences.',
  openGraph: {
    title: 'Artemii — Full-Stack Developer',
    description: 'A WebGL portfolio built with Next.js and React Three Fiber.',
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
