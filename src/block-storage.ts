import { Block, BlockBody } from './block';

type BlockHandler = (body: Block) => boolean;

interface BlockStorageOptions {
  blockHandler: BlockHandler;
}

export class BlockStorage {
  blocks: Block[];
  blockHandler: BlockHandler;

  constructor(options: BlockStorageOptions) {
    this.blocks = [];
    this.blockHandler = options.blockHandler;
  }

  add(block: Block): boolean {
    const lastBlock = this.getLast();
    if (lastBlock && lastBlock.hash != block.header.parentBlockHash) return false;

    const result = this.blockHandler(block);
    if (!result) return false;
    this.blocks.push(block);

    return true;
  }

  getByHash(hash: string): Block | undefined {
    return this.blocks.find(block => hash == block.hash);
  }

  getLast(): Block {
    return this.blocks[this.blocks.length - 1];
  }
}
