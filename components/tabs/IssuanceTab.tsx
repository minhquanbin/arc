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
import { parseUnits } from "viem";

export default function IssuanceTab() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState(6);
  const [initialMint, setInitialMint] = useState("10000");
  const [platformFeePercent, setPlatformFeePercent] = useState(0);
  const [contractURI, setContractURI] = useState(STABLECOIN_CONFIG.DEFAULT_CONTRACT_URI);

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deployedToken, setDeployedToken] = useState<StablecoinInfo | null>(null);

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customAdmin, setCustomAdmin] = useState("");
  const [customPrimarySale, setCustomPrimarySale] = useState("");
  const [customFeeRecipient, setCustomFeeRecipient] = useState("");

  // Auto-generate name/symbol
  const handleGenerate = () => {
    const newName = generateStablecoinName();
    setName(newName);
    setSymbol(generateStablecoinSymbol(newName));
  };

  // Deploy stablecoin
  async function handleDeploy() {
    try {
      setStatus("");
      setDeployedToken(null);
      setLoading(true);

      if (!isConnected || !address || !walletClient || !publicClient) {
        throw new Error("Please connect your wallet first");
      }

      // Validate inputs
      validateStablecoinParams({ name, symbol, decimals, initialMint, platformFeePercent });

      setStatus("Preparing deployment parameters...");

      const defaultAdmin = customAdmin || address;
      const primarySaleRecipient = customPrimarySale || address;
      const platformFeeRecipient = customFeeRecipient || address;
      const platformFeeBps = computePlatformFeeBps(platformFeePercent);

      // Deploy contract
      setStatus("Deploying stablecoin contract (please confirm in wallet)...");

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

      setStatus(`Deployment transaction sent: ${deployTx}\nWaiting for confirmation...`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: deployTx });

      if (receipt.status !== "success") {
        throw new Error("Deployment transaction failed");
      }

      const contractAddress = receipt.contractAddress;
      if (!contractAddress) {
        throw new Error("Contract address not found in receipt");
      }

      setStatus(`Contract deployed at: ${contractAddress}\nMinting initial supply...`);

      // Read contract to get initial state
      const [totalSupply, balance, isPaused] = await Promise.all([
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

      // Mint initial supply if specified
      if (parseFloat(initialMint) > 0) {
        const mintAmount = parseUnits(initialMint, decimals);

        const mintTx = await walletClient.writeContract({
          address: contractAddress,
          abi: STABLECOIN_ABI,
          functionName: "mintTo",
          args: [address, mintAmount],
          gas: STABLECOIN_CONFIG.GAS_LIMIT_MINT,
        });

        setStatus(`Minting ${initialMint} tokens...\nTransaction: ${mintTx}`);

        await publicClient.waitForTransactionReceipt({ hash: mintTx });

        // Update balances
        const [newTotalSupply, newBalance] = await Promise.all([
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

        const info: StablecoinInfo = {
          address: contractAddress,
          name,
          symbol,
          decimals,
          totalSupply: formatSupply(newTotalSupply, decimals),
          balance: formatSupply(newBalance, decimals),
          isPaused,
          deployTx,
          timestamp: new Date().toISOString(),
        };

        setDeployedToken(info);
        setStatus(
          `✅ Success!\n\n` +
            `Token: ${name} (${symbol})\n` +
            `Address: ${contractAddress}\n` +
            `Total Supply: ${info.totalSupply}\n` +
            `Your Balance: ${info.balance}`
        );
      } else {
        const info: StablecoinInfo = {
          address: contractAddress,
          name,
          symbol,
          decimals,
          totalSupply: formatSupply(totalSupply, decimals),
          balance: formatSupply(balance, decimals),
          isPaused,
          deployTx,
          timestamp: new Date().toISOString(),
        };

        setDeployedToken(info);
        setStatus(
          `✅ Success!\n\n` +
            `Token: ${name} (${symbol})\n` +
            `Address: ${contractAddress}\n` +
            `Total Supply: ${info.totalSupply}`
        );
      }
    } catch (err: any) {
      console.error("Deploy error:", err);
      setStatus(`❌ Error: ${err?.message || err?.shortMessage || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Create Stablecoin</h2>

        <div className="space-y-5">
          {/* Name & Symbol */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Token Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., MyStableUSD"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g., MUSD"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Generate Button */}
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
              <label className="mb-2 block text-sm font-medium text-gray-700">Decimals</label>
              <input
                type="number"
                value={decimals}
                onChange={(e) => setDecimals(parseInt(e.target.value) || 6)}
                min="0"
                max="18"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
              <div className="mt-1 text-xs text-gray-500">Recommended: 6 (USDC standard)</div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Initial Mint Amount</label>
              <input
                type="number"
                value={initialMint}
                onChange={(e) => setInitialMint(e.target.value)}
                min="0"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
              <div className="mt-1 text-xs text-gray-500">Amount to mint on deployment</div>
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={loading}
            className="text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showAdvanced ? "▼" : "▶"} Advanced Settings
          </button>

          {/* Advanced Settings Panel */}
          {showAdvanced && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Platform Fee (%)</label>
                <input
                  type="number"
                  value={platformFeePercent}
                  onChange={(e) => setPlatformFeePercent(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="10"
                  step="0.01"
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
                <div className="mt-1 text-xs text-gray-500">Transaction fee (0-10%)</div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Contract URI</label>
                <input
                  type="text"
                  value={contractURI}
                  onChange={(e) => setContractURI(e.target.value)}
                  placeholder="https://..."
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Custom Admin (optional)</label>
                <input
                  type="text"
                  value={customAdmin}
                  onChange={(e) => setCustomAdmin(e.target.value)}
                  placeholder={address || "0x..."}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Primary Sale Recipient (optional)
                </label>
                <input
                  type="text"
                  value={customPrimarySale}
                  onChange={(e) => setCustomPrimarySale(e.target.value)}
                  placeholder={address || "0x..."}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Fee Recipient (optional)
                </label>
                <input
                  type="text"
                  value={customFeeRecipient}
                  onChange={(e) => setCustomFeeRecipient(e.target.value)}
                  placeholder={address || "0x..."}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>
            </div>
          )}

          {/* Deploy Button */}
          <button
            onClick={handleDeploy}
            disabled={loading || !name || !symbol}
            className={[
              "w-full rounded-xl px-6 py-4 font-semibold text-white shadow-lg transition-all",
              loading || !name || !symbol
                ? "cursor-not-allowed bg-gray-300"
                : "bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:from-[#ff5f70] hover:to-[#664f6e] active:scale-[0.98]",
            ].join(" ")}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Deploying...</span>
              </div>
            ) : (
              "Deploy Stablecoin"
            )}
          </button>

          {/* Status */}
          {status && (
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
          )}

          {/* Deployed Token Info */}
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
                    {deployedToken.address.slice(0, 8)}...{deployedToken.address.slice(-6)}
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
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