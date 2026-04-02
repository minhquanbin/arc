"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract } from "wagmi"
import type { Address } from "viem"
import { CONTRACTS, ARBITRATOR_NFT_ABI, SERVICE_AGREEMENT_ABI } from "@/lib/contracts"
import { parseUSDC, fmtUSDC, computeDisputeDeposit, shortenAddr } from "@/lib/utils"
import { useCreateInvoice } from "@/hooks/useInvoice"
import { useApproveUSDC } from "@/hooks/useApproveUSDC"
import { useTotalAgreements, useAgreement } from "@/hooks/useServiceAgreement"
import { Field, TxButton, Modal, FeeBox } from "@/components/ui"

// ---- Arbitrator row ---------------------------------------------------------

function ArbRow({ addr, selected, onToggle, disabled }: {
  addr: string; selected: boolean; onToggle: () => void; disabled: boolean
}) {
  const { data: stats } = useReadContract({
    address: CONTRACTS.ARBITRATOR_NFT,
    abi: ARBITRATOR_NFT_ABI,
    functionName: "getStats",
    args: [addr as Address],
    query: { enabled: !!addr, staleTime: 30000 },
  })
  const tierLabels = ["Gold", "Diamond", "Platinum"]
  const tier = stats ? Number(stats[4]) : 0
  const tierLabel = tier < 3 ? tierLabels[tier] : "Gold"
  const tierColor = tier === 2 ? "var(--platinum)" : tier === 1 ? "var(--diamond)" : "var(--gold)"

  return (
    <div onClick={() => !disabled && onToggle()}
      style={{
        padding: "10px 14px", borderRadius: 8, cursor: disabled && !selected ? "not-allowed" : "pointer",
        opacity: disabled && !selected ? 0.4 : 1,
        border: "1px solid " + (selected ? "var(--teal)" : "var(--border)"),
        background: selected ? "var(--teal-bg)" : "var(--bg3)",
        transition: "all 0.15s",
      }}>
      <div className="row gap-8">
        <div style={{ flex: 1 }}>
          <div className="row gap-8">
            <span style={{ fontWeight: 600, fontSize: 13, fontFamily: "var(--mono)" }}>
              {addr.slice(0, 6)}...{addr.slice(-4)}
            </span>
            <span className="badge" style={{ fontSize: 9, color: tierColor, borderColor: tierColor }}>
              {tierLabel}
            </span>
          </div>
          {stats && (
            <div className="muted2 text-xs mono mt-4">
              {String(stats[0])} invoices completed - {String(stats[1])} disputes resolved
            </div>
          )}
        </div>
        {selected && <span style={{ color: "var(--teal)", fontSize: 12 }}>[OK]</span>}
      </div>
    </div>
  )
}

// ---- Agreement selector row -------------------------------------------------

function AgreementRow({ tokenId, onSelect, selected }: {
  tokenId: bigint; onSelect: () => void; selected: boolean
}) {
  const { data: ag } = useAgreement(tokenId)
  if (!ag) return null
  return (
    <div onClick={onSelect}
      style={{
        padding: "10px 14px", borderRadius: 8, cursor: "pointer",
        border: "1px solid " + (selected ? "var(--teal)" : "var(--border)"),
        background: selected ? "var(--teal-bg)" : "var(--bg3)",
        transition: "all 0.15s", marginBottom: 8,
      }}>
      <div className="row gap-8">
        <div style={{ flex: 1 }}>
          <div className="row gap-8">
            <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>NFT #{String(ag.tokenId)}</span>
            <span className="badge badge-active" style={{ fontSize: 9 }}>SIGNED</span>
          </div>
          <div className="muted2 text-xs mono mt-4">
            Vendor: {shortenAddr(ag.vendor)}
            {ag.invoiceId > 0n && <span style={{ color: "var(--coral)", marginLeft: 8 }}>Already linked to Invoice #{String(ag.invoiceId)}</span>}
          </div>
        </div>
        {selected && <span style={{ color: "var(--teal)", fontSize: 12 }}>[OK]</span>}
      </div>
    </div>
  )
}

// ---- Milestone form ---------------------------------------------------------

interface MilestoneForm {
  desc: string; amount: string; start: string; due: string
}

interface Props {
  onBack: () => void
  knownArbitrators: string[]
}

// ---- Main component ---------------------------------------------------------

export function CreateInvoice({ onBack, knownArbitrators }: Props) {
  const { address } = useAccount()

  // Agreement linking
  const [agreementModalOpen, setAgreementModalOpen] = useState(false)
  const [selectedAgreementId, setSelectedAgreementId] = useState<bigint | null>(null)
  const { data: agData } = useAgreement(selectedAgreementId ?? undefined)

  // Form state
  const [vendor, setVendor] = useState("")
  const [content, setContent] = useState("")
  const [milestones, setMilestones] = useState<MilestoneForm[]>([
    { desc: "", amount: "", start: "", due: "" },
  ])
  const [selArbs, setSelArbs] = useState<string[]>([])
  const [arbModalOpen, setArbModalOpen] = useState(false)
  const [arbInput, setArbInput] = useState("")

  // Auto-fill from linked agreement
  useEffect(() => {
    if (agData) {
      setVendor(agData.vendor)
      // Pre-fill content from agreement if empty
      if (!content) {
        setContent("Service Agreement NFT #" + String(agData.tokenId) + " | Client: " + agData.client + " | Vendor: " + agData.vendor)
      }
    }
  }, [agData])

  // Total amounts
  const total = milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0)
  const totalWei = total > 0 ? parseUSDC(total.toString()) : 0n
  const disputeDep = totalWei > 0n ? computeDisputeDeposit(totalWei) : 0n
  const lockAmount = totalWei + disputeDep

  const { needsApproval, approve, isApproving, isApproved, refetchAllowance } =
    useApproveUSDC(CONTRACTS.INVOICE_ESCROW, lockAmount)
  const { createInvoice, isPending, isSuccess, error } = useCreateInvoice()

  useEffect(() => { if (isApproved) refetchAllowance() }, [isApproved])
  useEffect(() => { if (isSuccess) onBack() }, [isSuccess])

  const addMilestone = () => setMilestones(p => [...p, { desc: "", amount: "", start: "", due: "" }])
  const removeMilestone = (i: number) =>
    milestones.length > 1 && setMilestones(p => p.filter((_, j) => j !== i))
  const updM = (i: number, k: keyof MilestoneForm, v: string) =>
    setMilestones(p => p.map((m, j) => j === i ? { ...m, [k]: v } : m))

  const toggleArb = (addr: string) => {
    setSelArbs(prev =>
      prev.includes(addr) ? prev.filter(a => a !== addr)
      : prev.length < 5 ? [...prev, addr] : prev
    )
  }

  const canSubmit =
    !!vendor && !!content && selArbs.length >= 3 &&
    milestones.every(m => m.desc && m.amount && m.start && m.due) && total > 0

  const handleSubmit = () => {
    if (needsApproval) { approve(); return }
    createInvoice({
      vendor: vendor as Address,
      arbitrators: selArbs as Address[],
      content,
      milestones,
    })
  }

  // Load on-chain agreements for selector
  const { data: totalAgreements } = useTotalAgreements()
  const agreementIds = totalAgreements && totalAgreements > 0n
    ? Array.from({ length: Number(totalAgreements) }, (_, i) => BigInt(i + 1))
    : []

  // Filter agreements where current user is client
  const myAgreementIds = agreementIds // filtered inside AgreementRow

  return (
    <div className="col gap-16 animate-in">
      <div className="row gap-12 mb-8">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create Invoice</h2>
      </div>

      {/* Section 0: Link Service Agreement */}
      <div className="card" style={{ border: selectedAgreementId ? "1px solid var(--teal-bd)" : "1px solid var(--border2)", background: selectedAgreementId ? "var(--teal-bg)" : "var(--bg2)" }}>
        <div className="row gap-12 mb-8">
          <div>
            <div className="section-label" style={{ margin: 0 }}>Service Agreement (optional)</div>
            <p className="muted text-xs mt-4">Link a signed Service Agreement NFT to this invoice for legal backing.</p>
          </div>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setAgreementModalOpen(true)}>
            {selectedAgreementId ? "Change" : "Select Agreement"}
          </button>
        </div>
        {selectedAgreementId && agData ? (
          <div className="fee-box" style={{ fontSize: 12 }}>
            <div className="fee-row">
              <span className="muted">Agreement</span>
              <span className="mono text-teal">NFT #{String(agData.tokenId)}</span>
            </div>
            <div className="fee-row">
              <span className="muted">Vendor (auto-filled)</span>
              <span className="mono">{shortenAddr(agData.vendor)}</span>
            </div>
            <div className="fee-row">
              <span className="muted">Content Hash</span>
              <span className="mono text-xs">{agData.contentHash.slice(0, 18)}...</span>
            </div>
            <div className="fee-row">
              <span className="muted">Status</span>
              <span className="text-teal">Both parties signed [OK]</span>
            </div>
          </div>
        ) : (
          <p className="muted text-xs">No agreement selected. You can still create an invoice without one.</p>
        )}
        {selectedAgreementId && (
          <button className="btn btn-ghost btn-sm mt-8" style={{ color: "var(--coral)", fontSize: 11 }}
            onClick={() => { setSelectedAgreementId(null); setVendor(""); setContent("") }}>
            Remove link
          </button>
        )}
      </div>

      {/* Section 1: Parties */}
      <div className="card">
        <div className="section-label mb-12">Parties</div>
        <div className="grid-2">
          <Field label="Your wallet (Client)">
            <input className="input" value={address ?? ""} readOnly style={{ opacity: 0.6 }} />
          </Field>
          <Field label="Vendor wallet *" hint={agData ? "Auto-filled from agreement" : "Enter vendor wallet address"}>
            <input className="input" placeholder="0x..." value={vendor}
              onChange={e => setVendor(e.target.value)}
              style={{ opacity: agData ? 0.7 : 1 }}
              readOnly={!!agData} />
          </Field>
        </div>
        <div className="mt-16">
          <Field label="Scope / description *">
            <textarea className="textarea" placeholder="Describe the work, deliverables, acceptance criteria..."
              value={content} onChange={e => setContent(e.target.value)} style={{ minHeight: 90 }} />
          </Field>
        </div>
      </div>

      {/* Section 2: Milestones */}
      <div className="card">
        <div className="row mb-12">
          <div className="section-label" style={{ margin: 0 }}>Milestones</div>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={addMilestone}>+ Add</button>
        </div>
        {milestones.map((m, i) => (
          <div key={i} style={{ background: "var(--bg3)", borderRadius: 10, padding: 14, marginBottom: 10, border: "1px solid var(--border)" }}>
            <div className="row mb-8">
              <span className="mono muted2 text-xs">MILESTONE {i + 1}</span>
              {milestones.length > 1 && (
                <button className="btn btn-ghost btn-icon btn-sm ml-auto"
                  style={{ fontSize: 13, color: "var(--text3)" }}
                  onClick={() => removeMilestone(i)}>X</button>
              )}
            </div>
            <div className="form-grid gap-12">
              <Field label="Description *">
                <input className="input" placeholder={"Phase " + (i + 1) + " deliverable..."} value={m.desc}
                  onChange={e => updM(i, "desc", e.target.value)} />
              </Field>
              <div className="grid-3">
                <Field label="Amount (USDC) *">
                  <input className="input" type="number" min="0" placeholder="0" value={m.amount}
                    onChange={e => updM(i, "amount", e.target.value)} />
                </Field>
                <Field label="Start date *">
                  <input className="input" type="date" value={m.start}
                    onChange={e => updM(i, "start", e.target.value)} />
                </Field>
                <Field label="Due date *">
                  <input className="input" type="date" value={m.due}
                    onChange={e => updM(i, "due", e.target.value)} />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Section 3: Arbitrators */}
      <div className="card">
        <div className="row mb-8">
          <div>
            <div className="section-label" style={{ margin: 0 }}>
              Arbitrators ({selArbs.length}/5, min 3)
            </div>
            <p className="muted text-xs mt-4">
              Select 3-5 ArbitratorNFT holders to resolve disputes.
              {agData && " Agreement requires " + (agData as any)?.arbitratorCount + " arbitrators."}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setArbModalOpen(true)}>
            Select arbitrators
          </button>
        </div>

        {selArbs.length === 0 ? (
          <div style={{ padding: "12px 16px", background: "var(--bg3)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <p className="muted text-sm">No arbitrators selected. Min 3 required.</p>
            {knownArbitrators.length > 0 && (
              <p className="muted text-xs mt-4">
                {knownArbitrators.length} arbitrator(s) available on this network.
              </p>
            )}
          </div>
        ) : (
          <div className="col gap-8">
            {selArbs.map(a => (
              <div key={a} className="row gap-8"
                style={{ padding: "10px 14px", background: "var(--teal-bg)", borderRadius: 8, border: "1px solid var(--teal-bd)" }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--mono)", fontWeight: 600 }}>
                    {a.slice(0, 6)}...{a.slice(-4)}
                  </span>
                </div>
                <span style={{ color: "var(--teal)", fontSize: 11 }}>[OK]</span>
                <button className="btn btn-ghost btn-icon btn-sm" style={{ fontSize: 12, color: "var(--text3)" }}
                  onClick={() => toggleArb(a)}>X</button>
              </div>
            ))}
          </div>
        )}

        {selArbs.length > 0 && selArbs.length < 3 && (
          <div className="mt-8" style={{ fontSize: 12, color: "var(--coral)" }}>
            Need at least {3 - selArbs.length} more arbitrator(s).
          </div>
        )}
      </div>

      {/* Payment summary */}
      {total > 0 && (
        <FeeBox title="Payment breakdown" rows={[
          { label: "Contract total", value: fmtUSDC(totalWei) },
          { label: "Dispute deposit (5%, min 50 USDC)", value: fmtUSDC(disputeDep), color: "var(--gold)" },
          { label: "Total you lock now", value: fmtUSDC(lockAmount), color: "var(--teal)", total: true },
          { label: "Vendor also locks (dispute deposit)", value: fmtUSDC(disputeDep), color: "var(--text2)" },
        ]} />
      )}

      {error && (
        <div style={{ color: "var(--coral)", fontSize: 12 }}>
          Error: {(error as Error)?.message?.slice(0, 120)}
        </div>
      )}

      <div className="row gap-12">
        <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
        <TxButton variant="primary" className="ml-auto" disabled={!canSubmit}
          loading={isApproving || isPending}
          loadingText={isApproving ? "Approving USDC..." : "Creating..."}
          onClick={handleSubmit}>
          {needsApproval ? "Approve " + fmtUSDC(lockAmount) : "Lock and Create Invoice"}
        </TxButton>
      </div>

      {/* Agreement selector modal */}
      <Modal open={agreementModalOpen} onClose={() => setAgreementModalOpen(false)} title="Select Service Agreement">
        <p className="muted text-sm mb-12">
          Select a signed Service Agreement where you are the client.
          Vendor address will be auto-filled.
        </p>
        {agreementIds.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No agreements found</div>
            <p className="empty-desc">Create and sign a Service Agreement first.</p>
          </div>
        ) : (
          <div className="col">
            {agreementIds.map(id => (
              <AgreementFilterRow
                key={id.toString()}
                tokenId={id}
                clientAddress={address ?? ""}
                selected={selectedAgreementId === id}
                onSelect={() => { setSelectedAgreementId(id); setAgreementModalOpen(false) }}
              />
            ))}
          </div>
        )}
        <div className="row mt-16">
          <button className="btn btn-ghost btn-sm" onClick={() => setAgreementModalOpen(false)}>Close</button>
        </div>
      </Modal>

      {/* Arbitrator selector modal */}
      <Modal open={arbModalOpen} onClose={() => setArbModalOpen(false)} title="Select Arbitrators (3-5)">
        <div className="fee-box mb-12" style={{ fontSize: 12 }}>
          <div className="fee-row">
            <span className="muted">Selected</span>
            <span className="mono">{selArbs.length}/5</span>
          </div>
          <div className="fee-row">
            <span className="muted">Min required</span>
            <span className="mono">3</span>
          </div>
          <div className="fee-row">
            <span className="muted">Fees earned (passive)</span>
            <span className="mono">0.5-1.0% per milestone</span>
          </div>
        </div>

        <div className="field mb-12">
          <label className="field-label">Add arbitrator by wallet address</label>
          <div className="row gap-8">
            <input className="input grow" placeholder="0x..." value={arbInput}
              onChange={e => setArbInput(e.target.value)} />
            <button className="btn btn-ghost btn-sm"
              onClick={() => { if (arbInput) { toggleArb(arbInput); setArbInput("") } }}>
              Add
            </button>
          </div>
        </div>

        <div className="section-label mb-8">Verified arbitrators on this network</div>
        <div className="col gap-8">
          {knownArbitrators.length === 0 ? (
            <p className="muted text-sm">No arbitrators found on-chain. Add manually above.</p>
          ) : (
            <>
              <div className="muted2 text-xs mb-8">
                Sorted by tier: Platinum then Diamond then Gold -- {knownArbitrators.length} arbitrator(s) found
              </div>
              {knownArbitrators.map(a => (
                <ArbRow key={a} addr={a} selected={selArbs.includes(a)}
                  onToggle={() => toggleArb(a)}
                  disabled={selArbs.length >= 5 && !selArbs.includes(a)} />
              ))}
            </>
          )}
        </div>
        <div className="row mt-16">
          <span className="muted text-sm">{selArbs.length}/5 selected (min 3)</span>
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => setArbModalOpen(false)}>Done</button>
        </div>
      </Modal>
    </div>
  )
}

// ---- Agreement filter row (only show if current user is client) --------------

function AgreementFilterRow({ tokenId, clientAddress, selected, onSelect }: {
  tokenId: bigint; clientAddress: string; selected: boolean; onSelect: () => void
}) {
  const { data: ag } = useAgreement(tokenId)
  if (!ag) return null
  if (ag.client.toLowerCase() !== clientAddress.toLowerCase()) return null
  return <AgreementRow tokenId={tokenId} selected={selected} onSelect={onSelect} />
}