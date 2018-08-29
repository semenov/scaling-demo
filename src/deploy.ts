import * as sleep from 'sleep-promise';
import { nodeCount } from './config';
import { NodeInfo, waitForService } from './common';
import fetch from 'node-fetch';
import { monitorStats } from './monitor-stats';
import { createServer, runCommand } from './server-management';

/*
Как должно быть для ускорения дебага:
1. Cоздаем необходимое количество инстансов в параллели. Ставим на них ноду
2. Чистим все истансы, убиваем нодовские процессы. Клоним репу
3. Атомарно распределяем инстансы под разные нужды
4. Поочередно запускаем на инстансах необходимые приложения
*/

async function deployNode(id: number): Promise<NodeInfo> {
  const host = await createServer() || '';
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

async function startNode(nodeInfo: NodeInfo, trackerUrl: string): Promise<void> {
  const env = {
    NODE_ID: nodeInfo.id,
    HOST: '0.0.0.0',
    PORT: nodeInfo.port,
    INTERCHANGE_PORT: nodeInfo.interchangePort,
    HTTP_PORT: nodeInfo.httpPort,
    TRACKER_URL: trackerUrl,
  };

  console.log('Starting node', nodeInfo.id);
  runCommand(nodeInfo.host, 'node', env);

  await waitForService(`http://${nodeInfo.host}:${nodeInfo.httpPort}/status`, 20000);
}

async function deployTracker(): Promise<string> {
  const host = await createServer();
  const port = 6000;

  const env = {
    HOST: '0.0.0.0',
    PORT: port,
  };

  runCommand(host, 'tracker', env);

  const url = `http://${host}:${port}`;
  await waitForService(url + '/status', 20000);
  return url;
}

async function deployTxGenerator(trackerUrl: string): Promise<void> {
  const host = await createServer();
  const env = {
    TRACKER_URL: trackerUrl,
  };

  runCommand(host, 'tx-gen', env);
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
    process.stderr.setMaxListeners(1000);
    process.stdout.setMaxListeners(1000);
    console.log('Starting servers');

    console.log('Deploying tracker');
    const trackerUrl = await deployTracker();

    console.log('Deploying nodes');
    const nodes: NodeInfo[] = [];
    const nodePromises: Promise<any>[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const nodePromise = (async() => {
        const nodeInfo = await deployNode(i);
        nodes.push(nodeInfo);
      })();
      nodePromises.push(nodePromise);
    }

    await Promise.all(nodePromises);

    console.log(nodes);

    console.log('Sending info to tracker');
    await sendNodesInfoToTracker(nodes, trackerUrl);

    console.log('Starting nodes');
    const startNodePromises: Promise<any>[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const startNodePromise = startNode(nodes[i], trackerUrl);
      startNodePromises.push(startNodePromise);
    }

    await Promise.all(startNodePromises);

    console.log('Deploying tx generator');
    await deployTxGenerator(trackerUrl);

    console.log('Monitoring stats');
    await monitorStats(trackerUrl);

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }
}

deploy();
