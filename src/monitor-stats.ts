import * as sleep from 'sleep-promise';
import { getChainByNodeId, getChainsList, getChainLeader } from './authority';
import fetch from 'node-fetch';
import { downloadNodesInfo, getNodeInfo } from './common';

export async function monitorStats(trackerUrl) {
  while (true) {
    await sleep(5000);
    console.log('='.repeat(40), '\n');

    const chains = getChainsList();
    const nodes = await downloadNodesInfo(trackerUrl);

    for (const chain of chains) {
      const id = getChainLeader(chain);
      const nodeInfo = getNodeInfo(nodes, id);

      if (!nodeInfo) {
        console.error('Node not found', id);
        continue;
      }

      const host = nodeInfo.host;
      const port = nodeInfo.httpPort;

      const response = await fetch(`http://${host}:${port}/stats`);
      const data = await response.json();

      console.log(data);
      console.log('\n');
    }
  }
}
