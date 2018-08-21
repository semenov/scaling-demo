import { Tx, TxInfo } from './tx';
import { signObject, verifyObjectSignature } from './signature';
import * as objectHash from 'object-hash';

function getPublicKeyFromPrivatekey(privateKey: string): string {
  // We use same private and public key for debug purposes
  return privateKey;
}

interface SignatureInfo {
  publicKey: string;
  signature: string;
}

interface BlockInfo {
  header: BlockHeader;
  body: BlockBody;
  signatures: SignatureInfo[];
  hash?: string;
}

interface BlockHeader {
  chain: string;
  timestamp: number;
  height: number;
  parentBlockHash: string;
}
export interface BlockBody {
  txs: TxInfo[];
}

export class Block {
  header: BlockHeader;
  body: BlockBody;
  signatures: SignatureInfo[];
  hash: string;

  constructor(options: BlockInfo) {
    this.header = options.header;
    this.body = options.body;
    this.signatures = options.signatures;
    this.hash = options.hash || '';
  }

  sign(privateKey: string): SignatureInfo {
    this.updateHash();

    const publicKey = getPublicKeyFromPrivatekey(privateKey);
    const signature = signObject(privateKey, {
      hash: this.hash,
    });

    const signatureInfo = {
      publicKey,
      signature,
    };

    if (!this.signatures.some(item => item.signature == signature)) {
      this.signatures.push(signatureInfo);
    }

    return signatureInfo;
  }

  validateSignature(signatureInfo: SignatureInfo): boolean {
    return verifyObjectSignature(signatureInfo.publicKey, signatureInfo.signature, {
      hash: this.hash,
    });
  }

  addSignature(signatureInfo: SignatureInfo): void {
    if (!this.signatures.some(item => item.signature == signatureInfo.signature)) {
      this.signatures.push(signatureInfo);
    }
  }

  calculateHash(): string {
    return objectHash({
      header: this.header,
      body: this.body,
    });
  }

  updateHash(): void {
    this.hash = this.calculateHash();
  }

  serialize() {
    return {
      header: this.header,
      body: this.body,
      signatures: this.signatures,
      hash: this.hash,
    };
  }
}
