import * as sleep from 'sleep-promise';
import { Node } from './node';
import { Peer } from './peer';
import { MessageType } from './message';
import { getChainLeader, getChainsByNodeId } from './authority';
import { Tx, TxType } from './tx';
import { Block } from './block';
import { inspect } from 'util';
import { ValueTransfer } from './value-transfer';

async function connectToPeers(peer: Peer) {
  const chains = getChainsByNodeId(peer.id);
  for (const chain of chains) {
    const id = getChainLeader(chain);
    if (id != peer.id) {
      await peer.connectPeer('localhost', 7000 + id);
    }
  }
}

(async () => {
  try {
    console.log('Starting servers');

    const nodes: Node[] = [];
    for (let i = 0; i < 10; i++) {
      const node = new Node({
        peerOptions : {
          id: i,
          host: '127.0.0.1',
          port: 7000 + i,
        },
      });

      await node.start();
      await connectToPeers(node.peer);

      nodes[i] = node;
    }
    await sleep(1000);

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

    await nodes[1].peer.broadcast({
      type: MessageType.Tx,
      channel: 'shard_0',
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

    while (true) {
      await sleep(5000);
      console.log(inspect(nodes[9].blocks, false, null));
    }

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }

})();
