import * as crypto from 'crypto';
import { verifyCrx, buildCrx3 } from '../lib/extensions/crx-verifier';

function makeKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  return { publicKey, privateKey, publicKeyDer };
}

describe('CRX3 verifier — signature enforcement', () => {
  it('validates a correctly signed CRX3', () => {
    const { privateKey, publicKeyDer } = makeKeyPair();
    const zip = Buffer.from('fake-zip-payload-bytes-verifyCrx-only-checks-signature');
    const crx = buildCrx3(zip, privateKey, publicKeyDer);
    const result = verifyCrx(crx);
    expect(result.valid).toBe(true);
    expect(result.extensionId).toBeDefined();
    expect(result.zipStart).toBeGreaterThan(0);
  });

  it('rejects a tampered signed payload', () => {
    const { privateKey, publicKeyDer } = makeKeyPair();
    const zip = Buffer.from('payload');
    const crx = buildCrx3(zip, privateKey, publicKeyDer);
    const headerSize = crx.readUInt32LE(8);
    const idx = 12 + headerSize - 1;
    crx[idx] = crx[idx] ^ 0xff;
    const result = verifyCrx(crx);
    expect(result.valid).toBe(false);
  });

  it('rejects non-CRX input', () => {
    expect(verifyCrx(Buffer.from('not a crx file')).valid).toBe(false);
  });
});
