'use client'

import { useAccount } from 'wagmi'
import { fmtDate, fmtUSDC, daysUntil } from '@/lib/utils'
import { MilestoneStatusBadge, TxButton } from '@/components/ui'
import { useSubmitMilestone, useApproveMilestone, useClaimAutoRelease, useOpenDispute } from '@/hooks/useInvoice'

interface MilestoneCardProps {
  invoiceId: bigint
  index: number
  data: {
    description: string
    amount: bigint
    startDate: bigint
    dueDate: bigint
    submittedAt: bigint
    status: number
  }
  client: string
  vendor: string
  onRefresh: () => void
}

export function MilestoneCard({ invoiceId, index, data, client, vendor, onRefresh }: MilestoneCardProps) {
  const { address } = useAccount()
  const isClient = address?.toLowerCase() === client.toLowerCase()
  const isVendor = address?.toLowerCase() === vendor.toLowerCase()

  const idx = BigInt(index)
  const { submit, isPending: submitting } = useSubmitMilestone()
  const { approve, isPending: approving } = useApproveMilestone()
  const { claim, isPending: claiming } = useClaimAutoRelease()
  const { openDispute, isPending: disputing } = useOpenDispute()

  const status = data.status as 0 | 1 | 2 | 3 | 4 | 5
  const autoReleaseAt = Number(data.submittedAt) + 7 * 86400
  const canAutoRelease = status === 1 && Date.now() / 1000 >= autoReleaseAt

  const overdue = status === 0 && Date.now() / 1000 > Number(data.dueDate)

  return (
    <div className="milestone-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
      {/* Header row */}
      <div className="row gap-12">
        <div
          style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--bg4)', border: '1px solid var(--border2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)',
            flexShrink: 0,
          }}
        >
          {index + 1}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{data.description}</div>
          <div className="row gap-8 mt-4">
            <span className="mono text-xs muted2">
              {fmtDate(Number(data.startDate))} → {fmtDate(Number(data.dueDate))}
            </span>
            {overdue && status === 0 && (
              <span className="badge badge-disputed" style={{ fontSize: 9 }}>OVERDUE</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal)' }}>
            {fmtUSDC(data.amount)}
          </div>
          <MilestoneStatusBadge status={status} />
        </div>
      </div>

      {/* Auto-release countdown */}
      {status === 1 && !canAutoRelease && (
        <div className="fee-box" style={{ padding: '8px 12px', fontSize: 11 }}>
          <div className="row gap-8">
            <span className="muted2">Auto-release in:</span>
            <span className="mono text-teal">
              {Math.max(0, Math.ceil((autoReleaseAt - Date.now() / 1000) / 86400))} days
            </span>
            <span className="muted2 text-xs">if client doesn't respond</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="row gap-8">
        {/* Vendor: submit when pending */}
        {isVendor && status === 0 && (
          <TxButton
            variant="primary"
            size="sm"
            loading={submitting}
            loadingText="Submitting…"
            onClick={() => { submit(invoiceId, idx); setTimeout(onRefresh, 3000) }}
          >
            Submit milestone
          </TxButton>
        )}

        {/* Client: approve or dispute when submitted */}
        {isClient && status === 1 && (
          <>
            <TxButton
              variant="primary"
              size="sm"
              loading={approving}
              loadingText="Approving…"
              onClick={() => { approve(invoiceId, idx); setTimeout(onRefresh, 3000) }}
            >
              ✓ Approve &amp; Release
            </TxButton>
            <TxButton
              variant="danger"
              size="sm"
              loading={disputing}
              loadingText="Opening…"
              onClick={() => { openDispute(invoiceId, idx); setTimeout(onRefresh, 3000) }}
            >
              Open Dispute
            </TxButton>
          </>
        )}

        {/* Vendor: auto-claim after 7 days */}
        {isVendor && status === 1 && canAutoRelease && (
          <TxButton
            variant="gold"
            size="sm"
            loading={claiming}
            loadingText="Claiming…"
            onClick={() => { claim(invoiceId, idx); setTimeout(onRefresh, 3000) }}
          >
            Claim (Auto-release)
          </TxButton>
        )}

        {/* Either party: open dispute on submitted */}
        {(isClient || isVendor) && status === 1 && !isClient && (
          <TxButton
            variant="danger"
            size="sm"
            loading={disputing}
            loadingText="Opening…"
            onClick={() => { openDispute(invoiceId, idx); setTimeout(onRefresh, 3000) }}
          >
            Open Dispute
          </TxButton>
        )}
      </div>
    </div>
  )
}
