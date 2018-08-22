import { SignatureInfo, verifyObjectSignature } from './signature';

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

  verifySignatures(): boolean {
    for (const signatureData of this.signatures) {
      const result = verifyObjectSignature(signatureData.publicKey, signatureData.signature, {
        hash: this.blockHash,
      });

      if (!result) return false;
    }

    return true;
  }

  serialize(): ShardCommitInfo {
    return {
      blockHash: this.blockHash,
      chain: this.chain,
      signatures: this.signatures,
    };
  }
}
