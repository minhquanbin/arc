"use client"

import { useState } from "react"
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi"
import { CONTRACTS, ERC20_ABI } from "@/lib/contracts"
import { type Address } from "viem"

export function useApproveUSDC(spender: Address, amount: bigint) {
  const { address } = useAccount()
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>()

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && spender ? [address, spender] : undefined,
    query: {
      enabled: !!address && !!spender && spender !== "0x",
      staleTime: 5000,
    },
  })

  const { writeContractAsync, isPending: isWritePending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  const needsApproval = allowance !== undefined && amount > 0n && allowance < amount

  const approve = async () => {
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender, amount],
      })
      setApproveHash(hash)
      return hash
    } catch (e) {
      console.error("Approve error:", e)
      throw e
    }
  }

  return {
    allowance,
    needsApproval,
    approve,
    isApproving: isWritePending || isConfirming,
    isApproved,
    refetchAllowance,
  }
}