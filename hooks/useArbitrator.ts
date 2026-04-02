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
        const CHUNK = 9000n
        const latestBlock = await client!.getBlockNumber()

        // Arc contract deployed around block 34,100,000
        const deployBlock = 34100000n
        const seen = new Set<string>()

        const eventDefs = [
          { name: "GoldMinted",        inputs: [{ name: "arbitrator", type: "address", indexed: true }] },
          { name: "UpgradedToDiamond", inputs: [{ name: "arbitrator", type: "address", indexed: true }] },
          { name: "UpgradedToPlatinum",inputs: [{ name: "arbitrator", type: "address", indexed: true }] },
        ] as const

        // Scan in 9000-block chunks from deploy block to latest
        for (let from = deployBlock; from <= latestBlock; from += CHUNK) {
          if (cancelled) return
          const to = from + CHUNK - 1n > latestBlock ? latestBlock : from + CHUNK - 1n

          await Promise.all(eventDefs.map(async (ev) => {
            try {
              const logs = await client!.getLogs({
                address: CONTRACTS.ARBITRATOR_NFT,
                event: { type: "event", name: ev.name, inputs: ev.inputs as any },
                fromBlock: from,
                toBlock: to,
              })
              logs.forEach(l => {
                const a = (l.args as any).arbitrator
                if (a) seen.add((a as string).toLowerCase())
              })
            } catch {}
          }))
        }

        if (!cancelled) {
          setArbitrators(Array.from(seen))
        }
      } catch (e) {
        console.error("useAllArbitrators error:", e)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [client])

  return arbitrators
}
