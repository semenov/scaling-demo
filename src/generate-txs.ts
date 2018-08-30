import { fakeAddresses } from './stubs';
import { getAddressShard, getChainLeader } from './authority';
import fetch from 'node-fetch';
import * as sleep from 'sleep-promise';
import { TxType, Tx } from './tx';
import { ValueTransfer } from './value-transfer';
import { downloadNodesInfo, getNodeInfo, NodeInfo } from './common';

function getRandomAddress(addresses: string[]): string {
  const index = Math.floor(Math.random() * addresses.length);

  return addresses[index];
}

async function generateTxs() {
  if (process.env['TRACKER_URL'] === undefined) {
    console.error('You should specify TRACKER_URL env variable');
    return;
  }
  const trackerUrl = String(process.env['TRACKER_URL']);
  const nodes = await downloadNodesInfo(trackerUrl);

  while (true) {
    await sleep(10);
    const from = getRandomAddress(fakeAddresses);
    const to = getRandomAddress(fakeAddresses);
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

    const nodeInfo = getNodeInfo(nodes, id);

    if (!nodeInfo) {
      console.error('Node not found', id);
      continue;
    }

    const host = nodeInfo.host;
    const port = nodeInfo.httpPort;

    try {
      console.time('tx');
      fetch(`http://${host}:${port}/txs`, {
        method: 'POST',
        body:    JSON.stringify(tx.serialize()),
        headers: { 'Content-Type': 'application/json' },
      });
      console.timeEnd('tx');
    } catch (e) {
      console.error(e);
    }

  }
}

generateTxs().catch(e => console.error(e));
