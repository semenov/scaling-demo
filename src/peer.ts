import * as net from 'net';
import chalk from 'chalk';
import * as readline from 'readline';
import { EventEmitter } from 'events';

interface HostInfo {
  host: string;
  port: number;
}

export interface PeerOptions {
  id: string;
  seeds: HostInfo[];
  host: string;
  port: number;
}

interface RemotePeer {
  id: string;
  channels: string[];
  host: string;
  port: number;
  socket: net.Socket;
}

interface Message {
  senderId?: string;
  channel?: string;
  type: string;
  data: any;
}

type BroadcastFn = (msg: any, channelName?: string) => void;

export enum MessageType {
  Tx = 'tx',
  Peers = 'peers',
  Greeting = 'greeting',
  Block = 'block',
  BlockProposal = 'block_proposal',
  BlockVote = 'block_vote',
}

function decodeMessage(bufffer: Buffer): Message {
  return JSON.parse(bufffer.toString());
}

function encodeMessage(msg: Message): string {
  return JSON.stringify(msg);
}

function makePeerId(socket: net.Socket): string {
  return socket.remoteAddress + ':' + socket.remotePort;
}

function sendMessage(socket: net.Socket, msg: Message) {
  socket.write(encodeMessage(msg) + '\n');
}

function announcePeers(socket: net.Socket, peers: Map<string, RemotePeer>) {
  const peersList = [];
  peers.forEach(peer => {
    peersList.push({
      id: peer.id,
      host: peer.host,
      port: peer.port,
    });
  });

  const msg = {
    type: 'peers',
    data: {
      peers: peersList,
    },
  };

  sendMessage(socket, msg);
}

interface GreetingData {
  peerId: string;
  channels: string[];
  host: string;
  port: number;
}

function sendGreeting(socket: net.Socket, greetingData: GreetingData) {
  const msg = {
    type: MessageType.Greeting,
    data: greetingData,
  };

  sendMessage(socket, msg);
}

export class Peer {
  id: string;
  server: net.Server;
  seeds: HostInfo[];
  host: string;
  port: number;
  peers: Map<string, RemotePeer>;
  channels: string[];
  processedMessages: Set<string>;
  isByzantine: boolean;
  events: EventEmitter;

  constructor(options: PeerOptions) {
    this.id = options.id;
    this.seeds = options.seeds;
    this.host = options.host;
    this.port = options.port;
    this.peers = new Map();
    this.channels = [];
    this.processedMessages = new Set();
    this.events = new EventEmitter();
  }

  async start() {
    this.server = net.createServer(socket => {
      this.log('New incoming connection');
      this.handleConnect(socket);
    });

    return new Promise((resolve, reject) => {
      this.server.on('error', e => {
        reject(e);
      });

      this.server.on('listening', async () => {
        await this.handleStart();
        resolve();
      });

      this.server.listen(this.port, this.host);
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

      socket.on('error', e => {
        reject(e);
      });
    });
  }

  log(...params) {
    console.log(chalk.cyan(`[${this.id}]`), ...params);
  }

  async handleStart() {
    await Promise.all(this.seeds.map(async seed => {
      try {
        await this.connect(seed.host, seed.port);
      } catch (e) {
        console.error('Failed to connect to seed', seed);
      }
    }));
  }

  async handleConnect(socket: net.Socket) {
    sendGreeting(socket, {
      peerId: this.id,
      channels: this.channels,
      host: this.host,
      port: this.port,
    });
    announcePeers(socket, this.peers);

    const rl = readline.createInterface({
      input: socket,
    });

    rl.on('line', async data => {
      try {
        const msg = decodeMessage(data);

        if (msg.type == MessageType.Greeting) {
          this.log('Greeting received', msg);

          const peerId = msg.data.peerId;
          const remotePeer = {
            id: peerId,
            channels: msg.data.channels,
            host: msg.data.host,
            port: msg.data.port,
            socket,
          };
          this.peers.set(peerId, remotePeer);
        } else if (msg.type == MessageType.Peers) {
          this.log('Peers received', msg);

          for (const peer of msg.data.peers) {
            if (peer.id != this.id && !this.peers.has(peer.id)) {
              await this.connect(peer.host, peer.port);
            }
          }
        } else {
          this.handleMessage(msg);
        }
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

    this.events.emit(msg.type, msg, this.broadcast.bind(this));

  }
  async broadcast(msg: Message) {
    for (const [id, remotePeer] of this.peers) {
      const isNewReciever = msg.senderId != remotePeer.id;
      const isWildcard = !msg.channel;
      const isSubscribed = remotePeer.channels.includes(msg.channel);
      const shouldSend = isNewReciever && (isWildcard || isSubscribed);

      if (shouldSend) {
        sendMessage(remotePeer.socket, { ...msg, senderId: this.id });
      }
    }
  }

  subscribeToChannel(channel: string) {
    this.channels.push(channel);
  }

  unsubscribeFromChannel(channel: string) {
    this.channels = this.channels.filter(item => item != channel);
  }

  addMessageListener(
    messageType: MessageType,
    handler: (msg: Message, broadcastFn?: BroadcastFn) => void,
  ) {
    this.events.addListener(messageType, handler);
  }
}
