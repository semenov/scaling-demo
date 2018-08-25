import fetch from 'node-fetch';

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
