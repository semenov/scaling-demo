import * as sleep from 'sleep-promise';
import { nodeNumber } from './config';
import { getChainByNodeId } from './authority';
import fetch from 'node-fetch';

export async function monitorStats() {
  while (true) {
    await sleep(5000);
    console.log('='.repeat(40), '\n');

    for (let i = 0; i < nodeNumber; i += 10) {
      const host = 'localhost';
      const port = 9000 + i;

      const response = await fetch(`http://${host}:${port}/stats`);
      const data = await response.json();

      // get data from node by http
      console.log(data);
      console.log('\n');
    }
  }
}
