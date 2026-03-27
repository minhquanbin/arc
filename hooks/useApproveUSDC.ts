'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useAccount } from 'wagmi'
import { CONTRACTS, ERC20_ABI } from '@/lib/contracts'
import { type Address } from 'viem'

export function useApproveUSDC(spender: Address, amount: bigint) {
  const { address } = useAccount()

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && spender ? [address, spender] : undefined,
    query: { enabled: !!address && !!spender },
  })

  const { writeContract, data: approveTxHash, isPending: isApproving } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  })

  const needsApproval = allowance !== undefined && allowance < amount

  const approve = () => {
    writeContract({
      address: CONTRACTS.USDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, amount],
    })
  }

  return {
    allowance,
    needsApproval,
    approve,
    isApproving: isApproving || isConfirming,
    isApproved,
    refetchAllowance,
  }
}
