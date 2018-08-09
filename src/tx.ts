import * as objectHash from 'object-hash';
import { signObject, verifyObjectSignature } from './signature';

interface TxOptions {
  from: string;
  to: string;
  amount: string;
  signature: string;
  hash: string;
}

export class Tx {
  from: string;
  to: string;
  amount: string;
  signature: string;
  hash: string;

  constructor(options: TxOptions) {
    this.from = options.from;
    this.to = options.to;
    this.amount = options.amount;
    this.signature = options.signature;
    this.hash = options.hash;
  }

  sign(privateKey) {
    this.signature = signObject(privateKey, {
      from: this.from,
      to: this.to,
      amout: this.amount,
    });
  }

  verifySignature(publicKey) {
    return verifyObjectSignature(publicKey, this.signature, {
      from: this.from,
      to: this.to,
      amout: this.amount,
    });
  }

  verifyHash() {
    return this.hash == objectHash({
      from: this.from,
      to: this.to,
      amout: this.amount,
      signature: this.signature,
    });
  }
}
