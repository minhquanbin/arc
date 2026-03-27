'use client'

import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { arcTestnet } from '@/lib/chains'

const config = getDefaultConfig({
  appName: 'Arc Invoice',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo',
  chains: [arcTestnet],
  ssr: true,
})

const queryClient = new QueryClient()

const rkTheme = darkTheme({
  accentColor: '#2de2b6',
  accentColorForeground: '#080c14',
  borderRadius: 'medium',
  fontStack: 'system',
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} locale="en-US">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
