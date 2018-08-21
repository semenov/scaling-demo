import { SignatureInfo } from './signature';

export interface ShardCommitInfo {
  blockHash: string;
  chain: string;
  signatures: SignatureInfo[];
}

export class ShardCommit {
  blockHash: string;
  chain: string;
  signatures: SignatureInfo[];

  constructor(options: ShardCommitInfo) {
    this.blockHash = options.blockHash;
    this.chain = options.chain;
    this.signatures = options.signatures;
  }

  serialize(): ShardCommitInfo {
    return {
      blockHash: this.blockHash,
      chain: this.chain,
      signatures: this.signatures,
    };
  }
}
