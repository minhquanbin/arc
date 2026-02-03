"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  deployStablecoinWithCircle,
  checkTransactionStatus,
  getContractDetails,
  generateStablecoinName,
  generateStablecoinSymbol,
  validateStablecoinParams,
  STABLECOIN_CONFIG,
  type StablecoinInfo,
} from "./stablecoin";

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

  // Reset form
  const handleReset = () => {
    setName("");
    setSymbol("");
    setWalletId("");
    setPlatformFeePercent(0);
    setStatus("idle");
    setError(null);
    setDeployedContract(null);
    setTransactionId(null);
    setContractId(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">
          Deploy Stablecoin (Circle Template)
        </h2>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Using Circle Contracts:</strong> This deployment uses Circle's
            pre-audited ERC-20 template. You need a Circle Dev-Controlled Wallet funded
            with testnet USDC.{" "}
            <a
              href="https://docs.arc.network/developer/quickstart/deploy-contracts"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    href={`https://testnet.arcscan.app/address/${deployedContract.contractAddress}`}
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
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
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