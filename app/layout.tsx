import type { Metadata } from 'next'
import './globals.css'
import LenisProvider from '@/components/LenisProvider'

export const metadata: Metadata = {
  title: 'Artemii — Full-Stack Developer',
  description: 'Portfolio of Artemii, a full-stack developer specializing in Next.js, React Three Fiber, and modern web experiences.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  )
}
