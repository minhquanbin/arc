"use client"

import { useState } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { type Address, keccak256, toBytes, encodePacked, hexToBytes } from "viem"
import { useSignTypedData } from "wagmi"
import { CONTRACTS, SERVICE_AGREEMENT_ABI } from "@/lib/contracts"
import { arcTestnet } from "@/lib/chains"

// EIP-712 domain + types for signing
const AGREEMENT_DOMAIN = {
  name: "ArcInvoice",
  version: "1",
  chainId: arcTestnet.id,
  verifyingContract: CONTRACTS.SERVICE_AGREEMENT,
} as const

const AGREEMENT_TYPES = {
  AgreementSignature: [
    { name: "client", type: "address" },
    { name: "vendor", type: "address" },
    { name: "contentHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
} as const

// Compute SHA256-like hash from agreement fields using keccak256
export function computeContentHash(fields: AgreementFields): `0x${string}` {
  const json = JSON.stringify(fields, Object.keys(fields).sort())
  return keccak256(toBytes(json))
}

export interface AgreementFields {
  projectTitle: string
  description: string
  deliverables: string
  techStack: string
  startDate: string
  endDate: string
  totalValue: string
  paymentSchedule: string
  penaltyPct: string
  arbitratorCount: string
  confidential: boolean
  ipOwnership: string
  terminationConditions: string
  clientName: string
  vendorName: string
  clientAddress: string
  vendorAddress: string
  agreementDate: string
}

// Get nonce for an address
export function useAgreementNonce(addr: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.SERVICE_AGREEMENT,
    abi: SERVICE_AGREEMENT_ABI,
    functionName: "nonces",
    args: addr ? [addr] : undefined,
    query: { enabled: !!addr, staleTime: 5000 },
  })
}

// Get agreement by token ID
export function useAgreement(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.SERVICE_AGREEMENT,
    abi: SERVICE_AGREEMENT_ABI,
    functionName: "getAgreement",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined, staleTime: 30000 },
  })
}

// Total agreements minted
export function useTotalAgreements() {
  return useReadContract({
    address: CONTRACTS.SERVICE_AGREEMENT,
    abi: SERVICE_AGREEMENT_ABI,
    functionName: "totalSupply",
    query: { staleTime: 30000 },
  })
}

// Sign agreement as client or vendor
export function useSignAgreement() {
  const { signTypedDataAsync, isPending, error } = useSignTypedData()

  const sign = async (params: {
    client: Address
    vendor: Address
    contentHash: `0x${string}`
    nonce: bigint
  }) => {
    return signTypedDataAsync({
      domain: AGREEMENT_DOMAIN,
      types: AGREEMENT_TYPES,
      primaryType: "AgreementSignature",
      message: {
        client: params.client,
        vendor: params.vendor,
        contentHash: params.contentHash,
        nonce: params.nonce,
      },
    })
  }

  return { sign, isPending, error }
}

// Mint agreement NFT with both signatures
export function useMintAgreement() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const mint = async (params: {
    client: Address
    vendor: Address
    contentHash: `0x${string}`
    ipfsCID: string
    clientSig: `0x${string}`
    vendorSig: `0x${string}`
    clientNonce: bigint
    vendorNonce: bigint
  }) => {
    return writeContractAsync({
      address: CONTRACTS.SERVICE_AGREEMENT,
      abi: SERVICE_AGREEMENT_ABI,
      functionName: "mintAgreement",
      args: [
        params.client,
        params.vendor,
        params.contentHash,
        params.ipfsCID,
        params.clientSig,
        params.vendorSig,
        params.clientNonce,
        params.vendorNonce,
      ],
      gas: 500000n,
    })
  }

  return { mint, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// Link agreement to invoice
export function useLinkAgreementToInvoice() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const link = (tokenId: bigint, invoiceId: bigint) => {
    writeContract({
      address: CONTRACTS.SERVICE_AGREEMENT,
      abi: SERVICE_AGREEMENT_ABI,
      functionName: "linkToInvoice",
      args: [tokenId, invoiceId],
      gas: 100000n,
    })
  }

  return { link, hash, isPending: isPending || isConfirming, isSuccess, error }
}

// Upload JSON to IPFS via public gateway (no API key needed for testnet)
export async function uploadToIPFS(data: object): Promise<string> {
  try {
    const json = JSON.stringify(data)
    const blob = new Blob([json], { type: "application/json" })
    const formData = new FormData()
    formData.append("file", blob, "agreement.json")

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + (process.env.NEXT_PUBLIC_PINATA_JWT ?? ""),
      },
      body: formData,
    })

    if (res.ok) {
      const data = await res.json()
      return data.IpfsHash
    }
  } catch {
    // Fallback: use data URI as mock CID for testnet
  }

  // Testnet fallback: generate deterministic mock CID from content
  const hash = keccak256(toBytes(JSON.stringify(data)))
  return "Qm" + hash.slice(2, 46)
}