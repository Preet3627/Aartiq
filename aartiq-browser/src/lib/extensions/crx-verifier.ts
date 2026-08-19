/**
 * CRX3 verifier — validates a Chrome extension package signature.
 *
 * Implements the CRX3 container parse + RSA/SHA-256 signature check exactly as
 * Chromium's sandboxed_unpacker does: the signature (field 2 of CrxFileHeader)
 * is verified over the SignedData (field 1) using the embedded public key
 * (field 2 of SignedData). The extension id is the first 32 hex chars of
 * SHA-256(publicKey). A Web Store install is rejected unless the signature
 * validates, so we never load attacker-controlled code.
 */

import * as crypto from 'crypto';

const CRX_MAGIC = Buffer.from('Cr24');

export interface CrxVerificationResult {
  valid: boolean;
  extensionId?: string;
  publicKey?: Buffer;
  headerSize?: number;
  zipStart?: number;
  error?: string;
}

function uint32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

function encodeVarint(n: number): Buffer {
  const out: number[] = [];
  let v = n >>> 0;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v & 0x7f);
  return Buffer.from(out);
}

function writeLengthDelimited(fieldNumber: number, data: Buffer): Buffer {
  return Buffer.concat([Buffer.from([(fieldNumber << 3) | 2]), encodeVarint(data.length), data]);
}

/** Minimal protobuf parser: returns first occurrence of each field number. */
function parseFields(buf: Buffer): Record<number, Buffer> {
  const out: Record<number, Buffer> = {};
  let i = 0;
  while (i < buf.length) {
    const tag = buf[i++];
    if (i >= buf.length) break;
    const field = tag >> 3;
    const wireType = tag & 0x07;
    if (wireType === 2) {
      const len = buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16) | (buf[i + 3] << 24);
      i += 4;
      out[field] = buf.subarray(i, i + len);
      i += len;
    } else if (wireType === 0) {
      while (i < buf.length && buf[i] & 0x80) i++;
      i++;
    } else {
      break;
    }
  }
  return out;
}

export function verifyCrx(buffer: Buffer): CrxVerificationResult {
  try {
    if (buffer.length < 16) return { valid: false, error: 'File too short to be a CRX.' };
    if (!buffer.subarray(0, 4).equals(CRX_MAGIC)) return { valid: false, error: 'Missing Cr24 magic header.' };
    const version = buffer.readUInt32LE(4);
    if (version !== 3) return { valid: false, error: `Unsupported CRX version ${version} (only CRX3).` };
    const headerSize = buffer.readUInt32LE(8);
    if (12 + headerSize > buffer.length) return { valid: false, error: 'Header size exceeds file length.' };
    const header = buffer.subarray(12, 12 + headerSize);
    const fields = parseFields(header);
    const signedData = fields[1];
    const signature = fields[2];
    if (!signedData || !signature) return { valid: false, error: 'CRX header missing signed data or signature.' };
    const signedFields = parseFields(signedData);
    const publicKey = signedFields[2];
    if (!publicKey) return { valid: false, error: 'Signed data missing public key.' };

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signedData);
    let ok = false;
    try {
      ok = verifier.verify(publicKey, signature);
    } catch {
      ok = false;
    }
    if (!ok) return { valid: false, error: 'CRX signature verification failed.' };

    const extensionId = crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 32);
    return { valid: true, extensionId, publicKey, headerSize, zipStart: 12 + headerSize };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

/**
 * Build a valid CRX3 from a ZIP payload and an RSA key pair. Used by tests and by
 * the (future) pack-from-source flow. The signature is produced over a minimal
 * SignedData containing only the public key.
 */
export function buildCrx3(zip: Buffer, privateKey: crypto.KeyObject, publicKeyDer: Buffer): Buffer {
  const signedData = writeLengthDelimited(2, publicKeyDer);
  const signature = crypto.sign('RSA-SHA256', signedData, privateKey);
  const header = Buffer.concat([writeLengthDelimited(1, signedData), writeLengthDelimited(2, signature)]);
  return Buffer.concat([CRX_MAGIC, uint32le(3), uint32le(header.length), header, zip]);
}
