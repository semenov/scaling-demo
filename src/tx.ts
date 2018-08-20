import * as objectHash from 'object-hash';
import { signObject, verifyObjectSignature } from './signature';

export interface TxInfo {
  from: string;
  to: string;
  amount: string;
  signature?: string;
  hash?: string;
}

export class Tx {
  from: string;
  to: string;
  amount: string;
  signature: string;
  hash: string;

  constructor(options: TxInfo) {
    this.from = options.from;
    this.to = options.to;
    this.amount = options.amount;
    this.signature = options.signature || '';
    this.hash = options.hash || '';
  }

  sign(privateKey: string): void {
    this.signature = signObject(privateKey, {
      from: this.from,
      to: this.to,
      amount: this.amount,
    });

    this.updateHash();
  }

  verifySignature(publicKey: string): boolean {
    return verifyObjectSignature(publicKey, this.signature, {
      from: this.from,
      to: this.to,
      amount: this.amount,
    });
  }

  calculateHash(): string {
    return objectHash({
      from: this.from,
      to: this.to,
      amount: this.amount,
      signature: this.signature,
    });
  }

  updateHash(): void {
    this.hash = this.calculateHash();
  }

  verifyHash(): boolean {
    return this.hash == objectHash({
      from: this.from,
      to: this.to,
      amount: this.amount,
      signature: this.signature,
    });
  }

  serialize(): TxInfo {
    return {
      from: this.from,
      to: this.to,
      amount: this.amount,
      signature: this.signature,
      hash: this.hash,
    };
  }
}
