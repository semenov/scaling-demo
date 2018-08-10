
export const validators: Map<string, string[]> = new Map();

for (let i = 0; i < 100; i++) {
  const peerId = makePeerId(i);

  if (i % 10 == 0) {
    if (!validators.has('basechain')) {
      validators.set('basechain', []);
    }

    validators.get('basechain').push(peerId);
  }

  const shardNumber = Math.floor(i / 10);
  const shard = 'shard_' + shardNumber;
  if (!validators.has(shard)) {
    validators.set(shard, []);
  }

  validators.get(shard).push(peerId);
}

console.log(validators);

function makePeerId(n: number): string {
  return 'peer_' + String(n).padStart(3, '0');
}

function parseId(stubId: string): number {
  return Number(stubId.match(/[0-9]+/));
}

export function getChainsList(): string[] {
  return Array.from(validators.keys());
}

export function getChainValidators(chain: string): string[] {
  return validators.get(chain);
}

export function isChainValidator(chain: string, id: string): boolean {
  const chainValidators = getChainValidators(chain);
  if (!chainValidators) {
    return false;
  }

  return chainValidators.includes(id);
}

export function isSlotLeader(chain: string, id: string): boolean {
  const chainValidators = getChainValidators(chain);
  if (!chainValidators) {
    return false;
  }

  return chainValidators[0] == id;
}
