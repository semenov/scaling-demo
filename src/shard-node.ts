import * as lowdb from 'lowdb';
import * as FileAsync from 'lowdb/adapters/FileAsync';
import { Peer, PeerOptions } from './peer';
import { MessageType } from './message';
import { Block } from './block';
import { getChainsList, isChainValidator, isSlotLeader } from './authority';
import { txSchema, blockSchema } from './schema';
import { validateSchema } from './validation';
import { Tx } from './tx';
import { AccountStorage } from './account-storage';
import * as sleep from 'sleep-promise';
import { blockTime } from './config';

interface NodeOptions {
  peerOptions: PeerOptions;
}

export class ShardNode {
  peer: Peer;
  pendingTransactions: Map<string, Tx>;
  blocks: Map<string, Block>;
  accounts: AccountStorage;
  isLeader: boolean;
  chain: string;

  constructor(options: NodeOptions) {
    this.peer = new Peer(options.peerOptions);
    this.pendingTransactions =  new Map();
    this.blocks = new Map();
    this.accounts = new AccountStorage();

    getChainsList().forEach(chain => {
      if (isChainValidator(chain, this.peer.id)) {
        this.peer.subscribeToChannel(chain);
        this.chain = chain;
        this.isLeader = isSlotLeader(chain, this.peer.id);
      }
    });

    this.peer.setMessageHandler(MessageType.Tx, this.txHandler);
    this.peer.setMessageHandler(MessageType.BlockProposal, this.blockProposalHandler);
    this.peer.setMessageHandler(MessageType.Block, this.blockHandler);
  }

  async start() {
    await this.peer.start();
    this.startBlockProduction();
  }

  async startBlockProduction() {
    while (true) {
      await sleep(blockTime);
      if (this.isLeader) {
        this.proposeBlock();
      }
    }
  }

  proposeBlock() {
    const block = new Block({
      header: {
        parentBlockHash: '',
        height: 1,
        timestamp: Date.now(),
        chain: this.chain,
      },
      body: {
        txs: [],
      },
      signatures: [],
    });

    this.pendingTransactions.forEach(tx => {

    });
  }

  private txHandler = async msg => {
    validateSchema(txSchema, msg.data);
    const tx = new Tx(msg.data);

    if (this.pendingTransactions.has(tx.hash)) return;

    if (tx.verifySignature(tx.from) && tx.verifyHash()) {
      this.pendingTransactions.set(tx.hash, tx);
      this.peer.broadcast(msg);
    }
  }

  private blockProposalHandler = msg => {
    validateSchema(blockSchema, msg.data);
    const block = new Block(msg.data);
    const chain = block.header.chain;

    this.peer.broadcast(msg);
  }

  private blockHandler = msg => {
    validateSchema(blockSchema, msg.data);
    const block = new Block(msg.data);
    const chain = block.header.chain;

    this.peer.broadcast(msg);
  }
}
