"use client"

import clsx from "clsx"

export function TierBadge({ tier }: { tier: number }) {
  const cls = tier === 2 ? "badge-platinum" : tier === 1 ? "badge-diamond" : "badge-gold"
  const labels = ["Gold", "Diamond", "Platinum"]
  return <span className={"badge " + cls}>{labels[tier] ?? "Unknown"}</span>
}

export function InvoiceStatusBadge({ status }: { status: number }) {
  const map: Record<number, [string, string]> = {
    0: ["badge-created", "CREATED"],
    1: ["badge-active", "ACTIVE"],
    2: ["badge-done", "COMPLETED"],
    3: ["badge-cancelled", "CANCELLED"],
    4: ["badge-disputed", "DISPUTED"],
  }
  const [cls, label] = map[status] ?? ["badge-done", "UNKNOWN"]
  return <span className={"badge " + cls}><span className="badge-dot" />{label}</span>
}

export function MilestoneStatusBadge({ status }: { status: number }) {
  const map: Record<number, [string, string]> = {
    0: ["badge-pending", "PENDING"],
    1: ["badge-submitted", "SUBMITTED"],
    2: ["badge-active", "APPROVED"],
    3: ["badge-resolved", "AUTO-RELEASED"],
    4: ["badge-disputed", "DISPUTED"],
    5: ["badge-done", "RESOLVED"],
  }
  const [cls, label] = map[status] ?? ["badge-done", "UNKNOWN"]
  return <span className={"badge " + cls}>{label}</span>
}

export function Spinner({ size = 24 }: { size?: number }) {
  return <div className="spinner" style={{ width: size, height: size }} />
}

interface TxButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  variant?: "primary" | "gold" | "diamond" | "platinum" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
}

export function TxButton({ loading, loadingText = "Confirming...", variant = "primary", size = "md", children, className, disabled, ...props }: TxButtonProps) {
  return (
    <button
      className={clsx("btn", "btn-" + variant, size === "sm" && "btn-sm", size === "lg" && "btn-lg", className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <><Spinner size={14} />{loadingText}</> : children}
    </button>
  )
}

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
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text3)", fontSize: 16, padding: "2px 6px",
              lineHeight: 1, fontFamily: "var(--mono)",
            }}
          >
            [X]
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

interface FieldProps {
  label: string; hint?: string; children: React.ReactNode; required?: boolean
}

export function Field({ label, hint, children, required }: FieldProps) {
  return (
    <div className="field">
      <label className="field-label">
        {label}{required && <span style={{ color: "var(--coral)" }}> *</span>}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

interface FeeRow { label: string; value: string; color?: string; total?: boolean }

export function FeeBox({ rows, title }: { rows: FeeRow[]; title?: string }) {
  return (
    <div className="fee-box">
      {title && <div className="section-label mb-8">{title}</div>}
      {rows.map((r, i) => (
        <div key={i} className={clsx("fee-row", r.total && "fee-row-total")}>
          <span className="fee-muted">{r.label}</span>
          <span className="mono" style={{ color: r.color ?? "var(--text)" }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

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

export function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color ?? "var(--text)" }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: "var(--mono)", color: "var(--text3)",
      background: "var(--bg3)", border: "1px solid var(--border)",
      padding: "2px 7px", borderRadius: 4,
    }}>
      {children}
    </span>
  )
}