"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { CONTRACTS } from "@/lib/contracts"
import { parseUSDC, fmtUSDC } from "@/lib/utils"
import { Field, TxButton, Modal, FeeBox, Tag } from "@/components/ui"
import { ListingCard } from "./ListingCard"
import {
  useMyProfile, useMarketplaceFees,
  useRegister, usePostListing, useApplyToListing,
} from "@/hooks/useMarketplace"
import { useApproveUSDC } from "@/hooks/useApproveUSDC"
import { useReadContract } from "wagmi"
import { MARKETPLACE_ABI } from "@/lib/contracts"

function RegisterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", xHandle: "", gmail: "", bio: "", userType: 0 as 0 | 1 })
  const { register, isPending, isSuccess, error } = useRegister()
  useEffect(() => { if (isSuccess) onClose() }, [isSuccess])

  return (
    <Modal open={open} onClose={onClose} title="Create Profile">
      <div className="row gap-8 mb-16">
        {[{ v: 0, label: "Business", sub: "Post job listings" }, { v: 1, label: "Member", sub: "Post skills and apply" }].map(({ v, label, sub }) => (
          <div key={v} onClick={() => setForm(p => ({ ...p, userType: v as 0 | 1 }))}
            style={{
              flex: 1, padding: 12, borderRadius: 10, cursor: "pointer", textAlign: "center",
              border: "1px solid " + (form.userType === v ? "var(--teal)" : "var(--border)"),
              background: form.userType === v ? "var(--teal-bg)" : "var(--bg3)",
              transition: "all 0.15s",
            }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{label}</div>
            <div className="muted2 text-xs">{sub}</div>
          </div>
        ))}
      </div>
      <div className="form-grid gap-12">
        <Field label="Display name *">
          <input className="input" placeholder="Your name or company" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <div className="grid-2">
          <Field label="X (Twitter) handle" hint="For display and trust">
            <input className="input" placeholder="@handle" value={form.xHandle} onChange={e => setForm(p => ({ ...p, xHandle: e.target.value }))} />
          </Field>
          <Field label="Gmail address" hint="For notifications">
            <input className="input" type="email" placeholder="you@gmail.com" value={form.gmail} onChange={e => setForm(p => ({ ...p, gmail: e.target.value }))} />
          </Field>
        </div>
        <Field label="Bio">
          <textarea className="textarea" placeholder="Short description..." value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} style={{ minHeight: 72 }} />
        </Field>
      </div>
      {error && <div className="text-sm mt-8" style={{ color: "var(--coral)" }}>{(error as Error)?.message?.slice(0, 120)}</div>}
      <div className="row gap-8 mt-16">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <TxButton variant="primary" className="ml-auto" disabled={!form.name} loading={isPending} loadingText="Registering..."
          onClick={() => register(form)}>
          Create Profile (gas only)
        </TxButton>
      </div>
    </Modal>
  )
}

function PostModal({ open, onClose, userType }: { open: boolean; onClose: () => void; userType: 0 | 1 }) {
  const [tier, setTier] = useState<0 | 1 | 2>(0)
  const [form, setForm] = useState({ title: "", description: "", tags: "", budget: "", durationDays: "0" })
  const { hotFee, superHotFee } = useMarketplaceFees()
  const fee = tier === 2 ? (superHotFee ?? 5n * 10n ** 18n) : tier === 1 ? (hotFee ?? 10n ** 18n) : 0n
  const { needsApproval, approve, isApproving } = useApproveUSDC(CONTRACTS.MARKETPLACE, fee)
  const { post, isPending, isSuccess, error } = usePostListing()
  useEffect(() => { if (isSuccess) onClose() }, [isSuccess])

  const tierOptions = [
    { id: 0, label: "Normal", sub: "Free -- gas only", detail: "New posts appear first" },
    { id: 1, label: "Hot", sub: hotFee ? fmtUSDC(hotFee) : "1 USDC", detail: "1.5x larger card, highlighted" },
    { id: 2, label: "Super Hot", sub: superHotFee ? fmtUSDC(superHotFee) : "5 USDC", detail: "Pinned top, featured, 2.25x larger" },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Post a Listing" maxWidth={600}>
      <div className="row gap-8 mb-16">
        {tierOptions.map(t => (
          <div key={t.id} onClick={() => setTier(t.id as 0 | 1 | 2)}
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
              border: "1px solid " + (tier === t.id ? "var(--teal)" : "var(--border)"),
              background: tier === t.id ? "var(--teal-bg)" : "var(--bg3)",
              transition: "all 0.15s",
            }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{t.label}</div>
            <div className="mono muted2 text-xs">{t.sub}</div>
            <div className="muted2 text-xs mt-4">{t.detail}</div>
          </div>
        ))}
      </div>
      {tier === 2 && (
        <div style={{ padding: "8px 12px", background: "var(--coral-bg)", border: "1px solid var(--coral-bd)", borderRadius: 8, marginBottom: 14, fontSize: 12, color: "var(--coral)" }}>
          Super Hot: pinned to top, featured badge, 2.25x card size, premium visibility
        </div>
      )}
      <div className="form-grid gap-12">
        <div>
          <div className="section-label mb-4">Listing type</div>
          <div className="chain-pill" style={{ width: "fit-content" }}>
            {userType === 0 ? "Business -- Job posting" : "Member -- Skill listing"}
          </div>
        </div>
        <Field label="Title *">
          <input className="input" placeholder={userType === 0 ? "Looking for a Solidity developer..." : "Full-stack Web3 Engineer available..."} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
        </Field>
        <Field label="Description *">
          <textarea className="textarea" placeholder="Detailed description..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ minHeight: 100 }} />
        </Field>
        <div className="grid-2">
          <Field label="Tags (comma-separated)">
            <input className="input" placeholder="solidity, react, defi" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
          </Field>
          <Field label="Budget (USDC, 0 = negotiable)">
            <input className="input" type="number" min="0" placeholder="0" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} />
          </Field>
        </div>
        <Field label="Duration (days, 0 = no expiry)">
          <input className="input" type="number" min="0" placeholder="30" value={form.durationDays} onChange={e => setForm(p => ({ ...p, durationDays: e.target.value }))} />
        </Field>
      </div>
      {tier > 0 && (
        <div className="mt-12">
          <FeeBox rows={[{ label: "Tier fee", value: fmtUSDC(fee), color: tier === 2 ? "var(--coral)" : "var(--gold)", total: true }]} />
        </div>
      )}
      {error && <div className="text-sm mt-8" style={{ color: "var(--coral)" }}>{(error as Error)?.message?.slice(0, 120)}</div>}
      <div className="row gap-8 mt-16">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <TxButton
          variant={tier === 2 ? "danger" : tier === 1 ? "gold" : "primary"}
          className="ml-auto"
          disabled={!form.title || !form.description}
          loading={isApproving || isPending}
          loadingText={isApproving ? "Approving USDC..." : "Posting..."}
          onClick={() => {
            if (tier > 0 && needsApproval) { approve(); return }
            post({ tier, title: form.title, description: form.description, tags: form.tags, budget: form.budget, durationDays: parseInt(form.durationDays) || 0 })
          }}>
          {tier > 0 && needsApproval ? "Approve " + fmtUSDC(fee) : "Post" + (tier > 0 ? " -- " + fmtUSDC(fee) : " (Free)")}
        </TxButton>
      </div>
    </Modal>
  )
}

function ApplyModal({ open, onClose, listingId, listingTitle }: {
  open: boolean; onClose: () => void; listingId: bigint; listingTitle: string
}) {
  const [message, setMessage] = useState("")
  const { apply, isPending, isSuccess, error } = useApplyToListing()
  useEffect(() => { if (isSuccess) onClose() }, [isSuccess])

  return (
    <Modal open={open} onClose={onClose} title="Apply to listing">
      <div className="fee-box mb-12">
        <div className="section-label mb-4">Applying to</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{listingTitle}</div>
      </div>
      <Field label="Cover message *">
        <textarea className="textarea" placeholder="Introduce yourself and describe your experience..." value={message} onChange={e => setMessage(e.target.value)} style={{ minHeight: 120 }} />
      </Field>
      {error && <div className="text-sm mt-8" style={{ color: "var(--coral)" }}>{(error as Error)?.message?.slice(0, 120)}</div>}
      <div className="row gap-8 mt-16">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <TxButton variant="primary" className="ml-auto" disabled={!message} loading={isPending} loadingText="Submitting..."
          onClick={() => apply(listingId, message)}>
          Submit application (gas only)
        </TxButton>
      </div>
    </Modal>
  )
}

function ListingDetail({ id, onBack }: { id: bigint; onBack: () => void }) {
  const { address } = useAccount()
  const { data: profile } = useMyProfile()
  const [applyOpen, setApplyOpen] = useState(false)

  const { data: listingData } = useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: "listings",
    args: [id],
  })

  if (!listingData) return (
    <div className="col gap-12 animate-in">
      <button className="btn btn-ghost btn-sm" style={{ width: "fit-content" }} onClick={onBack}>Back</button>
      <div className="card muted text-sm">Loading...</div>
    </div>
  )

  const [, owner, listingType, tier, title, description, tags, budget, createdAt,, active] = listingData
  const isOwner = (owner as string).toLowerCase() === address?.toLowerCase()
  const isMember = profile && (profile as any)[1] === 1
  const canApply = isMember && !isOwner && active && listingType === 0

  return (
    <div className="col gap-16 animate-in">
      <div className="row gap-12 mb-8">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>Back</button>
        <span className={"badge " + (listingType === 0 ? "badge-job" : "badge-skill")}>
          {listingType === 0 ? "JOB" : "SKILL"}
        </span>
        {tier === 2 && <span className="badge badge-disputed">SUPER HOT</span>}
        {tier === 1 && <span className="badge badge-gold">HOT</span>}
      </div>
      <div className="card">
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{title as string}</h2>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8, marginBottom: 16 }}>{description as string}</p>
        <div className="row gap-8 mb-16" style={{ flexWrap: "wrap" }}>
          {(tags as string).split(",").map(t => t.trim()).filter(Boolean).map(t => <Tag key={t}>{t}</Tag>)}
        </div>
        <div className="divider" />
        <div className="grid-3 mt-12">
          <div>
            <div className="section-label">Budget</div>
            <div className="mono text-lg text-teal">{(budget as bigint) > 0n ? fmtUSDC(budget as bigint) : "Negotiable"}</div>
          </div>
          <div>
            <div className="section-label">Posted by</div>
            <div className="mono text-sm">{(owner as string).slice(0, 6)}...{(owner as string).slice(-4)}</div>
          </div>
          <div>
            <div className="section-label">Status</div>
            <span className={"badge " + (active ? "badge-active" : "badge-cancelled")}>{active ? "ACTIVE" : "CLOSED"}</span>
          </div>
        </div>
        {canApply && (
          <div className="mt-16">
            <TxButton variant="primary" onClick={() => setApplyOpen(true)}>Apply for this position</TxButton>
          </div>
        )}
      </div>
      <ApplyModal open={applyOpen} onClose={() => setApplyOpen(false)} listingId={id} listingTitle={title as string} />
    </div>
  )
}

const MOCK_SUPER: any[] = [
  { id: 1n, owner: "0xABC", listingType: 0, tier: 2, title: "Senior Solidity Developer -- DeFi Protocol", description: "Looking for expert to audit and optimize our AMM smart contracts. Must have experience with Uniswap v4 and Foundry. Long-term engagement possible.", tags: "solidity,defi,audit,foundry", budget: 3000n * 10n ** 18n, createdAt: 1711000000n, expiresAt: 0n, active: true, ownerName: "DeFiProtocol Inc", ownerX: "@defiprotocol" },
]
const MOCK_HOT: any[] = [
  { id: 2n, owner: "0x111", listingType: 1, tier: 1, title: "Full-stack Web3 Engineer available", description: "5 years Web3 experience. React, Next.js, Wagmi, Solidity. Available for long-term projects or hourly contracts.", tags: "react,wagmi,typescript,nextjs", budget: 0n, createdAt: 1710900000n, expiresAt: 0n, active: true, ownerName: "dev.eth", ownerX: "@deveth" },
  { id: 3n, owner: "0x222", listingType: 0, tier: 1, title: "Smart Contract Auditor needed -- NFT marketplace", description: "Need security audit for our NFT marketplace before mainnet launch. Scope: 3 contracts, ~1500 LOC total.", tags: "audit,nft,security,solidity", budget: 5000n * 10n ** 18n, createdAt: 1710800000n, expiresAt: 0n, active: true, ownerName: "NFTLabs", ownerX: "@nftlabs" },
]
const MOCK_NORMAL: any[] = [
  { id: 4n, owner: "0x333", listingType: 1, tier: 0, title: "UI/UX Designer -- Web3 dApps", description: "Specializing in crypto-native interfaces. Figma, design systems, user research for DeFi products.", tags: "design,figma,ux,web3", budget: 0n, createdAt: 1710700000n, expiresAt: 0n, active: true, ownerName: "designr.eth", ownerX: "@designreth" },
  { id: 5n, owner: "0x444", listingType: 0, tier: 0, title: "Backend developer for blockchain indexer", description: "Node.js developer to build event indexer with PostgreSQL. Must know ethers.js and be comfortable with EVM events.", tags: "nodejs,postgres,ethers,indexer", budget: 2000n * 10n ** 18n, createdAt: 1710600000n, expiresAt: 0n, active: true, ownerName: "ChainIndex", ownerX: "@chainindex" },
  { id: 6n, owner: "0x555", listingType: 1, tier: 0, title: "Solidity tutor -- beginner to intermediate", description: "Teaching smart contract development. English and Vietnamese. 100+ students. Flexible schedule.", tags: "teaching,solidity,beginner,web3", budget: 0n, createdAt: 1710500000n, expiresAt: 0n, active: true, ownerName: "teach.eth", ownerX: "@teacheth" },
]

export function MarketplaceTab() {
  const { address } = useAccount()
  const { data: profile } = useMyProfile()
  const [filter, setFilter] = useState<"all" | "job" | "skill">("all")
  const [registerOpen, setRegisterOpen] = useState(false)
  const [postOpen, setPostOpen] = useState(false)
  const [detailId, setDetailId] = useState<bigint | null>(null)

  const hasProfile = profile && (profile as any)[7] === true
  const userType = hasProfile ? (profile as any)[1] as 0 | 1 : 0

  if (detailId !== null) return <ListingDetail id={detailId} onBack={() => setDetailId(null)} />

  const filterFn = (l: any) => filter === "all" || (filter === "job" ? l.listingType === 0 : l.listingType === 1)
  const supers  = MOCK_SUPER.filter(filterFn)
  const hots    = MOCK_HOT.filter(filterFn)
  const normals = MOCK_NORMAL.filter(filterFn)

  return (
    <div className="col gap-16 animate-in">
      <div className="row mb-8">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Marketplace</h2>
          <p className="muted mt-4 text-sm">On-chain job board | Link X and Gmail | 3 listing tiers</p>
        </div>
        <div className="row gap-8 ml-auto">
          {!hasProfile && (
            <TxButton variant="ghost" onClick={() => setRegisterOpen(true)}>Create Profile</TxButton>
          )}
          <TxButton variant="primary" onClick={() => hasProfile ? setPostOpen(true) : setRegisterOpen(true)}>
            + Post listing
          </TxButton>
        </div>
      </div>

      {hasProfile && (
        <div className="card" style={{ padding: "12px 16px" }}>
          <div className="row gap-12">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{(profile as any)[2]}</div>
              <div className="row gap-8 mt-4 text-xs muted2 mono">
                <span>{(profile as any)[3]}</span>
                <span>{(profile as any)[4]}</span>
              </div>
            </div>
            <span className={"badge " + (userType === 0 ? "badge-active" : "badge-gold")}>
              {userType === 0 ? "Business" : "Member"}
            </span>
          </div>
        </div>
      )}

      <div className="row gap-8">
        {[["all", "All"], ["job", "Jobs"], ["skill", "Skills"]].map(([k, v]) => (
          <button key={k} className={"btn btn-sm " + (filter === k ? "btn-primary" : "btn-ghost")} onClick={() => setFilter(k as any)}>{v}</button>
        ))}
        <div className="chain-pill ml-auto">
          <span className="chain-dot" />
          <span>{supers.length + hots.length + normals.length} listings</span>
        </div>
      </div>

      {supers.length > 0 && (
        <div>
          <div className="section-label mb-8" style={{ color: "var(--coral)" }}>FEATURED LISTINGS</div>
          {supers.map(l => <ListingCard key={String(l.id)} data={l} onClick={() => setDetailId(l.id)} />)}
        </div>
      )}
      {hots.length > 0 && (
        <div>
          <div className="section-label mb-8" style={{ color: "var(--gold)" }}>HOT LISTINGS</div>
          {hots.map(l => <ListingCard key={String(l.id)} data={l} onClick={() => setDetailId(l.id)} />)}
        </div>
      )}
      {normals.length > 0 && (
        <div>
          <div className="section-label mb-8">STANDARD LISTINGS</div>
          {normals.map(l => <ListingCard key={String(l.id)} data={l} onClick={() => setDetailId(l.id)} />)}
        </div>
      )}

      <RegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)} />
      {hasProfile && <PostModal open={postOpen} onClose={() => setPostOpen(false)} userType={userType} />}
    </div>
  )
}