'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { fetchArbitratorAddresses, fetchInvoicesForAddress } from '@/lib/events'

// ── Load known arbitrators from GoldMinted events ─────────────────────────────
export function useArbitratorAddresses() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchArbitratorAddresses()
      .then(setAddresses)
      .finally(() => setLoading(false))
  }, [])

  return { addresses, loading }
}

// ── Load invoice IDs for connected wallet (client or vendor) ──────────────────
export function useMyInvoiceIds() {
  const { address } = useAccount()
  const [ids, setIds] = useState<bigint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) { setIds([]); return }
    setLoading(true)
    fetchInvoicesForAddress(address as Address)
      .then(setIds)
      .finally(() => setLoading(false))
  }, [address])

  return { ids, loading }
}
