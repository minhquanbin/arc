'use client'

import { fmtUSDC, fmtDate, shortenAddr } from '@/lib/utils'
import { Tag } from '@/components/ui'

interface ListingData {
  id: bigint
  owner: string
  listingType: number
  tier: number
  title: string
  description: string
  tags: string
  budget: bigint
  createdAt: bigint
  expiresAt: bigint
  active: boolean
  ownerName?: string
  ownerX?: string
}

interface Props {
  data: ListingData
  onClick: () => void
}

export function ListingCard({ data, onClick }: Props) {
  const tierCls = data.tier === 2 ? 'listing-superhot' : data.tier === 1 ? 'listing-hot' : 'listing-normal'
  const scale = data.tier === 2 ? 1.02 : data.tier === 1 ? 1.005 : 1
  const tags = data.tags.split(',').map(t => t.trim()).filter(Boolean)

  return (
    <div
      className={`card card-hover ${tierCls}`}
      onClick={onClick}
      style={{ transform: `scale(${scale})`, marginBottom: 10 }}
    >
      <div className="row gap-8 mb-8">
        <div style={{ flex: 1, fontSize: data.tier === 2 ? 15 : 13, fontWeight: 700 }}>
          {data.title}
        </div>
        <span className={`badge ${data.listingType === 0 ? 'badge-job' : 'badge-skill'}`}>
          {data.listingType === 0 ? 'JOB' : 'SKILL'}
        </span>
        {data.tier === 1 && <span className="badge badge-gold">🔥 HOT</span>}
      </div>

      <p style={{
        fontSize: data.tier === 2 ? 13 : 12,
        color: 'var(--text2)',
        lineHeight: 1.6,
        marginBottom: 10,
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {data.description}
      </p>

      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        {tags.slice(0, 5).map(t => <Tag key={t}>{t}</Tag>)}
        <div style={{ flex: 1 }} />
        {data.budget > 0n && (
          <span className="mono text-sm text-teal">{fmtUSDC(data.budget)}</span>
        )}
        {data.budget === 0n && (
          <span className="mono text-xs muted2">Negotiable</span>
        )}
      </div>

      <div className="divider-sm" />
      <div className="row gap-8 text-xs muted2">
        <span className="mono">{data.ownerName ?? shortenAddr(data.owner)}</span>
        {data.ownerX && <span className="mono">{data.ownerX}</span>}
        <span className="ml-auto mono">{fmtDate(Number(data.createdAt))}</span>
        {data.expiresAt > 0n && Date.now() / 1000 > Number(data.expiresAt) && (
          <span className="badge badge-cancelled" style={{ fontSize: 9 }}>EXPIRED</span>
        )}
      </div>
    </div>
  )
}
