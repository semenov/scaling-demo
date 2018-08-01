import * as net from 'net';
import chalk from 'chalk';
import * as readline from 'readline';
import * as uuid from 'uuid/v4';

interface HostInfo {
  host: string;
  port: number;
}

interface PeerOptions {
  name: string;
  seeds: HostInfo[];
  port: number;
  channels: string[];
}

interface RemotePeer {
  id: string;
  channels: string[];
  socket: net.Socket;
}

interface Message {
  id: string;
  channel?: string;
  type: string;
  data: any;
}

function decodeMessage(bufffer) {
  return JSON.parse(bufffer.toString());
}

function encodeMessage(msg) {
  return JSON.stringify(msg);
}

function makePeerId(socket: net.Socket): string {
  return socket.remoteAddress + ':' + socket.remotePort;
}

class PeerNode {
  name: string;
  server: net.Server;
  seeds: HostInfo[];
  port: number;
  peers: Map<string, RemotePeer>;
  channels: string[];
  processedMessages: Set<string>;

  constructor(options: PeerOptions) {
    this.name = options.name;
    this.seeds = options.seeds;
    this.port = options.port;
    this.peers = new Map();
    this.channels = options.channels;
    this.processedMessages = new Set();
  }

  async start() {
    this.server = net.createServer((socket) => {
      this.log('New incoming connection');
      this.handleConnect(socket);
    });

    return new Promise((resolve, reject) => {
      this.server.on('error', (e) => {
        reject(e);
      });

      this.server.on('listening', async () => {
        await this.handleStart();
        resolve();
      });

      this.server.listen(this.port);
    });
  }

  async connect(host, port) {
    return new Promise((resolve, reject) => {
      const socket = net.connect(port, host);

      socket.on('connect', async () => {
        this.log('New outgoing connection');
        this.handleConnect(socket);
        resolve();
      });

      socket.on('error', (e) => {
        reject(e);
      });
    });
  }

  log(...params) {
    console.log(chalk.cyan(this.name), ...params);
  }

  async handleStart() {
    await Promise.all(this.seeds.map(async (seed) => {
      try {
        await this.connect(seed.host, seed.port);
      } catch (e) {
        console.error('Failed to connect to seed', seed);
      }
    }));
  }

  async handleConnect(socket: net.Socket) {
    const peerId = makePeerId(socket);
    const remotePeer = {
      id: peerId,
      channels: [],
      socket,
    };
    this.peers.set(peerId, remotePeer);

    const rl = readline.createInterface({
      input: socket,
    });

    rl.on('line', (data) => {
      try {
        const msg = decodeMessage(data);
        this.handleMessage(msg);
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('end', () => {
      this.log('Peer disconnected');
    });
  }

  async handleMessage(msg: Message) {
    this.log('Message handler', msg);

    if (this.processedMessages.has(msg.id)) {
      this.log('Message already processed');
      return;
    }

    if (msg.type == 'tx') {
      this.broadcast(msg);
    }

  }

  async send(peer: RemotePeer, msg: Message) {
    this.processedMessages.add(msg.id);
    peer.socket.write(encodeMessage(msg) + '\n');
  }

  async broadcast(msg: any, channelName?: string) {
    for (const [id, remotePeer] of this.peers) {
      const shouldSend = !channelName || remotePeer.channels.includes(channelName);

      if (shouldSend) {
        this.send(remotePeer, msg);
      }
    }
  }

  async subscribe(channelName: string, handler: (msg) => void) {

  }
}

function sleep(timeInMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), timeInMs);
  });
}

(async () => {
  try {
    console.log('Starting servers');
    const seedPeer = new PeerNode({
      name: 'Peer #00',
      port: 7000,
      seeds: [],
      channels: [],
    });
    await seedPeer.start();

    const peers = [seedPeer];
    for (let i = 1; i < 100; i++) {
      const peer = new PeerNode({
        name: 'Peer #' + String(i).padStart(2, '0'),
        port: 7000 + i,
        seeds: [{
          host: 'localhost',
          port: 7000,
        }],
        channels: [],
      });
      peers[i] = peer;
      await peer.start();

    }
    await sleep(3000);

    peers[3].broadcast({
      id: uuid(),
      type: 'tx',
      data: 'Some data on new tx' ,
    });

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }

})();
