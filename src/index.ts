import * as sleep from 'sleep-promise';
import { ShardNode } from './shard-node';
import { Peer } from './peer';
import { MessageType } from './message';
import { getChainLeader, getChainsByNodeId } from './authority';
import { Tx } from './tx';
import { Block } from './block';

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

    const peers: Peer[] = [];
    for (let i = 0; i < 10; i++) {
      const node = new ShardNode({
        peerOptions : {
          id: i,
          host: '127.0.0.1',
          port: 7000 + i,
        },
      });

      await node.start();
      await connectToPeers(node.peer);

      peers[i] = node.peer;
    }
    await sleep(1000);

    const tx = new Tx({
      from: 'Alice',
      to: 'Bob',
      amount: '100',
    });

    tx.sign('Alice');

    // await peers[1].broadcast({
    //   type: MessageType.Tx,
    //   channel: 'shard_0',
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

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }

})();
