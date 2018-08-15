import * as net from 'net';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import { RemotePeerStorage, PeerAddResult, RemotePeer } from './remote-peer-storage';
import { Message, MessageType, sendMessage, listenMessages } from './message';
import { validateSchema } from './validation';
import { greetingSchema, peersSchema, messageSchema } from './schema';

interface HostInfo {
  host: string;
  port: number;
}

function announcePeers(socket: net.Socket, peers: RemotePeer[]) {
  const peersList = peers.map(peer => ({
    id: peer.id,
    host: peer.host,
    port: peer.port,
    channels: peer.channels,
  }));

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

function startServer(
  host: string,
  port: number,
  connectHandler: (socket: net.Socket) => void,
): Promise<net.Server> {
  const server = net.createServer(connectHandler);

  return new Promise((resolve, reject) => {
    server.on('error', e => {
      reject(e);
    });

    server.on('listening', async () => {
      resolve(server);
    });

    server.listen(port, host);
  });
}

function connectPeer(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host);

    socket.on('connect', async () => {
      resolve(socket);
    });

    socket.on('error', e => {
      reject(e);
    });
  });
}

type MessageHandler = (msg: Message, socket: net.Socket) => void;

export interface PeerOptions {
  id: string;
  isSeed: boolean;
  seeds: HostInfo[];
  host: string;
  port: number;
}

export class Peer {
  id: string;
  server: net.Server;
  seeds: HostInfo[];
  host: string;
  port: number;
  peers: RemotePeerStorage;
  channels: string[];
  processedMessages: Set<string>;
  isByzantine: boolean;
  isSeed: boolean;
  messageHandlers: Map<MessageType, MessageHandler>;

  constructor(options: PeerOptions) {
    this.id = options.id;
    this.isSeed = options.isSeed;
    this.seeds = options.seeds;
    this.host = options.host;
    this.port = options.port;
    this.peers = new RemotePeerStorage({ channelLimit: 10 });
    this.channels = [];
    this.processedMessages = new Set();
    this.messageHandlers = new Map();

    this.setMessageHandler(MessageType.Greeting, this.handleGreetingMessage);
    this.setMessageHandler(MessageType.Peers, this.handlePeersMessage);
  }

  async start() {
    this.server = await startServer(this.host, this.port, this.handleConnect);
    await this.connectToSeeds();
  }

  async connectSeed(host: string, port: number): Promise<void> {
    const socket = await connectPeer(host, port);
    await this.handleConnect(socket);
  }

  async connectPeer(peer: RemotePeer): Promise<void> {
    this.peers.addPeer(peer);
    const socket = await connectPeer(peer.host, peer.port);
    await this.handleConnect(socket);
  }

  log(...params) {
    if (this.id !== 'peer_099') return;

    console.log(chalk.cyan(`[${this.id}]`), ...params);
  }

  private async connectToSeeds(): Promise<void> {
    for (const seed of this.seeds) {
      try {
        await this.connectSeed(seed.host, seed.port);
      } catch (e) {
        console.error('Failed to connect to seed', seed);
      }
    }
  }

  private handleConnect = async (socket: net.Socket) => {
    listenMessages(socket, this.handleMessage);

    sendGreeting(socket, {
      peerId: this.id,
      channels: this.channels,
      host: this.host,
      port: this.port,
    });

    if (this.isSeed) {
      announcePeers(socket, this.peers.getAllPeers());
    }
  }

  private handleGreetingMessage = async (msg: Message, socket: net.Socket) => {
    // validateSchema(greetingSchema, msg.data);

    const peerId = msg.data.peerId;
    const remotePeer = {
      id: peerId,
      channels: msg.data.channels,
      host: msg.data.host,
      port: msg.data.port,
      socket,
    };
    const addResult = this.peers.addPeer(remotePeer);

    if (addResult == PeerAddResult.Rejected) {
      socket.destroy();
    }

    socket.on('close', () => {
      this.peers.removePeer(peerId);
    });
  }

  private handlePeersMessage = async (msg: Message) => {
    // validateSchema(peersSchema, msg.data);

    for (const peer of msg.data.peers) {
      if (peer.id != this.id) {
        // This check is broken
        if (!this.peers.hasPeer(peer.id)) {
          await this.connectPeer(peer);
        }
      }
    }
  }

  private handleMessage = async (msg: Message, socket: net.Socket) => {
    this.log('Message handler', msg);
    const messageHandler = this.messageHandlers.get(msg.type as MessageType);

    if (messageHandler) {
      await messageHandler(msg, socket);
    }
  }

  async broadcast(msg: Message) {
    const channel = msg.channel;
    const peers = channel ? this.peers.getPeersByChannel(channel) : this.peers.getAllPeers();

    for (const remotePeer of peers) {
      if (msg.senderId != remotePeer.id) {
        sendMessage(remotePeer.socket, { ...msg, senderId: this.id });
      }
    }
  }

  subscribeToChannel(channel: string) {
    this.channels.push(channel);
    this.peers.addChannel(channel);
  }

  unsubscribeFromChannel(channel: string) {
    this.channels = this.channels.filter(item => item != channel);
  }

  setMessageHandler(messageType: MessageType, handler: MessageHandler) {
    this.messageHandlers.set(messageType, handler);
  }
}
