"use client";

import { useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import {
  STABLECOIN_ABI,
  STABLECOIN_BYTECODE,
  STABLECOIN_CONFIG,
  generateStablecoinName,
  generateStablecoinSymbol,
  validateStablecoinParams,
  computePlatformFeeBps,
  formatSupply,
  type StablecoinInfo,
} from "@/lib/stablecoin";
import { parseUnits, keccak256, toBytes } from "viem";

// ─── Shared UI helpers ────────────────────────────────────────────────────────
const INPUT_CLS =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100";

const LABEL_CLS = "mb-2 block text-sm font-medium text-gray-700";

function ActionButton({
  onClick,
  disabled,
  loading,
  loadingLabel,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  children: React.ReactNode;
  variant?: "primary" | "danger" | "warning";
}) {
  const colorMap = {
    primary:
      "bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:from-[#ff5f70] hover:to-[#664f6e]",
    danger: "bg-gradient-to-r from-[#e53e3e] to-[#c53030] hover:from-[#fc5c5c] hover:to-[#e53e3e]",
    warning:
      "bg-gradient-to-r from-[#d69e2e] to-[#b7791f] hover:from-[#ecc94b] hover:to-[#d69e2e]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        "w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow transition-all active:scale-[0.98]",
        disabled || loading ? "cursor-not-allowed bg-gray-300" : colorMap[variant],
      ].join(" ")}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <span>{loadingLabel || "Processing..."}</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
}

// ─── Status banner (reused everywhere) ───────────────────────────────────────
function StatusBanner({ status, loading }: { status: string; loading: boolean }) {
  if (!status) return null;
  return (
    <div
      className={[
        "rounded-xl border p-4 text-sm",
        status.includes("✅")
          ? "border-green-200 bg-green-50 text-green-800"
          : status.includes("❌")
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-blue-200 bg-blue-50 text-blue-800",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        {loading && (
          <div className="mt-0.5 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        )}
        <div className="flex-1 whitespace-pre-line">{status}</div>
      </div>
    </div>
  );
}

// ─── Section title inside the action panel ───────────────────────────────────
function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
      <span>{icon}</span>
      <span className="text-sm font-semibold text-gray-800">{title}</span>
    </div>
  );
}

export default function IssuanceTab() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // ── Deploy form state ─────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState(6);
  const [initialMint, setInitialMint] = useState("10000");
  const [platformFeePercent, setPlatformFeePercent] = useState(0);
  const [contractURI, setContractURI] = useState(STABLECOIN_CONFIG.DEFAULT_CONTRACT_URI);

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deployedToken, setDeployedToken] = useState<StablecoinInfo | null>(null);

  // Advanced deploy settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customAdmin, setCustomAdmin] = useState("");
  const [customPrimarySale, setCustomPrimarySale] = useState("");
  const [customFeeRecipient, setCustomFeeRecipient] = useState("");

  // ── Post-deploy action state ─────────────────────────────────────────────
  const [actionStatus, setActionStatus] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Mint
  const [mintAmount, setMintAmount] = useState("1000");
  // Burn
  const [burnAmount, setBurnAmount] = useState("100");
  const [burnRedeemId, setBurnRedeemId] = useState("");
  // Grant / Revoke Role
  const [roleTarget, setRoleTarget] = useState("");
  const [roleType, setRoleType] = useState("MINTER_ROLE");
  // Freeze
  const [freezeTarget, setFreezeTarget] = useState("");
  // Pause state (derived after each action)
  const [isPaused, setIsPaused] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    const newName = generateStablecoinName();
    setName(newName);
    setSymbol(generateStablecoinSymbol(newName));
  };

  /** Refresh balance + supply + paused from chain and update deployedToken */
  async function refreshTokenInfo(contractAddress: `0x${string}`) {
    if (!publicClient || !address) return;
    const [totalSupply, balance, paused] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: STABLECOIN_ABI,
        functionName: "totalSupply",
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contractAddress,
        abi: STABLECOIN_ABI,
        functionName: "balanceOf",
        args: [address],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contractAddress,
        abi: STABLECOIN_ABI,
        functionName: "paused",
      }) as Promise<boolean>,
    ]);

    setIsPaused(paused);
    setDeployedToken((prev) =>
      prev
        ? {
            ...prev,
            totalSupply: formatSupply(totalSupply, prev.decimals),
            balance: formatSupply(balance, prev.decimals),
            isPaused: paused,
          }
        : prev
    );
  }

  /** Generic "send tx → wait → refresh" wrapper for post-deploy actions */
  async function executeTx(
    label: string,
    txParams: {
      functionName: string;
      args?: unknown[];
      gas?: bigint;
    }
  ) {
    if (!walletClient || !publicClient || !deployedToken || !address) {
      throw new Error("Wallet or deployed contract not available");
    }
    setActionStatus(`Sending ${label} (confirm in wallet)…`);
    const hash = await walletClient.writeContract({
      address: deployedToken.address as `0x${string}`,
      abi: STABLECOIN_ABI,
      functionName: txParams.functionName as any,
      args: txParams.args as any,
      gas: txParams.gas,
    });
    setActionStatus(`${label} tx sent: ${hash}\nWaiting for confirmation…`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${label} transaction failed`);
    await refreshTokenInfo(deployedToken.address as `0x${string}`);
    return hash;
  }

  // ── Deploy ───────────────────────────────────────────────────────────────
  async function handleDeploy() {
    try {
      setStatus("");
      setDeployedToken(null);
      setLoading(true);

      if (!isConnected || !address || !walletClient || !publicClient) {
        throw new Error("Please connect your wallet first");
      }

      validateStablecoinParams({ name, symbol, decimals, initialMint, platformFeePercent });

      setStatus("Preparing deployment parameters…");

      const defaultAdmin = customAdmin || address;
      const primarySaleRecipient = customPrimarySale || address;
      const platformFeeRecipient = customFeeRecipient || address;
      const platformFeeBps = computePlatformFeeBps(platformFeePercent);

      setStatus("Deploying stablecoin contract (please confirm in wallet)…");

      const deployTx = await walletClient.deployContract({
        abi: STABLECOIN_ABI,
        bytecode: STABLECOIN_BYTECODE as `0x${string}`,
        args: [
          name,
          symbol,
          decimals,
          defaultAdmin as `0x${string}`,
          primarySaleRecipient as `0x${string}`,
          platformFeeRecipient as `0x${string}`,
          platformFeeBps,
          contractURI,
        ],
        gas: STABLECOIN_CONFIG.GAS_LIMIT_DEPLOY,
      });

      setStatus(`Deployment tx sent: ${deployTx}\nWaiting for confirmation…`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: deployTx });
      if (receipt.status !== "success") throw new Error("Deployment transaction failed");

      const contractAddress = receipt.contractAddress;
      if (!contractAddress) throw new Error("Contract address not found in receipt");

      setStatus(`Contract deployed at: ${contractAddress}\nMinting initial supply…`);

      // ── initial mint ──────────────────────────────────────────────────
      let finalSupply = 0n;
      let finalBalance = 0n;

      if (parseFloat(initialMint) > 0) {
        const mintAmt = parseUnits(initialMint, decimals);
        const mintTx = await walletClient.writeContract({
          address: contractAddress,
          abi: STABLECOIN_ABI,
          functionName: "mintTo",
          args: [address, mintAmt],
          gas: STABLECOIN_CONFIG.GAS_LIMIT_MINT,
        });
        setStatus(`Minting ${initialMint} tokens…\nTransaction: ${mintTx}`);
        await publicClient.waitForTransactionReceipt({ hash: mintTx });

        [finalSupply, finalBalance] = await Promise.all([
          publicClient.readContract({
            address: contractAddress,
            abi: STABLECOIN_ABI,
            functionName: "totalSupply",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: contractAddress,
            abi: STABLECOIN_ABI,
            functionName: "balanceOf",
            args: [address],
          }) as Promise<bigint>,
        ]);
      }

      const info: StablecoinInfo = {
        address: contractAddress,
        name,
        symbol,
        decimals,
        totalSupply: formatSupply(finalSupply, decimals),
        balance: formatSupply(finalBalance, decimals),
        isPaused: false,
        deployTx,
        timestamp: new Date().toISOString(),
      };

      setDeployedToken(info);
      setIsPaused(false);
      setStatus(
        `✅ Success!\n\n` +
          `Token: ${name} (${symbol})\n` +
          `Address: ${contractAddress}\n` +
          `Total Supply: ${info.totalSupply}\n` +
          `Your Balance: ${info.balance}`
      );
    } catch (err: any) {
      console.error("Deploy error:", err);
      setStatus(`❌ Error: ${err?.message || err?.shortMessage || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Post-deploy actions ─────────────────────────────────────────────────
  async function handleMint() {
    try {
      setActionLoading(true);
      setActionStatus("");
      const amt = parseUnits(mintAmount, deployedToken!.decimals);
      const hash = await executeTx("Mint", {
        functionName: "mintTo",
        args: [address, amt],
        gas: STABLECOIN_CONFIG.GAS_LIMIT_MINT,
      });
      setActionStatus(`✅ Minted ${mintAmount} tokens\nTx: ${hash}`);
    } catch (e: any) {
      setActionStatus(`❌ Error: ${e?.message || "Unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBurn() {
    try {
      setActionLoading(true);
      setActionStatus("");
      const amt = parseUnits(burnAmount, deployedToken!.decimals);
      const redeemId = burnRedeemId || `REDEEM-${Date.now()}`;
      const hash = await executeTx("Burn", {
        functionName: "burn",
        args: [amt, redeemId],
        gas: STABLECOIN_CONFIG.GAS_LIMIT_BURN,
      });
      setActionStatus(`✅ Burned ${burnAmount} tokens (redeemId: ${redeemId})\nTx: ${hash}`);
    } catch (e: any) {
      setActionStatus(`❌ Error: ${e?.message || "Unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleGrantRole() {
    try {
      setActionLoading(true);
      setActionStatus("");
      const roleHash = keccak256(toBytes(roleType));
      const hash = await executeTx("Grant Role", {
        functionName: "grantRole",
        args: [roleHash, roleTarget as `0x${string}`],
        gas: STABLECOIN_CONFIG.GAS_LIMIT_ROLE ?? 100_000n,
      });
      setActionStatus(`✅ Granted ${roleType} to ${roleTarget}\nTx: ${hash}`);
    } catch (e: any) {
      setActionStatus(`❌ Error: ${e?.message || "Unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevokeRole() {
    try {
      setActionLoading(true);
      setActionStatus("");
      const roleHash = keccak256(toBytes(roleType));
      const hash = await executeTx("Revoke Role", {
        functionName: "revokeRole",
        args: [roleHash, roleTarget as `0x${string}`],
        gas: STABLECOIN_CONFIG.GAS_LIMIT_ROLE ?? 100_000n,
      });
      setActionStatus(`✅ Revoked ${roleType} from ${roleTarget}\nTx: ${hash}`);
    } catch (e: any) {
      setActionStatus(`❌ Error: ${e?.message || "Unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFreeze() {
    try {
      setActionLoading(true);
      setActionStatus("");
      const hash = await executeTx("Freeze Account", {
        functionName: "freezeAccount",
        args: [freezeTarget as `0x${string}`],
        gas: STABLECOIN_CONFIG.GAS_LIMIT_FREEZE ?? 100_000n,
      });
      setActionStatus(`✅ Frozen account: ${freezeTarget}\nTx: ${hash}`);
    } catch (e: any) {
      setActionStatus(`❌ Error: ${e?.message || "Unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePause() {
    try {
      setActionLoading(true);
      setActionStatus("");
      const fn = isPaused ? "unpause" : "pause";
      const label = isPaused ? "Unpause" : "Pause";
      const hash = await executeTx(label, {
        functionName: fn,
        gas: STABLECOIN_CONFIG.GAS_LIMIT_PAUSE ?? 100_000n,
      });
      setActionStatus(`✅ Contract ${isPaused ? "unpaused" : "paused"}\nTx: ${hash}`);
    } catch (e: any) {
      setActionStatus(`❌ Error: ${e?.message || "Unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Deploy Card ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Create Stablecoin</h2>

        <div className="space-y-5">
          {/* Name & Symbol */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLS}>Token Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., MyStableUSD"
                disabled={loading}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g., MUSD"
                disabled={loading}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="text-sm font-semibold text-purple-600 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            🎲 Generate Random Name
          </button>

          {/* Decimals & Initial Mint */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLS}>Decimals</label>
              <input
                type="number"
                value={decimals}
                onChange={(e) => setDecimals(parseInt(e.target.value) || 6)}
                min="0"
                max="18"
                disabled={loading}
                className={INPUT_CLS}
              />
              <div className="mt-1 text-xs text-gray-500">Recommended: 6 (USDC standard)</div>
            </div>
            <div>
              <label className={LABEL_CLS}>Initial Mint Amount</label>
              <input
                type="number"
                value={initialMint}
                onChange={(e) => setInitialMint(e.target.value)}
                min="0"
                disabled={loading}
                className={INPUT_CLS}
              />
              <div className="mt-1 text-xs text-gray-500">Amount to mint on deployment</div>
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={loading}
            className="text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showAdvanced ? "▼" : "▶"} Advanced Settings
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <label className={LABEL_CLS}>Platform Fee (%)</label>
                <input
                  type="number"
                  value={platformFeePercent}
                  onChange={(e) => setPlatformFeePercent(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="10"
                  step="0.01"
                  disabled={loading}
                  className={INPUT_CLS}
                />
                <div className="mt-1 text-xs text-gray-500">Transaction fee (0–10 %)</div>
              </div>
              <div>
                <label className={LABEL_CLS}>Contract URI</label>
                <input
                  type="text"
                  value={contractURI}
                  onChange={(e) => setContractURI(e.target.value)}
                  placeholder="https://…"
                  disabled={loading}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Custom Admin (optional)</label>
                <input
                  type="text"
                  value={customAdmin}
                  onChange={(e) => setCustomAdmin(e.target.value)}
                  placeholder={address || "0x…"}
                  disabled={loading}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Primary Sale Recipient (optional)</label>
                <input
                  type="text"
                  value={customPrimarySale}
                  onChange={(e) => setCustomPrimarySale(e.target.value)}
                  placeholder={address || "0x…"}
                  disabled={loading}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Fee Recipient (optional)</label>
                <input
                  type="text"
                  value={customFeeRecipient}
                  onChange={(e) => setCustomFeeRecipient(e.target.value)}
                  placeholder={address || "0x…"}
                  disabled={loading}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          )}

          {/* Deploy button */}
          <ActionButton
            onClick={handleDeploy}
            disabled={!name || !symbol}
            loading={loading}
            loadingLabel="Deploying…"
          >
            Deploy Stablecoin
          </ActionButton>

          <StatusBanner status={status} loading={loading} />

          {/* Deployed token summary */}
          {deployedToken && (
            <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4">
              <div className="mb-2 text-sm font-semibold text-green-900">✅ Deployed Successfully</div>
              <div className="space-y-2 text-sm text-green-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Contract:</span>
                  <a
                    href={`https://testnet.arcscan.app/address/${deployedToken.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-green-700 hover:text-green-900 underline"
                  >
                    {deployedToken.address.slice(0, 8)}…{deployedToken.address.slice(-6)}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Name:</span>
                  <span>{deployedToken.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Symbol:</span>
                  <span>{deployedToken.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Total Supply:</span>
                  <span>{deployedToken.totalSupply}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Your Balance:</span>
                  <span>{deployedToken.balance}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <span className={isPaused ? "text-red-600 font-semibold" : "text-green-700 font-semibold"}>
                    {isPaused ? "⏸ Paused" : "● Active"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Contract Actions Panel (visible only after deploy) ─────────── */}
      {deployedToken && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
          <h2 className="mb-1 text-xl font-bold text-gray-900">Contract Actions</h2>
          <p className="mb-5 text-xs text-gray-500">
            Interact with{" "}
            <span className="font-mono">
              {deployedToken.address.slice(0, 8)}…{deployedToken.address.slice(-6)}
            </span>
          </p>

          <div className="space-y-6">
            {/* ── Mint ────────────────────────────────────────────────── */}
            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <SectionTitle icon="🪙" title="Mint Tokens" />
              <div>
                <label className={LABEL_CLS}>Amount</label>
                <input
                  type="number"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  min="0"
                  disabled={actionLoading}
                  className={INPUT_CLS}
                />
              </div>
              <ActionButton onClick={handleMint} loading={actionLoading} loadingLabel="Minting…">
                Mint Tokens
              </ActionButton>
            </div>

            {/* ── Burn ────────────────────────────────────────────────── */}
            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <SectionTitle icon="🔥" title="Burn Tokens" />
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={LABEL_CLS}>Amount</label>
                  <input
                    type="number"
                    value={burnAmount}
                    onChange={(e) => setBurnAmount(e.target.value)}
                    min="0"
                    disabled={actionLoading}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Redeem ID (optional)</label>
                  <input
                    type="text"
                    value={burnRedeemId}
                    onChange={(e) => setBurnRedeemId(e.target.value)}
                    placeholder="e.g., REDEEM-001"
                    disabled={actionLoading}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
              <ActionButton
                onClick={handleBurn}
                loading={actionLoading}
                loadingLabel="Burning…"
                variant="danger"
              >
                Burn Tokens
              </ActionButton>
            </div>

            {/* ── Grant / Revoke Role ─────────────────────────────────── */}
            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <SectionTitle icon="🛡️" title="Grant / Revoke Role" />
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={LABEL_CLS}>Target Address</label>
                  <input
                    type="text"
                    value={roleTarget}
                    onChange={(e) => setRoleTarget(e.target.value)}
                    placeholder="0x…"
                    disabled={actionLoading}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Role</label>
                  <select
                    value={roleType}
                    onChange={(e) => setRoleType(e.target.value)}
                    disabled={actionLoading}
                    className={INPUT_CLS}
                  >
                    <option value="MINTER_ROLE">MINTER_ROLE</option>
                    <option value="PAUSER_ROLE">PAUSER_ROLE</option>
                    <option value="FREEZER_ROLE">FREEZER_ROLE</option>
                    <option value="TRANSFER_ROLE">TRANSFER_ROLE</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ActionButton
                  onClick={handleGrantRole}
                  disabled={!roleTarget}
                  loading={actionLoading}
                  loadingLabel="Granting…"
                >
                  Grant Role
                </ActionButton>
                <ActionButton
                  onClick={handleRevokeRole}
                  disabled={!roleTarget}
                  loading={actionLoading}
                  loadingLabel="Revoking…"
                  variant="warning"
                >
                  Revoke Role
                </ActionButton>
              </div>
            </div>

            {/* ── Freeze Account ──────────────────────────────────────── */}
            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <SectionTitle icon="❄️" title="Freeze Account" />
              <div>
                <label className={LABEL_CLS}>Target Address</label>
                <input
                  type="text"
                  value={freezeTarget}
                  onChange={(e) => setFreezeTarget(e.target.value)}
                  placeholder="0x…"
                  disabled={actionLoading}
                  className={INPUT_CLS}
                />
              </div>
              <ActionButton
                onClick={handleFreeze}
                disabled={!freezeTarget}
                loading={actionLoading}
                loadingLabel="Freezing…"
                variant="warning"
              >
                Freeze Account
              </ActionButton>
            </div>

            {/* ── Pause / Unpause ─────────────────────────────────────── */}
            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <SectionTitle icon="⏸" title="Pause / Unpause Contract" />
              <p className="text-xs text-gray-500">
                Current status:{" "}
                <span className={isPaused ? "text-red-600 font-semibold" : "text-green-700 font-semibold"}>
                  {isPaused ? "Paused" : "Active"}
                </span>
              </p>
              <ActionButton
                onClick={handlePause}
                loading={actionLoading}
                loadingLabel={isPaused ? "Unpausing…" : "Pausing…"}
                variant={isPaused ? "primary" : "danger"}
              >
                {isPaused ? "Unpause Contract" : "Pause Contract"}
              </ActionButton>
            </div>

            {/* ── Action Status Banner ──────────────────────────────── */}
            <StatusBanner status={actionStatus} loading={actionLoading} />
          </div>
        </div>
      )}

      {/* ── Info Box ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-[#fff0f2] to-[#f3eef6] p-5">
        <div className="text-sm text-gray-700">
          <div className="mb-2 font-semibold">ℹ️ About Stablecoin Issuance</div>
          <ul className="list-inside list-disc space-y-1">
            <li>Deploy your own ERC-20 stablecoin on ARC Testnet</li>
            <li>Full control over minting, burning, freezing, and pausing</li>
            <li>Compatible with Circle CCTP for cross-chain bridging</li>
            <li>Built on thirdweb's audited smart contract framework</li>
          </ul>
        </div>
      </div>
    </div>
  );
}