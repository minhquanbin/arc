export const ARBITRATOR_NFT_ABI = [
  // mintGold
  {
    name: 'mintGold',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // upgradeToDiamond
  {
    name: 'upgradeToDiamond',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // upgradeToPlatinum
  {
    name: 'upgradeToPlatinum',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // isArbitrator
  {
    name: 'isArbitrator',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  // getTier
  {
    name: 'getTier',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  // getStats
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [
      { name: 'invoiceCount', type: 'uint256' },
      { name: 'disputeCount', type: 'uint256' },
      { name: 'activeDisputes', type: 'uint256' },
      { name: 'suspended', type: 'bool' },
      { name: 'tier', type: 'uint256' },
    ],
  },
  // balanceOf
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  // totalMinted
  {
    name: 'totalMinted',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // stats mapping
  {
    name: 'stats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'invoiceCount', type: 'uint256' },
      { name: 'disputeCount', type: 'uint256' },
      { name: 'activeDisputes', type: 'uint256' },
      { name: 'suspended', type: 'bool' },
      { name: 'exists', type: 'bool' },
    ],
  },
  // Constants
  { name: 'GOLD', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'DIAMOND', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'PLATINUM', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'MAX_TOTAL_NFTS', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'GOLD_PRICE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'DIAMOND_PRICE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'PLATINUM_PRICE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  // Events
  {
    name: 'GoldMinted',
    type: 'event',
    inputs: [{ name: 'arbitrator', type: 'address', indexed: true }],
  },
  {
    name: 'UpgradedToDiamond',
    type: 'event',
    inputs: [{ name: 'arbitrator', type: 'address', indexed: true }],
  },
  {
    name: 'UpgradedToPlatinum',
    type: 'event',
    inputs: [{ name: 'arbitrator', type: 'address', indexed: true }],
  },
  {
    name: 'ArbitratorSuspended',
    type: 'event',
    inputs: [{ name: 'arbitrator', type: 'address', indexed: true }],
  },
] as const
