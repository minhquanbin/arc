'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { fmtUSDC } from '@/lib/utils'
import { TierBadge, TxButton, StatCard, FeeBox, Modal, EmptyState } from '@/components/ui'
import { useMyArbitratorStats, useTotalMinted, useMintGold, useUpgradeToDiamond, useUpgradeToPlatinum } from '@/hooks/useArbitrator'
import { useApproveUSDC } from '@/hooks/useApproveUSDC'
import { CONTRACTS } from '@/lib/contracts'
import { parseUSDC } from '@/lib/utils'

const TIERS = [
  {
    id: 0, key: 'gold', icon: 'ÃƒÂ°Ã…Â¸Ã‚Â¥Ã¢â‚¬Â¡', title: 'Gold Arbitrator',
    color: 'var(--gold)', cls: 'nft-gold',
    mintPrice: '200 USDC', upgradePriceWei: parseUSDC('200'),
    feePct: '0.5%',
    req: 'Open to all ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â join the network',
    reqs: [] as string[],
  },
  {
    id: 1, key: 'diamond', icon: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã…Â½', title: 'Diamond Arbitrator',
    color: 'var(--diamond)', cls: 'nft-diamond',
    mintPrice: '1,000 USDC upgrade', upgradePriceWei: parseUSDC('1000'),
    feePct: '0.7%',
    req: 'Must have 10 completed invoice participations',
    reqs: ['Hold Gold NFT', '10+ invoice completions'],
  },
  {
    id: 2, key: 'platinum', icon: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â ', title: 'Platinum Arbitrator',
    color: 'var(--platinum)', cls: 'nft-platinum',
    mintPrice: '5,000 USDC upgrade', upgradePriceWei: parseUSDC('5000'),
    feePct: '1.0%',
    req: '20 invoices + 5 dispute resolutions',
    reqs: ['Hold Diamond NFT', '20+ invoice completions', '5+ disputes resolved'],
  },
]

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Mint / Upgrade modal ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
function MintModal({ open, onClose, targetTier, currentTier, stats }: {
  open: boolean; onClose: () => void;
  targetTier: typeof TIERS[0];
  currentTier: number | undefined;
  stats: any;
}) {
  const isMint = currentTier === undefined || currentTier === 0xff
  const priceWei = targetTier.upgradePriceWei

  const { needsApproval, approve, isApproving, isApproved } = useApproveUSDC(CONTRACTS.ARBITRATOR_NFT, priceWei)
  const { mintGold, isPending: mintPending, isSuccess: mintDone, error: mintErr } = useMintGold()
  const { upgrade: upgradeDiamond, isPending: upDPending, isSuccess: upDDone } = useUpgradeToDiamond()
  const { upgrade: upgradePlatinum, isPending: upPPending, isSuccess: upPDone } = useUpgradeToPlatinum()

  const isPending = mintPending || upDPending || upPPending
  const isSuccess = mintDone || upDDone || upPDone

  // Auto-mint sau khi approve xong
  useEffect(() => {
    if (isApproved) {
      if (targetTier.id === 0) mintGold()
      else if (targetTier.id === 1) upgradeDiamond()
      else upgradePlatinum()
    }
  }, [isApproved])

  const handleAction = () => {
    if (needsApproval) { approve(); return }
    if (targetTier.id === 0) mintGold()
    else if (targetTier.id === 1) upgradeDiamond()
    else upgradePlatinum()
  }

  if (isSuccess) onClose()

  return (
    <Modal open={open} onClose={onClose} title={isMint ? 'Become an Arbitrator' : `Upgrade to ${targetTier.title}`}>
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{targetTier.icon}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: targetTier.color, marginBottom: 4 }}>
          {targetTier.title}
        </div>
        <div className="muted text-sm mb-16">{targetTier.req}</div>
      </div>

      {targetTier.reqs.length > 0 && (
        <div className="fee-box mb-16">
          <div className="section-label mb-8">Requirements</div>
          {targetTier.reqs.map((r, i) => {
            const met = i === 0 ? true :
              i === 1 ? (stats?.[0] ?? 0n) >= (targetTier.id === 1 ? 10n : 20n) :
              (stats?.[1] ?? 0n) >= 5n
            return (
              <div key={i} className="fee-row">
                <span className={met ? 'text-teal' : 'muted'}>
                  {met ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“' : 'ÃƒÂ¢Ã¢â‚¬â€Ã¢â‚¬Â¹'} {r}
                </span>
                {i === 1 && stats && (
                  <span className="mono text-xs muted2">
                    {String(stats[0])}/{targetTier.id === 1 ? '10' : '20'}
                  </span>
                )}
                {i === 2 && stats && (
                  <span className="mono text-xs muted2">{String(stats[1])}/5</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <FeeBox
        rows={[
          { label: targetTier.id === 0 ? 'Mint price' : 'Upgrade fee', value: targetTier.mintPrice, color: targetTier.color, total: true },
          { label: 'Fee earned per invoice', value: `${targetTier.feePct} of each milestone`, color: 'var(--teal)' },
          { label: 'Dispute resolution fee', value: '5% of milestone (paid by loser)', color: 'var(--text2)' },
        ]}
      />

      <div className="row gap-8 mt-16">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <TxButton
          variant={targetTier.id === 0 ? 'gold' : targetTier.id === 1 ? 'diamond' : 'platinum'}
          className="ml-auto"
          loading={isApproving || isPending}
          loadingText={isApproving ? 'Approving USDCÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦' : 'ConfirmingÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦'}
          onClick={handleAction}
        >
          {needsApproval
            ? `Approve ${targetTier.mintPrice}`
            : targetTier.id === 0 ? `Mint Gold ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${targetTier.mintPrice}`
            : `Upgrade ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${targetTier.mintPrice}`}
        </TxButton>
      </div>
    </Modal>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Main ArbitratorTab ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
export function ArbitratorTab() {
  const { address } = useAccount()
  const { data: statsData } = useMyArbitratorStats()
  const { data: totalMinted } = useTotalMinted()
  const [mintModal, setMintModal] = useState<typeof TIERS[0] | null>(null)

  const myTier = statsData ? Number(statsData[4]) : undefined
  const isArbitrator = myTier !== undefined && myTier !== 0xff && myTier < 3
  const myStats = statsData

  const getUpgradeAction = () => {
    if (!isArbitrator) return TIERS[0]
    if (myTier === 0) return TIERS[1]
    if (myTier === 1) return TIERS[2]
    return null
  }
  const upgradeTarget = getUpgradeAction()

  return (
    <div className="col gap-16 animate-in">
      <div className="row mb-8">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>TrÃƒÂ¡Ã‚Â»Ã‚Âng tÃƒÆ’Ã‚Â i</h2>
          <p className="muted mt-4 text-sm">Max 10 NFTs globally | Unanimous voting | Non-transferable during disputes</p>
        </div>
        <div className="chain-pill ml-auto">
          <span className="chain-dot" />
          <span>{totalMinted !== undefined ? String(totalMinted) : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}/10 slots</span>
        </div>
      </div>

      {/* My status */}
      {address && isArbitrator && myStats && (
        <div className="card" style={{ border: `1px solid ${myTier === 2 ? 'var(--platinum-bd)' : myTier === 1 ? 'var(--diamond-bd)' : 'var(--gold-bd)'}` }}>
          <div className="row gap-12 mb-12">
            <div style={{ fontSize: 32 }}>{TIERS[myTier]?.icon}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{TIERS[myTier]?.title}</div>
              <div className="muted2 text-xs mono mt-4">{address}</div>
            </div>
            <TierBadge tier={myTier} />
          </div>
          <div className="stats-grid">
            <StatCard label="Invoices" value={String(myStats[0])} sub="Completed" />
            <StatCard label="Disputes resolved" value={String(myStats[1])} />
            <StatCard label="Active disputes" value={String(myStats[2])} color={Number(myStats[2]) > 0 ? 'var(--coral)' : undefined} />
          </div>
          {upgradeTarget && (
            <div className="mt-12">
              <TxButton
                variant={myTier === 0 ? 'diamond' : 'platinum'}
                size="sm"
                onClick={() => setMintModal(upgradeTarget)}
              >
                Upgrade to {upgradeTarget.title}
              </TxButton>
            </div>
          )}
        </div>
      )}

      {/* NFT tier cards */}
      <div className="grid-3">
        {TIERS.map(t => (
          <div key={t.id} className={`nft-card ${t.cls}`}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{t.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.color, marginBottom: 4 }}>{t.title}</div>
            <div className="mono text-xs muted2 mb-12">{t.mintPrice}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>
              {t.req}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
              Fee: <span style={{ color: t.color }}>{t.feePct}</span> per milestone
            </div>
            <div className="divider-sm" />
            <div className="row gap-8 text-xs mono muted2">
              <span>Min invoices: <strong>{t.id === 0 ? '0' : t.id === 1 ? '10' : '20'}</strong></span>
              <span>Ãƒâ€šÃ‚Â·</span>
              <span>Min disputes: <strong>{t.id < 2 ? '0' : '5'}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Become arbitrator CTA */}
      {!isArbitrator && (
        <div className="card" style={{ border: '1px solid var(--gold-bd)', background: 'var(--gold-bg)', textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>ÃƒÂ°Ã…Â¸Ã‚Â¥Ã¢â‚¬Â¡</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Become an Arbitrator</div>
          <p className="muted text-sm mb-16">
            Join as a Gold arbitrator for 200 USDC. Earn fees on every invoice you're named on.
            Work toward Diamond and Platinum for higher earnings.
          </p>
          <TxButton
            variant="gold"
            loading={false}
            onClick={() => setMintModal(TIERS[0])}
          >
            Mint Gold NFT ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 200 USDC
          </TxButton>
        </div>
      )}

      {/* Fee schedule */}
      <FeeBox
        title="Fee schedule"
        rows={[
          { label: 'Gold (0.5%) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â per milestone, always earned when named on invoice', value: 'Always active', color: 'var(--gold)' },
          { label: 'Diamond (0.7%) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â per milestone', value: 'Always active', color: 'var(--diamond)' },
          { label: 'Platinum (1.0%) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â per milestone', value: 'Always active', color: 'var(--platinum)' },
          { label: 'Dispute resolution ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 5% of milestone (min 50 USDC), paid by loser', value: 'On dispute', color: 'var(--coral)' },
          { label: 'Unanimous vote required ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â all arbitrators must agree', value: 'No majority voting' },
        ]}
      />

      {/* Mint modal */}
      {mintModal && (
        <MintModal
          open={!!mintModal}
          onClose={() => setMintModal(null)}
          targetTier={mintModal}
          currentTier={myTier}
          stats={myStats}
        />
      )}
    </div>
  )
}
