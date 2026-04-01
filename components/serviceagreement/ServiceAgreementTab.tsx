"use client"

import { useState, useRef } from "react"
import { useAccount } from "wagmi"
import { TxButton, StatCard, Field, FeeBox } from "@/components/ui"
import { shortenAddr, fmtDate } from "@/lib/utils"
import {
  useSignAgreement, useMintAgreement, useTotalAgreements, useAgreement, computeContentHash, uploadToIPFS, fetchNonceOnChain, type AgreementFields,
} from "@/hooks/useServiceAgreement"
import type { Address } from "viem"

const EMPTY: AgreementFields = {
  projectTitle: "", description: "", deliverables: "", techStack: "",
  startDate: "", endDate: "", totalValue: "", paymentSchedule: "milestone",
  penaltyPct: "2", arbitratorCount: "3", confidential: true,
  ipOwnership: "client", terminationConditions: "",
  clientName: "", vendorName: "", clientAddress: "", vendorAddress: "",
  agreementDate: new Date().toISOString().split("T")[0],
}

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
          <div><div className="section-label">Linked Invoice</div><div className="mono text-sm">{ag.invoiceId > 0n ? "#" + String(ag.invoiceId) : "Not linked"}</div></div>
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
      <div className="card" style={{ border: "1px solid var(--teal-bd)", background: "var(--teal-bg)" }}>
        <div className="section-label mb-8">NFT Certificate</div>
        <p className="muted text-sm">This agreement is permanently recorded on Arc blockchain as NFT #{String(ag.tokenId)}. Both parties signed via EIP-712.</p>
        <a href={"https://testnet.arcscan.app/token/" + process.env.NEXT_PUBLIC_SERVICE_AGREEMENT_ADDRESS + "/instance/" + String(ag.tokenId)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm mt-12">View on ArcScan</a>
      </div>
    </div>
  )
}

function CreateAgreement({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { address } = useAccount()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [fields, setFields] = useState<AgreementFields>({ ...EMPTY, clientAddress: address ?? "" })
  const [clientSig, setClientSig] = useState<`0x${string}` | null>(null)
  const clientNonceRef = useRef<bigint>(0n)
  const vendorNonceRef = useRef<bigint>(0n)
  const [vendorSig, setVendorSig] = useState<`0x${string}` | null>(null)
  const [ipfsCID, setIpfsCID] = useState("")
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")

  const isClient = address?.toLowerCase() === fields.clientAddress.toLowerCase()
  const isVendor = address?.toLowerCase() === fields.vendorAddress.toLowerCase()

  // nonces fetched fresh from chain before signing

  const { sign, isPending: signing } = useSignAgreement()
  const { mint, isPending: minting, isSuccess: mintDone, error: mintError } = useMintAgreement()

  const contentHash = computeContentHash(fields)
  const upd = (k: keyof AgreementFields, v: string | boolean) => setFields(p => ({ ...p, [k]: v }))

  if (mintDone) { onDone(); return null }

  const handleUploadSign = async () => {
    setUploading(true)
    setStatusMsg("Uploading to IPFS...")
    try {
      const cid = await uploadToIPFS({ ...fields, contentHash, version: "1.0" })
      setIpfsCID(cid)
      setStatusMsg("Signing...")
      const addr = isClient ? fields.clientAddress as Address : fields.vendorAddress as Address
      const nonce = await fetchNonceOnChain(addr, "0x63e8Ec1B2F9Cbf1AE30c868278f3F1D28a61d4b2" as Address)
      clientNonceRef.current = nonce
      const sig = await sign({ client: fields.clientAddress as Address, vendor: fields.vendorAddress as Address, contentHash, nonce })
      if (isClient) setClientSig(sig)
      else setVendorSig(sig)
      setStatusMsg("Signed!")
      setStep(3)
    } catch (e) { setStatusMsg("Error: " + (e as Error)?.message?.slice(0, 80)) }
    setUploading(false)
  }

  const handleVendorSign = async () => {
    try {
      const sameWallet = fields.clientAddress.toLowerCase() === fields.vendorAddress.toLowerCase()
      const freshVNonce = await fetchNonceOnChain(fields.vendorAddress as Address, "0x63e8Ec1B2F9Cbf1AE30c868278f3F1D28a61d4b2" as Address)
      const vNonce = sameWallet ? clientNonceRef.current + 1n : freshVNonce
      const sig = await sign({ client: fields.clientAddress as Address, vendor: fields.vendorAddress as Address, contentHash, nonce: vNonce })
      setVendorSig(sig)
      vendorNonceRef.current = vNonce
      setStep(4)
    } catch (e) { setStatusMsg("Error: " + (e as Error)?.message?.slice(0, 80)) }
  }

  const handleMint = async () => {
    if (!clientSig || !vendorSig || !ipfsCID) return
    try {
      await mint({ client: fields.clientAddress as Address, vendor: fields.vendorAddress as Address, contentHash, ipfsCID, clientSig, vendorSig, clientNonce: clientNonceRef.current, vendorNonce: vendorNonceRef.current })
    } catch (e) { setStatusMsg("Mint error: " + (e as Error)?.message?.slice(0, 80)) }
  }

  return (
    <div className="col gap-16 animate-in">
      <div className="row gap-12 mb-8">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>New Service Agreement</h2>
      </div>

      <div className="row gap-8 mb-8">
        {[["1","Fill form"],["2","Review"],["3","Client signs"],["4","Vendor + Mint"]].map(([n, label]) => (
          <div key={n} className="row gap-8" style={{ alignItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: step >= Number(n) ? "var(--teal)" : "var(--bg4)", border: "1px solid " + (step >= Number(n) ? "var(--teal)" : "var(--border2)"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: step >= Number(n) ? "var(--bg)" : "var(--text3)", flexShrink: 0 }}>{n}</div>
            <span style={{ fontSize: 11, color: step >= Number(n) ? "var(--text)" : "var(--text3)" }}>{label}</span>
            {Number(n) < 4 && <span className="muted2" style={{ fontSize: 10 }}>--</span>}
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          <div className="card">
            <div className="section-label mb-12">Section 1 - Parties</div>
            <div className="form-grid gap-12">
              <div className="grid-2">
                <Field label="Client full name *"><input className="input" placeholder="Company or individual" value={fields.clientName} onChange={e => upd("clientName", e.target.value)} /></Field>
                <Field label="Client wallet *"><input className="input" placeholder="0x..." value={fields.clientAddress} onChange={e => upd("clientAddress", e.target.value)} /></Field>
              </div>
              <div className="grid-2">
                <Field label="Vendor full name *"><input className="input" placeholder="Company or individual" value={fields.vendorName} onChange={e => upd("vendorName", e.target.value)} /></Field>
                <Field label="Vendor wallet *"><input className="input" placeholder="0x..." value={fields.vendorAddress} onChange={e => upd("vendorAddress", e.target.value)} /></Field>
              </div>
              <Field label="Effective date *"><input className="input" type="date" value={fields.agreementDate} onChange={e => upd("agreementDate", e.target.value)} /></Field>
            </div>
          </div>

          <div className="card">
            <div className="section-label mb-12">Section 2 - Scope of Work</div>
            <div className="form-grid gap-12">
              <Field label="Project title *"><input className="input" placeholder="e.g. DeFi Smart Contract Development" value={fields.projectTitle} onChange={e => upd("projectTitle", e.target.value)} /></Field>
              <Field label="Detailed description *"><textarea className="textarea" style={{ minHeight: 100 }} placeholder="Full description of work to be performed..." value={fields.description} onChange={e => upd("description", e.target.value)} /></Field>
              <Field label="Deliverables *" hint="List each deliverable on a new line"><textarea className="textarea" style={{ minHeight: 90 }} placeholder={"1. Audit report\n2. Unit tests\n3. Deployment"} value={fields.deliverables} onChange={e => upd("deliverables", e.target.value)} /></Field>
              <Field label="Technology stack"><input className="input" placeholder="e.g. Solidity, Foundry, React, Wagmi" value={fields.techStack} onChange={e => upd("techStack", e.target.value)} /></Field>
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
            <div className="form-grid gap-12">
              <div className="grid-2">
                <Field label="Total value (USDC) *"><input className="input" type="number" min="0" placeholder="0" value={fields.totalValue} onChange={e => upd("totalValue", e.target.value)} /></Field>
                <Field label="Late penalty (% per week)"><input className="input" type="number" min="0" max="10" placeholder="2" value={fields.penaltyPct} onChange={e => upd("penaltyPct", e.target.value)} /></Field>
              </div>
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
              <p className="muted text-sm">Disputes resolved by unanimous ArbitratorNFT vote. Dispute fee: 5% of milestone (min 50 USDC), paid by losing party.</p>
            </div>
          </div>

          <div className="card">
            <div className="section-label mb-12">Section 6 - Terms and Conditions</div>
            <div className="form-grid gap-12">
              <Field label="IP ownership">
                <select className="select-input" value={fields.ipOwnership} onChange={e => upd("ipOwnership", e.target.value)}>
                  <option value="client">Client owns all IP upon full payment</option>
                  <option value="vendor">Vendor retains IP, grants license</option>
                  <option value="shared">Shared ownership (50/50)</option>
                </select>
              </Field>
              <Field label="Confidentiality (NDA)">
                <div className="row gap-8 mt-4">
                  {[{ v: true, l: "Yes - NDA applies" }, { v: false, l: "No - public work" }].map(opt => (
                    <div key={String(opt.v)} onClick={() => upd("confidential", opt.v)}
                      style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, border: "1px solid " + (fields.confidential === opt.v ? "var(--teal)" : "var(--border)"), background: fields.confidential === opt.v ? "var(--teal-bg)" : "var(--bg3)" }}>
                      {opt.l}
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Termination conditions">
                <textarea className="textarea" style={{ minHeight: 80 }} placeholder={"Either party may terminate with 14 days written notice."} value={fields.terminationConditions} onChange={e => upd("terminationConditions", e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="row gap-12">
            <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
            <TxButton variant="primary" className="ml-auto"
              disabled={!fields.projectTitle || !fields.clientAddress || !fields.vendorAddress || !fields.startDate || !fields.endDate || !fields.totalValue}
              onClick={() => setStep(2)}>
              Review Agreement
            </TxButton>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="card">
            <div className="section-label mb-12">Agreement Preview</div>
            <div style={{ background: "var(--bg3)", borderRadius: 10, padding: 20, border: "1px solid var(--border)", fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.8, color: "var(--text2)" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12, fontFamily: "var(--sans)" }}>SERVICE AGREEMENT</div>
              <p><strong>Project:</strong> {fields.projectTitle}</p>
              <p><strong>Date:</strong> {fields.agreementDate}</p>
              <br />
              <p><strong>CLIENT:</strong> {fields.clientName} ({shortenAddr(fields.clientAddress)})</p>
              <p><strong>VENDOR:</strong> {fields.vendorName} ({shortenAddr(fields.vendorAddress)})</p>
              <br />
              <p><strong>SCOPE:</strong></p>
              <p style={{ whiteSpace: "pre-wrap" }}>{fields.description}</p>
              <br />
              <p><strong>DELIVERABLES:</strong></p>
              <p style={{ whiteSpace: "pre-wrap" }}>{fields.deliverables}</p>
              <br />
              <p><strong>TIMELINE:</strong> {fields.startDate} to {fields.endDate}</p>
              <p><strong>VALUE:</strong> {fields.totalValue} USDC | {fields.paymentSchedule}</p>
              <p><strong>LATE PENALTY:</strong> {fields.penaltyPct}% per week</p>
              <br />
              <p><strong>ARBITRATORS:</strong> {fields.arbitratorCount} | Unanimous vote | 5% dispute fee</p>
              <p><strong>IP:</strong> {fields.ipOwnership} | <strong>NDA:</strong> {fields.confidential ? "Yes" : "No"}</p>
              {fields.terminationConditions && <p><strong>TERMINATION:</strong> {fields.terminationConditions}</p>}
              <br />
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <p>On-chain: Arc blockchain (Chain ID 5042002) | ERC-721 NFT | EIP-712 signatures</p>
                <p>Hash: {contentHash.slice(0, 18)}...{contentHash.slice(-6)}</p>
              </div>
            </div>
          </div>
          <div className="row gap-12">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Edit</button>
            <TxButton variant="primary" className="ml-auto" loading={uploading || signing} loadingText={uploading ? "Uploading to IPFS..." : "Signing..."} onClick={handleUploadSign}>
              Upload to IPFS and Sign as {isClient ? "Client" : isVendor ? "Vendor" : "Party"}
            </TxButton>
          </div>
        </>
      )}

      {step === 3 && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>First signature collected</div>
          <p className="muted text-sm mb-16">IPFS CID: <span className="mono text-xs">{ipfsCID}</span></p>
          <FeeBox rows={[
            { label: "Client signature", value: clientSig ? "[OK] Signed" : "Pending", color: clientSig ? "var(--teal)" : "var(--text3)" },
            { label: "Vendor signature", value: vendorSig ? "[OK] Signed" : "Pending", color: vendorSig ? "var(--teal)" : "var(--text3)" },
          ]} />
          <div className="mt-16">
            {!vendorSig && (
              <TxButton variant="gold" loading={signing} loadingText="Signing..." onClick={handleVendorSign}>
                Sign as Vendor {address?.toLowerCase() === fields.vendorAddress.toLowerCase() ? "" : "(testnet - same wallet)"}
              </TxButton>
            )}
          </div>
          {statusMsg && <div className="mono text-xs muted2 mt-12">{statusMsg}</div>}
        </div>
      )}

      {step === 4 && (
        <div className="col gap-16">
          <div className="card" style={{ border: "1px solid var(--teal-bd)", background: "var(--teal-bg)", textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Both signatures collected</div>
            <p className="muted text-sm mb-16">Ready to mint as NFT on Arc blockchain.</p>
            <FeeBox rows={[
              { label: "Client signature", value: "[OK] Signed", color: "var(--teal)" },
              { label: "Vendor signature", value: "[OK] Signed", color: "var(--teal)" },
              { label: "IPFS CID", value: ipfsCID.slice(0, 16) + "..." },
              { label: "Ready to mint", value: "Gas only", color: "var(--teal)", total: true },
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

function AgreementRow({ tokenId, onSelect }: { tokenId: bigint; onSelect: () => void }) {
  const { data: ag } = useAgreement(tokenId)
  if (!ag) return <div style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", marginBottom: 6, opacity: 0.5 }}><div className="muted2 text-xs mono">Agreement #{tokenId.toString()} loading...</div></div>
  return (
    <div onClick={onSelect} className="card-hover"
      style={{ display: "grid", gridTemplateColumns: "56px 1fr 100px 90px", gap: 12, alignItems: "center", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", marginBottom: 6, cursor: "pointer" }}>
      <span className="mono muted2 text-xs">#{String(ag.tokenId)}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{shortenAddr(ag.client)} -- {shortenAddr(ag.vendor)}</div>
        <div className="mono muted2 text-xs mt-4">{ag.ipfsCID.slice(0, 12)}...{ag.invoiceId > 0n ? " | Invoice #" + String(ag.invoiceId) : ""}</div>
      </div>
      <span className="badge badge-active">SIGNED</span>
      <span className="mono muted2 text-xs">{fmtDate(Number(ag.createdAt))}</span>
    </div>
  )
}

export function ServiceAgreementTab() {
  const { address } = useAccount()
  const { data: total } = useTotalAgreements()
  const [view, setView] = useState<"list" | "create" | "detail">("list")
  const [selectedId, setSelectedId] = useState<bigint | null>(null)

  const demoIds = total && total > 0n
    ? Array.from({ length: Math.min(Number(total), 10) }, (_, i) => BigInt(i + 1))
    : []

  if (view === "create") return <CreateAgreement onBack={() => setView("list")} onDone={() => setView("list")} />
  if (view === "detail" && selectedId !== null) return <AgreementDetail tokenId={selectedId} onBack={() => setView("list")} />

  return (
    <div className="col gap-16 animate-in">
      <div className="row mb-8">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Service Agreements</h2>
          <p className="muted mt-4 text-sm">ERC-721 NFT - EIP-712 dual signature - IPFS storage - 6 sections</p>
        </div>
        <TxButton variant="primary" className="ml-auto" onClick={() => setView("create")}>+ New Agreement</TxButton>
      </div>

      <div className="stats-grid">
        <StatCard label="Total agreements" value={total !== undefined ? String(total) : "--"} sub="On-chain NFTs" />
        <StatCard label="Dual signed" value={total !== undefined ? String(total) : "--"} sub="EIP-712 verified" color="var(--teal)" />
        <StatCard label="IPFS backed" value={total !== undefined ? String(total) : "--"} sub="Permanent storage" />
      </div>

      <div className="card" style={{ border: "1px solid var(--border2)" }}>
        <div className="section-label mb-12">How it works</div>
        <div className="grid-3">
          {[["1","Fill 6-section form","Parties, scope, timeline, payment, dispute, terms"],["2","Both parties sign","EIP-712 cryptographic signature from client and vendor"],["3","Mint NFT","Full JSON on IPFS, hash + metadata as ERC-721 NFT on Arc"]].map(([n, t, d]) => (
            <div key={n} style={{ textAlign: "center", padding: "12px 8px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--teal-bg)", border: "1px solid var(--teal-bd)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 13, fontWeight: 700, color: "var(--teal)" }}>{n}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t}</div>
              <div className="muted2 text-xs">{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-label mb-12">All Agreements ({demoIds.length})</div>
        {!address ? (
          <div className="empty"><div className="empty-title">Connect your wallet</div></div>
        ) : demoIds.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No agreements yet</div>
            <p className="empty-desc">Create your first on-chain service agreement.</p>
            <div className="mt-16"><TxButton variant="primary" size="sm" onClick={() => setView("create")}>Create agreement</TxButton></div>
          </div>
        ) : (
          demoIds.map(id => <AgreementRow key={id.toString()} tokenId={id} onSelect={() => { setSelectedId(id); setView("detail") }} />)
        )}
      </div>
    </div>
  )
}