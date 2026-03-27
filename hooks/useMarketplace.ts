'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useAccount } from 'wagmi'
import { CONTRACTS, MARKETPLACE_ABI } from '@/lib/contracts'
import { parseUSDC } from '@/lib/utils'
import type { Address } from 'viem'

// ── Read profile ──────────────────────────────────────────────────────────────
export function useProfile(addr: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: 'profiles',
    args: addr ? [addr] : undefined,
    query: { enabled: !!addr },
  })
}

// ── My profile ────────────────────────────────────────────────────────────────
export function useMyProfile() {
  const { address } = useAccount()
  return useProfile(address)
}

// ── Read listing ──────────────────────────────────────────────────────────────
export function useListing(id: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: 'listings',
    args: id !== undefined ? [id] : undefined,
    query: { enabled: id !== undefined },
  })
}

// ── Get paginated listings ────────────────────────────────────────────────────
export function useSuperHotListings(offset = 0n, limit = 20n) {
  return useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: 'getSuperHotListings',
    args: [offset, limit],
    query: { refetchInterval: 30_000 },
  })
}

export function useHotListings(offset = 0n, limit = 20n) {
  return useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: 'getHotListings',
    args: [offset, limit],
    query: { refetchInterval: 30_000 },
  })
}

export function useNormalListings(offset = 0n, limit = 20n) {
  return useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: 'getNormalListings',
    args: [offset, limit],
    query: { refetchInterval: 30_000 },
  })
}

// ── Fees ──────────────────────────────────────────────────────────────────────
export function useMarketplaceFees() {
  const hotFee = useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: 'HOT_FEE',
  })
  const superHotFee = useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: 'superHotFee',
  })
  return { hotFee: hotFee.data, superHotFee: superHotFee.data }
}

// ── Register ──────────────────────────────────────────────────────────────────
export function useRegister() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const register = (params: {
    userType: 0 | 1
    name: string
    xHandle: string
    gmail: string
    bio: string
  }) => {
    writeContract({
      address: CONTRACTS.MARKETPLACE,
      abi: MARKETPLACE_ABI,
      functionName: 'register', gas: 300000n,
      args: [params.userType, params.name, params.xHandle, params.gmail, params.bio],
    })
  }
  return { register, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Update profile ────────────────────────────────────────────────────────────
export function useUpdateProfile() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const update = (name: string, xHandle: string, gmail: string, bio: string) => {
    writeContract({
      address: CONTRACTS.MARKETPLACE,
      abi: MARKETPLACE_ABI,
      functionName: 'updateProfile', gas: 200000n,
      args: [name, xHandle, gmail, bio],
    })
  }
  return { update, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Post listing ──────────────────────────────────────────────────────────────
export function usePostListing() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const post = (params: {
    tier: 0 | 1 | 2
    title: string
    description: string
    tags: string
    budget: string
    durationDays: number
  }) => {
    writeContract({
      address: CONTRACTS.MARKETPLACE,
      abi: MARKETPLACE_ABI,
      functionName: 'postListing', gas: 400000n,
      args: [
        params.tier,
        params.title,
        params.description,
        params.tags,
        params.budget ? parseUSDC(params.budget) : 0n,
        BigInt(params.durationDays),
      ],
    })
  }
  return { post, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Apply to listing ──────────────────────────────────────────────────────────
export function useApplyToListing() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const apply = (listingId: bigint, message: string) => {
    writeContract({
      address: CONTRACTS.MARKETPLACE,
      abi: MARKETPLACE_ABI,
      functionName: 'applyToListing', gas: 200000n,
      args: [listingId, message],
    })
  }
  return { apply, hash, isPending: isPending || isConfirming, isSuccess, error }
}
