export const INVOICE_ESCROW_ABI = [
  // createInvoice
  {
    name: 'createInvoice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vendor', type: 'address' },
      { name: 'arbitrators', type: 'address[]' },
      { name: 'content', type: 'string' },
      { name: 'milestoneDescs', type: 'string[]' },
      { name: 'milestoneAmounts', type: 'uint256[]' },
      { name: 'milestoneStarts', type: 'uint256[]' },
      { name: 'milestoneDues', type: 'uint256[]' },
    ],
    outputs: [{ name: 'invoiceId', type: 'uint256' }],
  },
  // acceptInvoice
  {
    name: 'acceptInvoice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [],
  },
  // submitMilestone
  {
    name: 'submitMilestone',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'uint256' },
      { name: 'milestoneIndex', type: 'uint256' },
    ],
    outputs: [],
  },
  // approveMilestone
  {
    name: 'approveMilestone',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'uint256' },
      { name: 'milestoneIndex', type: 'uint256' },
    ],
    outputs: [],
  },
  // claimMilestoneAutoRelease
  {
    name: 'claimMilestoneAutoRelease',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'uint256' },
      { name: 'milestoneIndex', type: 'uint256' },
    ],
    outputs: [],
  },
  // openDispute
  {
    name: 'openDispute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'uint256' },
      { name: 'milestoneIndex', type: 'uint256' },
    ],
    outputs: [],
  },
  // voteDispute
  {
    name: 'voteDispute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'uint256' },
      { name: 'milestoneIndex', type: 'uint256' },
      { name: 'favorClient', type: 'bool' },
    ],
    outputs: [],
  },
  // cancelInvoice
  {
    name: 'cancelInvoice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [],
  },
  // getInvoice (view)
  {
    name: 'getInvoice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [
      { name: 'client', type: 'address' },
      { name: 'vendor', type: 'address' },
      { name: 'arbitrators', type: 'address[]' },
      { name: 'content', type: 'string' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'milestoneCount', type: 'uint256' },
    ],
  },
  // getMilestone (view)
  {
    name: 'getMilestone',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'invoiceId', type: 'uint256' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [
      { name: 'description', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'startDate', type: 'uint256' },
      { name: 'dueDate', type: 'uint256' },
      { name: 'submittedAt', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
  },
  // Events
  {
    name: 'InvoiceCreated',
    type: 'event',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'vendor', type: 'address', indexed: true },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'milestoneCount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'MilestoneSubmitted',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'milestoneIndex', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'DisputeOpened',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'milestoneIndex', type: 'uint256', indexed: false },
      { name: 'by', type: 'address', indexed: false },
    ],
  },
  {
    name: 'DisputeResolved',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'milestoneIndex', type: 'uint256', indexed: false },
      { name: 'clientWins', type: 'bool', indexed: false },
    ],
  },
] as const
