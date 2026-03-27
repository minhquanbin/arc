# ArcInvoice — Decentralized Invoice Platform

Built on [Arc](https://docs.arc.network) — Circle's EVM L1 with USDC as native gas token.

## Features

- **Invoice** — USDC escrow with milestone payments, auto-release after 7 days, dispute resolution
- **Trọng tài** — Tiered NFT arbitrators (Gold/Diamond/Platinum), fee-earning, unanimous voting
- **Rao vặt** — On-chain job board with 3 listing tiers, X/Gmail profile linking

## Stack

| Layer | Technology |
|-------|-----------|
| Chain | Arc Testnet (Chain ID 5042002, USDC gas) |
| Contracts | Solidity 0.8.30, OpenZeppelin v5 |
| Frontend | Next.js 14, React 18, TypeScript |
| Web3 | Wagmi v2, Viem v2, RainbowKit v2 |
| Styling | Custom CSS (DM Mono + Syne fonts) |

## Project Structure

```
arc-invoice/
├── app/
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # Tab routing shell
│   ├── providers.tsx       # Wagmi + RainbowKit providers
│   └── globals.css         # Full design system
├── components/
│   ├── layout/Header.tsx   # Sticky header with wallet + USDC balance
│   ├── invoice/
│   │   ├── InvoiceTab.tsx  # Invoice list + detail view
│   │   ├── CreateInvoice.tsx  # Invoice creation form
│   │   └── MilestoneCard.tsx  # Per-milestone actions
│   ├── arbitrator/
│   │   └── ArbitratorTab.tsx  # NFT cards + mint/upgrade flow
│   ├── marketplace/
│   │   ├── MarketplaceTab.tsx # Listing feed + post/apply modals
│   │   └── ListingCard.tsx    # Tier-styled listing card
│   └── ui/index.tsx        # Shared primitives (Badge, Button, Modal…)
├── contracts/
│   ├── InvoiceEscrow.sol   # Main escrow + milestone + dispute logic
│   ├── ArbitratorNFT.sol   # ERC-1155 tiered arbitrator NFT
│   └── Marketplace.sol     # On-chain job board
├── hooks/
│   ├── useInvoice.ts       # All invoice contract hooks
│   ├── useArbitrator.ts    # Arbitrator NFT hooks
│   ├── useMarketplace.ts   # Marketplace hooks
│   └── useApproveUSDC.ts   # ERC-20 approve helper
└── lib/
    ├── chains.ts           # Arc Testnet chain config
    ├── contracts.ts        # Contract addresses + ABIs
    ├── utils.ts            # Format utilities, tier helpers
    └── abis/               # InvoiceEscrow, ArbitratorNFT, Marketplace ABIs
```

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/your-handle/arc-invoice
cd arc-invoice
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
# Fill in contract addresses after deploying
```

### 3. Deploy contracts (Foundry)

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Set env
export ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
export PRIVATE_KEY=0x...

# Deploy ArbitratorNFT first (needs treasury address)
forge create contracts/ArbitratorNFT.sol:ArbitratorNFT \
  --constructor-args $YOUR_WALLET \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY

# Deploy InvoiceEscrow (needs ArbitratorNFT address + fee collector)
forge create contracts/InvoiceEscrow.sol:InvoiceEscrow \
  --constructor-args $ARBITRATOR_NFT_ADDRESS $FEE_COLLECTOR \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY

# Link escrow in ArbitratorNFT
cast send $ARBITRATOR_NFT_ADDRESS "setInvoiceEscrow(address)" $INVOICE_ESCROW_ADDRESS \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY

# Deploy Marketplace
forge create contracts/Marketplace.sol:Marketplace \
  --constructor-args $FEE_COLLECTOR \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 4. Run frontend

```bash
npm run dev
# Open http://localhost:3000
```

## Arc Chain Config (MetaMask)

| Field | Value |
|-------|-------|
| Network Name | Arc Testnet |
| RPC URL | https://rpc.testnet.arc.network |
| Chain ID | 5042002 |
| Currency | USDC |
| Explorer | https://testnet.arcscan.app |

Get testnet USDC: https://faucet.circle.com

## Contract Logic Summary

### InvoiceEscrow.sol

**Invoice lifecycle:**
```
CREATED  → acceptInvoice()  → ACTIVE
                                 ↓
                          submitMilestone()
                                 ↓
                     approveMilestone()  OR  7-day silence → claimAutoRelease()
                                 ↓
                            COMPLETED (all milestones done)

         openDispute() → DISPUTED → voteDispute() (unanimous) → RESOLVED
                                     Loser pays 5% dispute fee to arbitrators
```

**Fee model:**
- Arbitrator fee: Gold 0.5% | Diamond 0.7% | Platinum 1% (per milestone, always)
- Platform fee: 1% (configurable)
- Dispute deposit: 5% of total (min 50 USDC), locked by both parties
- Dispute resolution fee: 5% of milestone (min 50 USDC), paid by loser

### ArbitratorNFT.sol

**Tier progression:**
```
Gold (200 USDC mint) → 10 invoices + 1,000 USDC → Diamond
Diamond → 20 invoices + 5 disputes + 5,000 USDC → Platinum
```

- Max 10 NFTs globally
- Non-transferable during active disputes
- Suspension only (no downgrade)

### Marketplace.sol

**Listing tiers:**
| Tier | Fee | Display |
|------|-----|---------|
| Normal | Free (gas) | Standard, newest first |
| Hot | 1 USDC | 1.5× larger, highlighted |
| Super Hot | 5 USDC (configurable) | 2.25× larger, pinned top, featured badge |

## License

MIT
