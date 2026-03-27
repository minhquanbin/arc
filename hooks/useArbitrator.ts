"use client"

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { useAccount } from "wagmi"
import { CONTRACTS, ARBITRATOR_NFT_ABI } from "@/lib/contracts"
import type { Address } from "viem"

const GAS_LIMIT = 500000n

export function useMyArbitratorStats() {
  const { address } = useAccount()
  return useReadContract({
    address: CONTRACTS.ARBITRATOR_NFT,
    abi: ARBITRATOR_NFT_ABI,
    functionName: "getStats",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      staleTime: 30000,
      retry: 1,
    },
  })
}

export function useIsArbitrator(addr: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.ARBITRATOR_NFT,
    abi: ARBITRATOR_NFT_ABI,
    functionName: "isArbitrator",
    args: addr ? [addr] : undefined,
    query: { enabled: !!addr, staleTime: 30000 },
  })
}

export function useArbitratorTier(addr: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.ARBITRATOR_NFT,
    abi: ARBITRATOR_NFT_ABI,
    functionName: "getTier",
    args: addr ? [addr] : undefined,
    query: { enabled: !!addr, staleTime: 30000 },
  })
}

export function useTotalMinted() {
  return useReadContract({
    address: CONTRACTS.ARBITRATOR_NFT,
    abi: ARBITRATOR_NFT_ABI,
    functionName: "totalMinted",
    query: { staleTime: 60000, retry: 1 },
  })
}

export function useMintGold() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const mintGold = () => {
    writeContract({
      address: CONTRACTS.ARBITRATOR_NFT,
      abi: ARBITRATOR_NFT_ABI,
      functionName: "mintGold",
      gas: GAS_LIMIT,
    })
  }
  return { mintGold, hash, isPending: isPending || isConfirming, isSuccess, error }
}

export function useUpgradeToDiamond() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const upgrade = () => {
    writeContract({
      address: CONTRACTS.ARBITRATOR_NFT,
      abi: ARBITRATOR_NFT_ABI,
      functionName: "upgradeToDiamond",
      gas: GAS_LIMIT,
    })
  }
  return { upgrade, hash, isPending: isPending || isConfirming, isSuccess, error }
}

export function useUpgradeToPlatinum() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const upgrade = () => {
    writeContract({
      address: CONTRACTS.ARBITRATOR_NFT,
      abi: ARBITRATOR_NFT_ABI,
      functionName: "upgradeToPlatinum",
      gas: GAS_LIMIT,
    })
  }
  return { upgrade, hash, isPending: isPending || isConfirming, isSuccess, error }
}