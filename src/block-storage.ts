import { Block } from './block';

export class BlockStorage {
  blocks: Block[];

  constructor() {
    this.blocks = [];
  }

  addBlock(block: Block): boolean {
    if (this.getLastBlock().hash != block.header.parentBlockHash) return false;

    this.blocks.push(block);

    return true;
  }

  getBlockByHash(hash: string): Block | undefined {
    return this.blocks.find(block => hash == block.hash);
  }

  getLastBlock(): Block {
    return this.blocks[this.blocks.length - 1];
  }
}
