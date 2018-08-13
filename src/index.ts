import * as sleep from 'sleep-promise';
import { createNode } from './node';
import { MessageType } from './peer';

(async () => {
  try {
    console.log('Starting servers');

    const peers = [];
    for (let i = 0; i < 100; i++) {
      const isSeed = (i == 0);
      const seeds = (i == 0 ? [] : [{
        host: 'localhost',
        port: 7000,
      }]);

      peers[i] = await createNode({
        dbFilename: `.data/peer${i}.json`,
        isByzantine: false,
        peerOptions : {
          id: 'peer_' + String(i).padStart(3, '0'),
          host: '127.0.0.1',
          port: 7000 + i,
          isSeed,
          seeds,
        },
      });
    }
    await sleep(1000);

    peers[20].broadcast({
      type: MessageType.Tx,
      channel: 'basechain',
      data: {
        hash: 'abc',
      },
    });

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }

})();
