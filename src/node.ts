import * as lowdb from 'lowdb';
import * as FileAsync from 'lowdb/adapters/FileAsync';
import { Peer, PeerOptions } from './peer';
import { MessageType } from './message';
import { Block } from './block';
import { getChainsList, isChainValidator, isSlotLeader } from './authority';
import { txSchema, blockSchema } from './schema';
import { validateSchema } from './validation';
import { Tx } from './tx';

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

  const pendingTransactions: Map<string, Tx> = new Map();
  const blocks = new Map();

  peer.setMessageHandler(MessageType.Tx, msg => {
    validateSchema(txSchema, msg.data);
    const tx = new Tx(msg.data);

    if (pendingTransactions.has(tx.hash)) return;

    if (tx.verifySignature(tx.from) && tx.verifyHash()) {
      pendingTransactions.set(tx.hash, tx);
      peer.broadcast(msg);
    }
  });

  peer.setMessageHandler(MessageType.BlockProposal, msg => {
    validateSchema(blockSchema, msg.data);
    const block = new Block(msg.data);
    const chain = block.header.chain;

    peer.broadcast(msg);
  });

  peer.setMessageHandler(MessageType.Block, msg => {
    validateSchema(blockSchema, msg.data);
    const block = new Block(msg.data);
    const chain = block.header.chain;

    peer.broadcast(msg);
  });

  return peer;
}
