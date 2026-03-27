import { formatUnits, parseUnits } from 'viem'

// Arc USDC uses 18 decimals
export const USDC_DECIMALS = 6

export function fmtUSDC(wei: bigint): string {
  const n = parseFloat(formatUnits(wei, USDC_DECIMALS))
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDC'
}

export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS)
}

export function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function daysUntil(ts: number): number {
  return Math.ceil((ts * 1000 - Date.now()) / 86_400_000)
}

export function toTimestamp(dateStr: string): bigint {
  return BigInt(Math.floor(new Date(dateStr).getTime() / 1000))
}

export function computeDisputeDeposit(totalWei: bigint): bigint {
  const MIN = parseUnits('50', USDC_DECIMALS)
  const fee = (totalWei * 500n) / 10_000n // 5%
  return fee < MIN ? MIN : fee
}

// Tier helpers
export const TIER_LABEL = ['Gold', 'Diamond', 'Platinum'] as const
export const TIER_ICON  = ['', '', ' '] as const
export const TIER_COLOR = ['var(--gold)', 'var(--diamond)', 'var(--platinum)'] as const
export const TIER_FEE_BPS = [50, 70, 100] as const // 0.5%, 0.7%, 1%

export function getTierLabel(tier: number): string {
  return TIER_LABEL[tier] ?? 'Unknown'
}
export function getTierIcon(tier: number): string {
  return TIER_ICON[tier] ?? '?'
}
export function getTierColor(tier: number): string {
  return TIER_COLOR[tier] ?? 'var(--text2)'
}

// Invoice status labels
export const INVOICE_STATUS = ['Created', 'Active', 'Completed', 'Cancelled', 'Disputed'] as const
export const MILESTONE_STATUS = ['Pending', 'Submitted', 'Approved', 'Auto-Released', 'Disputed', 'Resolved'] as const

export type InvoiceStatus = 0 | 1 | 2 | 3 | 4
export type MilestoneStatus = 0 | 1 | 2 | 3 | 4 | 5

// Listing tier
export const LISTING_TIER = ['Normal', 'Hot', 'Super Hot'] as const
export const LISTING_TYPE = ['Job', 'Skill'] as const
