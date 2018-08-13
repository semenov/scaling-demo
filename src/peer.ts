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
  isSeed: boolean;
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

function sendMessage(socket: net.Socket, msg: Message) {
  socket.write(encodeMessage(msg) + '\n');
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

type PeerMap = Map<string, RemotePeer>;
enum PeerAddResult {
  Added,
  Updated,
  Rejected,
}

interface RemotePeerOptions {
  channelLimit: number;
}

class RemotePeerStorage {
  peers: PeerMap;
  peerIdsByChannel: Map<string, string[]>;
  channelLimit: number;

  constructor(options: RemotePeerOptions) {
    this.peers = new Map();
    this.peerIdsByChannel = new Map();
    this.channelLimit = options.channelLimit;
  }

  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId);
  }

  addPeer(remotePeer: RemotePeer): PeerAddResult {
    let result = PeerAddResult.Rejected;

    this.getChannels().forEach(channel => {
      if (!remotePeer.channels.includes(channel)) {
        return;
      }

      let channelPeerIds = this.peerIdsByChannel.get(channel);
      if (!channelPeerIds) {
        channelPeerIds = [];
        this.peerIdsByChannel.set(channel, channelPeerIds);
      }

      if (channelPeerIds.includes(remotePeer.id)) {
        result = PeerAddResult.Updated;
        this.peers.set(remotePeer.id, remotePeer);
      } else if (channelPeerIds.length < this.channelLimit) {
        if (result != PeerAddResult.Updated) {
          result = PeerAddResult.Added;
        }
        this.peers.set(remotePeer.id, remotePeer);
        channelPeerIds.push(remotePeer.id);
      }
    });

    return result;
  }

  removePeer(peerId: string) {
    this.peerIdsByChannel.forEach((peerIds, channel) => {
      const fileteredIds = peerIds.filter(id => id != peerId);
      this.peerIdsByChannel.set(channel, fileteredIds);
    });
    this.peers.delete(peerId);
  }

  getPeersByChannel(channel: string): RemotePeer[] {
    const channelPeerIds = this.peerIdsByChannel.get(channel);

    if (!channelPeerIds) {
      return [];
    }

    return channelPeerIds.map(id => this.peers.get(id));
  }

  getAllPeers(): RemotePeer[] {
    return Array.from(this.peers.values());
  }

  addChannel(channel: string) {
    this.peerIdsByChannel.set(channel, []);
  }

  getChannels() {
    return Array.from(this.peerIdsByChannel.keys());
  }
}

function listenSocketMessages(
  socket: net.Socket,
  handler: (msg: Message, socket: net.Socket) => void,
): void {
  const rl = readline.createInterface({ input: socket });

  rl.on('line', data => {
    try {
      const msg = decodeMessage(data);
      handler(msg, socket);
    } catch (e) {
      console.error(e);
    }
  });
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
  events: EventEmitter;

  constructor(options: PeerOptions) {
    this.id = options.id;
    this.isSeed = options.isSeed;
    this.seeds = options.seeds;
    this.host = options.host;
    this.port = options.port;
    this.peers = new RemotePeerStorage({ channelLimit: 10 });
    this.channels = [];
    this.processedMessages = new Set();
    this.events = new EventEmitter();

    this.addMessageListener(MessageType.Greeting, this.handleGreetingMessage);
    this.addMessageListener(MessageType.Peers, this.handlePeersMessage);
  }

  async start() {
    this.server = net.createServer(socket => {
      // this.log('New incoming connection');
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
        // this.log('New outgoing connection');
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

  private async handleStart() {
    await Promise.all(this.seeds.map(async seed => {
      try {
        await this.connect(seed.host, seed.port);
      } catch (e) {
        console.error('Failed to connect to seed', seed);
      }
    }));
  }

  private async handleConnect(socket: net.Socket) {
    listenSocketMessages(socket, this.handleMessage);

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
    for (const peer of msg.data.peers) {
      if (peer.id != this.id) {
        if (!this.peers.hasPeer(peer.id)) {
          await this.connect(peer.host, peer.port);
        }
      }
    }
  }

  private handleMessage = async (msg: Message, socket: net.Socket) => {
    this.log('Message handler', msg);

    this.events.emit(msg.type, msg, socket);

  }
  async broadcast(msg: Message) {
    const channel = msg.channel;
    this.log({ channel });
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

  addMessageListener(
    messageType: MessageType,
    handler: (msg: Message, socket: net.Socket) => void,
  ) {
    this.events.addListener(messageType, handler);
  }
}
