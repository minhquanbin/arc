"use client";

import { useEffect, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import {
  deployStablecoinWithCircle,
  checkTransactionStatus,
  getContractDetails,
  generateStablecoinName,
  generateStablecoinSymbol,
  validateStablecoinParams,
  STABLECOIN_ABI,
  STABLECOIN_CONFIG,
  type StablecoinInfo,
} from "../../lib/stablecoin";

type DeploymentStatus = "idle" | "deploying" | "polling" | "success" | "error";

export default function IssuanceTab() {
  const { address, isConnected } = useAccount();

  // Form state
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [walletId, setWalletId] = useState("");
  const [platformFeePercent, setPlatformFeePercent] = useState(0);

  // Deployment state
  const [status, setStatus] = useState<DeploymentStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [deployedContract, setDeployedContract] = useState<StablecoinInfo | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);

  // Persist deployed contracts locally so refresh won't lose them
  const [savedContracts, setSavedContracts] = useState<StablecoinInfo[]>([]);
  const [selectedContractAddress, setSelectedContractAddress] = useState<string>("");

  // Contract interaction state (after deploy)
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastActionTx, setLastActionTx] = useState<string | null>(null);

  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");

  const [burnAmount, setBurnAmount] = useState("");
  const [burnRedeemId, setBurnRedeemId] = useState("redeem-1");

  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const [approveSpender, setApproveSpender] = useState("");
  const [approveAmount, setApproveAmount] = useState("");

  const [roleHex, setRoleHex] = useState("");
  const [roleAccount, setRoleAccount] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("arc:savedStablecoins");
      const parsed = raw ? (JSON.parse(raw) as StablecoinInfo[]) : [];
      const items = Array.isArray(parsed) ? parsed : [];
      setSavedContracts(items);

      const lastSelected = localStorage.getItem("arc:selectedStablecoin") || "";
      if (lastSelected) {
        setSelectedContractAddress(lastSelected);
        const found = items.find(
          (c) => c.contractAddress?.toLowerCase() === lastSelected.toLowerCase()
        );
        if (found) {
          setDeployedContract(found);
          setStatus("success");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const persistSavedContracts = (items: StablecoinInfo[]) => {
    setSavedContracts(items);
    try {
      localStorage.setItem("arc:savedStablecoins", JSON.stringify(items));
    } catch {
      // ignore
    }
  };

  const selectSavedContract = (contractAddress: string) => {
    setSelectedContractAddress(contractAddress);
    try {
      localStorage.setItem("arc:selectedStablecoin", contractAddress);
    } catch {
      // ignore
    }

    const found = savedContracts.find(
      (c) => c.contractAddress?.toLowerCase() === contractAddress.toLowerCase()
    );
    if (found) {
      setDeployedContract(found);
      setStatus("success");
      setError(null);
      setActionError(null);
      setLastActionTx(null);
    }
  };

  const gradientButtonClass = (disabled: boolean, extra: string = "") =>
    [
      extra,
      "rounded-xl font-semibold text-white shadow-lg transition-all",
      disabled
        ? "cursor-not-allowed bg-gray-300"
        : "bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:from-[#ff5f70] hover:to-[#664f6e] active:scale-[0.98]",
    ]
      .filter(Boolean)
      .join(" ");

  // Auto-generate name and symbol
  const handleAutoGenerate = () => {
    const generatedName = generateStablecoinName();
    const generatedSymbol = generateStablecoinSymbol(generatedName);
    setName(generatedName);
    setSymbol(generatedSymbol);
  };

  // Poll deployment status
  const pollDeploymentStatus = async (txId: string, ctId: string): Promise<void> => {
    let attempts = 0;
    const maxAttempts = STABLECOIN_CONFIG.MAX_POLL_ATTEMPTS;

    while (attempts < maxAttempts) {
      try {
        // Check transaction status
        const txStatus = await checkTransactionStatus(txId);

        if (txStatus.state === "COMPLETE") {
          // Get contract details
          const contractDetails = await getContractDetails(ctId);

          if (contractDetails.status === "COMPLETE" && contractDetails.contractAddress) {
            // Success! Create contract info
            const contractInfo: StablecoinInfo = {
              contractId: ctId,
              contractAddress: contractDetails.contractAddress,
              name,
              symbol,
              decimals: STABLECOIN_CONFIG.DECIMALS,
              totalSupply: "0", // Initial supply is 0 for Circle ERC-20 template
              balance: "0",
              isPaused: false,
              deployTx: txStatus.txHash || "",
              transactionId: txId,
              timestamp: new Date().toISOString(),
            };

            setDeployedContract(contractInfo);
            setSelectedContractAddress(contractInfo.contractAddress);

            // Save (de-dupe by contractAddress)
            const nextSaved = [
              contractInfo,
              ...savedContracts.filter(
                (c) => c.contractAddress.toLowerCase() !== contractInfo.contractAddress.toLowerCase()
              ),
            ];
            persistSavedContracts(nextSaved);

            setStatus("success");
            return;
          }
        } else if (txStatus.state === "FAILED") {
          const reason =
            txStatus.errorReason ||
            txStatus.errorMessage ||
            txStatus.errorCode ||
            "Transaction failed on-chain";
          throw new Error(`Deployment transaction failed: ${reason}`);
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, STABLECOIN_CONFIG.POLL_INTERVAL_MS));
        attempts++;
      } catch (err) {
        console.error("Polling error:", err);
        attempts++;
      }
    }

    throw new Error("Deployment timeout - transaction status check exceeded maximum attempts");
  };

  // Deploy stablecoin
  const handleDeploy = async () => {
    if (!isConnected || !address) {
      setError("Please connect your wallet first");
      return;
    }

    if (!walletId) {
      setError("Please enter your Circle Wallet ID");
      return;
    }

    try {
      // Validate inputs
      validateStablecoinParams({
        name,
        symbol,
        platformFeePercent,
      });

      setStatus("deploying");
      setError(null);
      setDeployedContract(null);

      // Deploy via Circle API
      const result = await deployStablecoinWithCircle({
        name,
        symbol,
        walletId,
        walletAddress: address,
        platformFeePercent,
        contractURI: STABLECOIN_CONFIG.DEFAULT_CONTRACT_URI,
      });

      console.log("Deployment initiated:", result);

      setTransactionId(result.transactionId);
      setContractId(result.contractIds[0]);
      setStatus("polling");

      // Poll for completion
      await pollDeploymentStatus(result.transactionId, result.contractIds[0]);
    } catch (err: any) {
      console.error("Deployment error:", err);
      setError(err.message || "Deployment failed");
      setStatus("error");
    }
  };

  const requireDeployed = () => {
    if (!deployedContract?.contractAddress) throw new Error("Missing contract address");
    return deployedContract.contractAddress as `0x${string}`;
  };

  const handleMint = async () => {
    try {
      setActionError(null);
      setLastActionTx(null);

      const addr = requireDeployed();
      if (!mintTo || !mintAmount) throw new Error("Enter mint recipient + amount");

      const hash = await writeContractAsync({
        address: addr,
        abi: STABLECOIN_ABI,
        functionName: "mintTo",
        args: [mintTo as `0x${string}`, parseUnits(mintAmount, STABLECOIN_CONFIG.DECIMALS)],
      });

      setLastActionTx(hash);
    } catch (e: any) {
      setActionError(e?.shortMessage || e?.message || "Mint failed");
    }
  };

  const handleBurn = async () => {
    try {
      setActionError(null);
      setLastActionTx(null);

      const addr = requireDeployed();
      if (!burnAmount || !burnRedeemId) throw new Error("Enter burn amount + redeemId");

      const hash = await writeContractAsync({
        address: addr,
        abi: STABLECOIN_ABI,
        functionName: "burn",
        args: [parseUnits(burnAmount, STABLECOIN_CONFIG.DECIMALS), burnRedeemId],
      });

      setLastActionTx(hash);
    } catch (e: any) {
      setActionError(e?.shortMessage || e?.message || "Burn failed");
    }
  };

  const handleTransfer = async () => {
    try {
      setActionError(null);
      setLastActionTx(null);

      const addr = requireDeployed();
      if (!transferTo || !transferAmount) throw new Error("Enter transfer recipient + amount");

      const hash = await writeContractAsync({
        address: addr,
        abi: STABLECOIN_ABI,
        functionName: "transfer",
        args: [transferTo as `0x${string}`, parseUnits(transferAmount, STABLECOIN_CONFIG.DECIMALS)],
      });

      setLastActionTx(hash);
    } catch (e: any) {
      setActionError(e?.shortMessage || e?.message || "Transfer failed");
    }
  };

  const handleApprove = async () => {
    try {
      setActionError(null);
      setLastActionTx(null);

      const addr = requireDeployed();
      if (!approveSpender || !approveAmount) throw new Error("Enter spender + amount");

      const hash = await writeContractAsync({
        address: addr,
        abi: STABLECOIN_ABI,
        functionName: "approve",
        args: [approveSpender as `0x${string}`, parseUnits(approveAmount, STABLECOIN_CONFIG.DECIMALS)],
      });

      setLastActionTx(hash);
    } catch (e: any) {
      setActionError(e?.shortMessage || e?.message || "Approve failed");
    }
  };

  const handleGrantRole = async () => {
    try {
      setActionError(null);
      setLastActionTx(null);

      const addr = requireDeployed();
      if (!roleHex || !roleAccount) throw new Error("Enter role (bytes32) + account");

      const hash = await writeContractAsync({
        address: addr,
        abi: STABLECOIN_ABI,
        functionName: "grantRole",
        args: [roleHex as `0x${string}`, roleAccount as `0x${string}`],
      });

      setLastActionTx(hash);
    } catch (e: any) {
      setActionError(e?.shortMessage || e?.message || "GrantRole failed");
    }
  };

  // Reset form
  const handleReset = () => {
    setName("");
    setSymbol("");
    setWalletId("");
    setPlatformFeePercent(0);
    setStatus("idle");
    setError(null);
    setDeployedContract(null);
    setSelectedContractAddress("");
    setTransactionId(null);
    setContractId(null);
    setActionError(null);
    setLastActionTx(null);
    try {
      localStorage.removeItem("arc:selectedStablecoin");
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">
          Deploy Stablecoin (Circle Template)
        </h2>

        {/* Saved tokens */}
        {savedContracts.length > 0 && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Your deployed tokens</div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={selectedContractAddress}
                onChange={(e) => selectSavedContract(e.target.value)}
                className="w-full sm:flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
              >
                <option value="">Select a token…</option>
                {savedContracts.map((c) => (
                  <option key={c.contractAddress} value={c.contractAddress}>
                    {c.name} ({c.symbol}) — {c.contractAddress.slice(0, 8)}…{c.contractAddress.slice(-6)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setSelectedContractAddress("");
                  setDeployedContract(null);
                  setStatus("idle");
                  try {
                    localStorage.removeItem("arc:selectedStablecoin");
                  } catch {
                    // ignore
                  }
                }}
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Clear
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-600">
              Tip: these are saved in your browser (localStorage), so they’ll still be here after refresh.
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Using Circle Contracts:</strong> This deployment uses Circle's
            pre-audited ERC-20 template. You need a Circle Dev-Controlled Wallet funded
            with testnet USDC.{" "}
            <a
              href="https://docs.arc.network/arc/tutorials/deploy-contracts"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Learn more →
            </a>
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Wallet ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Circle Wallet ID *
            </label>
            <input
              type="text"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              placeholder="e.g., 45692c3e-2ffa-5c5b-a99c-61366939114c"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff7582] focus:border-transparent"
              disabled={status === "deploying" || status === "polling"}
            />
            <p className="mt-1 text-xs text-gray-500">
              Your Circle Dev-Controlled Wallet ID from the Circle Console
            </p>
          </div>

          {/* Token Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Name *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., ArcUSD"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={status === "deploying" || status === "polling"}
              />
              <button
                onClick={handleAutoGenerate}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                disabled={status === "deploying" || status === "polling"}
              >
                🎲 Random
              </button>
            </div>
          </div>

          {/* Token Symbol */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Symbol *
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AUSD"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff7582] focus:border-transparent"
              disabled={status === "deploying" || status === "polling"}
            />
          </div>

          {/* Platform Fee (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Platform Fee (%) - Optional
            </label>
            <input
              type="number"
              value={platformFeePercent}
              onChange={(e) => setPlatformFeePercent(parseFloat(e.target.value) || 0)}
              min="0"
              max="10"
              step="0.1"
              placeholder="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={status === "deploying" || status === "polling"}
            />
            <p className="mt-1 text-xs text-gray-500">
              Platform fee percentage (0-10%). If set, you'll receive this percentage on
              token sales.
            </p>
          </div>

          {/* Connected Wallet Info */}
          {isConnected && address && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Connected:</strong> {address.slice(0, 8)}...{address.slice(-6)}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          {/* Status Messages */}
          {status === "deploying" && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⏳ Initiating deployment via Circle API...
              </p>
            </div>
          )}

          {status === "polling" && transactionId && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                ⏳ Waiting for transaction confirmation...
              </p>
              <p className="text-xs text-blue-600 font-mono break-all">
                Transaction ID: {transactionId}
              </p>
            </div>
          )}

          {/* Success Message */}
          {status === "success" && deployedContract && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
              <p className="text-sm text-green-800 font-medium">
                ✅ Stablecoin deployed successfully!
              </p>
              <div className="space-y-1 text-xs text-green-700">
                <p>
                  <strong>Contract:</strong>{" "}
                  <a
                    href={`https://testnet.arcscan.app/address/${deployedContract.contractAddress}?tab=write_proxy`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-mono"
                  >
                    {deployedContract.contractAddress}
                  </a>
                </p>
                <p>
                  <strong>Name:</strong> {deployedContract.name} ({deployedContract.symbol})
                </p>
                <p>
                  <strong>TX Hash:</strong>{" "}
                  <a
                    href={`https://testnet.arcscan.app/tx/${deployedContract.deployTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-mono"
                  >
                    {deployedContract.deployTx.slice(0, 10)}...
                    {deployedContract.deployTx.slice(-8)}
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Contract Actions */}
          {status === "success" && deployedContract && (
            <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">🧩 Contract actions</h3>
                <span className="text-xs text-gray-500">
                  Decimals: {STABLECOIN_CONFIG.DECIMALS}
                </span>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-800">
                    <strong>Error:</strong> {actionError}
                  </p>
                </div>
              )}

              {lastActionTx && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Last TX:</strong>{" "}
                    <a
                      className="underline font-mono"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://testnet.arcscan.app/tx/${lastActionTx}`}
                    >
                      {lastActionTx.slice(0, 10)}...{lastActionTx.slice(-8)}
                    </a>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {/* Mint */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-gray-900">Mint</div>
                  <input
                    type="text"
                    value={mintTo}
                    onChange={(e) => setMintTo(e.target.value)}
                    placeholder="Recipient address (0x...)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    placeholder='Amount (e.g. "100")'
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleMint}
                    disabled={isWriting}
                    className={gradientButtonClass(isWriting, "w-full px-4 py-2 text-sm")}
                  >
                    {isWriting ? "Sending..." : "Mint"}
                  </button>
                </div>

                {/* Burn */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-gray-900">Burn</div>
                  <input
                    type="text"
                    value={burnAmount}
                    onChange={(e) => setBurnAmount(e.target.value)}
                    placeholder='Amount (e.g. "10")'
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={burnRedeemId}
                    onChange={(e) => setBurnRedeemId(e.target.value)}
                    placeholder='redeemId (e.g. "redeem-1")'
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleBurn}
                    disabled={isWriting}
                    className={gradientButtonClass(isWriting, "w-full px-4 py-2 text-sm")}
                  >
                    {isWriting ? "Sending..." : "Burn"}
                  </button>
                </div>

                {/* Transfer */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-gray-900">Transfer</div>
                  <input
                    type="text"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    placeholder="Recipient address (0x...)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder='Amount (e.g. "1")'
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleTransfer}
                    disabled={isWriting}
                    className={gradientButtonClass(isWriting, "w-full px-4 py-2 text-sm")}
                  >
                    {isWriting ? "Sending..." : "Transfer"}
                  </button>
                </div>

                {/* Approve */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-gray-900">Approve</div>
                  <input
                    type="text"
                    value={approveSpender}
                    onChange={(e) => setApproveSpender(e.target.value)}
                    placeholder="Spender address (0x...)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={approveAmount}
                    onChange={(e) => setApproveAmount(e.target.value)}
                    placeholder='Amount (e.g. "100")'
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleApprove}
                    disabled={isWriting}
                    className={gradientButtonClass(isWriting, "w-full px-4 py-2 text-sm")}
                  >
                    {isWriting ? "Sending..." : "Approve"}
                  </button>
                </div>

                {/* GrantRole (advanced) */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-amber-900">GrantRole (advanced)</div>
                  <input
                    type="text"
                    value={roleHex}
                    onChange={(e) => setRoleHex(e.target.value)}
                    placeholder="Role bytes32 (0x...)"
                    className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={roleAccount}
                    onChange={(e) => setRoleAccount(e.target.value)}
                    placeholder="Account address (0x...)"
                    className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg"
                  />
                  <button
                    onClick={handleGrantRole}
                    disabled={isWriting}
                    className={gradientButtonClass(isWriting, "w-full px-4 py-2 text-sm")}
                  >
                    {isWriting ? "Sending..." : "GrantRole"}
                  </button>
                  <p className="text-[11px] text-amber-800">
                    If your deployed template doesn’t support AccessControl, this call will fail.
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* Deploy Button */}
          <div className="flex gap-3">
            <button
              onClick={handleDeploy}
              disabled={
                !isConnected ||
                !walletId ||
                !name ||
                !symbol ||
                status === "deploying" ||
                status === "polling"
              }
              className={gradientButtonClass(
                !isConnected ||
                  !walletId ||
                  !name ||
                  !symbol ||
                  status === "deploying" ||
                  status === "polling",
                "flex-1 px-6 py-3"
              )}
            >
              {status === "deploying" && "⏳ Deploying..."}
              {status === "polling" && "⏳ Confirming..."}
              {status !== "deploying" && status !== "polling" && "🚀 Deploy Stablecoin"}
            </button>

            {(status === "success" || status === "error") && (
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            📚 Setup Instructions
          </h3>
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              Create a Circle account at{" "}
              <a
                href="https://console.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                console.circle.com
              </a>
            </li>
            <li>Create an API key (Keys → Create a key → API key → Standard Key)</li>
            <li>Register your Entity Secret for wallet creation</li>
            <li>Create a Dev-Controlled Wallet on Arc Testnet</li>
            <li>
              Fund it with testnet USDC at{" "}
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                faucet.circle.com
              </a>
            </li>
            <li>Add your Circle API key to your .env.local file</li>
            <li>Copy your Wallet ID and paste it above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}