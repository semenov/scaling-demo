import * as objectHash from 'object-hash';
import { signObject, verifyObjectSignature } from './signature';
import { ValueTransfer, ValueTransferInfo } from './value-transfer';

export interface TxInfo {
  type: TxType;
  data: object;
  hash?: string;
}

export enum TxType {
  ValueTransfer = 'value_transfer',
}

type TxData = ValueTransfer;

export class Tx {
  type: TxType;
  data: TxData;
  hash: string;

  constructor(options: TxInfo) {
    this.type = options.type;

    if (this.type == TxType.ValueTransfer) {
      this.data = new ValueTransfer(options.data as ValueTransferInfo);
    }
    this.hash = options.hash || '';
  }

  calculateHash(): string {
    return objectHash({
      type: this.type,
      data: this.data.serialize(),
    });
  }

  updateHash(): void {
    this.hash = this.calculateHash();
  }

  verifyHash(): boolean {
    return this.hash == objectHash({
      type: this.type,
      data: this.data.serialize(),
    });
  }

  serialize(): TxInfo {
    return {
      type: this.type,
      data: this.data.serialize(),
      hash: this.hash,
    };
  }
}
