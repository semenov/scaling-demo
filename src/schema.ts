export const messageSchema = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    data: { type: 'object' },
    channel: { type: 'string' },
  },
  required: ['type', 'data', 'channel'],
};

export const txSchema = {
  type: 'object',
  properties: {
    from: { type: 'string' },
    to: { type: 'string' },
    amount: { type: 'string' },
    signature: { type: 'string' },
    hash: { type: 'string' },
  },
  required: ['from', 'to', 'amount', 'signature', 'hash'],
};

const blockHeaderSchema = {
  type: 'object',
  properties: {
    chain: { type: 'string' },
    parentBlockHash: { type: 'string' },
    timestamp: { type: 'number' },
    height: { type: 'number' },
  },
  required: ['chain', 'parentBlockHash', 'timestamp', 'height'],
};

const blockBodySchema = {
  type: 'object',
  properties: {
    txs: {
      type: 'array',
      items: txSchema,
    },
  },
  required: ['txs'],
};

const blockSignatureSchema = {
  type: 'object',
  properties: {
    publicKey: { type: 'string' },
    signature: { type: 'string' },
  },
  required: ['publicKey', 'signature'],
};

export const blockSchema = {
  type: 'object',
  properties: {
    header: blockHeaderSchema,
    body: blockBodySchema,
    signatures: {
      type: 'array',
      items: blockSignatureSchema,
    },
    hash: { type: 'string' },
  },
  required: ['header', 'body', 'signatures', 'hash'],
};

export const blockVoteSchema = {
  type: 'object',
  properties: {
    blockProposalHash: { type: 'string' },
    signature: { type: 'string' },
  },
  required: ['blockProposalHash', 'signature'],
};
