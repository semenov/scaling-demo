import { Peer, PeerOptions } from './peer';
import { MessageType, Message } from './message';
import { Block, BlockBody } from './block';
import {
  getChainsList,
  isChainValidator,
  isChainLeader,
  getChainValidators,
  getAddressShard,
} from './authority';
import { txSchema, blockSchema, blockVoteSchema } from './schema';
import { validateSchema } from './validation';
import { Tx, TxType, TxInfo } from './tx';
import { AccountStorage } from './account-storage';
import * as sleep from 'sleep-promise';
import { blockTime, blockSize } from './config';
import * as bigInt from 'big-integer';
import { BlockStorage } from './block-storage';
import { ValueTransfer } from './value-transfer';
import { ShardCommit } from './shard-commit';
import { Receipt } from './receipt';
import * as Hapi from 'hapi';
import { ExecuteContract, SetContract } from './gvm';

function getKeyByID(id: number): string {
  return 'peer_' + id;
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
    this.pendingTransactions = new Map();
    this.blocks = new BlockStorage({
      blockHandler: this.blockAddHandler,
    });
    this.accounts = new AccountStorage();

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

    this.peer.httpServer.route({
      method: 'GET',
      path: '/status',
      handler: (request: Hapi.Request) => {
        return { status: 'ok' };
      },
    });

    this.peer.httpServer.route({
      method: 'GET',
      path: '/stats',
      handler: this.statsHandler,
    });

    this.peer.httpServer.route({
      method: 'POST',
      path: '/txs',
      handler: async (request: Hapi.Request) => {
        await this.txHandler({
          type: MessageType.Tx,
          channel: this.chain,
          data: request.payload,
        });
        return { status: 'ok' };
      },
    });
  }

  async start() {
    await this.peer.start();
    this.startBlockProduction();
  }

  async startBlockProduction() {
    this.createGenesisBlock();
    await sleep(30000);
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
    if (tx.data instanceof ExecuteContract) {
      return this.accounts.haveContract(tx.data.to);
    }
    if (tx.data instanceof SetContract) {
      // тут надо валидировать код контракта на валидность
      return true;
    }

    return true;
  }

  private blockAddHandler = (block: Block): boolean => {
    for (const txData of block.body.txs) {
      const tx = new Tx(txData);
      if (tx.data instanceof ValueTransfer) {
        const destinationChain = getAddressShard(tx.data.to);

        if (getAddressShard(tx.data.to) == this.chain) {
          this.accounts.transact(tx.data.from, tx.data.to, bigInt(tx.data.amount));
        } else {
          this.accounts.transactOuter(tx.data.from, bigInt(tx.data.amount));
          // Send interchange message to other shard
          const receiptTx = new Tx({
            type: TxType.Receipt,
            data: {
              blockHash: block.hash,
              originalTxHash: tx.hash,
              to: tx.data.to,
              amount: tx.data.amount,
            },
          });

          this.peer.sendInterchangeMessage({
            type: MessageType.Tx,
            channel: destinationChain,
            data: receiptTx.serialize(),
          });
        }
      }
      if (tx.data instanceof SetContract) {
        // Поставить контракт можно только с самого аккаунта, значит мы в этом шарде
        this.accounts.setContract(tx.data.from, tx.data.code);
      }
      if (tx.data instanceof ExecuteContract) {
        const destinationChain = getAddressShard(tx.data.to);

        if (getAddressShard(tx.data.to) == this.chain) {
          this.accounts.executeContract(tx.data.from, tx.data.to, tx.data.data);
        } else {
          // Весь стейт контракта храним на шарде с контрактом, значит на текущем шарде
          // даже не надо ничего делать
          // просто отправляем эту транзакцию на нужный шард
          // Send interchange message to other shard
          const receiptTx = new Tx({
            type: TxType.ExecuteContract,
            data: tx.data,
          });

          this.peer.sendInterchangeMessage({
            type: MessageType.Tx,
            channel: destinationChain,
            data: receiptTx.serialize(),
          });
        }
      }
    }

    return true;
  }

  private statsHandler = (request: Hapi.Request) => {
    const block = this.blocks.getLast();
    let totalTxNumber = 0;
    this.blocks.blocks.forEach(block => {
      totalTxNumber += block.body.txs.length;
    });

    const avgTxNumber = totalTxNumber / block.header.height;

    return {
      chain: this.chain,
      blockHeight: block.header.height,
      blockHash: block.hash,
      blockTxNumber: block.body.txs.length,
      totalTxNumber,
      avgTxNumber,
      pendingTxNumber: this.pendingTransactions.size,
    };
  }

  private txHandler = async msg => {
    console.time('tx handler');
    // console.time('tx scema validation');
    // validateSchema(txSchema, msg.data);
    // console.timeEnd('tx scema validation');
    const tx = new Tx(msg.data);

    if (this.pendingTransactions.has(tx.hash)) return;

    if (
      (tx.data instanceof ValueTransfer)
      || (tx.data instanceof SetContract)
      || (tx.data instanceof ExecuteContract)
    ) {
      console.time('tx verification');
      const isTxVerified = tx.verifyHash() && tx.data.verifySignature(tx.data.from);
      console.timeEnd('tx verification');
      if (isTxVerified) {
        console.log('tx verified, going to broadcast');
        this.pendingTransactions.set(tx.hash, tx);
        console.time('tx broadcast');
        this.peer.broadcast(msg);
        console.timeEnd('tx broadcast');
      }
    }

    if (tx.data instanceof Receipt) {
      this.pendingTransactions.set(tx.hash, tx);
      this.peer.broadcast(msg);
    }

    if (tx.data instanceof ShardCommit) {
      const isBasechain = this.chain == 'basechain';
      const areSignaturesVerifiied = tx.data.verifySignatures();
      if (isBasechain && areSignaturesVerifiied) {
        this.pendingTransactions.set(tx.hash, tx);
        this.peer.broadcast(msg);
      }
    }
    console.timeEnd('tx handler');
  }

  checkBlock(block: Block): boolean {
    const chain = block.header.chain;
    if (chain != this.chain) {
      this.peer.log('Wrong chain');
      return false;
    }
    if (block.body.txs.length > blockSize) {
      this.peer.log('Wrong block size');
      return false;
    }

    for (const txData of block.body.txs) {
      const tx = new Tx(txData);
      if (tx.data instanceof ValueTransfer) {
        if (!tx.verifyHash() || !tx.data.verifySignature(tx.data.from)) return false;
        const txAllowed = this.accounts.checkTransaction(tx.data.from, bigInt(tx.data.amount));
        if (!txAllowed) return false;
      }

      if (tx.data instanceof ShardCommit) {
        const isBasechain = chain == 'basechain';
        const areSignaturesVerifiied = tx.data.verifySignatures();
        if (!isBasechain || !areSignaturesVerifiied) {
          return false;
        }
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
