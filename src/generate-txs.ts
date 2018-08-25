import { fakeAddresses } from './stubs';
import { getAddressShard, getChainLeader } from './authority';
import fetch from 'node-fetch';
import * as sleep from 'sleep-promise';
import { TxType, Tx } from './tx';
import { ValueTransfer } from './value-transfer';

function getRandomAddress(addresses: string[]): string {
  const index = Math.floor(Math.random() * addresses.length);

  return addresses[index];
}

async function generateTxs() {
  while (true) {
    await sleep(1);
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

    const host = 'localhost';
    const port = 9000 + id;

    try {
      // console.log(`Sending tx to ${host}:${port}`, tx);
      await fetch(`http://${host}:${port}/txs`, {
        method: 'POST',
        body:    JSON.stringify(tx.serialize()),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error(e);
    }

  }
}

generateTxs().catch(e => console.error(e));
