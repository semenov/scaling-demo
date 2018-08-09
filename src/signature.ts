import * as crypto from 'crypto';
import * as objectHash from 'object-hash';

export function signObject(key: string, object: object): string {
  const hash = objectHash(object);
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(hash);

  return hmac.digest('hex');
}

export function verifyObjectSignature(key: string, signature: string, object: object): boolean {
  const actualSignature = signObject(key, object);

  return actualSignature == signature;
}
