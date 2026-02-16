"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { defineChain } from "viem";
import { DESTS } from "@/lib/chains";

const arc = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002),
  name: "ARC Testnet",
  // Native token should be gas token (ETH). Setting USDC here confuses wallets/RainbowKit.
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: { name: "ARC Explorer", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// Optional: add CCTP test chains so user can connect/switch and bridge "back to ARC".
const externalChains = DESTS.map((d) => {
  const id = Number((process.env as any)[`NEXT_PUBLIC_${d.key}_CHAIN_ID`] || 0);
  const rpcUrl = (process.env as any)[`NEXT_PUBLIC_${d.key}_RPC_URL`] as string | undefined;
  const explorerUrl = (process.env as any)[`NEXT_PUBLIC_${d.key}_EXPLORER_URL`] as string | undefined;
  if (!id || !rpcUrl) return null;

  return defineChain({
    id,
    name: d.name,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: explorerUrl ? { default: { name: `${d.name} Explorer`, url: explorerUrl } } : undefined,
    testnet: true,
  });
}).filter(Boolean) as ReturnType<typeof defineChain>[];

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "arc-bridge";

const config = getDefaultConfig({
  appName: "Arc Bridge",
  projectId,
  chains: [arc, ...externalChains],
  ssr: true,
});

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 10_000,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider modalSize="compact">{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}