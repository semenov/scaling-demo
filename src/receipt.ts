import { signObject, verifyObjectSignature } from './signature';

export interface ReceiptInfo {
  blockHash: string;
  originalTxHash: string;
  to: string;
  amount: string;
}

export class Receipt {
  blockHash: string;
  originalTxHash: string;
  to: string;
  amount: string;

  constructor(options: ReceiptInfo) {
    this.blockHash = options.blockHash;
    this.originalTxHash = options.originalTxHash;
    this.to = options.to;
    this.amount = options.amount;
  }

  serialize(): ReceiptInfo {
    return {
      blockHash: this.blockHash,
      originalTxHash: this.originalTxHash,
      to: this.to,
      amount: this.amount,
    };
  }
}
