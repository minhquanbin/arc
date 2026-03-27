export const MARKETPLACE_ABI = [
  // register
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'userType', type: 'uint8' },
      { name: 'name', type: 'string' },
      { name: 'xHandle', type: 'string' },
      { name: 'gmail', type: 'string' },
      { name: 'bio', type: 'string' },
    ],
    outputs: [],
  },
  // updateProfile
  {
    name: 'updateProfile',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'xHandle', type: 'string' },
      { name: 'gmail', type: 'string' },
      { name: 'bio', type: 'string' },
    ],
    outputs: [],
  },
  // postListing
  {
    name: 'postListing',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'tags', type: 'string' },
      { name: 'budget', type: 'uint256' },
      { name: 'durationDays', type: 'uint256' },
    ],
    outputs: [{ name: 'listingId', type: 'uint256' }],
  },
  // deactivateListing
  {
    name: 'deactivateListing',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'listingId', type: 'uint256' }],
    outputs: [],
  },
  // applyToListing
  {
    name: 'applyToListing',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'listingId', type: 'uint256' },
      { name: 'message', type: 'string' },
    ],
    outputs: [],
  },
  // acceptApplication
  {
    name: 'acceptApplication',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'applicationId', type: 'uint256' }],
    outputs: [],
  },
  // profiles
  {
    name: 'profiles',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'wallet', type: 'address' },
      { name: 'userType', type: 'uint8' },
      { name: 'name', type: 'string' },
      { name: 'xHandle', type: 'string' },
      { name: 'gmailAddress', type: 'string' },
      { name: 'bio', type: 'string' },
      { name: 'registeredAt', type: 'uint256' },
      { name: 'exists', type: 'bool' },
    ],
  },
  // listings
  {
    name: 'listings',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'owner', type: 'address' },
      { name: 'listingType', type: 'uint8' },
      { name: 'tier', type: 'uint8' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'tags', type: 'string' },
      { name: 'budget', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
  // getSuperHotListings
  {
    name: 'getSuperHotListings',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      { name: 'ids', type: 'uint256[]' },
      { name: 'total', type: 'uint256' },
    ],
  },
  // getHotListings
  {
    name: 'getHotListings',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      { name: 'ids', type: 'uint256[]' },
      { name: 'total', type: 'uint256' },
    ],
  },
  // getNormalListings
  {
    name: 'getNormalListings',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      { name: 'ids', type: 'uint256[]' },
      { name: 'total', type: 'uint256' },
    ],
  },
  // getListingApplications
  {
    name: 'getListingApplications',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'listingId', type: 'uint256' }],
    outputs: [{ type: 'uint256[]' }],
  },
  // HOT_FEE
  {
    name: 'HOT_FEE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // superHotFee
  {
    name: 'superHotFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // Events
  {
    name: 'ProfileRegistered',
    type: 'event',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'userType', type: 'uint8', indexed: false },
      { name: 'name', type: 'string', indexed: false },
    ],
  },
  {
    name: 'ListingPosted',
    type: 'event',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'tier', type: 'uint8', indexed: false },
      { name: 'listingType', type: 'uint8', indexed: false },
    ],
  },
] as const
