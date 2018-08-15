export const messageSchema = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    data: { type: 'object' },
    senderId: { type: 'string' },
    channel: { type: 'string' },
  },
};

export const greetingSchema = {
  peerId: { type: 'string' },
  channels: {
    type: 'array',
    items: {
      type: 'string',
    },
  },
  host: { type: 'string' },
  port: { type: 'number' },
};

export const peersSchema = {
  peers: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        host: { type: 'string' },
        port: { type: 'number' },
        channels: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
  },
};
