"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";

import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { DESTS } from "@/lib/chains";



const arc = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002),
  name: "ARC Testnet",
  nativeCurrency: { 
    name: "USDC", 
    symbol: "USDC", 
    decimals: 6 
  },
  rpcUrls: {
    default: { 
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network"] 
    },
  },
  blockExplorers: {
    default: { 
      name: "ARC Explorer", 
      url: "https://testnet.arcscan.app" 
    },
  },
  testnet: true,
});
// Optional: add CCTP test chains so user can connect/switch and bridge "back to ARC".
const externalChains = DESTS.map((d) => {
  const id = Number(process.env[`NEXT_PUBLIC_${d.key}_CHAIN_ID` as any] || 0);
  const rpcUrl = process.env[`NEXT_PUBLIC_${d.key}_RPC_URL` as any] as string | undefined;
  const explorerUrl = process.env[`NEXT_PUBLIC_${d.key}_EXPLORER_URL` as any] as string | undefined;
  if (!id || !rpcUrl) return null;

  return defineChain({
    id,
    name: d.name,
    nativeCurrency: { name: d.symbol, symbol: d.symbol, decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: explorerUrl ? { default: { name: `${d.name} Explorer`, url: explorerUrl } } : undefined,
    testnet: true,
  });
}).filter(Boolean) as ReturnType<typeof defineChain>[];

const config = createConfig({
  chains: [arc, ...externalChains],
  transports: {
    [arc.id]: http(arc.rpcUrls.default.http[0]),
    ...Object.fromEntries(
      externalChains.map((c) => [c.id, http(c.rpcUrls.default.http[0])])
    ),
  },
  ssr: true,
});


const qc = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}