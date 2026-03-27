"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount, useBalance } from "wagmi"
import { CONTRACTS } from "@/lib/contracts"
import { fmtUSDC } from "@/lib/utils"
import { arcTestnet } from "@/lib/chains"

export function Header() {
  const { address, isConnected } = useAccount()

  const { data: balance } = useBalance({
    address: address,
    token: CONTRACTS.USDC,
    chainId: arcTestnet.id,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 30000,
      retry: 1,
    },
  })

  return (
    <header className="header">
      <div className="logo">
        <div className="logo-mark" style={{
          width: 30, height: 30,
          background: "linear-gradient(135deg, var(--gold) 0%, var(--teal) 100%)",
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          fontSize: 11, fontWeight: 800, color: "var(--bg)",
          fontFamily: "var(--mono)",
        }}>
          AI
        </div>
        <div>
          <div className="logo-text">ArcInvoice</div>
          <div className="logo-chain">ARC TESTNET - 5042002</div>
        </div>
      </div>

      <div className="header-right">
        <div className="chain-pill">
          <span className="chain-dot" />
          <span>Live</span>
        </div>

        {isConnected && balance && (
          <div className="chain-pill" style={{ color: "var(--teal)", borderColor: "var(--teal-bd)" }}>
            <span className="mono" style={{ fontSize: 11 }}>
              {parseFloat(balance.formatted).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC
            </span>
          </div>
        )}

        <div className="wallet-area">
          <ConnectButton
            accountStatus="avatar"
            showBalance={false}
            chainStatus="icon"
          />
        </div>
      </div>
    </header>
  )
}