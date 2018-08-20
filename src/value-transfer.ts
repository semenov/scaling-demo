import { signObject, verifyObjectSignature } from './signature';

export interface ValueTransferInfo {
  from: string;
  to: string;
  amount: string;
  signature?: string;
}

export class ValueTransfer {
  from: string;
  to: string;
  amount: string;
  signature: string;
  hash: string;

  constructor(options: ValueTransferInfo) {
    this.from = options.from;
    this.to = options.to;
    this.amount = options.amount;
    this.signature = options.signature || '';
  }

  sign(privateKey: string): void {
    this.signature = signObject(privateKey, {
      from: this.from,
      to: this.to,
      amount: this.amount,
    });
  }

  verifySignature(publicKey: string): boolean {
    return verifyObjectSignature(publicKey, this.signature, {
      from: this.from,
      to: this.to,
      amount: this.amount,
    });
  }

  serialize(): ValueTransferInfo {
    return {
      from: this.from,
      to: this.to,
      amount: this.amount,
      signature: this.signature,
    };
  }
}
