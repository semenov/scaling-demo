import * as net from 'net';

interface RemotePeerOptions {
  channelLimit: number;
}

type PeerMap = Map<string, RemotePeer>;

export enum PeerAddResult {
  Added,
  Updated,
  Rejected,
}

export interface RemotePeer {
  id: string;
  channels: string[];
  host: string;
  port: number;
  socket: net.Socket;
}

export class RemotePeerStorage {
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
