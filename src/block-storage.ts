import { Block, BlockBody } from './block';

type BlockBodyHandler = (body: BlockBody) => boolean;

interface BlockStorageOptions {
  blockBodyHandler: BlockBodyHandler;
}

export class BlockStorage {
  blocks: Block[];
  bodyHandler: BlockBodyHandler;

  constructor(options: BlockStorageOptions) {
    this.blocks = [];
    this.bodyHandler = options.blockBodyHandler;
  }

  add(block: Block): boolean {
    const lastBlock = this.getLast();
    if (lastBlock && lastBlock.hash != block.header.parentBlockHash) return false;

    const result = this.bodyHandler(block.body);
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
