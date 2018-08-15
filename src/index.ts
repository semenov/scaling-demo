import * as sleep from 'sleep-promise';
import { createNode } from './node';
import { Peer } from './peer';
import { MessageType } from './message';
import { getChainLeader, getChainsByNodeId } from './authority';

async function connectToPeers(peer: Peer) {
  const chains = getChainsByNodeId(peer.id);
  for (const chain of chains) {
    const id = getChainLeader(chain);
    if (id != peer.id) {
      console.log(peer.id, `await peer.connectPeer('localhost', ${7000 + id})`);
      await peer.connectPeer('localhost', 7000 + id);
    }
  }
}

(async () => {
  try {
    console.log('Starting servers');

    const peers: Peer[] = [];
    for (let i = 0; i < 100; i++) {
      const peer = await createNode({
        peerOptions : {
          id: i,
          host: '127.0.0.1',
          port: 7000 + i,
        },
      });

      await connectToPeers(peer);

      peers[i] = peer;
    }
    await sleep(1000);

    for (let i = 0; i < 100; i++) {
      console.log({ id: i, peersNumer: peers[i].peers.length });
    }

    await peers[11].broadcast({
      type: MessageType.Tx,
      channel: 'shard_1',
      data: {
        hash: 'abc',
      },
    });

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }

})();
