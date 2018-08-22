import { Peer, PeerOptions } from './peer';
import { MessageType, Message } from './message';
import { Block, BlockBody } from './block';
import { getChainsList, isChainValidator, isChainLeader, getChainValidators } from './authority';
import { txSchema, blockSchema, blockVoteSchema } from './schema';
import { validateSchema } from './validation';
import { Tx, TxType } from './tx';
import { AccountStorage } from './account-storage';
import * as sleep from 'sleep-promise';
import { blockTime, blockSize } from './config';
import * as bigInt from 'big-integer';
import { BlockStorage } from './block-storage';
import { ValueTransfer } from './value-transfer';

function getKeyByID(id: number): string {
  return 'peer_' + id;
}

function sendCrosschainMessage(msg: Message): void {

}

interface NodeOptions {
  peerOptions: PeerOptions;
}

export class Node {
  peer: Peer;
  pendingTransactions: Map<string, Tx>;
  blocks: BlockStorage;
  proposedBlockInitialHash?: string;
  proposedBlock?: Block;
  accounts: AccountStorage;
  isLeader: boolean;
  chain: string;

  constructor(options: NodeOptions) {
    this.peer = new Peer(options.peerOptions);
    this.pendingTransactions =  new Map();
    this.blocks = new BlockStorage({
      blockBodyHandler: this.blockBodyHandler,
    });
    this.accounts = new AccountStorage();
    this.accounts.issue('Alice', bigInt('1000000'));

    getChainsList().forEach(chain => {
      if (isChainValidator(chain, this.peer.id)) {
        this.peer.subscribeToChannel(chain);
        this.chain = chain;
        this.isLeader = isChainLeader(chain, this.peer.id);
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
    this.createGenesisBlock();
    while (true) {
      await sleep(blockTime);
      if (this.isLeader) {
        while (this.proposedBlock) {
          await sleep(100);
        }
        this.proposeBlock();
      }
    }
  }

  createGenesisBlock() {
    const block = new Block({
      header: {
        parentBlockHash: '0'.repeat(40),
        height: 0,
        timestamp: Date.parse('20 Aug 2018 00:00:00 GMT'),
        chain: this.chain,
      },
      body: {
        txs: [],
      },
      signatures: [],
    });

    block.updateHash();

    this.blocks.add(block);
  }

  proposeBlock() {
    const lastBlock = this.blocks.getLast();
    const block = new Block({
      header: {
        parentBlockHash: lastBlock.hash,
        height: lastBlock.header.height + 1,
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

      const txAllowed = this.checkTransaction(tx);
      if (txAllowed) {
        block.body.txs.push(tx.serialize());
      } else {
        console.error('Tx is not allowed', tx);
      }
    }

    block.sign(getKeyByID(this.peer.id));

    this.proposedBlock = block;
    this.proposedBlockInitialHash = block.hash;

    this.peer.broadcast({
      type: MessageType.BlockProposal,
      channel: this.chain,
      data: block.serialize(),
    });
  }

  checkTransaction(tx: Tx): boolean {
    if (tx.data instanceof ValueTransfer) {
      const txAllowed = this.accounts.checkTransaction(tx.data.from, bigInt(tx.data.amount));
      return txAllowed;
    }

    return true;
  }

  private blockBodyHandler = (blockBody: BlockBody): boolean => {
    for (const txData of blockBody.txs) {
      const tx = new Tx(txData);
      if (tx.data instanceof ValueTransfer) {
        this.accounts.transact(tx.data.from, tx.data.to, bigInt(tx.data.amount));
      }
    }

    return true;
  }

  private txHandler = async msg => {
    validateSchema(txSchema, msg.data);
    const tx = new Tx(msg.data);

    if (this.pendingTransactions.has(tx.hash)) return;

    if (tx.data instanceof ValueTransfer) {
      if (tx.verifyHash() && tx.data.verifySignature(tx.data.from)) {
        this.pendingTransactions.set(tx.hash, tx);
        this.peer.broadcast(msg);
      }
    }
  }

  checkBlock(block: Block): boolean {
    const chain = block.header.chain;
    if (chain != this.chain) return false;
    if (block.body.txs.length >= blockSize) return false;

    for (const txData of block.body.txs) {
      const tx = new Tx(txData);
      if (tx.data instanceof ValueTransfer) {
        if (!tx.verifyHash() || !tx.data.verifySignature(tx.data.from)) return false;
        const txAllowed = this.accounts.checkTransaction(tx.data.from, bigInt(tx.data.amount));
        if (!txAllowed) return false;
      }
    }

    return true;
  }

  private blockProposalHandler = msg => {
    validateSchema(blockSchema, msg.data);
    const block = new Block(msg.data);

    this.peer.broadcast(msg);

    if (this.checkBlock(block)) {
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
  }

  private blockVoteHandler = msg => {
    validateSchema(blockVoteSchema, msg.data);

    const blockProposalHash = msg.data.blockProposalHash;
    const signature = msg.data.signature;

    if (!this.isLeader) return;

    const block = this.proposedBlock;

    if (!block || this.proposedBlockInitialHash != blockProposalHash) return;

    const validSignature = block.validateSignature(signature);

    if (!validSignature) {
      console.error('Invalid signature on block vote');
      return;
    }

    block.addSignature(signature);

    const validators = getChainValidators(this.chain);
    const blockAge = Date.now() - block.header.timestamp;
    const hasTimeouted = blockAge > blockTime;
    const isSignedByAll = block.signatures.length == validators.length;
    const isSignedByTwoThirds = block.signatures.length > (validators.length * 2 / 3);
    // Not handling the situation whet we get >2/3 votes before timeout and no votes after
    const canCommit = isSignedByAll || (hasTimeouted && isSignedByTwoThirds);

    if (canCommit) {
      this.commitBlock(block);
    }
  }

  commitBlock(block: Block): void {
    this.proposedBlock = undefined;
    this.proposedBlockInitialHash = undefined;

    this.blocks.add(block);
    this.removeCommitedTxs(block);

    const shardCommitTx = new Tx({
      type: TxType.ShardCommit,
      data: {
        blockHash: block.hash,
        chain: this.chain,
        signatures: block.signatures,
      },
    });

    if (this.chain != 'basechain') {
      this.peer.sendInterchangeMessage({
        type: MessageType.Tx,
        channel: 'basechain',
        data: shardCommitTx.serialize(),
      });
    }

    this.peer.broadcast({
      type: MessageType.Block,
      channel: this.chain,
      data: block.serialize(),
    });
  }

  private blockHandler = msg => {
    validateSchema(blockSchema, msg.data);
    this.peer.broadcast(msg);

    const block = new Block(msg.data);
    const isNewBlock = !this.blocks.getByHash(block.hash);
    const isValidBlock = this.checkBlock(block);
    if (isNewBlock && isValidBlock) {
      this.blocks.add(block);
      this.removeCommitedTxs(block);
    }
  }

  removeCommitedTxs(block: Block): void {
    for (const tx of block.body.txs) {
      if (tx.hash) {
        this.pendingTransactions.delete(tx.hash);
      }
    }
  }
}
