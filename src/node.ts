import * as lowdb from 'lowdb';
import * as FileAsync from 'lowdb/adapters/FileAsync';
import { Peer, PeerOptions } from './peer';
import { MessageType } from './message';
import { Block } from './block';
import { getChainsList, isChainValidator, isSlotLeader } from './authority';

interface NodeOptions {
  peerOptions: PeerOptions;
}

export async function createNode(options: NodeOptions): Promise<Peer> {

  const peer = new Peer(options.peerOptions);
  getChainsList().forEach(chain => {
    if (isChainValidator(chain, peer.id)) {
      peer.subscribeToChannel(chain);
    }
  });

  await peer.start();

  const pendingTransactions = new Map();
  const blocks = new Map();

  peer.setMessageHandler(MessageType.Tx, msg => {
    const isNewTx = !pendingTransactions.has(msg.data.hash);
    if (isNewTx) {
      pendingTransactions.set(msg.data.hash, msg.data);
      peer.broadcast(msg);
    }
  });

  peer.setMessageHandler(MessageType.BlockProposal, msg => {
    const block = new Block(msg.data);
    const chain = block.header.chain;
    const isNewTx = !pendingTransactions.has(msg.data.hash);
    if (isNewTx) {
      pendingTransactions.set(msg.data.hash, msg.data);
      peer.broadcast(msg);
    }
  });

  return peer;
}
