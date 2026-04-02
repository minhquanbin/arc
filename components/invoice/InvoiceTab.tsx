"use client"

import { useState } from "react"
import { useAccount, useReadContract } from "wagmi"
import { CONTRACTS, INVOICE_ESCROW_ABI } from "@/lib/contracts"
import { fmtUSDC, fmtDate, shortenAddr } from "@/lib/utils"
import { InvoiceStatusBadge, MilestoneStatusBadge, TxButton, StatCard, EmptyState } from "@/components/ui"
import { CreateInvoice } from "./CreateInvoice"
import { MilestoneCard } from "./MilestoneCard"
import { useAcceptInvoice, useCancelInvoice, useVoteDispute, useInvoice, useMilestone } from "@/hooks/useInvoice"
import { useApproveUSDC } from "@/hooks/useApproveUSDC"
import { computeDisputeDeposit } from "@/lib/utils"
import { useMyInvoiceIds } from "@/hooks/useChainEvents"
import { ARBITRATOR_NFT_ABI } from "@/lib/contracts"
import { useAllArbitrators } from "@/hooks/useArbitrator"

const DEMO_IDS = [1n, 2n, 3n, 4n]



function InvoiceDetail({ invoiceId, onBack }: { invoiceId: bigint; onBack: () => void }) {
  const { address } = useAccount()
  const { data: inv, refetch } = useInvoice(invoiceId)
  const { accept, isPending: accepting } = useAcceptInvoice()
  const { cancel, isPending: cancelling } = useCancelInvoice()
  const { vote, isPending: voting } = useVoteDispute()

  if (!inv) return (
    <div className="col gap-12 animate-in">
      <button className="btn btn-ghost btn-sm" style={{ width: "fit-content" }} onClick={onBack}>Back</button>
      <div className="card muted text-sm">Loading invoice...</div>
    </div>
  )

  const [client, vendor, arbitrators, content, totalAmount, status, createdAt, milestoneCount] = inv
  const isClient = address?.toLowerCase() === (client as string).toLowerCase()
  const isVendor = address?.toLowerCase() === (vendor as string).toLowerCase()
  const isArbitrator = (arbitrators as string[]).some(a => a.toLowerCase() === address?.toLowerCase())
  const disputeDeposit = computeDisputeDeposit(totalAmount as bigint)

  const { needsApproval: vendorNeedsApprove, approve: approveVendor, isApproving: vendorApproving } =
    useApproveUSDC(CONTRACTS.INVOICE_ESCROW, disputeDeposit)

  const milestoneArr = Array.from({ length: Number(milestoneCount) }, (_, i) => i)

  return (
    <div className="col gap-16 animate-in">
      <div className="row gap-12 mb-8">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Invoice #{invoiceId.toString()}</h2>
        <InvoiceStatusBadge status={status as 0} />
      </div>

      <div className="card">
        <div className="grid-3 mb-16">
          <div>
            <div className="section-label">Client</div>
            <div className="mono text-sm">{shortenAddr(client as string)}</div>
            {isClient && <span className="badge badge-active mt-4">You</span>}
          </div>
          <div>
            <div className="section-label">Vendor</div>
            <div className="mono text-sm">{shortenAddr(vendor as string)}</div>
            {isVendor && <span className="badge badge-active mt-4">You</span>}
          </div>
          <div>
            <div className="section-label">Created</div>
            <div className="text-sm">{fmtDate(Number(createdAt))}</div>
          </div>
        </div>
        <div className="divider" />
        <div className="section-label mt-12 mb-8">Scope</div>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7 }}>{content as string}</p>
        <div className="divider" />
        <div className="row gap-8">
          <div>
            <div className="section-label">Total</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--teal)" }}>
              {fmtUSDC(totalAmount as bigint)}
            </div>
          </div>
          <div className="ml-auto" style={{ textAlign: "right" }}>
            <div className="section-label">Arbitrators ({(arbitrators as string[]).length})</div>
            <div className="col gap-4 mt-4">
              {(arbitrators as string[]).map((a: string) => (
                <span key={a} className="mono text-xs muted2">{shortenAddr(a)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {status === 0 && isVendor && (
        <div className="card" style={{ border: "1px solid var(--gold-bd)", background: "var(--gold-bg)" }}>
          <div className="section-label mb-8">Action required</div>
          <p className="muted text-sm mb-12">
            Accept this invoice to begin work. You need to lock {fmtUSDC(disputeDeposit)} as dispute deposit.
          </p>
          <TxButton
            variant="primary"
            loading={vendorApproving || accepting}
            loadingText={vendorApproving ? "Approving USDC..." : "Accepting..."}
            onClick={() => {
              if (vendorNeedsApprove) approveVendor()
              else { accept(invoiceId); setTimeout(refetch, 3000) }
            }}
          >
            {vendorNeedsApprove ? "Approve " + fmtUSDC(disputeDeposit) : "Accept Invoice"}
          </TxButton>
        </div>
      )}

      {status === 0 && isClient && (
        <TxButton variant="danger" size="sm" loading={cancelling} loadingText="Cancelling..."
          onClick={() => { cancel(invoiceId); setTimeout(onBack, 3000) }}>
          Cancel Invoice
        </TxButton>
      )}

      {status === 4 && isArbitrator && (
        <div className="card" style={{ border: "1px solid var(--coral-bd)", background: "var(--coral-bg)" }}>
          <div className="section-label mb-8">Dispute -- Cast Your Vote</div>
          <p className="muted text-sm mb-12">All arbitrators must vote unanimously. Losing party pays 5% dispute fee.</p>
          {milestoneArr.map(i => (
            <div key={i} className="mb-8">
              <div className="muted2 text-xs mb-8">Milestone {i + 1}</div>
              <div className="row gap-8">
                <TxButton variant="primary" size="sm" loading={voting} loadingText="Voting..."
                  onClick={() => { vote(invoiceId, BigInt(i), true); setTimeout(refetch, 3000) }}>
                  Client wins (refund)
                </TxButton>
                <TxButton variant="gold" size="sm" loading={voting} loadingText="Voting..."
                  onClick={() => { vote(invoiceId, BigInt(i), false); setTimeout(refetch, 3000) }}>
                  Vendor wins (release)
                </TxButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="section-label mb-12">Milestones ({milestoneArr.length})</div>
        {milestoneArr.map(i => (
          <MilestoneLoader key={i} invoiceId={invoiceId} index={i}
            client={client as string} vendor={vendor as string} onRefresh={refetch} />
        ))}
      </div>
    </div>
  )
}

function MilestoneLoader({ invoiceId, index, client, vendor, onRefresh }: {
  invoiceId: bigint; index: number; client: string; vendor: string; onRefresh: () => void
}) {
  const { data } = useMilestone(invoiceId, BigInt(index))
  if (!data) return (
    <div className="milestone-item">
      <div className="muted2 text-xs">Loading milestone {index + 1}...</div>
    </div>
  )
  const [description, amount, startDate, dueDate, submittedAt, status] = data
  return (
    <MilestoneCard invoiceId={invoiceId} index={index}
      data={{ description: description as string, amount: amount as bigint, startDate: startDate as bigint, dueDate: dueDate as bigint, submittedAt: submittedAt as bigint, status: status as number }}
      client={client} vendor={vendor} onRefresh={onRefresh} />
  )
}

function InvoiceRow({ id, onSelect }: { id: bigint; onSelect: () => void }) {
  const { data: inv } = useInvoice(id)
  const { address } = useAccount()

  if (!inv) return (
    <div style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", marginBottom: 6, opacity: 0.5 }}>
      <div className="muted2 text-xs mono">Invoice #{id.toString()} loading...</div>
    </div>
  )

  const [client, vendor,,, totalAmount, status, createdAt] = inv
  const isMe = [client, vendor].some(a => (a as string).toLowerCase() === address?.toLowerCase())

  return (
    <div onClick={onSelect} className="card-hover"
      style={{ display: "grid", gridTemplateColumns: "56px 1fr 130px 120px 90px", gap: 12, alignItems: "center", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", marginBottom: 6, cursor: "pointer" }}>
      <span className="mono muted2 text-xs">#{id.toString()}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{shortenAddr(client as string)} to {shortenAddr(vendor as string)}</div>
        {isMe && <span className="badge badge-active" style={{ fontSize: 9, marginTop: 4 }}>Your invoice</span>}
      </div>
      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--teal)" }}>{fmtUSDC(totalAmount as bigint)}</span>
      <InvoiceStatusBadge status={status as 0} />
      <span className="mono muted2 text-xs">{fmtDate(Number(createdAt))}</span>
    </div>
  )
}

export function InvoiceTab() {
  const { address } = useAccount()
  const [view, setView] = useState<"list" | "create" | "detail">("list")
  const [selectedId, setSelectedId] = useState<bigint | null>(null)
  const { ids: chainIds, loading: idsLoading } = useMyInvoiceIds()
  const knownArbitrators = useAllArbitrators()

  const displayIds = address && chainIds.length > 0 ? chainIds : DEMO_IDS

  if (view === "create") return (
    <CreateInvoice onBack={() => setView("list")} knownArbitrators={knownArbitrators} />
  )

  if (view === "detail" && selectedId !== null) return (
    <InvoiceDetail invoiceId={selectedId} onBack={() => setView("list")} />
  )

  return (
    <div className="col gap-16 animate-in">
      <div className="row mb-8">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Invoices</h2>
          <p className="muted mt-4 text-sm">USDC escrow - Milestone payments - Auto-release after 7 days</p>
        </div>
        <TxButton variant="primary" className="ml-auto" onClick={() => setView("create")}>
          + New Invoice
        </TxButton>
      </div>

      <div className="stats-grid">
        <StatCard label="Total USDC locked" value="--" sub="Connect wallet" />
        <StatCard label="Active invoices" value="--" sub="As client or vendor" />
        <StatCard label="Completed" value="--" sub="All time" />
      </div>

      <div className="card">
        <div className="section-label mb-12">All Invoices</div>
        <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 130px 120px 90px", gap: 12, padding: "0 16px 10px", borderBottom: "1px solid var(--border)" }}>
          {["ID", "PARTIES", "AMOUNT", "STATUS", "DATE"].map(h => (
            <span key={h} className="muted2 text-xs mono">{h}</span>
          ))}
        </div>
        <div className="mt-8">
          {!address ? (
            <EmptyState icon="" title="Connect your wallet" desc="Connect to see your invoices." />
          ) : idsLoading ? (
            <div className="empty"><div className="spinner" style={{ margin: "0 auto" }} /></div>
          ) : (
            displayIds.map(id => (
              <InvoiceRow key={id.toString()} id={id}
                onSelect={() => { setSelectedId(id); setView("detail") }} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}