import * as lowdb from 'lowdb';
import * as FileAsync from 'lowdb/adapters/FileAsync';
import { Peer, PeerOptions, MessageType } from './peer';
import { Block } from './block';
import { getChainsList, isChainValidator, isSlotLeader } from './checks';

interface NodeOptions {
  dbFilename: string;
  isByzantine: boolean;
  peerOptions: PeerOptions;
}

export async function createNode(options: NodeOptions): Promise<Peer> {
  // For testing puposes we temporarily don't use persisctence layer
  // const dbFilename = options.dbFilename;
  // const adapter = new FileAsync(dbFilename);
  // const db = await lowdb(adapter);
  // await db.defaults({ blocks: [] }).write();

  const peer = new Peer(options.peerOptions);
  getChainsList().forEach(chain => {
    if (isChainValidator(chain, peer.id)) {
      peer.subscribeToChannel(chain);
    }
  });

  await peer.start();

  const pendingTransactions = new Map();
  const blocks = new Map();

  peer.addMessageListener(MessageType.Tx, (msg, broadcast) => {
    const isNewTx = !pendingTransactions.has(msg.data.hash);
    if (isNewTx) {
      pendingTransactions.set(msg.data.hash, msg.data);
      broadcast(msg);
    }
  });

  peer.addMessageListener(MessageType.BlockProposal, (msg, broadcast) => {
    const block = new Block(msg.data);
    const chain = block.header.chain;
    const isNewTx = !pendingTransactions.has(msg.data.hash);
    if (isNewTx) {
      pendingTransactions.set(msg.data.hash, msg.data);
      broadcast(msg);
    }
  });

  return peer;
}
