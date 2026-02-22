"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { parseUnits, type Address } from "viem";
import { formatAddress, formatUSDC } from "@/lib/payments";

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const INVOICE_MARKETPLACE_ABI = [
  {
    type: "function",
    name: "listInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelListing",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "buyInvoice",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "listings",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "seller", type: "address" },
      { name: "token", type: "address" },
      { name: "price", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint64" },
      { name: "soldAt", type: "uint64" },
      { name: "buyer", type: "address" },
    ],
  },
  {
    type: "event",
    name: "InvoiceListed",
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
] as const;

type ListingRow = {
  invoiceId: `0x${string}`;
  seller: Address;
  token: Address;
  price: bigint;
  status: number; // 0 None, 1 Active, 2 Cancelled, 3 Sold
  createdAt: bigint;
  soldAt: bigint;
  buyer: Address;
};

function listingStatusLabel(status: number): string {
  if (status === 1) return "ACTIVE";
  if (status === 2) return "CANCELLED";
  if (status === 3) return "SOLD";
  return "NONE";
}

export default function InvoiceMarketplaceTab() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const isBusy = isPending || isConfirming;

  const INVOICE_MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_ARC_INVOICE_MARKETPLACE ||
    "0x0000000000000000000000000000000000000000") as Address;

  const USDC_ADDRESS = ((process.env.NEXT_PUBLIC_ARC_USDC || process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS) ||
    "0x3600000000000000000000000000000000000000") as Address;

  const isConfigured =
    INVOICE_MARKETPLACE_ADDRESS !== ("0x0000000000000000000000000000000000000000" as Address);

  // Allowance: USDC => InvoiceMarketplace (for buyInvoice)
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, INVOICE_MARKETPLACE_ADDRESS] : undefined,
    query: { enabled: Boolean(address) && isConfigured },
  });
  const allowance = (allowanceData as bigint | undefined) ?? 0n;

  const [status, setStatus] = useState("");
  const [lastError, setLastError] = useState("");

  // Listing creation
  const [listInvoiceId, setListInvoiceId] = useState("");
  const [listPrice, setListPrice] = useState("");

  // Known invoiceIds to scan listings for (persisted locally)
  const [knownIds, setKnownIds] = useState<string[]>([]);
  const [items, setItems] = useState<ListingRow[]>([]);

  const storageKey = useMemo(() => {
    const chainId = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002);
    return `arc:invoice-marketplace:knownIds:${chainId}:${INVOICE_MARKETPLACE_ADDRESS.toLowerCase()}`;
  }, [INVOICE_MARKETPLACE_ADDRESS]);

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

  useEffect(() => {
    if (!isConfirmed) return;
    refetchAllowance();
  }, [isConfirmed, refetchAllowance]);

  async function refreshFromChain() {
    if (!publicClient || !isConfigured) return;
    setLastError("");
    setStatus("Loading listings...");

    try {
      const latest = await publicClient.getBlockNumber();
      const window = 200_000n;
      const fromBlock = latest > window ? latest - window : 0n;

      const logs = await publicClient.getLogs({
        address: INVOICE_MARKETPLACE_ADDRESS,
        event: INVOICE_MARKETPLACE_ABI.find(
          (x) => (x as any).type === "event" && (x as any).name === "InvoiceListed"
        ) as any,
        fromBlock,
        toBlock: "latest",
      });

      const ids: string[] = [];
      for (const log of logs) {
        const invoiceId = (log as any).args?.invoiceId as string | undefined;
        if (invoiceId) ids.push(invoiceId);
      }

      saveKnownIds([...knownIds, ...ids]);
    } catch (e: any) {
      console.warn("[InvoiceMarketplaceTab] refreshFromChain getLogs failed:", e);
      setLastError(e?.message || "Failed to refresh listings");
    } finally {
      setStatus("");
    }
  }

  async function loadDetails(ids: string[]) {
    if (!publicClient || !isConfigured) return;
    const next: ListingRow[] = [];

    for (const id of ids) {
      try {
        const row = (await publicClient.readContract({
          address: INVOICE_MARKETPLACE_ADDRESS,
          abi: INVOICE_MARKETPLACE_ABI,
          functionName: "listings",
          args: [id as `0x${string}`],
        })) as unknown as readonly [string, Address, Address, bigint, number, bigint, bigint, Address];

        const statusNum = Number(row[4]);
        if (statusNum === 0) continue;

        next.push({
          invoiceId: (row[0] as `0x${string}`) || (id as `0x${string}`),
          seller: row[1],
          token: row[2],
          price: row[3],
          status: statusNum,
          createdAt: row[5],
          soldAt: row[6],
          buyer: row[7],
        });
      } catch {
        // ignore
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

  async function onListInvoice() {
    try {
      setLastError("");
      setStatus("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured) throw new Error("InvoiceMarketplace not configured (NEXT_PUBLIC_ARC_INVOICE_MARKETPLACE).");

      const id = listInvoiceId.trim();
      if (!id.startsWith("0x") || id.length !== 66) throw new Error("invoiceId must be 0x + 64 hex chars (bytes32).");
      if (!listPrice || Number(listPrice) <= 0) throw new Error("Price must be > 0");

      const price = parseUnits(listPrice, 6);
      setStatus("Listing invoice...");
      await writeContract({
        address: INVOICE_MARKETPLACE_ADDRESS,
        abi: INVOICE_MARKETPLACE_ABI,
        functionName: "listInvoice",
        args: [id as `0x${string}`, price],
      });

      saveKnownIds([...knownIds, id]);
      setStatus("Submitted. Waiting confirmation...");
    } catch (e: any) {
      setLastError(e?.message || "List invoice failed");
      setStatus("");
    }
  }

  async function onApprove(required: bigint) {
    try {
      setLastError("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured) throw new Error("InvoiceMarketplace not configured");

      setStatus(`Approving ${formatUSDC(required)} USDC allowance...`);
      await writeContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [INVOICE_MARKETPLACE_ADDRESS, required],
      });
    } catch (e: any) {
      setLastError(e?.message || "Approve failed");
      setStatus("");
    }
  }

  async function onBuyInvoice(invoiceId: `0x${string}`) {
    try {
      setLastError("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured) throw new Error("InvoiceMarketplace not configured");

      setStatus("Buying invoice...");
      await writeContract({
        address: INVOICE_MARKETPLACE_ADDRESS,
        abi: INVOICE_MARKETPLACE_ABI,
        functionName: "buyInvoice",
        args: [invoiceId],
      });
    } catch (e: any) {
      setLastError(e?.message || "Buy invoice failed");
    } finally {
      setStatus("");
    }
  }

  async function onCancel(invoiceId: `0x${string}`) {
    try {
      setLastError("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured) throw new Error("InvoiceMarketplace not configured");

      setStatus("Cancelling listing...");
      await writeContract({
        address: INVOICE_MARKETPLACE_ADDRESS,
        abi: INVOICE_MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [invoiceId],
      });
    } catch (e: any) {
      setLastError(e?.message || "Cancel listing failed");
    } finally {
      setStatus("");
    }
  }

  const myLower = (address || "").toLowerCase();
  const activeListings = items.filter((x) => x.status === 1);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <img src="/chain-icons/invoice.svg" alt="Marketplace" className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Invoice Marketplace</h1>
        </div>
        <p className="text-sm text-gray-600">
          List invoices at a discount and let buyers purchase the right to receive the future payment.
        </p>
      </div>

      {!isConfigured && (
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
          <div className="text-sm text-orange-800 font-semibold">Missing configuration</div>
          <div className="mt-1 text-sm text-orange-700">
            Set <code className="px-1 py-0.5 bg-white rounded">NEXT_PUBLIC_ARC_INVOICE_MARKETPLACE</code> to the deployed
            marketplace contract address.
          </div>
        </div>
      )}

      {/* List */}
      <div className="arc-card-light p-5 space-y-4 border-2 border-[#ff7582]/40 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">List an invoice</h2>
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
            <label className="text-xs font-semibold text-gray-700">Invoice ID (bytes32)</label>
            <input
              value={listInvoiceId}
              onChange={(e) => setListInvoiceId(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Price (USDC)</label>
            <input
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              placeholder="850.00"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={onListInvoice}
          disabled={!isConfigured || isBusy}
          className="rounded-xl bg-[#ff7582] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#ff5f70] disabled:opacity-60"
        >
          {isBusy ? "Processing..." : "List invoice"}
        </button>

        {txHash && (
          <div className="text-xs text-gray-600">
            Tx: <code className="px-1 py-0.5 bg-white rounded">{txHash}</code>
          </div>
        )}
      </div>

      {/* Listings */}
      <div className="arc-card-light p-5 space-y-4 border-2 border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Active listings</h2>
          <div className="text-xs text-gray-500">{activeListings.length} items</div>
        </div>

        {activeListings.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-600">No active listings yet. Click Refresh to fetch.</div>
        ) : (
          <div className="space-y-3">
            {activeListings.map((l) => {
              const isSeller = isConnected && l.seller.toLowerCase() === myLower;
              const needsApproval = allowance < l.price;
              return (
                <div key={l.invoiceId} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Invoice ID</div>
                      <div className="font-mono text-xs break-all">{l.invoiceId}</div>
                    </div>
                    <div className="text-xs font-semibold px-2 py-1 rounded-full border border-gray-200 bg-gray-50">
                      {listingStatusLabel(l.status)}
                    </div>
                  </div>

                  <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Seller</div>
                      <div className="font-semibold">{formatAddress(l.seller)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Token</div>
                      <div className="font-semibold">{formatAddress(l.token)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Price</div>
                      <div className="font-semibold">{formatUSDC(l.price)} USDC</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Buyer</div>
                      <div className="font-semibold">
                        {l.buyer && l.buyer !== ("0x0000000000000000000000000000000000000000" as Address)
                          ? formatAddress(l.buyer)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-gray-500">
                      Allowance: <span className="font-mono">{formatUSDC(allowance)} USDC</span>
                      {needsApproval ? " (needs approval)" : " (ok)"}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isSeller ? (
                        <>
                          <button
                            onClick={() => onApprove(l.price)}
                            disabled={!isConnected || !needsApproval || isBusy}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => onBuyInvoice(l.invoiceId)}
                            disabled={!isConnected || needsApproval || isBusy}
                            className="rounded-lg bg-[#725a7a] px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
                          >
                            Buy
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onCancel(l.invoiceId)}
                          disabled={!isConnected || isBusy}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(lastError || status || isConfirmed) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
          {lastError && <div className="text-red-600">{lastError}</div>}
          {status && <div className="text-gray-700">{status}</div>}
          {isConfirmed && <div className="text-green-700">Confirmed.</div>}
        </div>
      )}
    </div>
  );
}
