import { nodeNumber } from './config';
import { createHash } from 'crypto';
import * as bigInt from 'big-integer';

export const validators: Map<string, number[]> = new Map();

for (let i = 0; i < nodeNumber; i++) {
  const peerId = i;
  const chain = getChainsByNodeId(peerId);

  const peers = validators.get(chain);
  if (peers) {
    peers.push(peerId);
  } else {
    validators.set(chain, [peerId]);
  }
}

export function getChainsByNodeId(id: number): string {
  const shardNumber = Math.floor(id / 10);
  const chain = id < 10 ? 'basechain' : 'shard_' + shardNumber;

  return chain;
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

export function isChainValidator(chain: string, id: number): boolean {
  const chainValidators = getChainValidators(chain);
  if (!chainValidators) {
    return false;
  }

  return chainValidators.includes(id);
}

export function isChainLeader(chain: string, id: number): boolean {
  const chainValidators = getChainValidators(chain);
  if (!chainValidators) {
    return false;
  }

  return chainValidators[0] == id;
}

export function getAddressShard(address: string): string {
  const shardCount = getChainsList().length - 1;
  const hash = createHash('sha256');
  hash.update(address);
  const addressHashString = hash.digest('hex');
  const addressHash = bigInt(addressHashString, 16);
  const shardNumber = addressHash.remainder(shardCount);

  return 'shard_' + shardNumber;
}
