"use client";

import { useMemo, useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { DESTS } from "@/lib/chains";
import {
  ERC20_ABI,
  ROUTER_ABI,
  HOOK_DATA,
  addressToBytes32,
  buildHookDataWithMemo,
  validateRecipient,
  validateAmount,
  validateMemo,
} from "@/lib/cctp";
import { parseUnits } from "viem";

const TOKEN_MESSENGER_V2_FEE_ABI = [
  {
    type: "function",
    name: "getMinFeeAmount",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const TOKEN_MESSENGER_V2_ABI = [
  {
    type: "function",
    name: "depositForBurnWithHook",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ name: "nonce", type: "uint64" }],
  },
] as const;

const FEE_RECEIVER = (process.env.NEXT_PUBLIC_FEE_COLLECTOR ||
  "0xA87Bd559fd6F2646225AcE941bA6648Ec1BAA9AF") as `0x${string}`;
const FEE_USDC = process.env.NEXT_PUBLIC_FEE_USDC || "0.01";

type BridgeHistoryItem = {
  ts: number;
  from: `0x${string}`;
  to: `0x${string}`;
  txHash: `0x${string}`;
  memo?: string;
  direction?: "ARC_TO_OTHER" | "OTHER_TO_ARC";
};

function UsdcIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      fill="none"
      viewBox="0 0 120 120"
      className={className}
      aria-label="USDC"
      role="img"
      focusable="false"
    >
      <path fill="#0B53BF" d="M60 120c33.137 0 60-26.863 60-60S93.137 0 60 0 0 26.863 0 60s26.863 60 60 60" />
      <path
        fill="#fff"
        d="M70.8 16.313v7.725C86.211 28.688 97.498 43.013 97.498 60s-11.287 31.313-26.7 35.963v7.725C90.45 98.888 105 81.15 105 60s-14.55-38.887-34.2-43.687M22.499 60c0-16.987 11.287-31.312 26.7-35.962v-7.725c-19.65 4.8-34.2 22.537-34.2 43.687s14.55 38.888 34.2 43.688v-7.725C33.786 91.35 22.499 76.988 22.499 60"
      />
      <path
        fill="#fff"
        d="M76.124 68.363c0-15.338-24.037-9.038-24.037-17.513 0-3.037 2.437-4.987 7.087-4.987 5.55 0 7.463 2.7 8.063 6.337h7.65c-.683-6.826-4.6-11.137-11.138-12.42v-6.03h-7.5v5.814c-7.161.912-11.662 5.083-11.662 11.286 0 15.413 24.075 9.638 24.075 17.963 0 3.15-3.038 5.25-8.176 5.25-6.712 0-8.924-2.963-9.75-7.05h-7.462c.483 7.477 5.094 12.157 12.975 13.324v5.913h7.5v-5.834c7.692-.994 12.375-5.468 12.375-12.053"
      />
    </svg>
  );
}

export default function BridgeTab() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // NOTE: In the Next.js App Router, `process.env.NEXT_PUBLIC_*` is statically replaced at build time.
  // Some bundlers/optimizations can make dynamic lookups like `process.env[key]` unreliable.
  // We keep an explicit snapshot to improve reliability across deploys.
  const envPublic = useMemo(
    () => ({
      NEXT_PUBLIC_ARC_RPC_URL: process.env.NEXT_PUBLIC_ARC_RPC_URL,

      NEXT_PUBLIC_ETH_SEPOLIA_CHAIN_ID: process.env.NEXT_PUBLIC_ETH_SEPOLIA_CHAIN_ID,
      NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL,
      NEXT_PUBLIC_ETH_SEPOLIA_RPC: (process.env as any).NEXT_PUBLIC_ETH_SEPOLIA_RPC,
      NEXT_PUBLIC_ETH_SEPOLIA_EXPLORER_URL: process.env.NEXT_PUBLIC_ETH_SEPOLIA_EXPLORER_URL,
    }),
    []
  );

  // NOTE: In the Next.js App Router, `process.env.NEXT_PUBLIC_*` is statically replaced at build time.
  // Some bundlers/optimizations can make dynamic lookups like `process.env[key]` unreliable.
  // We keep an explicit snapshot to improve reliability across deploys.
  const envPublic = useMemo(
    () => ({
      NEXT_PUBLIC_ARC_RPC_URL: process.env.NEXT_PUBLIC_ARC_RPC_URL,

      NEXT_PUBLIC_ETH_SEPOLIA_CHAIN_ID: process.env.NEXT_PUBLIC_ETH_SEPOLIA_CHAIN_ID,
      NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL,
      NEXT_PUBLIC_ETH_SEPOLIA_RPC: (process.env as any).NEXT_PUBLIC_ETH_SEPOLIA_RPC,
      NEXT_PUBLIC_ETH_SEPOLIA_EXPLORER_URL: process.env.NEXT_PUBLIC_ETH_SEPOLIA_EXPLORER_URL,
    }),
    []
  );

  const [sourceKey, setSourceKey] = useState<"ARC" | (typeof DESTS)[number]["key"]>("ARC");
  const [destKey, setDestKey] = useState(DESTS[0].key);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [amountUsdc, setAmountUsdc] = useState("");
  const [recipient, setRecipient] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>("");

  const [history, setHistory] = useState<BridgeHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bridge_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (history.length > 0) localStorage.setItem("bridge_history", JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  const dest = useMemo(() => DESTS.find((d) => d.key === destKey) || DESTS[0], [destKey]);

  const expectedArcChainId = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002);
  const isOnArc = isConnected && chain?.id === expectedArcChainId;

  const sourceLabel = useMemo(() => {
    if (sourceKey === "ARC") return "ARC Testnet";
    return DESTS.find((d) => d.key === sourceKey)?.name || sourceKey;
  }, [sourceKey]);

  const src = useMemo(() => {
    if (sourceKey === "ARC") return null;
    return DESTS.find((d) => d.key === sourceKey) || null;
  }, [sourceKey]);

  const srcChainId = useMemo(() => {
    if (sourceKey === "ARC") return expectedArcChainId;
    const key = `NEXT_PUBLIC_${sourceKey}_CHAIN_ID`;
    const id = Number((envPublic as any)[key] ?? (process.env as any)[key] ?? 0);
    return id || 0;
  }, [sourceKey, expectedArcChainId, envPublic]);

  // On Vercel/Next, client-side env vars are injected at build time.
  // Fall back to a small built-in map so switching works even if env isn't present in the bundle.
  const fallbackChainIds: Record<string, number> = useMemo(
    () => ({
      ETH_SEPOLIA: 11155111,
      BASE_SEPOLIA: 84532,
      ARB_SEPOLIA: 421614,
      OP_SEPOLIA: 11155420,
      AVAX_FUJI: 43113,
      POLYGON_AMOY: 80002,
      UNICHAIN_SEPOLIA: 1301,
      LINEA_SEPOLIA: 59141,
      XDC_APOTHEM: 51,
      WORLD_CHAIN_SEPOLIA: 4801,
      MONAD_TESTNET: 10143,
      SEI_TESTNET: 1328,
      HYPEREVM_TESTNET: 999,
      INK_TESTNET: 763373,
      SONIC_TESTNET: 14601,
      PLUME_TESTNET: 98867,
      CODEX_TESTNET: 812242,
    }),
    []
  );

  const srcChainIdResolved = useMemo(() => {
    if (sourceKey === "ARC") return expectedArcChainId;
    return srcChainId || fallbackChainIds[sourceKey] || 0;
  }, [sourceKey, expectedArcChainId, srcChainId, fallbackChainIds]);

  const isOnSelectedSource = useMemo(() => {
    if (!isConnected || !chain?.id) return false;
    return chain.id === srcChainIdResolved;
  }, [isConnected, chain?.id, srcChainIdResolved]);

  // Debug helper: lets you see which env keys resolved at runtime in the browser.
  const envDebug = useMemo(() => {
    const chainIdKey = `NEXT_PUBLIC_${sourceKey}_CHAIN_ID`;
    const rpcKey = `NEXT_PUBLIC_${sourceKey}_RPC_URL`;
    const explorerKey = `NEXT_PUBLIC_${sourceKey}_EXPLORER_URL`;
    const rpcKeyAlt = `NEXT_PUBLIC_${sourceKey}_RPC`;
    const chainIdKeyAlt = `NEXT_PUBLIC_${sourceKey}_CHAINID`;
    return {
      sourceKey,
      chainIdKey,
      chainIdKeyAlt,
      chainIdRaw: (envPublic as any)[chainIdKey] ?? (process.env as any)[chainIdKey],
      chainIdRawAlt: (envPublic as any)[chainIdKeyAlt] ?? (process.env as any)[chainIdKeyAlt],
      rpcKey,
      rpcKeyAlt,
      rpcRaw: (envPublic as any)[rpcKey] ?? (process.env as any)[rpcKey],
      rpcRawAlt: (envPublic as any)[rpcKeyAlt] ?? (process.env as any)[rpcKeyAlt],
      explorerKey,
      explorerRaw: (envPublic as any)[explorerKey] ?? (process.env as any)[explorerKey],
      chainIdResolved: srcChainIdResolved,
    };
  }, [sourceKey, srcChainIdResolved, envPublic]);

  async function switchToSelectedSource() {
    if (!srcChainIdResolved) {
      throw new Error(
        `Missing source chain id for ${sourceKey}. ` +
          `Set NEXT_PUBLIC_${sourceKey}_CHAIN_ID (and NEXT_PUBLIC_${sourceKey}_RPC_URL) in Vercel env /.env.local.`
      );
    }
    if (!window.ethereum) throw new Error("No injected wallet found");

    const chainIdHex = `0x${srcChainIdResolved.toString(16)}`;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: any) {
      // If the chain isn't added, try adding it with the RPC URL from env.
      if (switchError?.code === 4902) {
        const rpcUrl =
          sourceKey === "ARC"
            ? process.env.NEXT_PUBLIC_ARC_RPC_URL
            : (process.env as any)[`NEXT_PUBLIC_${sourceKey}_RPC_URL`];
        const explorerUrl =
          sourceKey === "ARC"
            ? "https://testnet.arcscan.app"
            : (process.env as any)[`NEXT_PUBLIC_${sourceKey}_EXPLORER_URL`];

        if (!rpcUrl) throw new Error("Missing RPC URL for selected source chain");

        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: sourceLabel,
              nativeCurrency: {
                name: "ETH",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: [rpcUrl],
              blockExplorerUrls: explorerUrl ? [explorerUrl] : undefined,
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  }

  // Auto switch whenever the user changes the "Source chain" selector.
  // Note: browsers/wallets may require a user gesture for chain switching; in that case we surface a clear message.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isConnected) return;
      if (!srcChainIdResolved) return;
      if (chain?.id === srcChainIdResolved) return;

      const rpcKey = sourceKey === "ARC" ? "NEXT_PUBLIC_ARC_RPC_URL" : `NEXT_PUBLIC_${sourceKey}_RPC_URL`;
      const rpcUrl =
        sourceKey === "ARC"
          ? envPublic.NEXT_PUBLIC_ARC_RPC_URL ?? process.env.NEXT_PUBLIC_ARC_RPC_URL
          : (envPublic as any)[`NEXT_PUBLIC_${sourceKey}_RPC_URL`] ||
            (process.env as any)[`NEXT_PUBLIC_${sourceKey}_RPC_URL`] ||
            // some projects accidentally use *_RPC instead of *_RPC_URL
            (envPublic as any)[`NEXT_PUBLIC_${sourceKey}_RPC`] ||
            (process.env as any)[`NEXT_PUBLIC_${sourceKey}_RPC`];

      // If the user just updated env vars on Vercel but didn't redeploy,
      // the running bundle can still have the old values (undefined).
      if (!rpcUrl) {
        setStatus(
          `Thiếu RPC URL cho chain nguồn (${sourceLabel}).\n` +
            `Vercel chỉ inject NEXT_PUBLIC_* vào bundle lúc build/deploy. Bạn cần redeploy để giá trị mới có hiệu lực.\n\n` +
            `Biến cần có: ${rpcKey} (hoặc NEXT_PUBLIC_${sourceKey}_RPC)\n` +
            `Giá trị đọc được hiện tại: ${String(rpcUrl)}\n\n` +
            `Debug: ${JSON.stringify(envDebug, null, 2)}`
        );
        return;
      }

      try {
        setStatus(`Đang chuyển ví sang chain nguồn: ${sourceLabel}...`);
        await switchToSelectedSource();
        if (!cancelled) setStatus(`Đã gửi yêu cầu chuyển chain sang: ${sourceLabel}.`);
      } catch (e: any) {
        const msg =
          typeof e?.message === "string"
            ? e.message
            : typeof e === "string"
              ? e
              : JSON.stringify(e);
        if (!cancelled) {
          setStatus(
            `Không thể tự động chuyển chain sang: ${sourceLabel}.\n` +
              `Lỗi: ${msg}\n\n` +
              `Gợi ý: một số ví (hoặc trình duyệt) chặn switch chain nếu không có thao tác click trực tiếp.\n` +
              `Bạn có thể thử bấm lại nút Bridge/Switch trong UI để tạo "user gesture".`
          );
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isConnected, chain?.id, sourceKey, sourceLabel, srcChainIdResolved, envDebug]);

  // Auto switch whenever the user changes the "Source chain" selector.
  // Note: browsers/wallets may require a user gesture for chain switching; in that case we surface a clear message.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isConnected) return;
      if (!srcChainIdResolved) return;
      if (chain?.id === srcChainIdResolved) return;

      const rpcKey = sourceKey === "ARC" ? "NEXT_PUBLIC_ARC_RPC_URL" : `NEXT_PUBLIC_${sourceKey}_RPC_URL`;
      const rpcUrl =
        sourceKey === "ARC"
          ? envPublic.NEXT_PUBLIC_ARC_RPC_URL ?? process.env.NEXT_PUBLIC_ARC_RPC_URL
          : (envPublic as any)[`NEXT_PUBLIC_${sourceKey}_RPC_URL`] ||
            (process.env as any)[`NEXT_PUBLIC_${sourceKey}_RPC_URL`] ||
            // some projects accidentally use *_RPC instead of *_RPC_URL
            (envPublic as any)[`NEXT_PUBLIC_${sourceKey}_RPC`] ||
            (process.env as any)[`NEXT_PUBLIC_${sourceKey}_RPC`];

      // If the user just updated env vars on Vercel but didn't redeploy,
      // the running bundle can still have the old values (undefined).
      if (!rpcUrl) {
        setStatus(
          `Thiếu RPC URL cho chain nguồn (${sourceLabel}).\n` +
            `Vercel chỉ inject NEXT_PUBLIC_* vào bundle lúc build/deploy. Bạn cần redeploy để giá trị mới có hiệu lực.\n\n` +
            `Biến cần có: ${rpcKey} (hoặc NEXT_PUBLIC_${sourceKey}_RPC)\n` +
            `Giá trị đọc được hiện tại: ${String(rpcUrl)}\n\n` +
            `Debug: ${JSON.stringify(envDebug, null, 2)}`
        );
        return;
      }

      try {
        setStatus(`Đang chuyển ví sang chain nguồn: ${sourceLabel}...`);
        await switchToSelectedSource();
        if (!cancelled) setStatus(`Đã gửi yêu cầu chuyển chain sang: ${sourceLabel}.`);
      } catch (e: any) {
        const msg =
          typeof e?.message === "string"
            ? e.message
            : typeof e === "string"
              ? e
              : JSON.stringify(e);
        if (!cancelled) {
          setStatus(
            `Không thể tự động chuyển chain sang: ${sourceLabel}.\n` +
              `Lỗi: ${msg}\n\n` +
              `Gợi ý: một số ví (hoặc trình duyệt) chặn switch chain nếu không có thao tác click trực tiếp.\n` +
              `Bạn có thể thử bấm lại nút Bridge/Switch trong UI để tạo "user gesture".`
          );
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isConnected, chain?.id, sourceKey, sourceLabel, srcChainIdResolved, envDebug]);

  function computeMaxFee(amountUsdcStr: string, destinationDomain: number) {
    const amount = parseUnits(amountUsdcStr, 6);
    const minForwardFeeUsdc = destinationDomain === 0 ? "1.25" : "0.2";
    const minForwardFee = parseUnits(minForwardFeeUsdc, 6);
    const maxFeeBps = BigInt(process.env.NEXT_PUBLIC_MAX_FEE_BPS || "500");
    const maxFeeFromPct = (amount * maxFeeBps) / 10000n;
    let maxFeeToUse = maxFeeFromPct < minForwardFee ? minForwardFee : maxFeeFromPct;
    const maxFeeUsdcCapStr = process.env.NEXT_PUBLIC_MAX_FEE_USDC_CAP || "0";
    const maxFeeUsdcCap = parseUnits(maxFeeUsdcCapStr, 6);
    if (maxFeeUsdcCap > 0n && maxFeeToUse > maxFeeUsdcCap) maxFeeToUse = maxFeeUsdcCap;
    const maxFeeCap = amount - 1n;
    if (maxFeeToUse > maxFeeCap) throw new Error("Amount is too small for maxFee constraints.");
    return { amount, maxFee: maxFeeToUse };
  }

  async function onBridge() {
    try {
      setStatus("");
      setTxHash("");
      setLoading(true);

      if (!isConnected || !address || !walletClient || !publicClient) throw new Error("Please connect your wallet first");

      setStatus("Validating inputs...");
      validateAmount(amountUsdc);
      if (memo) validateMemo(memo);

      const recipientAddr = recipient.trim() ? validateRecipient(recipient.trim()) : address;
      const finalHookData = buildHookDataWithMemo(HOOK_DATA, memo);
      const amount = parseUnits(amountUsdc, 6);
      const minFinality = Number(process.env.NEXT_PUBLIC_MIN_FINALITY_THRESHOLD || "1000");

      if (!isOnSelectedSource) {
        setStatus(`Bạn đang ở sai mạng. Đang chuyển ví sang chain nguồn: ${sourceLabel}...`);
        await switchToSelectedSource();
        throw new Error(`Vui lòng bấm Bridge lại sau khi đã switch sang ${sourceLabel}`);
      }

      // === ARC -> Other ===
      if (sourceKey === "ARC") {
        const router = (process.env.NEXT_PUBLIC_ARC_ROUTER ||
          "0xEc02A909701A8eB9C84B93b55B6d4A7ca215CFca") as `0x${string}`;
        let arcUsdc = ((process.env.NEXT_PUBLIC_ARC_USDC || process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS) ||
          "0x3600000000000000000000000000000000000000") as `0x${string}`;

        let feeCollector = FEE_RECEIVER;
        let feeAmount = parseUnits(FEE_USDC, 6);
        let tokenMessengerV2Addr: `0x${string}` | "" = "";
        let destinationCallerBytes32: `0x${string}` | "" = "";

        setStatus("Reading Router config...");
        const [routerUsdc, routerFeeCollector, routerServiceFee, routerDestCaller, routerTokenMessengerV2] =
          await Promise.all([
            publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: "usdc" }) as Promise<`0x${string}`>,
            publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: "feeCollector" }) as Promise<`0x${string}`>,
            publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: "serviceFee" }) as Promise<bigint>,
            publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: "destinationCaller" }) as Promise<`0x${string}`>,
            publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: "tokenMessengerV2" }) as Promise<`0x${string}`>,
          ]);

        arcUsdc = routerUsdc;
        feeCollector = routerFeeCollector;
        feeAmount = routerServiceFee;
        tokenMessengerV2Addr = routerTokenMessengerV2;
        destinationCallerBytes32 = routerDestCaller;

        let maxFee: bigint;
        ({ maxFee } = computeMaxFee(amountUsdc, dest.domain));

        setStatus("Reading minFee from TokenMessengerV2...");
        try {
          const minProtocolFee = (await publicClient.readContract({
            address: tokenMessengerV2Addr as `0x${string}`,
            abi: TOKEN_MESSENGER_V2_FEE_ABI,
            functionName: "getMinFeeAmount",
            args: [amount],
          })) as bigint;
          if (minProtocolFee > maxFee) {
            const bufferedMinFee = (minProtocolFee * 110n) / 100n;
            const maxFeeCap = amount - 1n;
            maxFee = bufferedMinFee > maxFeeCap ? maxFeeCap : bufferedMinFee;
          }
        } catch {
          // ignore
        }

        if (maxFee >= amount) throw new Error("Invalid fee: maxFee must be less than amount");

        setStatus("Checking USDC balance...");
        const bal = (await publicClient.readContract({
          address: arcUsdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        const totalNeed = amount + feeAmount;
        if (bal < totalNeed) throw new Error("Insufficient USDC balance");

        setStatus("Checking TokenMessengerV2 allowance...");
        const tmAllowance = (await publicClient.readContract({
          address: arcUsdc,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, tokenMessengerV2Addr as `0x${string}`],
        })) as bigint;

        if (tmAllowance < amount) {
          setStatus("Please approve USDC for TokenMessengerV2...");
          const approveTx = await walletClient.writeContract({
            address: arcUsdc,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [tokenMessengerV2Addr as `0x${string}`, amount],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        setStatus("Sending service fee transfer...");
        const feeTx = await walletClient.writeContract({
          address: arcUsdc,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [feeCollector, feeAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: feeTx });

        setStatus("Sending burn+message transaction...");
        const burnTx = await walletClient.writeContract({
          address: tokenMessengerV2Addr as `0x${string}`,
          abi: TOKEN_MESSENGER_V2_ABI,
          functionName: "depositForBurnWithHook",
          args: [
            amount,
            dest.domain,
            addressToBytes32(recipientAddr),
            arcUsdc,
            destinationCallerBytes32 as `0x${string}`,
            maxFee,
            minFinality,
            finalHookData,
          ],
        });

        setTxHash(burnTx);
        setStatus("Waiting for burn+message confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash: burnTx });
        if (receipt.status !== "success") throw new Error("burn+message transaction reverted");

        setHistory((prev) => [
          {
            ts: Date.now(),
            from: address,
            to: recipientAddr,
            txHash: burnTx,
            memo: memo || undefined,
            direction: "ARC_TO_OTHER",
          },
          ...prev,
        ]);

        setStatus(
          `Success!\n\n` +
            `Amount: ${Number(amount) / 1e6} USDC\n` +
            `From: ARC Testnet\n` +
            `To: ${dest.name}\n` +
            `Recipient: ${recipientAddr}\n\n` +
            `Waiting for forwarding...`
        );
      } else {
        // === Other -> ARC ===
        if (!src) throw new Error("Chain nguồn không hợp lệ.");

        const srcUsdc = ((process.env as any)[`NEXT_PUBLIC_${src.key}_USDC`] ||
          (process.env as any)[`NEXT_PUBLIC_${src.key}_USDC_ADDRESS`]) as `0x${string}` | undefined;
        const srcTokenMessengerV2 = (process.env as any)[`NEXT_PUBLIC_${src.key}_TOKEN_MESSENGER_V2`] as
          | `0x${string}`
          | undefined;

        if (!srcUsdc) throw new Error(`Thiếu NEXT_PUBLIC_${src.key}_USDC`);
        if (!srcTokenMessengerV2) throw new Error(`Thiếu NEXT_PUBLIC_${src.key}_TOKEN_MESSENGER_V2`);

        const arcDomain = Number(process.env.NEXT_PUBLIC_ARC_CCTP_DOMAIN || "26");
        let maxFee: bigint;
        ({ maxFee } = computeMaxFee(amountUsdc, arcDomain));
        if (maxFee >= amount) throw new Error("Invalid fee: maxFee must be less than amount");

        setStatus("Checking USDC balance on source chain...");
        const bal = (await publicClient.readContract({
          address: srcUsdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        if (bal < amount) throw new Error("Insufficient USDC balance");

        setStatus("Approving USDC for TokenMessengerV2 (source chain)...");
        const allowance = (await publicClient.readContract({
          address: srcUsdc,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, srcTokenMessengerV2],
        })) as bigint;

        if (allowance < amount) {
          const approveTx = await walletClient.writeContract({
            address: srcUsdc,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [srcTokenMessengerV2, amount],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        // Destination caller is optional; use zero.
        const destinationCallerBytes32 = addressToBytes32("0x0000000000000000000000000000000000000000");

        setStatus("Sending burn+message transaction (source chain)...");
        const burnTx = await walletClient.writeContract({
          address: srcTokenMessengerV2,
          abi: TOKEN_MESSENGER_V2_ABI,
          functionName: "depositForBurnWithHook",
          args: [
            amount,
            arcDomain,
            addressToBytes32(recipientAddr),
            srcUsdc,
            destinationCallerBytes32,
            maxFee,
            minFinality,
            finalHookData,
          ],
        });

        setTxHash(burnTx);
        setStatus("Waiting for burn+message confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash: burnTx });
        if (receipt.status !== "success") throw new Error("burn+message transaction reverted");

        setHistory((prev) => [
          {
            ts: Date.now(),
            from: address,
            to: recipientAddr,
            txHash: burnTx,
            memo: memo || undefined,
            direction: "ARC_TO_OTHER",
          },
          ...prev,
        ]);

        setStatus(
          `Success!\n\n` +
            `Amount: ${Number(amount) / 1e6} USDC\n` +
            `From: ${src.name}\n` +
            `To: ARC Testnet\n` +
            `Recipient (ARC): ${recipientAddr}\n\n` +
            `Waiting for attestation + mint on ARC...`
        );
      }
    } catch (err: any) {
      console.error("Bridge error:", err);
      setStatus(`Error: ${err?.message || err?.shortMessage || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
        {/* Left */}
        <div className="h-full rounded-2xl bg-white shadow-xl p-6 min-h-[70vh]">
          <div className="space-y-5">
            {/* Source chain */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Source chain</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSourceOpen((v) => !v)}
                  disabled={loading}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={sourceKey === "ARC" ? "/chain-icons/arc-logo.svg" : (DESTS.find((d) => d.key === sourceKey)?.iconPath || "/chain-icons/browser.svg")}
                      alt={sourceLabel}
                      className="h-6 w-6 rounded-md"
                    />
                    <span className="font-medium">{sourceLabel}</span>
                  </div>
                  <span className="text-gray-400">▾</span>
                </button>

                {sourceOpen && (
                  <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    <div className="max-h-72 overflow-auto py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSourceKey("ARC");
                          setSourceOpen(false);
                        }}
                        className={[
                          "flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gray-50",
                          sourceKey === "ARC" ? "bg-gray-50" : "",
                        ].join(" ")}
                      >
                        <img src="/chain-icons/arc-logo.svg" alt="ARC" className="h-6 w-6 rounded-md" />
                        <span className="font-medium text-gray-900">ARC Testnet</span>
                      </button>
                      {DESTS.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => {
                            setSourceKey(d.key as any);
                            setSourceOpen(false);
                          }}
                          className={[
                            "flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gray-50",
                            d.key === sourceKey ? "bg-gray-50" : "",
                          ].join(" ")}
                        >
                          <img src={d.iconPath} alt={d.name} className="h-6 w-6 rounded-md" />
                          <span className="font-medium text-gray-900">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {isOnSelectedSource ? "✅ Ví đang ở đúng chain nguồn." : "ℹ️ Hãy switch ví sang chain nguồn để gửi burn."}
              </div>
              {!isOnSelectedSource ? (
                <button
                  type="button"
                  onClick={() => switchToSelectedSource().catch((e) => setStatus(e?.message || "Switch failed"))}
                  disabled={loading || !isConnected}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Switch wallet to {sourceLabel}
                </button>
              ) : null}
              {!srcChainIdResolved ? (
                <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                  Thiếu cấu hình chain nguồn:{" "}
                  <span className="font-mono">{`NEXT_PUBLIC_${sourceKey}_CHAIN_ID`}</span>{" "}
                  / <span className="font-mono">{`NEXT_PUBLIC_${sourceKey}_RPC_URL`}</span>
                  <div className="mt-2 text-[11px] text-orange-900">
                    Debug: <span className="font-mono">{String(envDebug.chainIdRaw || "")}</span>{" "}
                    | <span className="font-mono">{String(envDebug.rpcRaw || "")}</span>
                    {"  "}→ resolved chainId: <span className="font-mono">{String(envDebug.chainIdResolved || "")}</span>
                  </div>
                </div>
              ) : null}
              {!srcChainIdResolved ? (
                <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                  Thiếu cấu hình chain nguồn:{" "}
                  <span className="font-mono">{`NEXT_PUBLIC_${sourceKey}_CHAIN_ID`}</span>{" "}
                  / <span className="font-mono">{`NEXT_PUBLIC_${sourceKey}_RPC_URL`}</span>
                  <div className="mt-2 text-[11px] text-orange-900">
                    Debug: <span className="font-mono">{String(envDebug.chainIdRaw || "")}</span>{" "}
                    | <span className="font-mono">{String(envDebug.rpcRaw || "")}</span>
                    {"  "}→ resolved chainId: <span className="font-mono">{String(envDebug.chainIdResolved || "")}</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Destination Chain */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Destination chain</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDestOpen((v) => !v)}
                  disabled={loading}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={sourceKey === "ARC" ? dest.iconPath : "/chain-icons/arc-logo.svg"}
                      alt={sourceKey === "ARC" ? dest.name : "ARC Testnet"}
                      className="h-6 w-6 rounded-md"
                    />
                    <span className="font-medium">{sourceKey === "ARC" ? dest.name : "ARC Testnet"}</span>
                  </div>
                  <span className="text-gray-400">▾</span>
                </button>

                {destOpen && (
                  <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    <div className="max-h-72 overflow-auto py-1">
                      {(sourceKey === "ARC"
                        ? DESTS
                        : [
                            {
                              key: "ARC",
                              name: "ARC Testnet",
                              domain: Number(process.env.NEXT_PUBLIC_ARC_CCTP_DOMAIN || "26"),
                              symbol: "USDC",
                              iconPath: "/chain-icons/arc-logo.svg",
                            },
                          ]
                      ).map((d: any) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => {
                            if (sourceKey === "ARC") setDestKey(d.key);
                            setDestOpen(false);
                          }}
                          className={[
                            "flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gray-50",
                            sourceKey === "ARC" && d.key === destKey ? "bg-gray-50" : "",
                          ].join(" ")}
                        >
                          <img src={d.iconPath} alt={d.name} className="h-6 w-6 rounded-md" />
                          <span className="font-medium text-gray-900">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {!isOnSelectedSource ? (
                <button
                  type="button"
                  onClick={() => switchToSelectedSource().catch((e) => setStatus(e?.message || "Switch failed"))}
                  disabled={loading || !isConnected}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Switch wallet to {sourceLabel}
                </button>
              ) : null}
            </div>

            {/* Recipient */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {sourceKey === "ARC" ? "Recipient address" : "Recipient (ARC) address"}
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={address || "0x..."}
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            {/* Memo */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Message</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Leave a message"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="5"
                  value={amountUsdc}
                  onChange={(e) => setAmountUsdc(e.target.value)}
                  placeholder="Minimum 5 USDC"
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-16 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <UsdcIcon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Suggested minimum: 5 USDC
              </div>
              {sourceKey !== "ARC" ? (
                <div className="mt-1 text-[11px] text-gray-500">
                  Source chain detected: <span className="font-semibold">{src?.name || "Unknown"}</span>
                </div>
              ) : null}
            </div>

            <button
              onClick={onBridge}
              disabled={loading || !isConnected}
              className={[
                "w-full rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all",
                loading || !isConnected
                  ? "cursor-not-allowed bg-gray-300"
                  : "bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:from-[#ff5f70] hover:to-[#664f6e] active:scale-[0.98]",
              ].join(" ")}
            >
              {loading ? "Processing..." : sourceKey === "ARC" ? "Bridge out" : "Bridge to ARC"}
            </button>
          </div>
        </div>

        {/* Right */}
        <div className="h-full rounded-2xl bg-white shadow-xl p-6 min-h-[70vh]">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Status</h3>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 whitespace-pre-wrap min-h-[140px]">
              {status || "—"}
            </div>

            {txHash ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-800">
                <div className="text-xs text-gray-500 mb-1">Tx Hash</div>
                <div className="font-mono break-all">{txHash}</div>
              </div>
            ) : null}

            <div className="border-t border-gray-200" />

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">History</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  disabled={historyPage <= 0}
                  onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  disabled={(historyPage + 1) * 5 >= history.length}
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {history.slice(historyPage * 5, historyPage * 5 + 5).map((h) => (
                <div key={`${h.txHash}-${h.ts}`} className="rounded-xl border border-gray-200 bg-white p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-800">
                      {h.direction === "OTHER_TO_ARC" ? "Other → ARC" : "ARC → Other"}
                    </div>
                    <div className="text-gray-500">{new Date(h.ts).toLocaleString()}</div>
                  </div>
                  <div className="mt-2 text-gray-600">
                    to: <span className="font-mono">{h.to}</span>
                  </div>
                  {h.memo ? (
                    <div className="mt-1 text-gray-600">
                      memo: <span className="font-mono">{h.memo}</span>
                    </div>
                  ) : null}
                  <div className="mt-2 text-gray-600">
                    tx: <span className="font-mono break-all">{h.txHash}</span>
                  </div>
                </div>
              ))}
              {history.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">No history</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
