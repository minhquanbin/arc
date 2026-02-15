"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { DESTS } from "@/lib/chains";
import { ERC20_ABI, ROUTER_ABI, addressToBytes32, validateAmount, validateMemo } from "@/lib/cctp";

type Invoice = {
  id: string;
  ts: number;
  title: string;
  payer?: string;
  arcRecipient: `0x${string}`;
  amountUsdc: string;
  status: "draft" | "issued";
};

function isAddress(v: string): v is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

function newInvoiceId() {
  // Short, human-friendly, still unique enough for demo
  const rand = Math.random().toString(16).slice(2, 10);
  return `inv_${Date.now().toString(36)}_${rand}`;
}

export default function InvoicesTab() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();

  const expectedChainId = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002);
  const isWrongNetwork = isConnected && chain?.id !== expectedChainId;

  const [title, setTitle] = useState("Invoice");
  const [payer, setPayer] = useState("");
  const [amountUsdc, setAmountUsdc] = useState("");
  const [sourceChainKey, setSourceChainKey] = useState(DESTS[0]?.key || "");
  const [arcRecipient, setArcRecipient] = useState<string>("");

  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const sourceChain = useMemo(
    () => DESTS.find((d) => d.key === sourceChainKey) || DESTS[0],
    [sourceChainKey]
  );

  const arcRouter = (process.env.NEXT_PUBLIC_ARC_ROUTER ||
    "0xEc02A909701A8eB9C84B93b55B6d4A7ca215CFca") as `0x${string}`;
  const arcUsdc = ((process.env.NEXT_PUBLIC_ARC_USDC || process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS) ||
    "0x3600000000000000000000000000000000000000") as `0x${string}`;

  // Load + persist invoices
  useEffect(() => {
    try {
      const raw = localStorage.getItem("arc:invoices");
      const parsed = raw ? (JSON.parse(raw) as Invoice[]) : [];
      if (Array.isArray(parsed)) {
        setInvoices(parsed);
        if (parsed[0]?.id) setSelectedId(parsed[0].id);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("arc:invoices", JSON.stringify(invoices));
    } catch {
      // ignore
    }
  }, [invoices]);

  // Default ARC recipient: your own wallet
  useEffect(() => {
    if (!arcRecipient && address) setArcRecipient(address);
  }, [arcRecipient, address]);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === selectedId) || null,
    [invoices, selectedId]
  );

  const memo = useMemo(() => {
    if (!selectedInvoice) return "";
    // Keep it short (<=128 bytes); use invoiceId only for v1.
    return `ARC:${selectedInvoice.id}`;
  }, [selectedInvoice]);

  async function refreshPaidStatus(inv: Invoice) {
    if (!publicClient) throw new Error("Public client not ready");
    // Simple heuristic for v1: check ARC USDC balance of the recipient and compare to amount.
    // (Not perfect accounting, but OK for a demo; next step is an on-chain InvoiceVault + events.)
    const bal = (await publicClient.readContract({
      address: arcUsdc,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [inv.arcRecipient],
    })) as bigint;
    const need = parseUnits(inv.amountUsdc || "0", 6);
    return { bal, need, paid: bal >= need };
  }

  async function onCreateInvoice() {
    try {
      setStatus("");
      setLoading(true);

      if (!isConnected || !address) throw new Error("Vui lòng connect ví trước");
      if (isWrongNetwork) throw new Error(`Vui lòng switch sang ARC Testnet (Chain ID: ${expectedChainId})`);

      validateAmount(amountUsdc);
      if (payer && !isAddress(payer)) throw new Error("Payer address không hợp lệ");
      if (!arcRecipient || !isAddress(arcRecipient)) throw new Error("ARC recipient address không hợp lệ");

      const inv: Invoice = {
        id: newInvoiceId(),
        ts: Date.now(),
        title: title.trim() || "Invoice",
        payer: payer.trim() || undefined,
        arcRecipient: arcRecipient as `0x${string}`,
        amountUsdc: amountUsdc.trim(),
        status: "issued",
      };

      setInvoices((prev) => [inv, ...prev]);
      setSelectedId(inv.id);
      setStatus("✅ Đã tạo invoice. Gửi invoiceId cho người thanh toán và dùng memo bên dưới.");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "Tạo invoice thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function onCheckPayment() {
    try {
      setStatus("");
      setLoading(true);
      if (!selectedInvoice) throw new Error("Chọn 1 invoice trước");
      if (!publicClient) throw new Error("Public client not ready");

      const { bal, need, paid } = await refreshPaidStatus(selectedInvoice);
      setStatus(
        paid
          ? `✅ Có vẻ đã thanh toán (balance recipient đủ). Balance: ${Number(formatUnits(bal, 6)).toFixed(
              6
            )} USDC`
          : `⏳ Chưa thấy đủ tiền. Balance: ${Number(formatUnits(bal, 6)).toFixed(6)} / Cần: ${Number(
              formatUnits(need, 6)
            ).toFixed(6)} USDC`
      );
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "Check thất bại");
    } finally {
      setLoading(false);
    }
  }

  const paymentParams = useMemo(() => {
    if (!selectedInvoice) return null;
    const amt = parseUnits(selectedInvoice.amountUsdc || "0", 6);
    // For Router ABI (ARC side), mintRecipient is bytes32.
    const mintRecipient = addressToBytes32(selectedInvoice.arcRecipient);
    const minFinality = Number(process.env.NEXT_PUBLIC_MIN_FINALITY_THRESHOLD || "1000");

    // We don't compute a precise maxFee here (it depends on circle forwarding rules);
    // for UI instructions we show env default.
    const maxFeeBps = BigInt(process.env.NEXT_PUBLIC_MAX_FEE_BPS || "500");
    const maxFee = (amt * maxFeeBps) / 10000n;

    // v1 memo only (forwarding header is handled in Bridge tab when actually submitting tx)
    // but still validate length for safety.
    validateMemo(memo);

    return {
      amount: amt,
      destinationDomain: sourceChain?.domain ?? 0,
      mintRecipient,
      maxFee,
      minFinalityThreshold: minFinality,
      memo,
      router: arcRouter,
    };
  }, [selectedInvoice, memo, sourceChain, arcRouter]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <img src="/chain-icons/payment.svg" alt="Invoices" className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Invoices</h1>
        </div>
        <p className="text-sm text-gray-600">
          V1: tạo invoice trên ARC, người trả có thể trả từ chain khác bằng cách bridge USDC qua ARC và
          đính kèm memo chứa invoiceId.
        </p>
      </div>

      {/* Create invoice */}
      <div className="rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Tạo invoice</h2>
          <div className="text-xs text-gray-500">Settlement: ARC address</div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Tiêu đề</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              placeholder="Invoice for services"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Số tiền (USDC)</label>
            <input
              value={amountUsdc}
              onChange={(e) => setAmountUsdc(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              placeholder="10"
              inputMode="decimal"
            />
            <div className="mt-1 text-xs text-gray-500">Khuyến nghị tối thiểu 5 USDC (giống Bridge tab).</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Payer (tuỳ chọn)</label>
            <input
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              placeholder="0x... (để trống nếu ai trả cũng được)"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Nhận trên ARC (recipient)</label>
            <input
              value={arcRecipient}
              onChange={(e) => setArcRecipient(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              placeholder="0x..."
            />
          </div>
        </div>

        <button
          onClick={onCreateInvoice}
          disabled={loading || !isConnected || isWrongNetwork}
          className={[
            "w-full rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all",
            loading || !isConnected || isWrongNetwork
              ? "cursor-not-allowed bg-gray-300"
              : "bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:from-[#ff5f70] hover:to-[#664f6e] active:scale-[0.98]",
          ].join(" ")}
        >
          {loading ? "Đang tạo..." : "Tạo invoice"}
        </button>
      </div>

      {/* Invoice list + payment instructions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Danh sách invoices</h2>
            <button
              onClick={() => setInvoices([])}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700"
              type="button"
            >
              Clear
            </button>
          </div>

          {invoices.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
              Chưa có invoice nào.
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => setSelectedId(inv.id)}
                  className={[
                    "w-full rounded-xl border p-4 text-left transition-all",
                    inv.id === selectedId
                      ? "border-[#ff7582]/70 bg-gradient-to-br from-[#ff7582]/12 to-[#725a7a]/8"
                      : "border-gray-200 bg-white hover:border-[#ff7582]/40",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{inv.title}</div>
                      <div className="mt-1 text-xs text-gray-500 font-mono">{inv.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{inv.amountUsdc} USDC</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {new Date(inv.ts).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    ARC recipient: <span className="font-mono">{inv.arcRecipient}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Hướng dẫn thanh toán (cross-chain → ARC)</h2>

          {!selectedInvoice ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
              Chọn 1 invoice để xem hướng dẫn thanh toán.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Chain người trả đang có USDC</label>
                  <select
                    value={sourceChainKey}
                    onChange={(e) => setSourceChainKey(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
                  >
                    {DESTS.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-gray-500">
                    Chọn chain nguồn để hiển thị domain (cho CCTP/Circle).
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Memo (dán vào Bridge)</label>
                  <input
                    value={memo}
                    readOnly
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono"
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    Memo này sẽ encode invoiceId (&lt;=128 bytes).
                  </div>
                </div>

              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 space-y-2">
                <div className="font-semibold">Thông số cần dùng khi bridge sang ARC:</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-gray-500">Mint recipient (ARC address)</div>
                    <div className="font-mono break-all">{selectedInvoice.arcRecipient}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Destination domain</div>
                    <div className="font-mono">{String(sourceChain?.domain ?? 0)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Gợi ý: vào tab <span className="font-semibold">Bridge</span> → nhập Amount + Recipient (ARC) + Memo ở
                  trên → submit.
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onCheckPayment}
                  disabled={loading}
                  className={[
                    "flex-1 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all",
                    loading
                      ? "cursor-not-allowed bg-gray-300"
                      : "bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:from-[#ff5f70] hover:to-[#664f6e] active:scale-[0.98]",
                  ].join(" ")}
                >
                  {loading ? "Đang kiểm tra..." : "Kiểm tra đã nhận tiền (ARC)"}
                </button>
              </div>

              {paymentParams ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-600 space-y-1">
                  <div className="font-semibold text-gray-800">Dev notes (v1):</div>
                  <div className="font-mono break-all">router: {paymentParams.router}</div>
                  <div className="font-mono break-all">amount: {paymentParams.amount.toString()}</div>
                  <div className="font-mono break-all">mintRecipient(bytes32): {paymentParams.mintRecipient}</div>
                  <div className="font-mono break-all">maxFee(rough): {paymentParams.maxFee.toString()}</div>
                  <div className="font-mono break-all">minFinalityThreshold: {String(paymentParams.minFinalityThreshold)}</div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {status ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-800 whitespace-pre-wrap">
          {status}
        </div>
      ) : null}
    </div>
  );
}
