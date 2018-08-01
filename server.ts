import * as net from 'net';

interface HostInfo {
  host: string;
  port: number;
}

interface PeerOptions {
  seeds: HostInfo[];
  port: number;
  channels: string[];
}

interface RemotePeer {
  id: string;
  channels: string[];
  socket: net.Socket;
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
  server: net.Server;
  seeds: HostInfo[];
  port: number;
  peers: Map<string, RemotePeer>;
  channels: string[];

  constructor(options: PeerOptions) {
    this.seeds = options.seeds;
    this.port = options.port;
    this.peers = new Map();
    this.channels = options.channels;
  }

  async start() {
    this.server = net.createServer((socket) => {
      console.log('New incoming connection');
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
        console.log('New outgoing connection');
        this.handleConnect(socket);
        resolve();
      });

      socket.on('error', (e) => {
        reject(e);
      });
    });
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

  async handleConnect(socket) {
    const peerId = makePeerId(socket);
    const remotePeer = {
      id: peerId,
      channels: [],
      socket,
    };
    this.peers.set(peerId, remotePeer);

    socket.on('data', (data) => {
      console.log('Data recieved:', data);
      try {
        const msg = decodeMessage(data);
        this.handleMessage(msg);
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('end', () => {
      console.log('Peer disconnected');
    });
  }

  async handleMessage(msg) {
    console.log('Message handler', msg);
  }

  async send(peer, msg) {
    peer.write(encodeMessage(msg));
  }

  async broadcast(msg: any, channelName?: string) {
    for (const [k, v] of this.peers) {
      const shouldSend = !channelName || v.channels.includes(channelName);

      if (shouldSend) {
        this.send(v, msg);
      }
    }
  }

  async subscribe(channelName: string, handler: (msg) => void) {

  }
}

(async () => {
  try {
    console.log('Starting servers');
    const peer = new PeerNode({
      port: 7777,
      seeds: [],
      channels: [],
    });
    await peer.start();

    const peer2 = new PeerNode({
      port: 7778,
      seeds: [{
        host: 'localhost',
        port: 7777,
      }],
      channels: [],
    });
    await peer2.start();

    const peer3 = new PeerNode({
      port: 7779,
      seeds: [{
        host: 'localhost',
        port: 7777,
      }],
      channels: [],
    });
    await peer3.start();

    console.log('Ready');
  } catch (e) {
    console.error('Error!:', e);
  }

})();
