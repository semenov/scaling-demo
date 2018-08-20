
export const validators: Map<string, number[]> = new Map();

for (let i = 0; i < 100; i++) {
  const peerId = i;

  // if (i % 10 == 0) {
  //   if (!validators.has('basechain')) {
  //     validators.set('basechain', []);
  //   }

  //   validators.get('basechain').push(peerId);
  // }

  const shardNumber = Math.floor(i / 10);
  const shard = 'shard_' + shardNumber;

  const peers = validators.get(shard);
  if (peers) {
    peers.push(peerId);
  } else {
    validators.set(shard, [peerId]);
  }
}

export function getChainsList(): string[] {
  return Array.from(validators.keys());
}

export function getChainValidators(chain: string): number[] {
  return validators.get(chain) || [];
}

export function getChainLeader(chain: string): number {
  return getChainValidators(chain)[0];
}

export function getChainsByNodeId(id: number): string[] {
  // const chains = [];
  // if (id % 10 == 0) {
  //   chains.push('basechain');
  // }

  const shardNumber = Math.floor(id / 10);
  const shard = 'shard_' + shardNumber;

  return [shard];
}

export function isChainValidator(chain: string, id: number): boolean {
  const chainValidators = getChainValidators(chain);
  if (!chainValidators) {
    return false;
  }

  return chainValidators.includes(id);
}

export function isSlotLeader(chain: string, id: number): boolean {
  const chainValidators = getChainValidators(chain);
  if (!chainValidators) {
    return false;
  }

  return chainValidators[0] == id;
}
