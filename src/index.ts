import * as sleep from 'sleep-promise';
import { Node } from './node';
import { Peer } from './peer';
import { MessageType } from './message';
import {
  getChainLeader,
  getChainByNodeId,
  getChainsList,
  isChainLeader,
  getAddressShard,
} from './authority';
import { Tx, TxType } from './tx';
import { Block } from './block';
import { inspect } from 'util';
import { ValueTransfer } from './value-transfer';
import { nodeNumber } from './config';
import { createHash } from 'crypto';
import * as bigInt from 'big-integer';

async function connectToPeers(peer: Peer) {
  const chain = getChainByNodeId(peer.id);
  const id = getChainLeader(chain);
  if (id != peer.id) {
    await peer.connectPeer('localhost', 7000 + id);
  }
}

async function connectToInterchanges(peer: Peer) {
  const nodeChain = getChainByNodeId(peer.id);
  if (isChainLeader(nodeChain, peer.id)) {
    const chains = getChainsList();
    for (const chain of chains) {
      const id = getChainLeader(chain);
      if (id != peer.id) {
        await peer.connectChannelPeer(chain, 'localhost', 8000 + id);
      }
    }
  }
}

function calculateHash(input: string): string {
  const hash = createHash('sha256');
  hash.update(input);
  return hash.digest('hex');
}

function generateFakeAddresses(count: number): string[] {
  const accounts: string[] = [];

  for (let i = 0; i < count; i++) {
    const account = calculateHash(String(i));
    accounts.push(account);
  }

  return accounts;
}

function addAccounts(node: Node, addreses: string[]): void {
  const shardAddresses = addreses.filter(address => {
    return getAddressShard(address) == node.chain;
  });

  shardAddresses.forEach(address => {
    node.accounts.issue(address, bigInt('1000000'));
  });
}

(async () => {
  try {
    console.log('Starting servers');

    const addresses = generateFakeAddresses(100);

    const nodes: Node[] = [];
    for (let i = 0; i < nodeNumber; i++) {
      const node = new Node({
        peerOptions : {
          id: i,
          host: '127.0.0.1',
          port: 7000 + i,
          interchangePort: 8000 + i,
          httpPort: 9000 + i,
        },
      });

      addAccounts(node, addresses);

      await node.start();
      await connectToPeers(node.peer);

      nodes[i] = node;
    }

    const chains = getChainsList();
    for (const chain of chains) {
      const id = getChainLeader(chain);
      await connectToInterchanges(nodes[id].peer);
    }

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }

})();
