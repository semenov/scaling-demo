import * as lowdb from 'lowdb';
import * as FileAsync from 'lowdb/adapters/FileAsync';
import { Peer, PeerOptions, MessageType } from './peer';

interface NodeOptions {
  dbFilename: string;
  isByzantine: boolean;
  peerOptions: PeerOptions;
}

export async function createNode(options: NodeOptions) {
  const dbFilename = options.dbFilename;
  const adapter = new FileAsync(dbFilename);
  const db = await lowdb(adapter);

  await db.defaults({ blocks: [] }).write();

  const peer = new Peer(options.peerOptions);
  await peer.start();

  const pendingTransactions = [];
  peer.addListener(MessageType.Tx, (msg, broadcast) => {
    if (!pendingTransactions.some(tx => tx.hash == msg.data.hash)) {
      pendingTransactions.push(msg.data);
      broadcast(msg);
    }
  });

  return peer;
}
