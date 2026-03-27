'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useAccount } from 'wagmi'
import { CONTRACTS, ARBITRATOR_NFT_ABI } from '@/lib/contracts'
import type { Address } from 'viem'

// ── Read current user's arbitrator status ────────────────────────────────────
export function useMyArbitratorStats() {
  const { address } = useAccount()
  return useReadContract({
    address: CONTRACTS.ARBITRATOR_NFT,
    abi: ARBITRATOR_NFT_ABI,
    functionName: 'getStats',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })
}

// ── Check if any address is an arbitrator ────────────────────────────────────
export function useIsArbitrator(addr: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.ARBITRATOR_NFT,
    abi: ARBITRATOR_NFT_ABI,
    functionName: 'isArbitrator',
    args: addr ? [addr] : undefined,
    query: { enabled: !!addr },
  })
}

// ── Get tier of any address ───────────────────────────────────────────────────
export function useArbitratorTier(addr: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.ARBITRATOR_NFT,
    abi: ARBITRATOR_NFT_ABI,
    functionName: 'getTier',
    args: addr ? [addr] : undefined,
    query: { enabled: !!addr },
  })
}

// ── Total minted ──────────────────────────────────────────────────────────────
export function useTotalMinted() {
  return useReadContract({
    address: CONTRACTS.ARBITRATOR_NFT,
    abi: ARBITRATOR_NFT_ABI,
    functionName: 'totalMinted',
    query: { refetchInterval: 30_000 },
  })
}

// ── Mint Gold NFT ─────────────────────────────────────────────────────────────
export function useMintGold() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const mintGold = () => {
    writeContract({
      address: CONTRACTS.ARBITRATOR_NFT,
      abi: ARBITRATOR_NFT_ABI,
      functionName: 'mintGold',
    })
  }
  return { mintGold, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Upgrade to Diamond ────────────────────────────────────────────────────────
export function useUpgradeToDiamond() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const upgrade = () => {
    writeContract({
      address: CONTRACTS.ARBITRATOR_NFT,
      abi: ARBITRATOR_NFT_ABI,
      functionName: 'upgradeToDiamond',
    })
  }
  return { upgrade, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// ── Upgrade to Platinum ───────────────────────────────────────────────────────
export function useUpgradeToPlatinum() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const upgrade = () => {
    writeContract({
      address: CONTRACTS.ARBITRATOR_NFT,
      abi: ARBITRATOR_NFT_ABI,
      functionName: 'upgradeToPlatinum',
    })
  }
  return { upgrade, hash, isPending: isPending || isConfirming, isSuccess, error }
}
