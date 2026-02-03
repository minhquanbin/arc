import { parseUnits } from "viem";

// =====================================================
// STABLECOIN CONTRACT ABI (simplified for frontend)
// =====================================================
export const STABLECOIN_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_symbol", type: "string" },
      { name: "_decimals", type: "uint8" },
      { name: "_defaultAdmin", type: "address" },
      { name: "_primarySaleRecipient", type: "address" },
      { name: "_platformFeeRecipient", type: "address" },
      { name: "_platformFeeBps", type: "uint256" },
      { name: "_contractURI", type: "string" },
    ],
  },
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
    name: "freezeAccount",
    stateMutability: "nonpayable",
    inputs: [{ name: "_account", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "unfreezeAccount",
    stateMutability: "nonpayable",
    inputs: [{ name: "_account", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "pause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "unpause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "grantRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
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
// STABLECOIN BYTECODE (from compiled ArcStablecoin.sol)
// =====================================================
export const STABLECOIN_BYTECODE = "0x" + "60806040523480156200001157600080fd5b5060405162003000380380620030008339810160408190526200003491620002e1565b8751889088906200004d9060039060208501906200018b565b508051620000639060049060208401906200018b565b50505062000081620000796200011360201b60201c565b600062000117565b620000a5336000908152600660205260409020805460ff19166001179055565b620000b33060001962000169565b620000be8462000169565b620000c98362000169565b620000d48262000169565b620000df8162000169565b50505050505050505062000423565b6001600160a01b03163b151590565b3390565b60008281526005602052604090206001015462000135813362000187565b6200014183836200018b565b505050565b6200015282826200024f565b60009182526005602090815260408084209390935560088152828320909152805460ff19169055565b6200014182826200031f565b600082815260056020526040902060010154620001a5813362000187565b6200014183836200031f565b620001ba620003f0565b6001600160a01b0381166200022c5760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201526564647265737360d01b60648201526084015b60405180910390fd5b6200023781620001ad565b50565b6000828152600560205260408120620001549083620003e0565b6200026082826200024f565b6200028e5760008281526005602090815260408083206001600160a01b03851684529091529020805460ff19166001179055565b5050565b620002a482826200024f565b156200028e5760008281526005602090815260408083206001600160a01b0385168452909152902080546001600160a01b03191690555050565b80516001600160a01b0381168114620002fc57600080fd5b919050565b600082198211156200031a576200031a62000407565b500190565b60006200032f838362000391565b6200036d5760008381526020818152604080832085845290915290206001018054600160a01b600160e01b031916740100000000000000000000000000000000000000001790555060015b92915050565b60008181526020838152604080832085845290915290206001015460ff61010090910416151560011490565b60006200036d836001600160a01b038416620003b2565b60008181526020838152604080832085845290915281206001015460ff16620003675760008381526020848152604080832086845290915290206001018054600160a01b600160e01b03191690555060016200036d565b600062000367836001600160a01b03841662000404565b600062000367836001600160a01b03841662000452565b6000546001600160a01b03163314620004575760405162461bcd60e51b815260206004820181905260248201526000805160206200301083398151915260448201526064016200022e565b565b634e487b7160e01b600052601160045260246000fd5b634e487b7160e01b600052604160045260246000fd5b828054828255906000526020600020908101928215620004bd579160200282015b82811115620004bd578251825591602001919060010190620004a0565b50620004cb929150620004cf565b5090565b5b80821115620004cb5760008155600101620004d0565b634e487b7160e01b600052603260045260246000fd5b60005b838110156200051a57818101518382015260200162000500565b838111156200052a576000848401525b50505050565b600082601f8301126200054257600080fd5b81516001600160401b03808211156200055f576200055f6200041d565b604051601f8301601f19908116603f011681019082821181831017156200058a576200058a6200041d565b81604052838152866020858801011115620005a457600080fd5b620005b7846020830160208901620004fd565b9695505050505050565b60008060008060008060008060006101208a8c031215620005e157600080fd5b89516001600160401b0380821115620005f957600080fd5b620006078d838e0162000530565b9a5060208c01519150808211156200061e57600080fd5b506200062d8c828d0162000530565b98505060408a01519650620006456060850162000292565b9550620006556080850162000292565b94506200066560a0850162000292565b935060c08401519250620006" + 
  "7d60e0850162000292565b91506101008401516001600160401b038111156200069a57600080fd5b620006a88c828d0162000530565b9150509295985092959850929598565b60006001600160a01b03808816835280871660208401525084604083015283606083015260a0608083015284518060a0840152620006fa8160c0850160208901620004fd565b601f01601f191691909101606001979650505050505050565b6000815180845260208085019450848260051b860182860111156200073657600080fd5b60005b858110156200076a5783830389526200075583825162000796565b98850198925090840190600101620007395565b5090979650505050505050565b6020815260006200036760208301846200071a565b6000602082840312156200079f57600080fd5b620007aa82620002e4565b9392505050565b60008060408385031215620007c557600080fd5b620007d083620002e4565b9150620007e060208401620002e4565b90509250929050565b600080600060608486031215620007ff57600080fd5b6200080a84620002e4565b92506200081a60208501620002e4565b9150604084015190509250925092565b60006020828403121562000843576200084362000480565b5051919050565b6000602082840312156200085d57600080fd5b81518015158114620007aa57600080fd5b60006080820190508251825260208301516020830152604083015160408301526060830151606083015292915050565b600060208284031215620008b157600080fd5b5051919050565b600060208284031215620008cb57600080fd5b81516001600160401b03811115620008e257600080fd5b620008f08482850162000530565b949350505050565b6000825162000906818460208701620004fd565b9190910192915050565b602081526000620003676020830184620008f8565b6000821982111562000937576200093762000407565b500190565b6000826200094e576200094e6200049a565b500490565b60008160001904831182151516156200096c576200096c62000407565b500290565b600082821015620009865762000986620004" + 
  "07565b500390565b602081526000620003676020830184620008f8565b600060208284031215620009b657600080fd5b81516001600160e01b031981168114620007aa57600080fd5b634e487b7160e01b600052602160045260246000fd5b612b1c80620009f36000396000f3fe";

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

export function generateRandomAddress(): `0x${string}` {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
}

export function validateStablecoinParams(params: {
  name: string;
  symbol: string;
  decimals: number;
  initialMint: string;
  platformFeePercent?: number;
}) {
  const { name, symbol, decimals, initialMint, platformFeePercent } = params;

  if (!name || name.length < 3 || name.length > 50) {
    throw new Error("Name must be between 3-50 characters");
  }

  if (!symbol || symbol.length < 2 || symbol.length > 10) {
    throw new Error("Symbol must be between 2-10 characters");
  }

  if (decimals < 0 || decimals > 18) {
    throw new Error("Decimals must be between 0-18");
  }

  const mintAmount = parseFloat(initialMint);
  if (isNaN(mintAmount) || mintAmount < 0) {
    throw new Error("Initial mint amount must be a positive number");
  }

  if (platformFeePercent !== undefined && (platformFeePercent < 0 || platformFeePercent > 10)) {
    throw new Error("Platform fee must be between 0-10%");
  }
}

export function computePlatformFeeBps(percentFee: number): bigint {
  return BigInt(Math.round(percentFee * 100));
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
// STABLECOIN DEPLOYMENT CONFIG
// =====================================================
export const STABLECOIN_CONFIG = {
  DECIMALS: 6,
  INITIAL_MINT_AMOUNT: "10000",
  DEFAULT_CONTRACT_URI: "https://metadata.arc-stablecoin.com/contract.json",
  GAS_LIMIT_DEPLOY: 8000000n,
  GAS_LIMIT_MINT: 200000n,
  GAS_LIMIT_TRANSFER: 150000n,
  GAS_LIMIT_BURN: 150000n,
  GAS_LIMIT_FREEZE: 100000n,
  GAS_LIMIT_PAUSE: 100000n,
  GAS_LIMIT_APPROVE: 100000n,
  GAS_LIMIT_ROLE: 100000n,
};

// =====================================================
// TYPES
// =====================================================
export type DeployStablecoinParams = {
  name: string;
  symbol: string;
  decimals: number;
  defaultAdmin: `0x${string}`;
  primarySaleRecipient: `0x${string}`;
  platformFeeRecipient: `0x${string}`;
  platformFeeBps: bigint;
  contractURI: string;
};

export type StablecoinInfo = {
  address: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  balance: string;
  isPaused: boolean;
  deployTx: `0x${string}`;
  timestamp: string;
};