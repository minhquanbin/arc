"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount, useReadContract } from "wagmi"
import { CONTRACTS, ERC20_ABI } from "@/lib/contracts"
import { fmtUSDC } from "@/lib/utils"

export function Header() {
  const { address } = useAccount()

  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 20000 },
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
          fontSize: 13, fontWeight: 800, color: "var(--bg)",
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

        {address && usdcBalance !== undefined && (
          <div className="chain-pill" style={{ color: "var(--teal)" }}>
            <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
              {fmtUSDC(usdcBalance)}
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