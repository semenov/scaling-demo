import * as sleep from 'sleep-promise';
import { nodeCount, txGeneratorsCount } from './config';
import { NodeInfo, waitForService } from './common';
import fetch from 'node-fetch';
import { monitorStats } from './monitor-stats';
import { createServer, runCommand, prepareServer, Driver } from './server-management';
import { AWSDriver } from './aws-driver';
import { GCEDriver } from './gce-driver';

/*
Как должно быть для ускорения дебага:
1. Cоздаем необходимое количество инстансов в параллели. Ставим на них ноду
2. Чистим все истансы, убиваем нодовские процессы. Клоним репу
3. Атомарно распределяем инстансы под разные нужды
4. Поочередно запускаем на инстансах необходимые приложения
*/

async function reserveServers(driver: Driver): Promise<string[]> {
  const serverCount = nodeCount + 1 + txGeneratorsCount; // Nodes plus tracker and tx gen
  const existingIps = await driver.getRunningServers();
  const createServerCount = serverCount - existingIps.length;

  const serverPromises: Promise<string>[] = [];
  for (let i = 0; i < createServerCount; i++) {
    const serverPromise = createServer(driver);
    serverPromises.push(serverPromise);
    await sleep(500);
  }
  const newIps = await Promise.all(serverPromises);
  const ips = [...existingIps, ...newIps];

  return ips;
}

async function prepareServers(driver: Driver, ips: string[]): Promise<void> {
  const promises = ips.map(ip => prepareServer(driver, ip));
  await Promise.all(promises);
}

function constructNodeInfo(host: string, id: number): NodeInfo {
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

async function startNode(driver: Driver, nodeInfo: NodeInfo, trackerUrl: string): Promise<void> {
  const env = {
    NODE_ID: nodeInfo.id,
    HOST: '0.0.0.0',
    PORT: nodeInfo.port,
    INTERCHANGE_PORT: nodeInfo.interchangePort,
    HTTP_PORT: nodeInfo.httpPort,
    TRACKER_URL: trackerUrl,
  };

  console.log('Starting node', nodeInfo.id);
  runCommand(driver, nodeInfo.host, 'node', env);

  await waitForService(`http://${nodeInfo.host}:${nodeInfo.httpPort}/status`, 60000);
}

async function startTracker(driver: Driver, host: string): Promise<string> {
  const port = 6000;

  const env = {
    HOST: '0.0.0.0',
    PORT: port,
  };

  runCommand(driver, host, 'tracker', env);

  const url = `http://${host}:${port}`;
  await waitForService(url + '/status', 20000);
  return url;
}

async function startTxGenerator(driver: Driver, host: string, trackerUrl: string): Promise<void> {
  const env = {
    TRACKER_URL: trackerUrl,
  };
  console.log('Strting tx gen', host);
  runCommand(driver, host, 'tx-gen', env);
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
    const driver = new GCEDriver();

    console.log('Reserving servers');
    const ips = await reserveServers(driver);

    console.log('Preparing servers');
    await prepareServers(driver, ips);

    console.log('Starting servers');

    console.log('Starting tracker');
    const trackerUrl = await startTracker(driver, ips.pop() as string);

    const nodes: NodeInfo[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const nodeInfo = await constructNodeInfo(ips.pop() as string, i);
      nodes.push(nodeInfo);
    }

    console.log(nodes);

    console.log('Sending info to tracker');
    await sendNodesInfoToTracker(nodes, trackerUrl);

    console.log('Starting nodes');
    const startNodePromises: Promise<any>[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const startNodePromise = startNode(driver, nodes[i], trackerUrl);
      startNodePromises.push(startNodePromise);
      await sleep(50);
    }

    await Promise.all(startNodePromises);

    console.log('Starting tx generators');
    for (let i = 0; i < txGeneratorsCount; i++) {
      await startTxGenerator(driver, ips.pop() as string, trackerUrl);
      await sleep(50);
    }

    console.log('Monitoring stats');
    await monitorStats(trackerUrl);

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }
}

deploy();
