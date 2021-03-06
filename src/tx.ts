import * as objectHash from 'object-hash';
import { signObject, verifyObjectSignature } from './signature';
import { ValueTransfer, ValueTransferInfo } from './value-transfer';
import { ShardCommit, ShardCommitInfo } from './shard-commit';
import { Receipt, ReceiptInfo } from './receipt';
import { SetContract, SetContractInfo, ExecuteContract,
  ExecuteContractInfo, ExecuteContractRawInfo } from './gvm';

export interface TxInfo {
  type: TxType;
  data: ValueTransferInfo | ShardCommitInfo | ReceiptInfo |
    SetContractInfo | ExecuteContractRawInfo;
  hash?: string;
}

export enum TxType {
  ExecuteContract = 'execute_contract',
  SetContract = 'set_contract',
  ValueTransfer = 'value_transfer',
  ShardCommit = 'shard_commit',
  Receipt = 'receipt',
}

type TxData = ValueTransfer | ShardCommit | Receipt | SetContract | ExecuteContract;

export class Tx {
  type: TxType;
  data: TxData;
  hash: string;

  constructor(options: TxInfo) {
    this.type = options.type;

    if (this.type == TxType.ValueTransfer) {
      this.data = new ValueTransfer(options.data as ValueTransferInfo);
    }

    if (this.type == TxType.ShardCommit) {
      this.data = new ShardCommit(options.data as ShardCommit);
    }

    if (this.type == TxType.Receipt) {
      this.data = new Receipt(options.data as ReceiptInfo);
    }

    if (this.type == TxType.SetContract) {
      this.data = new SetContract(options.data as SetContractInfo);
    }
    if (this.type == TxType.ExecuteContract) {
      this.data = new ExecuteContract(options.data as ExecuteContractRawInfo);
    }

    if (options.hash) {
      this.hash = options.hash;
    } else {
      this.updateHash();
    }
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
