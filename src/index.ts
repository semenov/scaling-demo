import * as sleep from 'sleep-promise';
import { Node } from './node';
import { Peer } from './peer';
import { MessageType } from './message';
import {
  getChainLeader,
  getChainsByNodeId,
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
  const chain = getChainsByNodeId(peer.id);
  const id = getChainLeader(chain);
  if (id != peer.id) {
    await peer.connectPeer('localhost', 7000 + id);
  }
}

async function connectToInterchanges(peer: Peer) {
  const nodeChain = getChainsByNodeId(peer.id);
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

function getRandomAddress(addresses: string[]): string {
  const index = Math.floor(Math.random() * addresses.length);

  return addresses[index];
}

async function generateTxs(nodes: Node[], addresses: string[]) {
  while (true) {
    await sleep(10);
    const from = getRandomAddress(addresses);
    const to = getRandomAddress(addresses);
    const senderShard = getAddressShard(from);
    const id = getChainLeader(senderShard);
    const tx = new Tx({
      type: TxType.ValueTransfer,
      data: {
        from,
        to,
        amount: '1',
      },
    });

    (tx.data as ValueTransfer).sign(from);
    tx.updateHash();

    await nodes[id + 1].peer.broadcast({
      type: MessageType.Tx,
      channel: senderShard,
      data: tx.serialize(),
    });
  }

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

    await sleep(5000);

    generateTxs(nodes, addresses).catch(e => console.error(e));

    // const tx = new Tx({
    //   type: TxType.ValueTransfer,
    //   data: {
    //     from: 'Alice',
    //     to: 'Bob',
    //     amount: '100',
    //   },
    // });

    // (tx.data as ValueTransfer).sign('Alice');
    // tx.updateHash();

    // await nodes[10].peer.broadcast({
    //   type: MessageType.Tx,
    //   channel: 'shard_1',
    //   data: tx.serialize(),
    // });

    // const block = new Block({
    //   header: {
    //     parentBlockHash: '',
    //     height: 1,
    //     timestamp: Date.now(),
    //     chain: 'shard_0',
    //   },
    //   body: {
    //     txs: [tx.serialize()],
    //   },
    //   signatures: [],
    // });

    // block.sign('validator1');

    // await peers[1].broadcast({
    //   type: MessageType.Block,
    //   channel: 'shard_0',
    //   data: block.serialize(),
    // });

    while (true) {
      await sleep(5000);
      console.log(inspect(nodes[10].blocks.getLast(), false, null));
      console.log('Pending txs', nodes[20].pendingTransactions.size);
    }

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }

})();
