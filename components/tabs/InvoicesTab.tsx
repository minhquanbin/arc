"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { keccak256, parseUnits, stringToHex, type Address } from "viem";
import { formatAddress, formatUSDC, generateId } from "@/lib/payments";

const INVOICE_REGISTRY_ABI = [
  {
    type: "function",
    name: "createInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "payer", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "dueDate", type: "uint64" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "payInvoice",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "invoices",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [
      { name: "vendor", type: "address" },
      { name: "payer", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "dueDate", type: "uint64" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint64" },
      { name: "paidAt", type: "uint64" },
      { name: "metadataHash", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "InvoiceCreated",
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "vendor", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "dueDate", type: "uint64", indexed: false },
      { name: "metadataHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "InvoicePaid",
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "vendor", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "metadataHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

type InvoiceRow = {
  invoiceId: `0x${string}`;
  vendor: Address;
  payer: Address;
  token: Address;
  amount: bigint;
  dueDate: bigint;
  status: number;
  createdAt: bigint;
  paidAt: bigint;
  metadataHash: `0x${string}`;
};

function statusLabel(status: number): string {
  // matches contract enum: None(0) Created(1) Cancelled(2) Paid(3)
  if (status === 1) return "CREATED";
  if (status === 2) return "CANCELLED";
  if (status === 3) return "PAID";
  return "UNKNOWN";
}

function parseLocalDateToUnixSeconds(dateStr: string): number {
  // Expects YYYY-MM-DD in user's local timezone
  if (!dateStr) return 0;
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  if (!yyyy || !mm || !dd) return 0;
  const d = new Date();
  d.setFullYear(yyyy, mm - 1, dd);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

export default function InvoicesTab() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const isBusy = isPending || isConfirming;

  const INVOICE_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_ARC_INVOICE_REGISTRY ||
    "0x0000000000000000000000000000000000000000") as Address;

  const USDC_ADDRESS = ((process.env.NEXT_PUBLIC_ARC_USDC || process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS) ||
    "0x3600000000000000000000000000000000000000") as Address;

  const isConfigured =
    INVOICE_REGISTRY_ADDRESS !== ("0x0000000000000000000000000000000000000000" as Address);

  // Create form
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [description, setDescription] = useState("Consulting services");

  const [status, setStatus] = useState("");
  const [lastError, setLastError] = useState("");

  // List state
  const [knownIds, setKnownIds] = useState<string[]>([]);
  const [items, setItems] = useState<InvoiceRow[]>([]);

  const storageKey = useMemo(() => {
    const chainId = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002);
    return `arc:invoices:knownIds:${chainId}:${INVOICE_REGISTRY_ADDRESS.toLowerCase()}`;
  }, [INVOICE_REGISTRY_ADDRESS]);

  function saveKnownIds(ids: string[]) {
    const uniq = Array.from(new Set(ids.map((x) => x.toLowerCase())));
    setKnownIds(uniq);
    try {
      localStorage.setItem(storageKey, JSON.stringify(uniq));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      if (Array.isArray(parsed)) setKnownIds(Array.from(new Set(parsed.map((x) => String(x).toLowerCase()))));
    } catch {
      setKnownIds([]);
    }
  }, [storageKey]);

  async function refreshFromChain() {
    if (!publicClient || !isConfigured) return;
    setStatus("Loading invoices...");
    setLastError("");

    try {
      const code = await publicClient.getBytecode({ address: INVOICE_REGISTRY_ADDRESS });
      if (!code) {
        setLastError(`No contract code found at ${INVOICE_REGISTRY_ADDRESS}. Set NEXT_PUBLIC_ARC_INVOICE_REGISTRY.`);
        setStatus("");
        return;
      }
    } catch {
      // ignore
    }

    try {
      const logs = await publicClient.getLogs({
        address: INVOICE_REGISTRY_ADDRESS,
        event: INVOICE_REGISTRY_ABI.find((x) => (x as any).type === "event" && (x as any).name === "InvoiceCreated") as any,
        fromBlock: 0n,
        toBlock: "latest",
      });

      const ids: string[] = [];
      for (const log of logs) {
        const invoiceId = (log as any).args?.invoiceId as string | undefined;
        if (invoiceId) ids.push(invoiceId);
      }
      // Merge with local ids
      saveKnownIds([...knownIds, ...ids]);
    } catch (e: any) {
      setLastError(e?.message || "Failed to read logs");
    } finally {
      setStatus("");
    }
  }

  async function loadDetails(ids: string[]) {
    if (!publicClient || !isConfigured) return;
    const next: InvoiceRow[] = [];
    for (const id of ids) {
      try {
        const row = (await publicClient.readContract({
          address: INVOICE_REGISTRY_ADDRESS,
          abi: INVOICE_REGISTRY_ABI,
          functionName: "invoices",
          args: [id as `0x${string}`],
        })) as any[];

        next.push({
          invoiceId: id as `0x${string}`,
          vendor: row[0] as Address,
          payer: row[1] as Address,
          token: row[2] as Address,
          amount: row[3] as bigint,
          dueDate: row[4] as bigint,
          status: Number(row[5]),
          createdAt: row[6] as bigint,
          paidAt: row[7] as bigint,
          metadataHash: row[8] as `0x${string}`,
        });
      } catch {
        // ignore invalid ids
      }
    }
    setItems(next.sort((a, b) => Number(b.createdAt - a.createdAt)));
  }

  useEffect(() => {
    loadDetails(knownIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownIds.join("|"), isConfigured, address, isConfirmed]);

  useEffect(() => {
    if (!publicClient || !isConfigured) return;
    refreshFromChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, isConfigured]);

  function buildInvoiceId(vendor: Address, payerAddr: Address, amountUsdc: string, due: string, desc: string): `0x${string}` {
    // Deterministic id (still user friendly): hash of core fields + random salt.
    // We include a random salt so vendors can re-issue similar invoices without collision.
    const salt = generateId();
    const raw = `${vendor.toLowerCase()}|${payerAddr.toLowerCase()}|${amountUsdc}|${due}|${desc}|${salt}`;
    return keccak256(stringToHex(raw)) as `0x${string}`;
  }

  function buildMetadataHash(desc: string): `0x${string}` {
    // Minimal: hash description string. In production: hash canonical JSON metadata.
    return keccak256(stringToHex(desc || "")) as `0x${string}`;
  }

  async function onCreateInvoice() {
    try {
      setLastError("");
      setStatus("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured) throw new Error("InvoiceRegistry not configured (NEXT_PUBLIC_ARC_INVOICE_REGISTRY).");

      if (!payer || !payer.startsWith("0x") || payer.length !== 42) throw new Error("Payer must be a valid 0x address.");
      if (!amount || Number(amount) <= 0) throw new Error("Amount must be > 0");

      const payerAddr = payer as Address;
      const dueUnix = parseLocalDateToUnixSeconds(dueDate);
      const amt = parseUnits(amount, 6);

      const invoiceId = buildInvoiceId(address as Address, payerAddr, amount, dueDate, description);
      const metadataHash = buildMetadataHash(description);

      setStatus("Creating invoice...");
      await writeContract({
        address: INVOICE_REGISTRY_ADDRESS,
        abi: INVOICE_REGISTRY_ABI,
        functionName: "createInvoice",
        args: [invoiceId, payerAddr, USDC_ADDRESS, amt, BigInt(dueUnix), metadataHash],
      });

      // Optimistic save so it shows instantly.
      saveKnownIds([...knownIds, invoiceId]);
      setStatus("Submitted. Waiting confirmation...");
    } catch (e: any) {
      setLastError(e?.message || "Create invoice failed");
      setStatus("");
    }
  }

  async function onPayInvoice(invoiceId: `0x${string}`) {
    try {
      setLastError("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured) throw new Error("InvoiceRegistry not configured");
      setStatus("Paying invoice...");
      await writeContract({
        address: INVOICE_REGISTRY_ADDRESS,
        abi: INVOICE_REGISTRY_ABI,
        functionName: "payInvoice",
        args: [invoiceId],
      });
    } catch (e: any) {
      setLastError(e?.message || "Pay invoice failed");
    } finally {
      setStatus("");
    }
  }

  const myLower = (address || "").toLowerCase();
  const mine = items.filter(
    (x) => x.vendor.toLowerCase() === myLower || x.payer.toLowerCase() === myLower
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <img src="/chain-icons/payment.svg" alt="Invoices" className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Invoices</h1>
        </div>
        <p className="text-sm text-gray-600">
          On-chain invoice registry + USDC payment (ERC20 transferFrom). Metadata is hashed for integrity.
        </p>
      </div>

      {!isConfigured && (
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
          <div className="text-sm text-orange-800 font-semibold">Missing configuration</div>
          <div className="mt-1 text-sm text-orange-700">
            Set <code className="px-1 py-0.5 bg-white rounded">NEXT_PUBLIC_ARC_INVOICE_REGISTRY</code> to the deployed contract
            address.
          </div>
        </div>
      )}

      {/* Create */}
      <div className="arc-card-light p-5 space-y-4 border-2 border-[#ff7582]/40 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">Create invoice</h2>
          <button
            onClick={refreshFromChain}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60"
            disabled={!isConfigured || !publicClient}
          >
            Refresh
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Payer (will pay)</label>
            <input
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Amount (USDC)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Due date</label>
            <input
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              type="date"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Description (hashed)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Feb 2026 retainer"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={onCreateInvoice}
          disabled={!isConfigured || isBusy}
          className="rounded-xl bg-[#ff7582] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#ff5f70] disabled:opacity-60"
        >
          {isBusy ? "Processing..." : "Create invoice"}
        </button>

        {txHash && (
          <div className="text-xs text-gray-600">
            Tx: <code className="px-1 py-0.5 bg-white rounded">{txHash}</code>
          </div>
        )}
      </div>

      {/* List */}
      <div className="arc-card-light p-5 space-y-4 border-2 border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">My invoices</h2>
          <div className="text-xs text-gray-500">{mine.length} items</div>
        </div>

        {mine.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-600">
            No invoices found yet (created by you or payable by you).
          </div>
        ) : (
          <div className="space-y-3">
            {mine.map((inv) => {
              const canPay = address && inv.payer.toLowerCase() === myLower && inv.status === 1;
              return (
                <div key={inv.invoiceId} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Invoice ID</div>
                      <div className="font-mono text-xs break-all">{inv.invoiceId}</div>
                    </div>
                    <div className="text-xs font-semibold px-2 py-1 rounded-full border border-gray-200 bg-gray-50">
                      {statusLabel(inv.status)}
                    </div>
                  </div>

                  <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Vendor</div>
                      <div className="font-semibold">{formatAddress(inv.vendor)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Payer</div>
                      <div className="font-semibold">{formatAddress(inv.payer)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Amount</div>
                      <div className="font-semibold">{formatUSDC(inv.amount)} USDC</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Due</div>
                      <div className="font-semibold">
                        {inv.dueDate > 0n ? new Date(Number(inv.dueDate) * 1000).toISOString().slice(0, 10) : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-gray-500">
                      Token: <span className="font-mono">{formatAddress(inv.token)}</span>
                      {" • "}metaHash: <span className="font-mono">{inv.metadataHash.slice(0, 10)}...</span>
                    </div>
                    <button
                      onClick={() => onPayInvoice(inv.invoiceId)}
                      disabled={!canPay || isBusy}
                      className="rounded-lg bg-[#725a7a] px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
                    >
                      Pay
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(status || lastError) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
          {status && <div className="text-gray-700">{status}</div>}
          {lastError && <div className="text-red-600">{lastError}</div>}
          {isConfirmed && <div className="text-green-700">Confirmed.</div>}
        </div>
      )}
    </div>
  );
}

