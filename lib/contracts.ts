import { INVOICE_ESCROW_ABI } from "./abis/InvoiceEscrow"
import { ARBITRATOR_NFT_ABI } from "./abis/ArbitratorNFT"
import { MARKETPLACE_ABI } from "./abis/Marketplace"
import { SERVICE_AGREEMENT_ABI } from "./abis/ServiceAgreement"

export const CONTRACTS = {
  USDC: (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000") as `0x${string}`,
  INVOICE_ESCROW: (process.env.NEXT_PUBLIC_INVOICE_ESCROW_ADDRESS ?? "0x") as `0x${string}`,
  ARBITRATOR_NFT: (process.env.NEXT_PUBLIC_ARBITRATOR_NFT_ADDRESS ?? "0x") as `0x${string}`,
  MARKETPLACE: (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ?? "0x") as `0x${string}`,
  SERVICE_AGREEMENT: (process.env.NEXT_PUBLIC_SERVICE_AGREEMENT_ADDRESS ?? "0x") as `0x${string}`,
} as const

export { INVOICE_ESCROW_ABI, ARBITRATOR_NFT_ABI, MARKETPLACE_ABI, SERVICE_AGREEMENT_ABI }

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const