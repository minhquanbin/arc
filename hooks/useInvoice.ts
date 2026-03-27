'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useAccount } from 'wagmi'
import { CONTRACTS, INVOICE_ESCROW_ABI } from '@/lib/contracts'
import { parseUSDC, computeDisputeDeposit } from '@/lib/utils'
import type { Address } from 'viem'

// ── Read a single invoice ──────────────────────────────────────────────────────
export function useInvoice(invoiceId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.INVOICE_ESCROW,
    abi: INVOICE_ESCROW_ABI,
    functionName: 'getInvoice',
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: { enabled: invoiceId !== undefined },
  })
}

// ── Read a single milestone ────────────────────────────────────────────────────
export function useMilestone(invoiceId: bigint | undefined, index: bigint) {
  return useReadContract({
    address: CONTRACTS.INVOICE_ESCROW,
    abi: INVOICE_ESCROW_ABI,
    functionName: 'getMilestone',
    args: invoiceId !== undefined ? [invoiceId, index] : undefined,
    query: { enabled: invoiceId !== undefined },
  })
}

// ── Create invoice ─────────────────────────────────────────────────────────────
export function useCreateInvoice() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const createInvoice = (params: {
    vendor: Address
    arbitrators: Address[]
    content: string
    milestones: { desc: string; amount: string; start: string; due: string }[]
  }) => {
    const amounts = params.milestones.map(m => parseUSDC(m.amount))
    const starts  = params.milestones.map(m => BigInt(Math.floor(new Date(m.start).getTime() / 1000)))
    const dues    = params.milestones.map(m => BigInt(Math.floor(new Date(m.due).getTime() / 1000)))
    const descs   = params.milestones.map(m => m.desc)

    writeContract({
      address: CONTRACTS.INVOICE_ESCROW,
      abi: INVOICE_ESCROW_ABI,
      functionName: 'createInvoice', gas: 800000n,
      args: [params.vendor, params.arbitrators, params.content, descs, amounts, starts, dues],
    })
  }

  return { createInvoice, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Accept invoice ─────────────────────────────────────────────────────────────
export function useAcceptInvoice() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const accept = (invoiceId: bigint) => {
    writeContract({
      address: CONTRACTS.INVOICE_ESCROW,
      abi: INVOICE_ESCROW_ABI,
      functionName: 'acceptInvoice', gas: 300000n,
      args: [invoiceId],
    })
  }
  return { accept, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Submit milestone ───────────────────────────────────────────────────────────
export function useSubmitMilestone() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const submit = (invoiceId: bigint, milestoneIndex: bigint) => {
    writeContract({
      address: CONTRACTS.INVOICE_ESCROW,
      abi: INVOICE_ESCROW_ABI,
      functionName: 'submitMilestone', gas: 200000n,
      args: [invoiceId, milestoneIndex],
    })
  }
  return { submit, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Approve milestone ──────────────────────────────────────────────────────────
export function useApproveMilestone() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const approve = (invoiceId: bigint, milestoneIndex: bigint) => {
    writeContract({
      address: CONTRACTS.INVOICE_ESCROW,
      abi: INVOICE_ESCROW_ABI,
      functionName: 'approveMilestone', gas: 300000n,
      args: [invoiceId, milestoneIndex],
    })
  }
  return { approve, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Claim auto-release ─────────────────────────────────────────────────────────
export function useClaimAutoRelease() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const claim = (invoiceId: bigint, milestoneIndex: bigint) => {
    writeContract({
      address: CONTRACTS.INVOICE_ESCROW,
      abi: INVOICE_ESCROW_ABI,
      functionName: 'claimMilestoneAutoRelease', gas: 300000n,
      args: [invoiceId, milestoneIndex],
    })
  }
  return { claim, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Open dispute ───────────────────────────────────────────────────────────────
export function useOpenDispute() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const openDispute = (invoiceId: bigint, milestoneIndex: bigint) => {
    writeContract({
      address: CONTRACTS.INVOICE_ESCROW,
      abi: INVOICE_ESCROW_ABI,
      functionName: 'openDispute', gas: 200000n,
      args: [invoiceId, milestoneIndex],
    })
  }
  return { openDispute, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Vote dispute ───────────────────────────────────────────────────────────────
export function useVoteDispute() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const vote = (invoiceId: bigint, milestoneIndex: bigint, favorClient: boolean) => {
    writeContract({
      address: CONTRACTS.INVOICE_ESCROW,
      abi: INVOICE_ESCROW_ABI,
      functionName: 'voteDispute', gas: 400000n,
      args: [invoiceId, milestoneIndex, favorClient],
    })
  }
  return { vote, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Cancel invoice ─────────────────────────────────────────────────────────────
export function useCancelInvoice() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const cancel = (invoiceId: bigint) => {
    writeContract({
      address: CONTRACTS.INVOICE_ESCROW,
      abi: INVOICE_ESCROW_ABI,
      functionName: 'cancelInvoice', gas: 200000n,
      args: [invoiceId],
    })
  }
  return { cancel, hash, isPending: isPending || isConfirming, isSuccess, error }
}
