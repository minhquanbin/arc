"use client"

import { RainbowKitProvider, darkTheme, connectorsForWallets } from "@rainbow-me/rainbowkit"
import { metaMaskWallet, walletConnectWallet, coinbaseWallet } from "@rainbow-me/rainbowkit/wallets"
import "@rainbow-me/rainbowkit/styles.css"
import { WagmiProvider, createConfig } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http } from "viem"
import { arcTestnet } from "@/lib/chains"

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, coinbaseWallet, walletConnectWallet],
    },
  ],
  {
    appName: "Arc Invoice",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo",
  }
)

const config = createConfig({
  chains: [arcTestnet],
  connectors,
  transports: {
    [arcTestnet.id]: http("https://rpc.testnet.arc.network", {
      batch: false,
      timeout: 20000,
    }),
  },
  batch: { multicall: false },
  pollingInterval: 0,
  ssr: true,
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      staleTime: 60000,
      gcTime: 60000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      networkMode: "always",
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