'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { parseUSDC, fmtUSDC, computeDisputeDeposit, getTierIcon, getTierLabel, getTierColor } from '@/lib/utils'
import { useCreateInvoice } from '@/hooks/useInvoice'
import { useApproveUSDC } from '@/hooks/useApproveUSDC'
import { useIsArbitrator, useArbitratorTier } from '@/hooks/useArbitrator'
import { Field, TxButton, Modal, FeeBox, TierBadge, EmptyState } from '@/components/ui'
import { ARBITRATOR_NFT_ABI } from '@/lib/contracts'
import { useReadContract } from 'wagmi'

// â”€â”€ Arbitrator selector row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ArbRow({
  addr, selected, onToggle, disabled,
}: { addr: string; selected: boolean; onToggle: () => void; disabled: boolean }) {
  const { data: isArb } = useIsArbitrator(addr as Address)
  const { data: tier } = useArbitratorTier(addr as Address)
  const { data: stats } = useReadContract({
    address: CONTRACTS.ARBITRATOR_NFT,
    abi: ARBITRATOR_NFT_ABI,
    functionName: 'getStats',
    args: [addr as Address],
    query: { enabled: !!addr },
  })

  if (!isArb) return null

  const tierNum = Number(tier ?? 0)
  return (
    <div
      className={`arb-row ${selected ? 'selected' : ''}`}
      onClick={() => !disabled && onToggle()}
      style={{ opacity: disabled && !selected ? 0.5 : 1 }}
    >
      <span style={{ fontSize: 22 }}>{getTierIcon(tierNum)}</span>
      <div style={{ flex: 1 }}>
        <div className="row gap-8">
          <span style={{ fontWeight: 600, fontSize: 13 }}>{addr.slice(0, 6)}â€¦{addr.slice(-4)}</span>
          <TierBadge tier={tierNum} />
        </div>
        {stats && (
          <div className="muted2 text-xs mono mt-4">
            {String(stats[0])} invoices Â· {String(stats[1])} disputes resolved
          </div>
        )}
      </div>
      {selected && <span className="text-teal">âœ“</span>}
    </div>
  )
}

interface MilestoneForm {
  desc: string
  amount: string
  start: string
  due: string
}

interface Props {
  onBack: () => void
  knownArbitrators: string[]  // passed from parent (fetched from events)
}

export function CreateInvoice({ onBack, knownArbitrators }: Props) {
  const { address } = useAccount()

  // Form state
  const [vendor, setVendor] = useState('')
  const [content, setContent] = useState('')
  const [milestones, setMilestones] = useState<MilestoneForm[]>([
    { desc: '', amount: '', start: '', due: '' },
  ])
  const [selArbs, setSelArbs] = useState<string[]>([])
  const [arbModalOpen, setArbModalOpen] = useState(false)
  const [arbInput, setArbInput] = useState('')

  const total = milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0)
  const totalWei = parseUSDC(total.toString())
  const disputeDep = computeDisputeDeposit(totalWei)
  const lockAmount = totalWei + disputeDep

  // Highest tier among selected arbs (for fee calc â€” simplified, uses 0.5/0.7/1%)
  const arbFeeBps = 50 // default gold; real calc done on-chain
  const arbFeeWei = (totalWei * BigInt(arbFeeBps)) / 10_000n

  // Approve + Create hooks
  const { needsApproval, approve, isApproving, isApproved, refetchAllowance } = useApproveUSDC(
    CONTRACTS.INVOICE_ESCROW, lockAmount
  )
  const { createInvoice, isPending, isSuccess, error } = useCreateInvoice()

  useEffect(() => { if (isApproved) refetchAllowance() }, [isApproved])
  useEffect(() => { if (isSuccess) onBack() }, [isSuccess])

  // Milestone helpers
  const addMilestone = () => setMilestones(p => [...p, { desc: '', amount: '', start: '', due: '' }])
  const removeMilestone = (i: number) =>
    milestones.length > 1 && setMilestones(p => p.filter((_, j) => j !== i))
  const updM = (i: number, k: keyof MilestoneForm, v: string) =>
    setMilestones(p => p.map((m, j) => j === i ? { ...m, [k]: v } : m))

  const toggleArb = (addr: string) => {
    setSelArbs(prev =>
      prev.includes(addr)
        ? prev.filter(a => a !== addr)
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

  return (
    <div className="col gap-16 animate-in">
      <div className="row gap-12 mb-8">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>â† Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create Invoice</h2>
      </div>

      {/* â”€â”€ Parties â”€â”€ */}
      <div className="card">
        <div className="section-label mb-12">Parties</div>
        <div className="grid-2">
          <Field label="Your wallet (Client)">
            <input className="input input-disabled" value={address ?? ''} readOnly />
          </Field>
          <Field label="Vendor wallet *" required>
            <input
              className="input"
              placeholder="0x..."
              value={vendor}
              onChange={e => setVendor(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-16">
          <Field label="Scope / description *" required>
            <textarea
              className="textarea"
              placeholder="Describe the work, deliverables, and acceptance criteriaâ€¦"
              value={content}
              onChange={e => setContent(e.target.value)}
              style={{ minHeight: 90 }}
            />
          </Field>
        </div>
      </div>

      {/* â”€â”€ Milestones â”€â”€ */}
      <div className="card">
        <div className="row gap-12 mb-12">
          <div className="section-label" style={{ margin: 0 }}>Milestones</div>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={addMilestone}>+ Add</button>
        </div>

        {milestones.map((m, i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg3)', borderRadius: 10, padding: 14,
              marginBottom: 10, border: '1px solid var(--border)',
            }}
          >
            <div className="row mb-8">
              <span className="mono muted2 text-xs">MILESTONE {i + 1}</span>
              {milestones.length > 1 && (
                <button
                  className="btn btn-ghost btn-icon btn-sm ml-auto"
                  style={{ fontSize: 14, color: 'var(--text3)' }}
                  onClick={() => removeMilestone(i)}
                >âœ•</button>
              )}
            </div>
            <div className="form-grid gap-12">
              <Field label="Description *">
                <input
                  className="input"
                  placeholder={`Phase ${i + 1} deliverableâ€¦`}
                  value={m.desc}
                  onChange={e => updM(i, 'desc', e.target.value)}
                />
              </Field>
              <div className="grid-3">
                <Field label="Amount (USDC) *">
                  <input
                    className="input"
                    type="number" min="0" placeholder="0"
                    value={m.amount}
                    onChange={e => updM(i, 'amount', e.target.value)}
                  />
                </Field>
                <Field label="Start date *">
                  <input className="input" type="date" value={m.start} onChange={e => updM(i, 'start', e.target.value)} />
                </Field>
                <Field label="Due date *">
                  <input className="input" type="date" value={m.due} onChange={e => updM(i, 'due', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* â”€â”€ Arbitrators â”€â”€ */}
      <div className="card">
        <div className="row mb-12">
          <div className="section-label" style={{ margin: 0 }}>
            Trá»ng tÃ i ({selArbs.length}/5 selected — min 3, max 5)
          </div>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setArbModalOpen(true)}>
            Select arbitrators
          </button>
        </div>

        {selArbs.length === 0 ? (
          <p className="muted text-sm">No arbitrators selected yet. Min 3, max 5.</p>
        ) : (
          <div className="col gap-8">
            {selArbs.map(a => (
              <div key={a} className="row gap-8" style={{ padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--mono)' }}>{a.slice(0, 6)}â€¦{a.slice(-4)}</span>
                <button
                  className="btn btn-ghost btn-icon btn-sm ml-auto"
                  style={{ fontSize: 13 }}
                  onClick={() => toggleArb(a)}
                >âœ•</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* â”€â”€ Fee breakdown â”€â”€ */}
      {total > 0 && (
        <FeeBox
          title="Payment breakdown"
          rows={[
            { label: 'Contract total', value: fmtUSDC(totalWei) },
            { label: 'Dispute deposit (5%, min 50 USDC)', value: fmtUSDC(disputeDep), color: 'var(--gold)' },
            { label: 'Total you lock now', value: fmtUSDC(lockAmount), color: 'var(--teal)', total: true },
            { label: 'Vendor also locks (dispute deposit)', value: fmtUSDC(disputeDep), color: 'var(--text2)' },
            { label: 'Dispute fee if escalated (5%, paid by loser)', value: fmtUSDC((totalWei * 500n) / 10_000n), color: 'var(--coral)' },
          ]}
        />
      )}

      {error && (
        <div style={{ color: 'var(--coral)', fontSize: 12 }}>
          Error: {(error as Error)?.message?.slice(0, 120)}
        </div>
      )}

      {/* â”€â”€ Actions â”€â”€ */}
      <div className="row gap-12">
        <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
        <TxButton
          variant="primary"
          className="ml-auto"
          disabled={!canSubmit}
          loading={isApproving || isPending}
          loadingText={isApproving ? 'Approving USDCâ€¦' : 'Creatingâ€¦'}
          onClick={handleSubmit}
        >
          {needsApproval
            ? `Approve ${fmtUSDC(lockAmount)}`
            : `Lock & Create Invoice`}
        </TxButton>
      </div>

      {/* â”€â”€ Arbitrator modal â”€â”€ */}
      <Modal open={arbModalOpen} onClose={() => setArbModalOpen(false)} title="Select arbitrators (3â€“5)">
        <div className="field mb-12">
          <label className="field-label">Add by wallet address</label>
          <div className="row gap-8">
            <input
              className="input grow"
              placeholder="0x..."
              value={arbInput}
              onChange={e => setArbInput(e.target.value)}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { if (arbInput) { toggleArb(arbInput); setArbInput('') } }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="section-label mb-8">Known arbitrators on-chain</div>
        <div className="col gap-8">
          {knownArbitrators.length === 0 ? (
            <p className="muted text-sm">No arbitrators found on-chain yet.</p>
          ) : (
            knownArbitrators.map(a => (
              <ArbRow
                key={a}
                addr={a}
                selected={selArbs.includes(a)}
                onToggle={() => toggleArb(a)}
                disabled={selArbs.length >= 5 && !selArbs.includes(a)}
              />
            ))
          )}
        </div>

        <div className="row mt-16">
          <span className="muted text-sm">{selArbs.length}/5 selected</span>
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => setArbModalOpen(false)}>
            Done
          </button>
        </div>
      </Modal>
    </div>
  )
}
