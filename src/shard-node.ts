import * as lowdb from 'lowdb';
import * as FileAsync from 'lowdb/adapters/FileAsync';
import { Peer, PeerOptions } from './peer';
import { MessageType } from './message';
import { Block } from './block';
import { getChainsList, isChainValidator, isSlotLeader, getChainValidators } from './authority';
import { txSchema, blockSchema, blockVoteSchema } from './schema';
import { validateSchema } from './validation';
import { Tx } from './tx';
import { AccountStorage } from './account-storage';
import * as sleep from 'sleep-promise';
import { blockTime, blockSize } from './config';
import * as bigInt from 'big-integer';
import { verifyObjectSignature } from './signature';

function getKeyByID(id: number): string {
  return 'shard_' + id;
}

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
  blockProposals: Map<string, Block>;

  constructor(options: NodeOptions) {
    this.peer = new Peer(options.peerOptions);
    this.pendingTransactions =  new Map();
    this.blocks = new Map();
    this.accounts = new AccountStorage();
    this.blockProposals = new Map();

    getChainsList().forEach(chain => {
      if (isChainValidator(chain, this.peer.id)) {
        this.peer.subscribeToChannel(chain);
        this.chain = chain;
        this.isLeader = isSlotLeader(chain, this.peer.id);
      }
    });

    this.peer.setMessageHandler(MessageType.Tx, this.txHandler);
    this.peer.setMessageHandler(MessageType.BlockProposal, this.blockProposalHandler);
    this.peer.setMessageHandler(MessageType.BlockVote, this.blockVoteHandler);
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

    for (const [hash, tx] of this.pendingTransactions) {
      if (block.body.txs.length >= blockSize) break;

      const txAllowed = this.accounts.checkTransaction(tx.from, bigInt(tx.amount));
      if (txAllowed) {
        block.body.txs.push(tx.serialize());
      }
    }

    block.sign(getKeyByID(this.peer.id));

    this.blockProposals.set(block.hash, block);

    this.peer.broadcast({
      type: MessageType.BlockProposal,
      channel: this.chain,
      data: block.serialize(),
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

    if (block.body.txs.length >= blockSize) return;

    for (const txData of block.body.txs) {
      const tx = new Tx(txData);
      if (!tx.verifyHash() || !tx.verifySignature(tx.from)) return;
      const txAllowed = this.accounts.checkTransaction(tx.from, bigInt(tx.amount));
      if (!txAllowed) return;
    }

    const publicKey = getKeyByID(this.peer.id);

    this.peer.broadcast({
      type: MessageType.BlockVote,
      channel: this.chain,
      data: {
        blockProposalHash: block.hash,
        signature: block.sign(publicKey),
      },
    });
  }

  private blockVoteHandler = msg => {
    validateSchema(blockVoteSchema, msg.data);

    const blockProposalHash = msg.data.blockProposalHash;
    const signature = msg.data.signature;

    if (!this.isLeader) return;

    const block = this.blockProposals.get(blockProposalHash);

    if (!block) return;

    const validSignature = block.validateSignature(signature);

    if (!validSignature) return;

    block.addSignature(signature);

    const validators = getChainValidators(this.chain);
    const blockAge = Date.now() - block.header.timestamp;
    const hasTimeouted = blockAge > blockTime;
    const isSignedByAll = block.signatures.length == validators.length;
    const isSignedByTwoThirds = block.signatures.length > (validators.length * 2 / 3);
    // Not handling the situation whet we get >2/3 votes before timeout and no votes after
    const canCommit = isSignedByAll || (hasTimeouted && isSignedByTwoThirds);

    if (canCommit) {
      this.peer.broadcast({
        type: MessageType.Block,
        channel: this.chain,
        data: block.serialize(),
      });
    }
  }

  private blockHandler = msg => {
    validateSchema(blockSchema, msg.data);
    const block = new Block(msg.data);
    const chain = block.header.chain;

    this.peer.broadcast(msg);
  }
}
