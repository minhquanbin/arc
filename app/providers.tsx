"use client"

import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit"
import "@rainbow-me/rainbowkit/styles.css"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http } from "viem"
import { arcTestnet } from "@/lib/chains"

const ARC_RPC = "https://rpc.testnet.arc.network"

const config = getDefaultConfig({
  appName: "Arc Invoice",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo",
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(ARC_RPC, {
      batch: false,
      timeout: 20000,
    }),
  },
  batch: {
    multicall: false,
  },
  pollingInterval: 0,
  ssr: true,
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      staleTime: 20000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
})

const rkTheme = darkTheme({
  accentColor: "#2de2b6",
  accentColorForeground: "#080c14",
  borderRadius: "medium",
  fontStack: "system",
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