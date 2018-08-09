import * as lowdb from 'lowdb';
import * as FileAsync from 'lowdb/adapters/FileAsync';
import { Peer, PeerOptions, MessageType } from './peer';

interface NodeOptions {
  dbFilename: string;
  isByzantine: boolean;
  peerOptions: PeerOptions;
}

export async function createNode(options: NodeOptions) {
  // For testing puposes we temporarily don't use persisctence layer
  // const dbFilename = options.dbFilename;
  // const adapter = new FileAsync(dbFilename);
  // const db = await lowdb(adapter);
  // await db.defaults({ blocks: [] }).write();

  const peer = new Peer(options.peerOptions);
  await peer.start();

  const pendingTransactions = new Map();
  const blocks = new Map();

  peer.addListener(MessageType.Tx, (msg, broadcast) => {
    const isNewTx = !pendingTransactions.has(msg.data.hash);
    if (isNewTx) {
      pendingTransactions.set(msg.data.hash, msg.data);
      broadcast(msg);
    }
  });

  return peer;
}
