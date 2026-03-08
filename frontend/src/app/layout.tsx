import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Agent Call Center',
  description: 'Enterprise AI-powered call center platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
