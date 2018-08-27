import fetch from 'node-fetch';
import * as sleep from 'sleep-promise';

export interface NodeInfo {
  id: number;
  host: string;
  port: number;
  interchangePort: number;
  httpPort: number;
}

export async function downloadNodesInfo(trackerUrl: string): Promise<NodeInfo[]> {
  const response = await fetch(`${trackerUrl}/nodes`);
  const data = await response.json();
  return data.nodes;
}

export async function waitForService(url: string, timeout: number): Promise<void> {
  const startTime = Date.now();
  while (true) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Service timeout ' + url);
    }

    try {
      const response = await fetch(url);
      if (response.status == 200) {
        return;
      }
    } catch (e) {}

    await sleep(50);
  }
}
