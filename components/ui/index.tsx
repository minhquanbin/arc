'use client'

import clsx from 'clsx'
import { getTierIcon, getTierLabel, getTierColor } from '@/lib/utils'
import { INVOICE_STATUS, MILESTONE_STATUS, type InvoiceStatus, type MilestoneStatus } from '@/lib/utils'

// ── TierBadge ─────────────────────────────────────────────────────────────────
export function TierBadge({ tier }: { tier: number }) {
  const cls = tier === 2 ? 'badge-platinum' : tier === 1 ? 'badge-diamond' : 'badge-gold'
  return (
    <span className={`badge ${cls}`}>
      {getTierIcon(tier)} {getTierLabel(tier)}
    </span>
  )
}

// ── InvoiceStatusBadge ────────────────────────────────────────────────────────
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<number, string> = {
    0: 'badge-created',
    1: 'badge-active',
    2: 'badge-done',
    3: 'badge-cancelled',
    4: 'badge-disputed',
  }
  return (
    <span className={`badge ${map[status] ?? 'badge-done'}`}>
      <span className="badge-dot" />
      {INVOICE_STATUS[status] ?? 'Unknown'}
    </span>
  )
}

// ── MilestoneStatusBadge ──────────────────────────────────────────────────────
export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  const map: Record<number, string> = {
    0: 'badge-pending',
    1: 'badge-submitted',
    2: 'badge-active',
    3: 'badge-resolved',
    4: 'badge-disputed',
    5: 'badge-done',
  }
  return (
    <span className={`badge ${map[status] ?? 'badge-done'}`}>
      {MILESTONE_STATUS[status] ?? 'Unknown'}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <div
      className="spinner"
      style={{ width: size, height: size }}
    />
  )
}

// ── TxButton ──────────────────────────────────────────────────────────────────
interface TxButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  variant?: 'primary' | 'gold' | 'diamond' | 'platinum' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function TxButton({
  loading,
  loadingText = 'Confirming…',
  variant = 'primary',
  size = 'md',
  children,
  className,
  disabled,
  ...props
}: TxButtonProps) {
  return (
    <button
      className={clsx(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size={14} />
          {loadingText}
        </>
      ) : children}
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: number
}

export function Modal({ open, onClose, title, children, maxWidth = 560 }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span>{title}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}
            style={{ fontSize: 16, color: 'var(--text3)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Field ─────────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
  required?: boolean
}

export function Field({ label, hint, children, required }: FieldProps) {
  return (
    <div className="field">
      <label className="field-label">
        {label}{required && <span style={{ color: 'var(--coral)' }}> *</span>}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

// ── FeeBox ────────────────────────────────────────────────────────────────────
interface FeeRow { label: string; value: string; color?: string; total?: boolean }

export function FeeBox({ rows, title }: { rows: FeeRow[]; title?: string }) {
  return (
    <div className="fee-box">
      {title && <div className="section-label mb-8">{title}</div>}
      {rows.map((r, i) => (
        <div key={i} className={clsx('fee-row', r.total && 'fee-row-total')}>
          <span className="fee-muted">{r.label}</span>
          <span className="mono" style={{ color: r.color ?? 'var(--text)' }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, desc, action }: {
  icon?: string; title: string; desc?: string; action?: React.ReactNode
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {desc && <p className="empty-desc">{desc}</p>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

// ── Tag ───────────────────────────────────────────────────────────────────────
export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)',
      background: 'var(--bg3)', border: '1px solid var(--border)',
      padding: '2px 7px', borderRadius: 4,
    }}>{children}</span>
  )
}
