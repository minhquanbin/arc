import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Arc Invoice — Escrow & Arbitration on Arc',
  description: 'Decentralized invoice platform with USDC escrow, milestone payments, NFT arbitrators, and on-chain job board. Built on Arc blockchain.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
