import { parseUnits } from "viem";

// =====================================================
// CIRCLE CONTRACTS CONFIGURATION
// =====================================================

// ERC-20 Template ID for Circle Contracts (theo tài liệu Arc)
export const ERC20_TEMPLATE_ID = "a1b74add-23e0-4712-88d1-6b3009e85a86";

// Arc Testnet blockchain identifier
export const ARC_TESTNET_BLOCKCHAIN = "ARC-TESTNET";

// Circle API endpoints
export const CIRCLE_API_BASE_URL = "https://api.circle.com/v1/w3s";

// =====================================================
// STABLECOIN CONTRACT ABI (for interacting after deployment)
// =====================================================
export const STABLECOIN_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "mintTo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_to", type: "address" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "burn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_redeemId", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
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
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "TokensMinted",
    inputs: [
      { name: "mintedTo", type: "address", indexed: true },
      { name: "quantityMinted", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensBurned",
    inputs: [
      { name: "burnedFrom", type: "address", indexed: true },
      { name: "quantityBurned", type: "uint256", indexed: false },
    ],
  },
] as const;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function generateStablecoinName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let prefix = "";
  for (let i = 0; i < 4; i++) {
    prefix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase() + "USD";
}

export function generateStablecoinSymbol(name: string): string {
  return name.charAt(0) + "USD";
}

export function validateStablecoinParams(params: {
  name: string;
  symbol: string;
  initialMint?: string;
  platformFeePercent?: number;
}) {
  const { name, symbol, initialMint, platformFeePercent } = params;

  if (!name || name.length < 3 || name.length > 50) {
    throw new Error("Name must be between 3-50 characters");
  }

  if (!symbol || symbol.length < 2 || symbol.length > 10) {
    throw new Error("Symbol must be between 2-10 characters");
  }

  if (initialMint) {
    const mintAmount = parseFloat(initialMint);
    if (isNaN(mintAmount) || mintAmount < 0) {
      throw new Error("Initial mint amount must be a positive number");
    }
  }

  if (platformFeePercent !== undefined && (platformFeePercent < 0 || platformFeePercent > 10)) {
    throw new Error("Platform fee must be between 0-10%");
  }
}

export function computePlatformFeeBps(percentFee: number): number {
  return Math.round(percentFee * 100);
}

export function formatSupply(supply: bigint, decimals: number): string {
  const divisor = 10 ** decimals;
  const supplyNum = Number(supply) / divisor;
  return supplyNum.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

// =====================================================
// CIRCLE API CLIENT
// =====================================================

/**
 * Deploy stablecoin using Circle Contracts Template
 * 
 * @param params Deployment parameters
 * @returns Deployment response with contractIds and transactionId
 */
export async function deployStablecoinWithCircle(params: {
  name: string;
  symbol: string;
  walletId: string;
  walletAddress: string;
  platformFeeRecipient?: string;
  platformFeePercent?: number;
  contractURI?: string;
}) {
  const {
    name,
    symbol,
    walletId,
    walletAddress,
    platformFeeRecipient,
    platformFeePercent = 0,
    contractURI = "https://metadata.arc-stablecoin.com/contract.json"
  } = params;

  // Validate params
  validateStablecoinParams({ name, symbol, platformFeePercent });

  // Template parameters theo tài liệu Arc
  const templateParameters: Record<string, any> = {
    name,
    symbol,
    defaultAdmin: walletAddress,
    primarySaleRecipient: walletAddress,
  };

  // Optional parameters
  if (platformFeeRecipient && platformFeePercent > 0) {
    templateParameters.platformFeeRecipient = platformFeeRecipient;
    templateParameters.platformFeePercent = platformFeePercent / 100; // Convert to decimal
  }

  if (contractURI) {
    templateParameters.contractUri = contractURI;
  }

  const requestBody = {
    blockchain: ARC_TESTNET_BLOCKCHAIN,
    name: `${name} Contract`, // Offchain name (visible in Circle Console)
    walletId,
    templateParameters,
    feeLevel: "MEDIUM",
  };

  // Call Circle API
  const response = await fetch(
    `${CIRCLE_API_BASE_URL}/templates/${ERC20_TEMPLATE_ID}/deploy`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_CIRCLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Circle API deployment failed: ${response.status} ${response.statusText}. ${JSON.stringify(error)}`
    );
  }

  const data = await response.json();
  return data as {
    contractIds: string[];
    transactionId: string;
  };
}

/**
 * Check deployment transaction status
 */
export async function checkTransactionStatus(transactionId: string) {
  const response = await fetch(
    `${CIRCLE_API_BASE_URL}/transactions/${transactionId}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_CIRCLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to check transaction status: ${response.status}`);
  }

  const data = await response.json();
  return data.transaction as {
    id: string;
    state: "PENDING" | "COMPLETE" | "FAILED";
    contractAddress?: string;
    txHash?: string;
    blockHeight?: number;
  };
}

/**
 * Get contract details after deployment
 */
export async function getContractDetails(contractId: string) {
  const response = await fetch(
    `${CIRCLE_API_BASE_URL}/contracts/${contractId}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_CIRCLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get contract details: ${response.status}`);
  }

  const data = await response.json();
  return data.contract as {
    id: string;
    contractAddress: string;
    blockchain: string;
    status: "PENDING" | "COMPLETE" | "FAILED";
  };
}

// =====================================================
// STABLECOIN CONFIG
// =====================================================
export const STABLECOIN_CONFIG = {
  DECIMALS: 18, // ERC-20 template uses 18 decimals by default
  DEFAULT_CONTRACT_URI: "https://metadata.arc-stablecoin.com/contract.json",
  
  // Polling config for deployment status
  POLL_INTERVAL_MS: 3000,
  MAX_POLL_ATTEMPTS: 60, // 3 minutes total (60 * 3s)
};

// =====================================================
// TYPES
// =====================================================
export type DeployStablecoinParams = {
  name: string;
  symbol: string;
  walletId: string;
  walletAddress: string;
  platformFeeRecipient?: string;
  platformFeePercent?: number;
  contractURI?: string;
};

export type StablecoinInfo = {
  contractId: string;
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  balance: string;
  isPaused: boolean;
  deployTx: string;
  transactionId: string;
  timestamp: string;
};