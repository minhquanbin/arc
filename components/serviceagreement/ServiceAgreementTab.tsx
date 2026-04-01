"use client"

import { useState, useRef } from "react"
import { useAccount } from "wagmi"
import type { Address } from "viem"
import {
  useSignAgreement, useMintAgreement, useTotalAgreements,
  useAgreement, computeContentHash, uploadToIPFS, fetchNonceOnChain,
  type AgreementFields,
} from "@/hooks/useServiceAgreement"
import { CONTRACTS } from "@/lib/contracts"
import { Field, TxButton, StatCard, FeeBox } from "@/components/ui"
import { shortenAddr, fmtDate } from "@/lib/utils"

// ---- Storage helpers --------------------------------------------------------

const PREFIX = "arc_agreement_"

interface DraftState {
  id: string
  fields: AgreementFields
  contentHash: `0x${string}`
  ipfsCID: string
  clientSig: `0x${string}` | null
  vendorSig: `0x${string}` | null
  clientNonce: string
  vendorNonce: string
  step: 1 | 2 | 3 | 4
  createdAt: number
}

function saveDraft(d: DraftState) {
  try { localStorage.setItem(PREFIX + d.id, JSON.stringify(d)) } catch {}
}

function loadDraft(id: string): DraftState | null {
  try {
    const s = localStorage.getItem(PREFIX + id)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function clearDraft(id: string) {
  try { localStorage.removeItem(PREFIX + id) } catch {}
}

function listDrafts(): DraftState[] {
  try {
    const drafts: DraftState[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) {
        drafts.push(JSON.parse(localStorage.getItem(key)!))
      }
    }
    return drafts.sort((a, b) => b.createdAt - a.createdAt)
  } catch { return [] }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Encode draft into a shareable URL query param
function encodeDraftToUrl(draft: DraftState): string {
  try {
    const json = JSON.stringify(draft)
    const encoded = btoa(encodeURIComponent(json))
    return window.location.origin + window.location.pathname + "?agreement=" + encoded
  } catch { return "" }
}

// Decode draft from URL on page load (vendor flow)
function decodeDraftFromUrl(): DraftState | null {
  try {
    if (typeof window === "undefined") return null
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get("agreement")
    if (!encoded) return null
    const json = decodeURIComponent(atob(encoded))
    return JSON.parse(json)
  } catch { return null }
}

// ---- Empty form defaults ----------------------------------------------------

const EMPTY: AgreementFields = {
  projectTitle: "", description: "", deliverables: "", techStack: "",
  startDate: "", endDate: "", totalValue: "", paymentSchedule: "milestone",
  penaltyPct: "2", arbitratorCount: "3", confidential: true,
  ipOwnership: "client", terminationConditions: "",
  clientName: "", vendorName: "", clientAddress: "", vendorAddress: "",
  agreementDate: new Date().toISOString().split("T")[0],
}

// ---- Agreement Detail -------------------------------------------------------

function AgreementDetail({ tokenId, onBack }: { tokenId: bigint; onBack: () => void }) {
  const { data: ag } = useAgreement(tokenId)
  if (!ag) return (
    <div className="col gap-12 animate-in">
      <button className="btn btn-ghost btn-sm" style={{ width: "fit-content" }} onClick={onBack}>Back</button>
      <div className="card muted text-sm">Loading...</div>
    </div>
  )
  return (
    <div className="col gap-16 animate-in">
      <div className="row gap-12 mb-8">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Agreement #{tokenId.toString()}</h2>
        <span className="badge badge-active">SIGNED</span>
      </div>
      <div className="card">
        <div className="grid-3 mb-16">
          <div><div className="section-label">Token ID</div><div className="mono text-sm">#{String(ag.tokenId)}</div></div>
          <div><div className="section-label">Created</div><div className="text-sm">{fmtDate(Number(ag.createdAt))}</div></div>
          <div><div className="section-label">Invoice</div><div className="mono text-sm">{ag.invoiceId > 0n ? "#" + String(ag.invoiceId) : "Not linked"}</div></div>
        </div>
        <div className="divider" />
        <div className="grid-2 mt-12">
          <div><div className="section-label">Client</div><div className="mono text-sm">{shortenAddr(ag.client)}</div><span className="badge badge-active mt-4">Signed</span></div>
          <div><div className="section-label">Vendor</div><div className="mono text-sm">{shortenAddr(ag.vendor)}</div><span className="badge badge-active mt-4">Signed</span></div>
        </div>
        <div className="divider mt-12" />
        <div className="mt-12">
          <div className="section-label mb-8">Content Hash</div>
          <div className="mono text-xs muted2" style={{ wordBreak: "break-all" }}>{ag.contentHash}</div>
        </div>
        <div className="mt-12">
          <div className="section-label mb-8">IPFS Document</div>
          <div className="row gap-8">
            <div className="mono text-xs muted2 grow" style={{ wordBreak: "break-all" }}>{ag.ipfsCID}</div>
            <a href={"https://ipfs.io/ipfs/" + ag.ipfsCID} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">View</a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Create / Sign Agreement ------------------------------------------------

function CreateAgreement({ initialDraft, onBack, onDone }: {
  initialDraft?: DraftState; onBack: () => void; onDone: () => void
}) {
  const { address } = useAccount()
  const [agreementId] = useState(initialDraft?.id ?? generateId())
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialDraft?.step ?? 1)
  const [fields, setFields] = useState<AgreementFields>(
    initialDraft?.fields ?? { ...EMPTY, clientAddress: address ?? "" }
  )
  const [clientSig, setClientSig] = useState<`0x${string}` | null>(initialDraft?.clientSig ?? null)
  const [vendorSig, setVendorSig] = useState<`0x${string}` | null>(initialDraft?.vendorSig ?? null)
  const [ipfsCID, setIpfsCID] = useState(initialDraft?.ipfsCID ?? "")
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const [copied, setCopied] = useState(false)

  const clientNonceRef = useRef<bigint>(
    initialDraft?.clientNonce ? BigInt(initialDraft.clientNonce) : 0n
  )
  const vendorNonceRef = useRef<bigint>(
    initialDraft?.vendorNonce ? BigInt(initialDraft.vendorNonce) : 0n
  )

  const isClient = !!address && fields.clientAddress !== "" &&
    address.toLowerCase() === fields.clientAddress.toLowerCase()
  const isVendor = !!address && fields.vendorAddress !== "" &&
    address.toLowerCase() === fields.vendorAddress.toLowerCase()

  const contentHash = computeContentHash(fields)
  const { sign, isPending: signing } = useSignAgreement()
  const { mint, isPending: minting, isSuccess: mintDone, error: mintError } = useMintAgreement()

  if (mintDone) { clearDraft(agreementId); onDone(); return null }

  const save = (overrides: Partial<DraftState> = {}) => {
    saveDraft({
      id: agreementId, fields, contentHash, ipfsCID,
      clientSig, vendorSig,
      clientNonce: clientNonceRef.current.toString(),
      vendorNonce: vendorNonceRef.current.toString(),
      step, createdAt: Date.now(),
      ...overrides,
    })
  }

  const getDraft = (): DraftState => ({
    id: agreementId, fields, contentHash, ipfsCID,
    clientSig, vendorSig,
    clientNonce: clientNonceRef.current.toString(),
    vendorNonce: vendorNonceRef.current.toString(),
    step, createdAt: Date.now(),
  })

  const upd = (k: keyof AgreementFields, v: string | boolean) =>
    setFields(p => ({ ...p, [k]: v }))

  const copyShareLink = () => {
    const url = encodeDraftToUrl(getDraft())
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const copyId = () => {
    navigator.clipboard.writeText(agreementId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClientSign = async () => {
    if (!isClient) {
      setStatusMsg("Connect CLIENT wallet: " + fields.clientAddress)
      return
    }
    setUploading(true)
    setStatusMsg("Uploading to IPFS...")
    try {
      const cid = await uploadToIPFS({ ...fields, contentHash, agreementId, version: "1.0" })
      setIpfsCID(cid)
      setStatusMsg("Sign in MetaMask as client...")
      const nonce = await fetchNonceOnChain(fields.clientAddress as Address, CONTRACTS.SERVICE_AGREEMENT)
      clientNonceRef.current = nonce
      const sig = await sign({
        client: fields.clientAddress as Address,
        vendor: fields.vendorAddress as Address,
        contentHash, nonce,
      })
      setClientSig(sig)
      const newStep = 3 as const
      setStep(newStep)
      save({ clientSig: sig, ipfsCID: cid, clientNonce: nonce.toString(), step: newStep })
      setStatusMsg("Client signed! Share the link with vendor.")
    } catch (e) { setStatusMsg("Error: " + (e as Error)?.message?.slice(0, 80)) }
    setUploading(false)
  }

  const handleVendorSign = async () => {
    if (!isVendor) {
      setStatusMsg("Connect VENDOR wallet: " + fields.vendorAddress)
      return
    }
    setStatusMsg("Sign in MetaMask as vendor...")
    try {
      const nonce = await fetchNonceOnChain(fields.vendorAddress as Address, CONTRACTS.SERVICE_AGREEMENT)
      vendorNonceRef.current = nonce
      const sig = await sign({
        client: fields.clientAddress as Address,
        vendor: fields.vendorAddress as Address,
        contentHash, nonce,
      })
      setVendorSig(sig)
      const newStep = 4 as const
      setStep(newStep)
      save({ vendorSig: sig, vendorNonce: nonce.toString(), step: newStep })
      setStatusMsg("Vendor signed! Ready to mint.")
    } catch (e) { setStatusMsg("Error: " + (e as Error)?.message?.slice(0, 80)) }
  }

  const handleMint = async () => {
    if (!clientSig || !vendorSig || !ipfsCID) {
      setStatusMsg("Missing signatures or IPFS CID")
      return
    }
    try {
      await mint({
        client: fields.clientAddress as Address,
        vendor: fields.vendorAddress as Address,
        contentHash, ipfsCID, clientSig, vendorSig,
        clientNonce: clientNonceRef.current,
        vendorNonce: vendorNonceRef.current,
      })
    } catch (e) { setStatusMsg("Mint error: " + (e as Error)?.message?.slice(0, 80)) }
  }

  return (
    <div className="col gap-16 animate-in">

      {/* Header */}
      <div className="row gap-12 mb-4">
        <button className="btn btn-ghost btn-sm" onClick={() => { save(); onBack() }}>Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Service Agreement</h2>
        <div className="row gap-8 ml-auto" style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", alignItems: "center" }}>
          <span className="muted text-xs">Agreement ID:</span>
          <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: "var(--teal)", letterSpacing: 2 }}>{agreementId}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={copyId} style={{ fontSize: 11 }}>[Copy]</button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="row gap-8 mb-4">
        {[["1","Fill form"],["2","Review"],["3","Client signs"],["4","Vendor + Mint"]].map(([n, label]) => (
          <div key={n} className="row gap-6" style={{ alignItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: step >= Number(n) ? "var(--teal)" : "var(--bg4)", border: "1px solid " + (step >= Number(n) ? "var(--teal)" : "var(--border2)"), color: step >= Number(n) ? "var(--bg)" : "var(--text3)" }}>{n}</div>
            <span style={{ fontSize: 11, color: step >= Number(n) ? "var(--text)" : "var(--text3)" }}>{label}</span>
            {Number(n) < 4 && <span className="muted2" style={{ fontSize: 10 }}>--</span>}
          </div>
        ))}
      </div>

      {/* Wallet status */}
      <div className="fee-box" style={{ padding: "8px 14px" }}>
        <div className="row gap-8">
          <span className="muted text-xs">Connected:</span>
          <span className="mono text-xs">{address ? shortenAddr(address) : "Not connected"}</span>
          {isClient && <span className="badge badge-active" style={{ fontSize: 9 }}>CLIENT</span>}
          {isVendor && <span className="badge badge-gold" style={{ fontSize: 9 }}>VENDOR</span>}
          {!isClient && !isVendor && address && <span className="muted2 text-xs">(not a party)</span>}
        </div>
      </div>

      {/* STEP 1: Form */}
      {step === 1 && (
        <>
          <div className="card">
            <div className="section-label mb-12">Section 1 - Parties</div>
            <div className="form-grid gap-12">
              <div className="grid-2">
                <Field label="Client full name *"><input className="input" placeholder="Company or individual" value={fields.clientName} onChange={e => upd("clientName", e.target.value)} /></Field>
                <Field label="Client wallet *" hint="Must match MetaMask when client signs">
                  <div className="row gap-8">
                    <input className="input grow" placeholder="0x..." value={fields.clientAddress} onChange={e => upd("clientAddress", e.target.value)} />
                    {address && <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => upd("clientAddress", address)}>Mine</button>}
                  </div>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Vendor full name *"><input className="input" placeholder="Company or individual" value={fields.vendorName} onChange={e => upd("vendorName", e.target.value)} /></Field>
                <Field label="Vendor wallet *" hint="Vendor connects this wallet to sign">
                  <input className="input" placeholder="0x..." value={fields.vendorAddress} onChange={e => upd("vendorAddress", e.target.value)} />
                </Field>
              </div>
              <Field label="Effective date *"><input className="input" type="date" value={fields.agreementDate} onChange={e => upd("agreementDate", e.target.value)} /></Field>
            </div>
          </div>

          <div className="card">
            <div className="section-label mb-12">Section 2 - Scope of Work</div>
            <div className="form-grid gap-12">
              <Field label="Project title *"><input className="input" placeholder="e.g. DeFi Smart Contract Development" value={fields.projectTitle} onChange={e => upd("projectTitle", e.target.value)} /></Field>
              <Field label="Detailed description *"><textarea className="textarea" style={{ minHeight: 100 }} placeholder="Full description of work..." value={fields.description} onChange={e => upd("description", e.target.value)} /></Field>
              <Field label="Deliverables *" hint="One per line"><textarea className="textarea" style={{ minHeight: 80 }} placeholder={"1. Audit report\n2. Unit tests\n3. Deployment"} value={fields.deliverables} onChange={e => upd("deliverables", e.target.value)} /></Field>
              <Field label="Technology stack"><input className="input" placeholder="Solidity, Foundry, React, Wagmi..." value={fields.techStack} onChange={e => upd("techStack", e.target.value)} /></Field>
            </div>
          </div>

          <div className="card">
            <div className="section-label mb-12">Section 3 - Timeline</div>
            <div className="grid-2">
              <Field label="Start date *"><input className="input" type="date" value={fields.startDate} onChange={e => upd("startDate", e.target.value)} /></Field>
              <Field label="End date *"><input className="input" type="date" value={fields.endDate} onChange={e => upd("endDate", e.target.value)} /></Field>
            </div>
          </div>

          <div className="card">
            <div className="section-label mb-12">Section 4 - Payment Terms</div>
            <div className="grid-2">
              <Field label="Total value (USDC) *"><input className="input" type="number" min="0" placeholder="0" value={fields.totalValue} onChange={e => upd("totalValue", e.target.value)} /></Field>
              <Field label="Late penalty (% per week)"><input className="input" type="number" min="0" max="10" placeholder="2" value={fields.penaltyPct} onChange={e => upd("penaltyPct", e.target.value)} /></Field>
            </div>
            <div className="mt-12">
              <Field label="Payment schedule">
                <select className="select-input" value={fields.paymentSchedule} onChange={e => upd("paymentSchedule", e.target.value)}>
                  <option value="milestone">Milestone-based (via Invoice)</option>
                  <option value="upfront">50% upfront, 50% on completion</option>
                  <option value="completion">100% on completion</option>
                  <option value="monthly">Monthly retainer</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="card">
            <div className="section-label mb-12">Section 5 - Dispute Resolution</div>
            <Field label="Number of arbitrators">
              <select className="select-input" value={fields.arbitratorCount} onChange={e => upd("arbitratorCount", e.target.value)}>
                <option value="3">3 arbitrators (minimum)</option>
                <option value="4">4 arbitrators</option>
                <option value="5">5 arbitrators (maximum)</option>
              </select>
            </Field>
            <div className="fee-box mt-12">
              <p className="muted text-sm">Unanimous vote required. Dispute fee: 5% of milestone, paid by losing party.</p>
            </div>
          </div>

          <div className="card">
            <div className="section-label mb-12">Section 6 - Terms</div>
            <div className="form-grid gap-12">
              <Field label="IP ownership">
                <select className="select-input" value={fields.ipOwnership} onChange={e => upd("ipOwnership", e.target.value)}>
                  <option value="client">Client owns IP upon full payment</option>
                  <option value="vendor">Vendor retains IP, grants license</option>
                  <option value="shared">Shared ownership (50/50)</option>
                </select>
              </Field>
              <Field label="Confidentiality (NDA)">
                <div className="row gap-8 mt-4">
                  {[{ v: true, l: "NDA applies" }, { v: false, l: "Public work" }].map(opt => (
                    <div key={String(opt.v)} onClick={() => upd("confidential", opt.v)}
                      style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, border: "1px solid " + (fields.confidential === opt.v ? "var(--teal)" : "var(--border)"), background: fields.confidential === opt.v ? "var(--teal-bg)" : "var(--bg3)" }}>
                      {opt.l}
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Termination conditions">
                <textarea className="textarea" style={{ minHeight: 80 }} placeholder="Either party may terminate with 14 days written notice." value={fields.terminationConditions} onChange={e => upd("terminationConditions", e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="row gap-12">
            <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
            <TxButton variant="primary" className="ml-auto"
              disabled={!fields.projectTitle || !fields.clientAddress || !fields.vendorAddress || !fields.startDate || !fields.endDate || !fields.totalValue}
              onClick={() => { save({ step: 2 }); setStep(2) }}>
              Review Agreement
            </TxButton>
          </div>
        </>
      )}

      {/* STEP 2: Review */}
      {step === 2 && (
        <>
          <div className="card">
            <div className="section-label mb-12">Agreement Preview</div>
            <div style={{ background: "var(--bg3)", borderRadius: 10, padding: 20, border: "1px solid var(--border)", fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.8, color: "var(--text2)" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12, fontFamily: "var(--sans)" }}>SERVICE AGREEMENT - {agreementId}</div>
              <p><strong>Project:</strong> {fields.projectTitle}</p>
              <p><strong>Date:</strong> {fields.agreementDate}</p>
              <br />
              <p><strong>CLIENT:</strong> {fields.clientName} ({fields.clientAddress})</p>
              <p><strong>VENDOR:</strong> {fields.vendorName} ({fields.vendorAddress})</p>
              <br />
              <p><strong>SCOPE:</strong></p>
              <p style={{ whiteSpace: "pre-wrap" }}>{fields.description}</p>
              <br />
              <p><strong>DELIVERABLES:</strong></p>
              <p style={{ whiteSpace: "pre-wrap" }}>{fields.deliverables}</p>
              <br />
              <p><strong>TIMELINE:</strong> {fields.startDate} -- {fields.endDate}</p>
              <p><strong>VALUE:</strong> {fields.totalValue} USDC | {fields.paymentSchedule}</p>
              <p><strong>LATE PENALTY:</strong> {fields.penaltyPct}% per week</p>
              <br />
              <p><strong>ARBITRATORS:</strong> {fields.arbitratorCount} | Unanimous vote | 5% dispute fee</p>
              <p><strong>IP:</strong> {fields.ipOwnership} | <strong>NDA:</strong> {fields.confidential ? "Yes" : "No"}</p>
              {fields.terminationConditions && <><br /><p><strong>TERMINATION:</strong> {fields.terminationConditions}</p></>}
              <br />
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <p>On-chain: Arc blockchain (Chain ID 5042002) | ERC-721 | EIP-712 signatures</p>
              </div>
            </div>
          </div>
          <div className="row gap-12">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Edit</button>
            <TxButton variant="primary" className="ml-auto"
              loading={uploading || signing}
              loadingText={uploading ? "Uploading to IPFS..." : "Signing..."}
              disabled={!isClient}
              onClick={handleClientSign}>
              {isClient ? "Upload and Sign as Client" : "Connect client wallet (" + shortenAddr(fields.clientAddress) + ")"}
            </TxButton>
          </div>
          {!isClient && fields.clientAddress && (
            <div style={{ padding: "10px 14px", background: "var(--coral-bg)", border: "1px solid var(--coral-bd)", borderRadius: 8, fontSize: 12, color: "var(--coral)" }}>
              Switch MetaMask to client wallet: {fields.clientAddress}
            </div>
          )}
        </>
      )}

      {/* STEP 3: Waiting for vendor */}
      {step === 3 && (
        <div className="col gap-12">
          <div className="card" style={{ border: "1px solid var(--teal-bd)", background: "var(--teal-bg)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--teal)" }}>Client signed successfully</div>
            <FeeBox rows={[
              { label: "Client (" + shortenAddr(fields.clientAddress) + ")", value: "[OK] Signed", color: "var(--teal)" },
              { label: "Vendor (" + shortenAddr(fields.vendorAddress) + ")", value: "[ ] Pending", color: "var(--text3)" },
              { label: "IPFS CID", value: ipfsCID.slice(0, 24) + "..." },
            ]} />
          </div>

          {/* Share with vendor */}
          <div className="card" style={{ border: "1px solid var(--gold-bd)", background: "var(--gold-bg)" }}>
            <div className="section-label mb-8" style={{ color: "var(--gold)" }}>Share with vendor to sign</div>
            <p className="muted text-sm mb-12">
              Send the vendor this link. They open it, connect their wallet, and sign.
            </p>
            <div className="col gap-8">
              {/* Big ID display */}
              <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "12px 16px", border: "1px solid var(--border)" }}>
                <div className="muted text-xs mb-4">Agreement ID</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, color: "var(--text)" }}>
                  {agreementId}
                </div>
              </div>
              <div className="row gap-8">
                <button className="btn btn-ghost btn-sm" onClick={copyId} style={{ fontSize: 12 }}>
                  [Copy] ID only
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={copyShareLink}
                  style={{ fontSize: 12 }}>
                  {copied ? "[OK] Link copied!" : "[Copy] Share Link (recommended)"}
                </button>
              </div>
              <div className="muted text-xs mt-4">
                Vendor wallet: <span className="mono">{fields.vendorAddress}</span>
              </div>
            </div>
          </div>

          {/* If vendor wallet is already connected */}
          {isVendor && (
            <div className="card" style={{ border: "1px solid var(--teal-bd)", background: "var(--teal-bg)", textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Vendor wallet connected</div>
              <p className="muted text-sm mb-12">You are now connected as vendor. Click below to sign.</p>
              <TxButton variant="primary" loading={signing} loadingText="Signing..." onClick={handleVendorSign}>
                Sign as Vendor ({shortenAddr(fields.vendorAddress)})
              </TxButton>
            </div>
          )}

          {statusMsg && (
            <div style={{ padding: "8px 12px", background: "var(--bg3)", borderRadius: 8, fontSize: 12, fontFamily: "var(--mono)", color: statusMsg.startsWith("Error") ? "var(--coral)" : "var(--teal)" }}>
              {statusMsg}
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Mint */}
      {step === 4 && (
        <div className="col gap-16">
          <div className="card" style={{ border: "1px solid var(--teal-bd)", background: "var(--teal-bg)", textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Both signatures collected</div>
            <p className="muted text-sm mb-16">Ready to mint as ERC-721 NFT on Arc blockchain.</p>
            <FeeBox rows={[
              { label: "Client (" + shortenAddr(fields.clientAddress) + ")", value: "[OK] Signed", color: "var(--teal)" },
              { label: "Vendor (" + shortenAddr(fields.vendorAddress) + ")", value: "[OK] Signed", color: "var(--teal)" },
              { label: "IPFS CID", value: ipfsCID.slice(0, 20) + "..." },
              { label: "Mint cost", value: "Gas only", color: "var(--teal)", total: true },
            ]} />
          </div>
          {(mintError || statusMsg) && (
            <div style={{ color: mintError ? "var(--coral)" : "var(--text2)", fontSize: 12 }}>
              {mintError ? "Error: " + (mintError as Error)?.message?.slice(0, 120) : statusMsg}
            </div>
          )}
          <TxButton variant="primary" loading={minting} loadingText="Minting NFT..." onClick={handleMint}>
            Mint Service Agreement NFT (gas only)
          </TxButton>
        </div>
      )}
    </div>
  )
}

// ---- Agreement List Row -----------------------------------------------------

function AgreementRow({ tokenId, onSelect }: { tokenId: bigint; onSelect: () => void }) {
  const { data: ag } = useAgreement(tokenId)
  if (!ag) return (
    <div style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", marginBottom: 6, opacity: 0.5 }}>
      <div className="muted2 text-xs mono">Agreement #{tokenId.toString()} loading...</div>
    </div>
  )
  return (
    <div onClick={onSelect} className="card-hover"
      style={{ display: "grid", gridTemplateColumns: "56px 1fr 100px 90px", gap: 12, alignItems: "center", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", marginBottom: 6, cursor: "pointer" }}>
      <span className="mono muted2 text-xs">#{String(ag.tokenId)}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{shortenAddr(ag.client)} -- {shortenAddr(ag.vendor)}</div>
        <div className="mono muted2 text-xs mt-4">{ag.ipfsCID.slice(0, 16)}...</div>
      </div>
      <span className="badge badge-active">SIGNED</span>
      <span className="mono muted2 text-xs">{fmtDate(Number(ag.createdAt))}</span>
    </div>
  )
}

// ---- Main Tab ---------------------------------------------------------------

export function ServiceAgreementTab() {
  const { address } = useAccount()
  const { data: total } = useTotalAgreements()

  // Auto-detect if vendor opened a shared link
  const [activeDraft, setActiveDraft] = useState<DraftState | undefined>(() => {
    const ud = decodeDraftFromUrl()
    if (ud) { saveDraft(ud); return ud }
    return undefined
  })

  const [view, setView] = useState<"list" | "create" | "detail">(() => {
    if (decodeDraftFromUrl()) return "create"
    return "list"
  })

  const [selectedId, setSelectedId] = useState<bigint | null>(null)
  const [lookupId, setLookupId] = useState("")
  const [lookupError, setLookupError] = useState("")

  const pendingDrafts = listDrafts().filter(d => d.step < 4)
  const demoIds = total && total > 0n
    ? Array.from({ length: Math.min(Number(total), 10) }, (_, i) => BigInt(i + 1))
    : []

  const handleLookup = () => {
    const id = lookupId.trim().toUpperCase()
    const draft = loadDraft(id)
    if (!draft) {
      setLookupError("ID not found locally. Ask client to share the full link using [Copy] Share Link button.")
      return
    }
    setLookupError("")
    setActiveDraft(draft)
    setView("create")
  }

  if (view === "create") return (
    <CreateAgreement
      initialDraft={activeDraft}
      onBack={() => { setActiveDraft(undefined); setView("list") }}
      onDone={() => { setActiveDraft(undefined); setView("list") }}
    />
  )

  if (view === "detail" && selectedId !== null) return (
    <AgreementDetail tokenId={selectedId} onBack={() => setView("list")} />
  )

  return (
    <div className="col gap-16 animate-in">
      <div className="row mb-8">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Service Agreements</h2>
          <p className="muted mt-4 text-sm">ERC-721 NFT - EIP-712 dual signature - IPFS storage</p>
        </div>
        <TxButton variant="primary" className="ml-auto"
          onClick={() => { setActiveDraft(undefined); setView("create") }}>
          + New Agreement
        </TxButton>
      </div>

      {/* Vendor: enter agreement ID or open shared link */}
      <div className="card" style={{ border: "1px solid var(--border2)" }}>
        <div className="section-label mb-8">Sign as vendor -- enter Agreement ID</div>
        <p className="muted text-sm mb-12">
          If client sent you only the ID (not the full link), enter it here.
          For best results, ask client to use the <strong>[Copy] Share Link</strong> button.
        </p>
        <div className="row gap-8">
          <input
            className="input"
            placeholder="e.g. A1B2C3"
            value={lookupId}
            onChange={e => setLookupId(e.target.value.toUpperCase())}
            style={{ maxWidth: 180, fontFamily: "var(--mono)", fontSize: 18, fontWeight: 700, letterSpacing: 3 }}
            maxLength={6}
            onKeyDown={e => e.key === "Enter" && handleLookup()}
          />
          <TxButton variant="primary" disabled={lookupId.length < 6} onClick={handleLookup}>
            Load Agreement
          </TxButton>
        </div>
        {lookupError && (
          <div className="mt-8" style={{ fontSize: 12, color: "var(--coral)" }}>{lookupError}</div>
        )}
      </div>

      {/* Pending drafts on this browser */}
      {pendingDrafts.length > 0 && (
        <div className="card" style={{ border: "1px solid var(--gold-bd)", background: "var(--gold-bg)" }}>
          <div className="section-label mb-8" style={{ color: "var(--gold)" }}>Pending drafts on this browser</div>
          {pendingDrafts.map(d => (
            <div key={d.id} className="row gap-12" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <span className="mono" style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "var(--teal)" }}>{d.id}</span>
                <span className="muted2 text-xs ml-8">{d.fields.projectTitle || "Untitled"}</span>
              </div>
              <span className="badge" style={{ fontSize: 9 }}>Step {d.step}/4</span>
              <div className="row gap-8">
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--coral)", fontSize: 11 }}
                  onClick={() => { clearDraft(d.id); window.location.reload() }}>
                  Discard
                </button>
                <TxButton variant="gold" size="sm" onClick={() => { setActiveDraft(d); setView("create") }}>
                  Continue
                </TxButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="stats-grid">
        <StatCard label="Total agreements" value={total !== undefined ? String(total) : "--"} sub="On-chain NFTs" />
        <StatCard label="Dual signed" value={total !== undefined ? String(total) : "--"} sub="EIP-712 verified" color="var(--teal)" />
        <StatCard label="IPFS backed" value={total !== undefined ? String(total) : "--"} sub="Permanent storage" />
      </div>

      {/* How it works */}
      <div className="card" style={{ border: "1px solid var(--border2)" }}>
        <div className="section-label mb-12">How it works</div>
        <div className="grid-3">
          {[
            ["1","Client creates and signs","Fill 6 sections, get Agreement ID, sign with client wallet, send share link to vendor"],
            ["2","Vendor signs","Vendor opens shared link or enters ID, connects wallet, signs"],
            ["3","Mint NFT","Either party mints -- full JSON on IPFS, ERC-721 on Arc"],
          ].map(([n, t, d]) => (
            <div key={n} style={{ textAlign: "center", padding: "12px 8px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--teal-bg)", border: "1px solid var(--teal-bd)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 13, fontWeight: 700, color: "var(--teal)" }}>{n}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t}</div>
              <div className="muted2 text-xs">{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-label mb-12">All On-chain Agreements ({demoIds.length})</div>
        {!address ? (
          <div className="empty"><div className="empty-title">Connect your wallet</div></div>
        ) : demoIds.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No agreements minted yet</div>
            <p className="empty-desc">Create your first on-chain service agreement.</p>
            <div className="mt-16">
              <TxButton variant="primary" size="sm" onClick={() => { setActiveDraft(undefined); setView("create") }}>
                Create agreement
              </TxButton>
            </div>
          </div>
        ) : (
          demoIds.map(id => (
            <AgreementRow key={id.toString()} tokenId={id}
              onSelect={() => { setSelectedId(id); setView("detail") }} />
          ))
        )}
      </div>
    </div>
  )
}