"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// ── FIX #2: Add ERC721 ABI for NFT approval check before listing ─────────────
const ERC721_ABI = [
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
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

// ── FIX #3: localStorage cache TTL (24 hours) ────────────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = {
  ids: string[];
  savedAt: number;
};

export default function InvoiceMarketplaceTab() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  // ── FIX #7: isBusy also blocks while fetching listings ───────────────────
  const [isLoading, setIsLoading] = useState(false);
  const isBusy = isPending || isConfirming || isLoading;

  const INVOICE_MARKETPLACE_ADDRESS = (process.env
    .NEXT_PUBLIC_ARC_INVOICE_MARKETPLACE ||
    "0x0000000000000000000000000000000000000000") as Address;

  const USDC_ADDRESS = ((process.env.NEXT_PUBLIC_ARC_USDC ||
    process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS) ||
    "0x3600000000000000000000000000000000000000") as Address;

  // NFT contract address (invoice NFT that must be approved for listing)
  const INVOICE_NFT_ADDRESS = (process.env.NEXT_PUBLIC_ARC_INVOICE_NFT ||
    "0x0000000000000000000000000000000000000000") as Address;

  const isConfigured =
    INVOICE_MARKETPLACE_ADDRESS !==
    ("0x0000000000000000000000000000000000000000" as Address);

  // ── Allowance: USDC => InvoiceMarketplace (for buyInvoice) ───────────────
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, INVOICE_MARKETPLACE_ADDRESS] : undefined,
    query: { enabled: Boolean(address) && isConfigured },
  });
  const allowance = (allowanceData as bigint | undefined) ?? 0n;

  // ── FIX #2: NFT approval check ───────────────────────────────────────────
  const { data: nftApprovedData, refetch: refetchNftApproval } =
    useReadContract({
      address: INVOICE_NFT_ADDRESS,
      abi: ERC721_ABI,
      functionName: "isApprovedForAll",
      args: address ? [address, INVOICE_MARKETPLACE_ADDRESS] : undefined,
      query: {
        enabled:
          Boolean(address) &&
          isConfigured &&
          INVOICE_NFT_ADDRESS !==
            ("0x0000000000000000000000000000000000000000" as Address),
      },
    });
  const isNftApproved = Boolean(nftApprovedData);

  const [txStatus, setTxStatus] = useState("");
  const [lastError, setLastError] = useState("");

  // Listing creation
  const [listInvoiceId, setListInvoiceId] = useState("");
  const [listPrice, setListPrice] = useState("");

  // All listing rows fetched from chain
  const [items, setItems] = useState<ListingRow[]>([]);

  // ── FIX #5: ref to cancel in-flight refreshes ────────────────────────────
  const refreshAbortRef = useRef<AbortController | null>(null);

  const storageKey = useMemo(() => {
    const chainId = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002);
    return `arc:invoice-marketplace:knownIds:${chainId}:${INVOICE_MARKETPLACE_ADDRESS.toLowerCase()}`;
  }, [INVOICE_MARKETPLACE_ADDRESS]);

  // ── FIX #3: localStorage helpers with TTL ────────────────────────────────
  function getCachedIds(): string[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as CacheEntry | string[];
      // Handle legacy format (plain array) and new format (object with TTL)
      if (Array.isArray(parsed)) return parsed;
      if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
        localStorage.removeItem(storageKey);
        return [];
      }
      return Array.isArray(parsed.ids)
        ? Array.from(new Set(parsed.ids.map((x) => String(x).toLowerCase())))
        : [];
    } catch {
      return [];
    }
  }

  function mergeAndCacheIds(incoming: string[]) {
    const merged = Array.from(
      new Set([
        ...getCachedIds(),
        ...incoming.map((x) => x.toLowerCase()),
      ])
    );
    try {
      const entry: CacheEntry = { ids: merged, savedAt: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch {
      // ignore quota errors
    }
    return merged;
  }

  // ── FIX #1 + #6: Refetch allowance & NFT approval after tx confirmed; reset txStatus ──
  useEffect(() => {
    if (!isConfirmed) return;
    refetchAllowance();
    refetchNftApproval();
    setTxStatus(""); // FIX #6: clear status after confirmed
  }, [isConfirmed, refetchAllowance, refetchNftApproval]);

  // ── FIX #4: getLogs with chunked block ranges to avoid RPC limits ─────────
  async function getLogsChunked(
    fromBlock: bigint,
    toBlock: bigint,
    signal: AbortSignal
  ): Promise<string[]> {
    if (!publicClient) return [];
    const CHUNK_SIZE = 50_000n;
    const ids: string[] = [];
    let start = fromBlock;

    while (start <= toBlock) {
      if (signal.aborted) break;
      const end = start + CHUNK_SIZE - 1n > toBlock ? toBlock : start + CHUNK_SIZE - 1n;

      try {
        const logs = await publicClient.getLogs({
          address: INVOICE_MARKETPLACE_ADDRESS,
          event: INVOICE_MARKETPLACE_ABI.find(
            (x) => (x as any).type === "event" && (x as any).name === "InvoiceListed"
          ) as any,
          fromBlock: start,
          toBlock: end,
        });

        for (const log of logs) {
          const invoiceId = (log as any).args?.invoiceId as string | undefined;
          if (invoiceId) ids.push(invoiceId.toLowerCase());
        }
      } catch (chunkErr) {
        console.warn(
          `[InvoiceMarketplaceTab] getLogs chunk ${start}-${end} failed:`,
          chunkErr
        );
        // Continue to next chunk rather than aborting entirely
      }

      start = end + 1n;
    }

    return ids;
  }

  // ── Load listing details for each known invoiceId ────────────────────────
  const loadDetails = useCallback(
    async (ids: string[], signal: AbortSignal) => {
      if (!publicClient || !isConfigured || ids.length === 0) return;
      const next: ListingRow[] = [];

      for (const id of ids) {
        if (signal.aborted) return;
        try {
          const row = (await publicClient.readContract({
            address: INVOICE_MARKETPLACE_ADDRESS,
            abi: INVOICE_MARKETPLACE_ABI,
            functionName: "listings",
            args: [id as `0x${string}`],
          })) as unknown as readonly [
            string,
            Address,
            Address,
            bigint,
            number,
            bigint,
            bigint,
            Address
          ];

          const statusNum = Number(row[4]);
          if (statusNum === 0) continue; // skip uninitialized

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
          // ignore invalid ids
        }
      }

      if (!signal.aborted) {
        setItems(next.sort((a, b) => Number(b.createdAt - a.createdAt)));
      }
    },
    [publicClient, isConfigured, INVOICE_MARKETPLACE_ADDRESS]
  );

  // ── FIX #5: Race-condition-safe refresh ──────────────────────────────────
  const refreshFromChain = useCallback(async () => {
    if (!publicClient || !isConfigured) return;

    // Cancel any previous in-flight refresh
    if (refreshAbortRef.current) {
      refreshAbortRef.current.abort();
    }
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    const { signal } = controller;

    setIsLoading(true);
    setLastError("");

    try {
      const latest = await publicClient.getBlockNumber();
      const window = 200_000n;
      const fromBlock = latest > window ? latest - window : 0n;

      // FIX #4: chunked getLogs
      const idsFromChain = await getLogsChunked(fromBlock, latest, signal);
      if (signal.aborted) return;

      const allIds = mergeAndCacheIds(idsFromChain);
      await loadDetails(allIds, signal);
    } catch (e: any) {
      if (signal.aborted) return;
      console.warn("[InvoiceMarketplaceTab] refreshFromChain failed:", e);
      const cachedIds = getCachedIds();
      if (cachedIds.length > 0) {
        await loadDetails(cachedIds, signal);
      }
      setLastError(
        "Could not fetch latest listings from chain. Showing cached data."
      );
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, isConfigured, loadDetails]);

  // Auto-refresh on mount and after tx confirmed
  useEffect(() => {
    if (!publicClient || !isConfigured) return;
    refreshFromChain();
  }, [publicClient, isConfigured, isConfirmed, refreshFromChain]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      refreshAbortRef.current?.abort();
    };
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  // FIX #2: Approve NFT before listing if not already approved
  async function onApproveNft() {
    try {
      setLastError("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured)
        throw new Error("InvoiceMarketplace not configured");

      setTxStatus("Approving invoice NFT transfer...");
      await writeContract({
        address: INVOICE_NFT_ADDRESS,
        abi: ERC721_ABI,
        functionName: "setApprovalForAll",
        args: [INVOICE_MARKETPLACE_ADDRESS, true],
      });
    } catch (e: any) {
      setLastError(e?.message || "NFT approve failed");
      setTxStatus("");
    }
  }

  async function onListInvoice() {
    try {
      setLastError("");
      setTxStatus("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured)
        throw new Error(
          "InvoiceMarketplace not configured (NEXT_PUBLIC_ARC_INVOICE_MARKETPLACE)."
        );

      // FIX #2: Guard — require NFT approval before listing
      if (
        INVOICE_NFT_ADDRESS !==
          ("0x0000000000000000000000000000000000000000" as Address) &&
        !isNftApproved
      ) {
        throw new Error(
          "Marketplace not approved to transfer your invoice NFT. Click 'Approve NFT' first."
        );
      }

      const id = listInvoiceId.trim();
      if (!id.startsWith("0x") || id.length !== 66)
        throw new Error(
          "invoiceId must be 0x + 64 hex chars (bytes32)."
        );
      if (!listPrice || Number(listPrice) <= 0)
        throw new Error("Price must be > 0");

      const price = parseUnits(listPrice, 6);
      setTxStatus("Listing invoice...");
      await writeContract({
        address: INVOICE_MARKETPLACE_ADDRESS,
        abi: INVOICE_MARKETPLACE_ABI,
        functionName: "listInvoice",
        args: [id as `0x${string}`, price],
      });

      // Add to cache so it appears immediately after confirm
      mergeAndCacheIds([id]);
      setTxStatus("Submitted. Waiting confirmation...");
    } catch (e: any) {
      setLastError(e?.message || "List invoice failed");
      setTxStatus("");
    }
  }

  async function onApprove(required: bigint) {
    try {
      setLastError("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured)
        throw new Error("InvoiceMarketplace not configured");

      setTxStatus(`Approving ${formatUSDC(required)} USDC allowance...`);
      await writeContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [INVOICE_MARKETPLACE_ADDRESS, required],
      });
    } catch (e: any) {
      setLastError(e?.message || "Approve failed");
      setTxStatus("");
    }
  }

  async function onBuyInvoice(invoiceId: `0x${string}`, price: bigint) {
    try {
      setLastError("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured)
        throw new Error("InvoiceMarketplace not configured");

      // FIX #1: Re-fetch allowance right before buying to avoid race condition
      const { data: freshAllowance } = await refetchAllowance();
      const currentAllowance = (freshAllowance as bigint | undefined) ?? 0n;

      if (currentAllowance < price) {
        throw new Error(
          `Insufficient allowance. Please approve at least ${formatUSDC(price)} USDC first.`
        );
      }

      setTxStatus("Buying invoice...");
      await writeContract({
        address: INVOICE_MARKETPLACE_ADDRESS,
        abi: INVOICE_MARKETPLACE_ABI,
        functionName: "buyInvoice",
        args: [invoiceId],
      });
    } catch (e: any) {
      setLastError(e?.message || "Buy invoice failed");
    } finally {
      setTxStatus("");
    }
  }

  async function onCancel(invoiceId: `0x${string}`) {
    try {
      setLastError("");
      if (!isConnected || !address) throw new Error("Connect wallet first");
      if (!isConfigured)
        throw new Error("InvoiceMarketplace not configured");

      setTxStatus("Cancelling listing...");
      await writeContract({
        address: INVOICE_MARKETPLACE_ADDRESS,
        abi: INVOICE_MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [invoiceId],
      });
    } catch (e: any) {
      setLastError(e?.message || "Cancel listing failed");
    } finally {
      setTxStatus("");
    }
  }

  const myLower = (address || "").toLowerCase();

  const activeListings = items.filter((x) => x.status === 1);

  // FIX #8: Memoize myListings to avoid recomputing on every render
  const myListings = useMemo(
    () =>
      address
        ? items.filter(
            (x) => x.seller.toLowerCase() === myLower && x.status !== 0
          )
        : [],
    [items, address, myLower]
  );

  const needsNftApproval =
    INVOICE_NFT_ADDRESS !==
      ("0x0000000000000000000000000000000000000000" as Address) &&
    !isNftApproved;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <img
            src="/chain-icons/invoice.svg"
            alt="Marketplace"
            className="h-8 w-8"
          />
          <h1 className="text-3xl font-bold">Invoice Marketplace</h1>
        </div>
        <p className="text-sm text-gray-600">
          List invoices at a discount and let buyers purchase the right to
          receive the future payment.
        </p>
      </div>

      {!isConfigured && (
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
          <div className="text-sm text-orange-800 font-semibold">
            Missing configuration
          </div>
          <div className="mt-1 text-sm text-orange-700">
            Set{" "}
            <code className="px-1 py-0.5 bg-white rounded">
              NEXT_PUBLIC_ARC_INVOICE_MARKETPLACE
            </code>{" "}
            to the deployed marketplace contract address.
          </div>
        </div>
      )}

      {/* List an invoice */}
      <div className="arc-card-light p-5 space-y-4 border-2 border-[#ff7582]/40 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">List an invoice</h2>
          <button
            onClick={refreshFromChain}
            disabled={!isConfigured || !publicClient || isLoading}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* FIX #2: NFT approval banner */}
        {isConnected && needsNftApproval && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
            <p className="text-xs text-yellow-800">
              The marketplace needs permission to transfer your invoice NFT
              before you can list.
            </p>
            <button
              onClick={onApproveNft}
              disabled={isBusy}
              className="shrink-0 rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yellow-600 disabled:opacity-60"
            >
              Approve NFT
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">
              Invoice ID (bytes32)
            </label>
            <input
              value={listInvoiceId}
              onChange={(e) => setListInvoiceId(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">
              Price (USDC)
            </label>
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
          disabled={!isConfigured || isBusy || needsNftApproval}
          className="rounded-xl bg-[#ff7582] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#ff5f70] disabled:opacity-60"
        >
          {isBusy ? "Processing..." : "List invoice"}
        </button>

        {txHash && (
          <div className="text-xs text-gray-600">
            Tx:{" "}
            <code className="px-1 py-0.5 bg-white rounded">{txHash}</code>
          </div>
        )}
      </div>

      {/* All active listings — visible to everyone */}
      <div className="arc-card-light p-5 space-y-4 border-2 border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Active listings</h2>
          <div className="text-xs text-gray-500">
            {isLoading ? "Loading..." : `${activeListings.length} items`}
          </div>
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-sm text-gray-500">
            Fetching listings from chain...
          </div>
        ) : activeListings.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-600">
            No active listings yet. Click{" "}
            <span className="font-semibold">Refresh</span> to fetch from chain.
          </div>
        ) : (
          <div className="space-y-3">
            {activeListings.map((l) => {
              const isSeller =
                isConnected && l.seller.toLowerCase() === myLower;
              // FIX #1: allowance check uses live `allowance` state; onBuyInvoice re-fetches before executing
              const needsApproval = allowance < l.price;
              return (
                <div
                  key={l.invoiceId}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Invoice ID</div>
                      <div className="font-mono text-xs break-all">
                        {l.invoiceId}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSeller && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ff7582]/10 text-[#ff7582] border border-[#ff7582]/30">
                          Your listing
                        </span>
                      )}
                      <div className="text-xs font-semibold px-2 py-1 rounded-full border border-gray-200 bg-gray-50">
                        {listingStatusLabel(l.status)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Seller</div>
                      <div className="font-semibold">
                        {formatAddress(l.seller)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Price</div>
                      <div className="font-semibold text-[#725a7a]">
                        {formatUSDC(l.price)} USDC
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Token</div>
                      <div className="font-semibold">
                        {formatAddress(l.token)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Listed at</div>
                      <div className="font-semibold">
                        {l.createdAt > 0n
                          ? new Date(Number(l.createdAt) * 1000)
                              .toISOString()
                              .slice(0, 10)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-gray-500">
                      Allowance:{" "}
                      <span className="font-mono">
                        {formatUSDC(allowance)} USDC
                      </span>
                      {!isSeller &&
                        (needsApproval
                          ? " (needs approval)"
                          : " ✓ ok")}
                    </div>
                    <div className="flex items-center gap-2">
                      {isSeller ? (
                        <button
                          onClick={() => onCancel(l.invoiceId)}
                          disabled={isBusy}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                        >
                          Cancel listing
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => onApprove(l.price)}
                            disabled={
                              !isConnected || !needsApproval || isBusy
                            }
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                            title={
                              needsApproval
                                ? `Approve ${formatUSDC(l.price)} USDC`
                                : "Allowance sufficient"
                            }
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              onBuyInvoice(l.invoiceId, l.price)
                            }
                            disabled={
                              !isConnected || needsApproval || isBusy
                            }
                            className="rounded-lg bg-[#725a7a] px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
                            title={
                              needsApproval
                                ? "Approve USDC first"
                                : "Buy this invoice"
                            }
                          >
                            Buy
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My listings history */}
      {myListings.length > 0 && (
        <div className="arc-card-light p-5 space-y-4 border-2 border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">My listings</h2>
            <div className="text-xs text-gray-500">
              {myListings.length} items
            </div>
          </div>
          {/* FIX #9: loading skeleton for My listings */}
          {isLoading ? (
            <div className="py-6 text-center text-sm text-gray-500">
              Fetching your listings from chain...
            </div>
          ) : (
            <div className="space-y-3">
              {myListings.map((l) => (
                <div
                  key={l.invoiceId}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Invoice ID</div>
                      <div className="font-mono text-xs break-all">
                        {l.invoiceId}
                      </div>
                    </div>
                    <div
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                        l.status === 1
                          ? "border-green-200 bg-green-50 text-green-700"
                          : l.status === 3
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-gray-50 text-gray-600"
                      }`}
                    >
                      {listingStatusLabel(l.status)}
                    </div>
                  </div>
                  <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Price</div>
                      <div className="font-semibold">
                        {formatUSDC(l.price)} USDC
                      </div>
                    </div>
                    {l.status === 3 &&
                      l.buyer &&
                      l.buyer !==
                        "0x0000000000000000000000000000000000000000" && (
                        <div>
                          <div className="text-xs text-gray-500">Sold to</div>
                          <div className="font-semibold">
                            {formatAddress(l.buyer)}
                          </div>
                        </div>
                      )}
                    {l.soldAt > 0n && (
                      <div>
                        <div className="text-xs text-gray-500">Sold at</div>
                        <div className="font-semibold">
                          {new Date(Number(l.soldAt) * 1000)
                            .toISOString()
                            .slice(0, 10)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(lastError || txStatus || isConfirmed) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm space-y-1">
          {lastError && <div className="text-red-600">{lastError}</div>}
          {txStatus && <div className="text-gray-700">{txStatus}</div>}
          {isConfirmed && <div className="text-green-700">Confirmed.</div>}
        </div>
      )}
    </div>
  );
}