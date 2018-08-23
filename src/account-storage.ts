import * as bigInt from 'big-integer';

interface AccountOptions {
  id: string;
  balance: bigInt.BigInteger;
}

class Account {
  id: string;
  balance: bigInt.BigInteger;

  constructor(options: AccountOptions) {
    this.id = options.id;
    this.balance = options.balance;
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
