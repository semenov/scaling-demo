import { SignatureInfo } from './signature';

interface ShardCommitOptions {
  blockHash: string;
  signatures: SignatureInfo[];
}

export class ShardCommit {
  blockHash: string;
  signatures: SignatureInfo[];

  constructor(options: ShardCommitOptions) {
    this.blockHash = options.blockHash;
    this.signatures = options.signatures;
  }

  serialize() {
    return {
      blockHash: this.blockHash,
      signatures: this.signatures,
    };
  }
}
