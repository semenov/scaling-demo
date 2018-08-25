import { createHash } from 'crypto';

function calculateHash(input: string): string {
  const hash = createHash('sha256');
  hash.update(input);
  return hash.digest('hex');
}

function generateFakeAddresses(count: number): string[] {
  const accounts: string[] = [];

  for (let i = 0; i < count; i++) {
    const account = calculateHash(String(i));
    accounts.push(account);
  }

  return accounts;
}

export const fakeAddresses = generateFakeAddresses(100);
