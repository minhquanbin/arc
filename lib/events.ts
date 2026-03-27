/**
 * @file lib/events.ts
 * @description Helpers to fetch on-chain events for indexing arbitrators and invoices.
 *
 * In production you'd use a dedicated indexer (The Graph subgraph, Ponder, etc.).
 * These helpers use viem's getLogs as a lightweight alternative.
 */

import { createPublicClient, http, parseAbiItem, type Address } from 'viem'
import { arcTestnet } from './chains'
import { CONTRACTS } from './contracts'

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
})

// ── Fetch all known arbitrator addresses ─────────────────────────────────────
export async function fetchArbitratorAddresses(): Promise<Address[]> {
  try {
    const logs = await publicClient.getLogs({
      address: CONTRACTS.ARBITRATOR_NFT,
      event: parseAbiItem('event GoldMinted(address indexed arbitrator)'),
      fromBlock: 0n,
    })
    const addrs = [...new Set(logs.map(l => l.args.arbitrator as Address))]
    return addrs
  } catch {
    return []
  }
}

// ── Fetch all InvoiceCreated events for an address ───────────────────────────
export async function fetchInvoicesForAddress(address: Address): Promise<bigint[]> {
  try {
    const [asClient, asVendor] = await Promise.all([
      publicClient.getLogs({
        address: CONTRACTS.INVOICE_ESCROW,
        event: parseAbiItem('event InvoiceCreated(uint256 indexed id, address indexed client, address indexed vendor, uint256 totalAmount, uint256 milestoneCount)'),
        args: { client: address },
        fromBlock: 0n,
      }),
      publicClient.getLogs({
        address: CONTRACTS.INVOICE_ESCROW,
        event: parseAbiItem('event InvoiceCreated(uint256 indexed id, address indexed client, address indexed vendor, uint256 totalAmount, uint256 milestoneCount)'),
        args: { vendor: address },
        fromBlock: 0n,
      }),
    ])

    const ids = [...asClient, ...asVendor].map(l => l.args.id as bigint)
    return [...new Set(ids)].sort((a, b) => Number(b - a)) // newest first
  } catch {
    return []
  }
}

// ── Fetch all listing IDs for an owner ───────────────────────────────────────
export async function fetchListingsForOwner(owner: Address): Promise<bigint[]> {
  try {
    const logs = await publicClient.getLogs({
      address: CONTRACTS.MARKETPLACE,
      event: parseAbiItem('event ListingPosted(uint256 indexed id, address indexed owner, uint8 tier, uint8 listingType)'),
      args: { owner },
      fromBlock: 0n,
    })
    return logs.map(l => l.args.id as bigint)
  } catch {
    return []
  }
}
