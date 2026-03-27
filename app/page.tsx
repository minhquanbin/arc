"use client"

import { useState } from "react"
import { Header } from "@/components/layout/Header"
import { InvoiceTab } from "@/components/invoice/InvoiceTab"
import { ArbitratorTab } from "@/components/arbitrator/ArbitratorTab"
import { MarketplaceTab } from "@/components/marketplace/MarketplaceTab"
import { ToastContainer } from "@/components/ui/Toast"
import { useToast } from "@/hooks/useToast"

type Tab = "invoice" | "arbitrator" | "marketplace"

const TABS: { id: Tab; label: string; dotColor: string }[] = [
  { id: "invoice",     label: "Invoice",     dotColor: "var(--teal)" },
  { id: "arbitrator",  label: "Arbitrator",  dotColor: "var(--gold)" },
  { id: "marketplace", label: "Marketplace", dotColor: "var(--coral)" },
]

export default function Home() {
  const [tab, setTab] = useState<Tab>("invoice")
  const { toasts } = useToast()

  return (
    <div className="app-layout">
      <Header />

      <nav className="nav-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-item ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {tab === t.id && (
              <span className="nav-dot" style={{ background: t.dotColor }} />
            )}
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer"
            className="chain-pill" style={{ fontSize: 11, textDecoration: "none" }}>
            Faucet
          </a>
          <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer"
            className="chain-pill" style={{ fontSize: 11, textDecoration: "none" }}>
            <span className="chain-dot" />
            Explorer
          </a>
        </div>
      </nav>

      <main className="main-content">
        {tab === "invoice"     && <InvoiceTab />}
        {tab === "arbitrator"  && <ArbitratorTab />}
        {tab === "marketplace" && <MarketplaceTab />}
      </main>

      <footer style={{
        borderTop: "1px solid var(--border)", padding: "10px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg2)",
      }}>
        <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>
          ArcInvoice · Arc Testnet 5042002 · USDC native gas · Built with Arc + Circle
        </span>
        <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: "var(--teal)", fontFamily: "var(--mono)" }}>
          arcscan.app
        </a>
      </footer>

      <ToastContainer toasts={toasts} />
    </div>
  )
}