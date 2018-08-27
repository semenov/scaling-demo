import * as sleep from 'sleep-promise';
import { Node } from './node';
import { Peer } from './peer';
import {
  getChainLeader,
  getChainByNodeId,
  getChainsList,
  isChainLeader,
  getAddressShard,
} from './authority';
import * as bigInt from 'big-integer';
import { fakeAddresses } from './stubs';
import { downloadNodesInfo, waitForService, getNodeInfo, NodeInfo } from './common';

let nodes: NodeInfo[] = [];

async function connectToPeers(peer: Peer) {
  const chain = getChainByNodeId(peer.id);
  const id = getChainLeader(chain);
  if (id != peer.id) {
    const nodeInfo = getNodeInfo(nodes, id);
    if (nodeInfo) {
      await peer.connectPeer(nodeInfo.host, nodeInfo.port);
    }
  }
}

async function connectToInterchanges(peer: Peer) {
  const nodeChain = getChainByNodeId(peer.id);
  if (isChainLeader(nodeChain, peer.id)) {
    const chains = getChainsList();
    for (const chain of chains) {
      const id = getChainLeader(chain);
      if (id != peer.id) {
        const nodeInfo = getNodeInfo(nodes, id);
        if (nodeInfo) {
          (async () => {
            try {
              await waitForService(`http://${nodeInfo.host}:${nodeInfo.httpPort}/status`, 60000);
              await peer.connectChannelPeer(chain, nodeInfo.host, nodeInfo.interchangePort);
            } catch (e) {
              console.error('Peer interchange error', peer.id, e);
            }
          })();
        }
      }
    }
  }
}

function addAccounts(node: Node, addreses: string[]): void {
  const shardAddresses = addreses.filter(address => {
    return getAddressShard(address) == node.chain;
  });

  shardAddresses.forEach(address => {
    node.accounts.issue(address, bigInt('1000000'));
  });
}

async function run() {
  try {
    console.log('Starting server');

    if (process.env['NODE_ID'] === undefined) {
      console.error('You should specify NODE_ID env variable');
      return;
    }

    if (process.env['HOST'] === undefined) {
      console.error('You should specify HOST env variable');
      return;
    }

    if (process.env['PORT'] === undefined) {
      console.error('You should specify PORT env variable');
      return;
    }

    if (process.env['INTERCHANGE_PORT'] === undefined) {
      console.error('You should specify INTERCHANGE_PORT env variable');
      return;
    }

    if (process.env['HTTP_PORT'] === undefined) {
      console.error('You should specify HTTP_PORT env variable');
      return;
    }

    if (process.env['TRACKER_URL'] === undefined) {
      console.error('You should specify TRACKER_URL env variable');
      return;
    }

    const id = Number(process.env['NODE_ID']);
    const host = String(process.env['HOST']);
    const port = Number(process.env['PORT']);
    const interchangePort = Number(process.env['INTERCHANGE_PORT']);
    const httpPort = Number(process.env['HTTP_PORT']);
    const trackerUrl = String(process.env['TRACKER_URL']);

    nodes = await downloadNodesInfo(trackerUrl);

    const node = new Node({
      peerOptions : {
        id,
        host,
        port,
        interchangePort,
        httpPort,
      },
    });

    addAccounts(node, fakeAddresses);

    await node.start();
    await connectToPeers(node.peer);

    const chains = getChainsList();
    for (const chain of chains) {
      const leaderId = getChainLeader(chain);
      if (id == leaderId) {
        await connectToInterchanges(node.peer);
      }
    }

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }
}

run();
