import * as net from 'net';
import chalk from 'chalk';
import { Message, MessageType, sendMessage, listenMessages } from './message';
import * as objectHash from 'object-hash';

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
  id: number;
  host: string;
  port: number;
  interchangePort: number;
}

export class Peer {
  id: number;
  server: net.Server;
  host: string;
  port: number;
  interchangePort: number;
  interchangeServer: net.Server;
  peers: net.Socket[];
  channels: string[];
  interchangePeers: Map<string, net.Socket>;
  isByzantine: boolean;
  isSeed: boolean;
  messageHandlers: Map<MessageType, MessageHandler>;
  knownMessages: Map<net.Socket, string[]>;

  constructor(options: PeerOptions) {
    this.id = options.id;
    this.host = options.host;
    this.port = options.port;
    this.interchangePort = options.interchangePort;
    this.peers = [];
    this.channels = [];
    this.interchangePeers = new Map();
    this.messageHandlers = new Map();
    this.knownMessages = new Map();
  }

  async start() {
    this.server = await startServer(this.host, this.port, this.handleConnect);
    this.interchangeServer = await startServer(this.host, this.interchangePort, this.handleConnect);
  }

  async connectPeer(host: string, port: number): Promise<void> {
    const socket = await connectPeer(host, port);
    await this.handleConnect(socket);
  }

  log(...params) {
    console.log(chalk.cyan(`[Peer ${this.id}]`), ...params);
  }

  private handleConnect = async (socket: net.Socket) => {
    this.peers.push(socket);
    this.knownMessages.set(socket, []);
    listenMessages(socket, this.handleMessage);
  }

  private handleMessage = async (msg: Message, socket: net.Socket) => {
    this.log('Message handler', msg);

    if (!this.channels.includes(msg.channel)) return;

    const messageHandler = this.messageHandlers.get(msg.type as MessageType);

    if (messageHandler) {
      this.addKnownMessage(msg, socket);
      await messageHandler(msg, socket);
    }
  }

  private addKnownMessage(msg: Message, socket: net.Socket): void {
    const hash = objectHash(msg);
    const list = this.knownMessages.get(socket);

    if (list) {
      if (list.length >= 100) {
        list.shift();
      }

      list.push(hash);
    }
  }

  private isKnownMessage(msg: Message, socket: net.Socket): boolean {
    const hash = objectHash(msg);
    const list = this.knownMessages.get(socket);

    if (!list) return false;

    return list.includes(hash);
  }

  async broadcast(msg: Message) {
    for (const socket of this.peers) {
      if (!this.isKnownMessage(msg, socket)) {
        sendMessage(socket, msg);
      }
    }
  }

  sendInterchangeMessage(msg: Message) {
    const socket = this.interchangePeers.get(msg.channel);

    if (socket) {
      sendMessage(socket, msg);
    } else {
      console.error('No interchange peer found');
    }
  }

  subscribeToChannel(channel: string) {
    this.channels.push(channel);
  }

  unsubscribeFromChannel(channel: string) {
    this.channels = this.channels.filter(item => item != channel);
  }

  async connectChannelPeer(channel: string, host: string, port: number) {
    const socket = await connectPeer(host, port);
    this.interchangePeers.set(channel, socket);
  }

  setMessageHandler(messageType: MessageType, handler: MessageHandler) {
    this.messageHandlers.set(messageType, handler);
  }
}
