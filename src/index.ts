import * as sleep from 'sleep-promise';
import { Node } from './node';
import { Peer } from './peer';
import { MessageType } from './message';
import { getChainLeader, getChainsByNodeId, getChainsList, isChainLeader } from './authority';
import { Tx, TxType } from './tx';
import { Block } from './block';
import { inspect } from 'util';
import { ValueTransfer } from './value-transfer';
import { nodeNumber } from './config';

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

(async () => {
  try {
    console.log('Starting servers');

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

    const tx = new Tx({
      type: TxType.ValueTransfer,
      data: {
        from: 'Alice',
        to: 'Bob',
        amount: '100',
      },
    });

    (tx.data as ValueTransfer).sign('Alice');
    tx.updateHash();

    await nodes[10].peer.broadcast({
      type: MessageType.Tx,
      channel: 'shard_1',
      data: tx.serialize(),
    });

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

    // while (true) {
    //   await sleep(5000);
    //   console.log(inspect(nodes[9].blocks, false, null));
    // }

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }

})();
