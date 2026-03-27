"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { parseUSDC } from "@/lib/utils"
import { TierBadge, TxButton, StatCard, FeeBox, Modal } from "@/components/ui"
import { useMyArbitratorStats, useTotalMinted, useMintGold, useUpgradeToDiamond, useUpgradeToPlatinum } from "@/hooks/useArbitrator"
import { useApproveUSDC } from "@/hooks/useApproveUSDC"
import { CONTRACTS } from "@/lib/contracts"

const TIERS = [
  {
    id: 0, key: "gold", title: "Gold Arbitrator",
    color: "var(--gold)", cls: "nft-gold",
    mintPrice: "200 USDC", upgradePriceWei: parseUSDC("200"),
    feePct: "0.5%",
    req: "Open to all -- join the network",
    reqs: [] as string[],
  },
  {
    id: 1, key: "diamond", title: "Diamond Arbitrator",
    color: "var(--diamond)", cls: "nft-diamond",
    mintPrice: "1,000 USDC upgrade", upgradePriceWei: parseUSDC("1000"),
    feePct: "0.7%",
    req: "Must have 10 completed invoice participations",
    reqs: ["Hold Gold NFT", "10+ invoice completions"],
  },
  {
    id: 2, key: "platinum", title: "Platinum Arbitrator",
    color: "var(--platinum)", cls: "nft-platinum",
    mintPrice: "5,000 USDC upgrade", upgradePriceWei: parseUSDC("5000"),
    feePct: "1.0%",
    req: "20 invoices + 5 dispute resolutions",
    reqs: ["Hold Diamond NFT", "20+ invoice completions", "5+ disputes resolved"],
  },
]

type Step = "idle" | "approving" | "approved" | "minting" | "done" | "error"

function MintModal({ open, onClose, targetTier, currentTier, stats }: {
  open: boolean
  onClose: () => void
  targetTier: typeof TIERS[0]
  currentTier: number | undefined
  stats: any
}) {
  const [step, setStep] = useState<Step>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const priceWei = targetTier.upgradePriceWei

  const {
    needsApproval,
    approve,
    isApproving,
    isApproved,
    refetchAllowance,
  } = useApproveUSDC(CONTRACTS.ARBITRATOR_NFT, priceWei)

  const { mintGold, isPending: mintPending, isSuccess: mintDone, error: mintErr } = useMintGold()
  const { upgrade: upgradeDiamond, isPending: upDPending, isSuccess: upDDone } = useUpgradeToDiamond()
  const { upgrade: upgradePlatinum, isPending: upPPending, isSuccess: upPDone } = useUpgradeToPlatinum()

  const isMinting = mintPending || upDPending || upPPending
  const isSuccess = mintDone || upDDone || upPDone

  // Step 2: after approve confirmed, trigger mint
  useEffect(() => {
    if (isApproved && step === "approving") {
      setStep("approved")
      refetchAllowance().then(() => {
        setStep("minting")
        doMint()
      })
    }
  }, [isApproved])

  // Step 3: done
  useEffect(() => {
    if (isSuccess) {
      setStep("done")
      setTimeout(onClose, 1500)
    }
  }, [isSuccess])

  useEffect(() => {
    if (mintErr) {
      setErrorMsg((mintErr as Error)?.message?.slice(0, 150) ?? "Transaction failed")
      setStep("error")
    }
  }, [mintErr])

  const doMint = useCallback(() => {
    try {
      if (targetTier.id === 0) mintGold()
      else if (targetTier.id === 1) upgradeDiamond()
      else upgradePlatinum()
    } catch (e) {
      setErrorMsg((e as Error)?.message?.slice(0, 150) ?? "Transaction failed")
      setStep("error")
    }
  }, [targetTier.id])

  const handleClick = async () => {
    setErrorMsg("")
    try {
      if (needsApproval) {
        setStep("approving")
        await approve()
        // isApproved effect will trigger mint
      } else {
        setStep("minting")
        doMint()
      }
    } catch (e) {
      setErrorMsg((e as Error)?.message?.slice(0, 150) ?? "Transaction failed")
      setStep("idle")
    }
  }

  const btnLabel = () => {
    if (step === "approving" || isApproving) return "Step 1/2: Approving USDC..."
    if (step === "approved") return "Approved! Starting mint..."
    if (step === "minting" || isMinting) return "Step 2/2: Minting NFT..."
    if (step === "done") return "Success!"
    if (needsApproval) return "Step 1/2: Approve " + targetTier.mintPrice
    return targetTier.id === 0
      ? "Mint Gold -- " + targetTier.mintPrice
      : "Upgrade -- " + targetTier.mintPrice
  }

  const isLoading = step === "approving" || step === "approved" || step === "minting" || isApproving || isMinting

  return (
    <Modal open={open} onClose={onClose} title={targetTier.id === 0 ? "Become an Arbitrator" : "Upgrade Tier"}>
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: targetTier.color, marginBottom: 4 }}>
          {targetTier.title}
        </div>
        <div className="muted text-sm mb-16">{targetTier.req}</div>
      </div>

      {needsApproval && step === "idle" && (
        <div className="fee-box mb-12" style={{ borderColor: "var(--gold-bd)", background: "var(--gold-bg)" }}>
          <div className="text-sm" style={{ color: "var(--gold)" }}>
            2-step process: First approve USDC, then mint NFT.
            MetaMask will show 2 popups.
          </div>
        </div>
      )}

      {targetTier.reqs.length > 0 && (
        <div className="fee-box mb-16">
          <div className="section-label mb-8">Requirements</div>
          {targetTier.reqs.map((r, i) => {
            const met = i === 0 ? true
              : i === 1 ? (stats?.[0] ?? 0n) >= (targetTier.id === 1 ? 10n : 20n)
              : (stats?.[1] ?? 0n) >= 5n
            return (
              <div key={i} className="fee-row">
                <span className={met ? "text-teal" : "muted"}>
                  {met ? "[OK]" : "[ ]"} {r}
                </span>
                {i === 1 && stats && <span className="mono text-xs muted2">{String(stats[0])}/{targetTier.id === 1 ? "10" : "20"}</span>}
                {i === 2 && stats && <span className="mono text-xs muted2">{String(stats[1])}/5</span>}
              </div>
            )
          })}
        </div>
      )}

      <FeeBox rows={[
        { label: targetTier.id === 0 ? "Mint price" : "Upgrade fee", value: targetTier.mintPrice, color: targetTier.color, total: true },
        { label: "Fee per invoice milestone", value: targetTier.feePct, color: "var(--teal)" },
        { label: "Dispute fee (paid by loser)", value: "5% of milestone (min 50 USDC)" },
      ]} />

      {errorMsg && (
        <div className="mt-12" style={{ padding: "8px 12px", background: "var(--coral-bg)", borderRadius: 8, border: "1px solid var(--coral-bd)", fontSize: 12, color: "var(--coral)" }}>
          Error: {errorMsg}
        </div>
      )}

      {step === "done" && (
        <div className="mt-12" style={{ padding: "8px 12px", background: "var(--teal-bg)", borderRadius: 8, border: "1px solid var(--teal-bd)", fontSize: 12, color: "var(--teal)" }}>
          NFT minted successfully!
        </div>
      )}

      <div className="row gap-8 mt-16">
        <button className="btn btn-ghost" onClick={onClose} disabled={isLoading}>Cancel</button>
        <TxButton
          variant={targetTier.id === 0 ? "gold" : targetTier.id === 1 ? "diamond" : "platinum"}
          className="ml-auto"
          loading={isLoading}
          loadingText={btnLabel()}
          disabled={step === "done"}
          onClick={handleClick}
        >
          {btnLabel()}
        </TxButton>
      </div>
    </Modal>
  )
}

export function ArbitratorTab() {
  const { address } = useAccount()
  const { data: statsData, refetch: refetchStats } = useMyArbitratorStats()
  const { data: totalMinted } = useTotalMinted()
  const [mintModal, setMintModal] = useState<typeof TIERS[0] | null>(null)

  const myTier = statsData ? Number(statsData[4]) : undefined
  const isArbitrator = myTier !== undefined && myTier !== 0xff && myTier < 3
  const myStats = statsData

  const upgradeTarget = !isArbitrator ? TIERS[0]
    : myTier === 0 ? TIERS[1]
    : myTier === 1 ? TIERS[2]
    : null

  return (
    <div className="col gap-16 animate-in">
      <div className="row mb-8">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Arbitrator</h2>
          <p className="muted mt-4 text-sm">Max 10 NFTs globally | Unanimous voting | Non-transferable during disputes</p>
        </div>
        <div className="chain-pill ml-auto">
          <span className="chain-dot" />
          <span>{totalMinted !== undefined ? String(totalMinted) : "0"}/10 slots</span>
        </div>
      </div>

      {address && isArbitrator && myStats && (
        <div className="card" style={{
          border: "1px solid " + (myTier === 2 ? "var(--platinum-bd)" : myTier === 1 ? "var(--diamond-bd)" : "var(--gold-bd)")
        }}>
          <div className="row gap-12 mb-12">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{TIERS[myTier]?.title}</div>
              <div className="muted2 text-xs mono mt-4">{address}</div>
            </div>
            <TierBadge tier={myTier} />
          </div>
          <div className="stats-grid">
            <StatCard label="Invoices" value={String(myStats[0])} sub="Completed" />
            <StatCard label="Disputes resolved" value={String(myStats[1])} />
            <StatCard label="Active disputes" value={String(myStats[2])}
              color={Number(myStats[2]) > 0 ? "var(--coral)" : undefined} />
          </div>
          {upgradeTarget && (
            <div className="mt-12">
              <TxButton
                variant={myTier === 0 ? "diamond" : "platinum"}
                size="sm"
                onClick={() => setMintModal(upgradeTarget)}
              >
                Upgrade to {upgradeTarget.title}
              </TxButton>
            </div>
          )}
        </div>
      )}

      <div className="grid-3">
        {TIERS.map(t => (
          <div key={t.id} className={"nft-card " + t.cls}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.color, letterSpacing: 2, marginBottom: 8, fontFamily: "var(--mono)" }}>
              {t.key.toUpperCase()}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.color, marginBottom: 4 }}>{t.title}</div>
            <div className="mono text-xs muted2 mb-12">{t.mintPrice}</div>
            <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.6, marginBottom: 12 }}>{t.req}</div>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text3)" }}>
              Fee: <span style={{ color: t.color }}>{t.feePct}</span> per milestone
            </div>
            <div className="divider-sm" />
            <div className="row gap-8 text-xs mono muted2">
              <span>Min invoices: <strong>{t.id === 0 ? "0" : t.id === 1 ? "10" : "20"}</strong></span>
              <span>Min disputes: <strong>{t.id < 2 ? "0" : "5"}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {!isArbitrator && (
        <div className="card" style={{
          border: "1px solid var(--gold-bd)",
          background: "var(--gold-bg)",
          textAlign: "center",
          padding: 32,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Become an Arbitrator</div>
          <p className="muted text-sm mb-16">
            Join as a Gold arbitrator for 200 USDC. Earn fees on every invoice you are named on.
          </p>
          <TxButton variant="gold" onClick={() => setMintModal(TIERS[0])}>
            Mint Gold NFT -- 200 USDC
          </TxButton>
        </div>
      )}

      <FeeBox title="Fee schedule" rows={[
        { label: "Gold (0.5%) per milestone, always earned when named on invoice", value: "Always active", color: "var(--gold)" },
        { label: "Diamond (0.7%) per milestone", value: "Always active", color: "var(--diamond)" },
        { label: "Platinum (1.0%) per milestone", value: "Always active", color: "var(--platinum)" },
        { label: "Dispute fee: 5% of milestone (min 50 USDC), paid by loser", value: "On dispute", color: "var(--coral)" },
        { label: "Unanimous vote required -- all arbitrators must agree", value: "No majority voting" },
      ]} />

      {mintModal && (
        <MintModal
          open={!!mintModal}
          onClose={() => { setMintModal(null); refetchStats() }}
          targetTier={mintModal}
          currentTier={myTier}
          stats={myStats}
        />
      )}
    </div>
  )
}