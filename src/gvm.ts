import { Account } from './account-storage';
import { signObject, verifyObjectSignature } from './signature';
import * as vm from 'vm';

export default function run(code: string,
  state: Map<any, any>, executor: Account, input: Map<any, any>) {
  vm.runInNewContext(code, {
    state,
    executor: Object.freeze(executor),
    input: Object.freeze(input),
  });
}

export interface SetContractInfo {
  from: string;
  signature?: string;
  code: string;
}

export class SetContract {
  from: string;
  signature: string;
  code: string;

  constructor(options: SetContractInfo) {
    this.from = options.from;
    this.signature = options.signature || '';
    this.code = options.code;
  }
  sign(privateKey: string): void {
    this.signature = signObject(privateKey, {
      from: this.from,
      code: this.code,
    });
  }
  verifySignature(publicKey: string): boolean {
    return verifyObjectSignature(publicKey, this.signature, {
      from: this.from,
      code: this.code,
    });
  }
  serialize(): SetContractInfo {
    return {
      from: this.from,
      code: this.code,
      signature: this.signature,
    };
  }
}

interface ExecuteContractInfo {
  from: string;
  to: string;
  signature?: string;
  data: Map<any, any>;
}
export class ExecuteContract {
  from: string;
  to: string;
  signature: string;
  data: Map<any, any>;

  constructor(options: ExecuteContractInfo) {
    this.from = options.from;
    this.signature = options.signature || '';
    this.data = options.data;
    this.to = options.to;
  }
  sign(privateKey: string): void {
    this.signature = signObject(privateKey, {
      to: this.to,
      from: this.from,
      data: this.data,
    });
  }
  verifySignature(publicKey: string): boolean {
    return verifyObjectSignature(publicKey, this.signature, {
      to: this.to,
      from: this.from,
      data: this.data,
    });
  }
  serialize(): ExecuteContractInfo {
    return {
      to: this.to,
      from: this.from,
      data: this.data,
      signature: this.signature,
    };
  }
}
