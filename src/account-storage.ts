import * as bigInt from 'big-integer';

class Account {
  id: string;
  balance: bigInt.BigInteger;

  constructor(options) {
    this.id = options.id;
    this.balance = options.balance;
  }
}

export class AccountStorage {
  accouts: Map<string, Account>;

  constructor() {
    this.accouts = new Map();
  }

  checkTransaction(from: string, amount: bigInt.BigInteger): boolean {
    const account = this.accouts.get(from);
    if (!account) return false;

    return amount.greater(0) && account.balance.greaterOrEquals(amount);
  }

  getOrCreateAccount(id: string): Account {
    const account = this.accouts.get(id);
    if (account) return account;

    const newAccount = new Account({
      id,
      amount: bigInt(0),
    });

    this.accouts.set(id, newAccount);

    return newAccount;
  }

  transact(from: string, to: string, amount: bigInt.BigInteger): boolean {
    if (!this.checkTransaction(from, amount)) return false;

    const fromAccount = this.accouts.get(from);
    if (!fromAccount) return false;

    fromAccount.balance = fromAccount.balance.subtract(amount);

    const toAccount = this.getOrCreateAccount(to);

    toAccount.balance = toAccount.balance.add(amount);

    return true;
  }
}
