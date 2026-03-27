'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useReadContract } from 'wagmi'
import { CONTRACTS, ERC20_ABI } from '@/lib/contracts'
import { fmtUSDC } from '@/lib/utils'

export function Header() {
  const { address } = useAccount()

  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })

  return (
    <header className="header">
      <div className="logo">
        <div className="logo-mark">â¬¡</div>
        <div>
          <div className="logo-text">ArcInvoice</div>
          <div className="logo-chain">Arc Testnet Â· 5042002</div>
        </div>
      </div>

      <div className="header-right">
        <div className="chain-pill">
          <span className="chain-dot" />
          <span>Live</span>
        </div>

        {address && usdcBalance !== undefined && (
          <div className="chain-pill" style={{ color: 'var(--teal)' }}>
            <span style={{ fontSize: 12 }}>ðŸ’°</span>
            <span>{fmtUSDC(usdcBalance)}</span>
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
