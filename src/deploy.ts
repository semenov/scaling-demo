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
import { nodeNumber } from './config';

import * as bigInt from 'big-integer';
import { fakeAddresses } from './stubs';
import { NodeInfo } from './common';
import fetch from 'node-fetch';
import { monitorStats } from './monitor-stats';
import { exec, spawn } from 'child_process';

async function deployNode(id: number, trackerUrl: string): Promise<NodeInfo> {
  const host = 'localhost';
  const port = 7000 + id;
  const interchangePort = 8000 + id;
  const httpPort = 9000 + id;

  return {
    id,
    host,
    port,
    interchangePort,
    httpPort,
  };
}

async function waitForService(url: string, timeout: number): Promise<void> {
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

    sleep(50);
  }
}

async function startNode(nodeInfo: NodeInfo, trackerUrl: string): Promise<void> {
  const env = {
    HOST: nodeInfo.host,
    PORT: nodeInfo.port,
    INERCHANGE_PORT: nodeInfo.interchangePort,
    HTTP_PORT: nodeInfo.httpPort,
    TRACKER_URL: trackerUrl,
  };

  spawn('npm', ['run', 'node'], { env: { ...process.env, ...env } }).stderr.pipe(process.stderr);
}

async function deployTracker(): Promise<string> {
  spawn('npm', ['run', 'tracker']).stderr.pipe(process.stderr);

  const url = 'http://localhost:6000';
  await waitForService(url + '/status', 1000);
  return url;
}

async function deployTxGenerator(trackerUrl: string): Promise<void> {
  const env = {
    TRACKER_URL: trackerUrl,
  };

  spawn('npm', ['run', 'tx-gen'], { env: { ...process.env, ...env } }).stderr.pipe(process.stderr);
}

async function sendNodesInfoToTracker(nodes: NodeInfo[], trackerUrl: string) {
  await fetch(`${trackerUrl}/nodes`, {
    method: 'POST',
    body: JSON.stringify({ nodes }),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function deploy() {
  try {
    console.log('Starting servers');

    console.log('Deploying tracker');
    const trackerUrl = await deployTracker();

    console.log('Deploying nodes');
    const nodes: NodeInfo[] = [];
    for (let i = 0; i < nodeNumber; i++) {
      const nodeInfo = await deployNode(i, trackerUrl);
      nodes.push(nodeInfo);
    }

    console.log(nodes);

    console.log('Sending info to tracker');
    await sendNodesInfoToTracker(nodes, trackerUrl);

    // console.log('Starting nodes');
    // for (let i = 0; i < nodeNumber; i++) {
    //   await startNode(nodes[i], trackerUrl);
    // }

    // console.log('Deploying tx generator');
    // await deployTxGenerator(trackerUrl);

    // console.log('Monitoring stats');
    // await monitorStats();

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }
}

deploy();
