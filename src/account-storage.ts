import * as bigInt from 'big-integer';
import run from './gvm';

interface AccountOptions {
  id: string;
  balance: bigInt.BigInteger;
}

export class Account {
  id: string;
  balance: bigInt.BigInteger;
  contract?: {
    code: string;
    state: Map<any, any>
  };
  constructor(options: AccountOptions) {
    this.id = options.id;
    this.balance = options.balance;
  }
  public setContractCode(code: string) {
    this.contract = {
      code,
      state: new Map(),
    };
  }
  public executeCode(executor: Account, input: Map<any, any>) {
    if (!this.contract) {
      throw new Error('Нет контракта!');
    }
    run(this.contract.code, this.contract.state, executor, input);
  }
}

export class AccountStorage {
  accounts: Map<string, Account>;

  constructor() {
    this.accounts = new Map();
  }

  issue(to: string, amount: bigInt.BigInteger) {
    const toAccount = this.getOrCreateAccount(to);
    toAccount.balance = toAccount.balance.add(amount);
  }

  checkTransaction(from: string, amount: bigInt.BigInteger): boolean {
    const account = this.accounts.get(from);
    if (!account) return false;

    return amount.greater(0) && account.balance.greaterOrEquals(amount);
  }
  haveContract(to: string) {
    const account = this.accounts.get(to);
    if (!account) return false;

    return !!account.contract;
  }
  setContract(to: string, code: string) {
    const account = this.accounts.get(to);
    if (!account) return false;

    account.setContractCode(code);
  }
  executeContract(from: string, to: string, input: Map<any, any>) {
    const contractAccount = this.accounts.get(to);
    if (!contractAccount) return false;

    const account = this.accounts.get(to);
    if (!account) return false;

    contractAccount.executeCode(account, input);
  }
  getOrCreateAccount(id: string): Account {
    const account = this.accounts.get(id);
    if (account) return account;

    const newAccount = new Account({
      id,
      balance: bigInt(0),
    });

    this.accounts.set(id, newAccount);

    return newAccount;
  }


  transact(from: string, to: string, amount: bigInt.BigInteger): boolean {
    if (!this.checkTransaction(from, amount)) return false;

    const fromAccount = this.accounts.get(from);
    if (!fromAccount) return false;

    fromAccount.balance = fromAccount.balance.subtract(amount);

    const toAccount = this.getOrCreateAccount(to);

    toAccount.balance = toAccount.balance.add(amount);

    return true;
  }

  transactOuter(from: string, amount: bigInt.BigInteger): boolean {
    if (!this.checkTransaction(from, amount)) return false;

    const fromAccount = this.accounts.get(from);
    if (!fromAccount) return false;

    fromAccount.balance = fromAccount.balance.subtract(amount);

    return true;
  }
}
