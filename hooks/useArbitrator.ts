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
import { usePublicClient } from "wagmi"
import { useState, useEffect } from "react"

export function useAllArbitrators(): string[] {
  const client = usePublicClient()
  const [arbitrators, setArbitrators] = useState<string[]>([])

  useEffect(() => {
    if (!client) return
    let cancelled = false

    async function fetch() {
      try {
        const [goldLogs, diamondLogs, platinumLogs] = await Promise.all([
          client!.getLogs({
            address: CONTRACTS.ARBITRATOR_NFT,
            event: { type: "event", name: "GoldMinted", inputs: [{ name: "arbitrator", type: "address", indexed: true }] },
            fromBlock: 0n, toBlock: "latest",
          }).catch(() => []),
          client!.getLogs({
            address: CONTRACTS.ARBITRATOR_NFT,
            event: { type: "event", name: "UpgradedToDiamond", inputs: [{ name: "arbitrator", type: "address", indexed: true }] },
            fromBlock: 0n, toBlock: "latest",
          }).catch(() => []),
          client!.getLogs({
            address: CONTRACTS.ARBITRATOR_NFT,
            event: { type: "event", name: "UpgradedToPlatinum", inputs: [{ name: "arbitrator", type: "address", indexed: true }] },
            fromBlock: 0n, toBlock: "latest",
          }).catch(() => []),
        ])
        if (cancelled) return

        const seen = new Set<string>()
        platinumLogs.forEach(l => { const a = (l.args as any).arbitrator; if (a) seen.add(a.toLowerCase()) })
        diamondLogs.forEach(l => { const a = (l.args as any).arbitrator; if (a) seen.add(a.toLowerCase()) })
        goldLogs.forEach(l => { const a = (l.args as any).arbitrator; if (a) seen.add(a.toLowerCase()) })

        const list = Array.from(seen)
        if (!cancelled) setArbitrators(list.length > 0 ? list : [])
      } catch {
        if (!cancelled) setArbitrators([])
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [client])

  return arbitrators
}
