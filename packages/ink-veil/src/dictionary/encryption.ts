/**
 * Dictionary encryption: PBKDF2(100K iterations, SHA-512) + AES-256-GCM
 * File format: [magic "IVDK" (4B)] [salt (16B)] [IV (12B)] [encrypted data] [auth tag (16B)]
 */
import { createCipheriv, createDecipheriv, pbkdf2, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { DictionaryError } from '../errors/types.js';

const pbkdf2Async = promisify(pbkdf2);

const MAGIC = Buffer.from('IVDK', 'ascii');
const MAGIC_LEN = 4;
const SALT_LEN = 16;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32; // 256-bit
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = 'sha512';

/** Derive a 256-bit key from password + salt using PBKDF2. */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return pbkdf2Async(password, salt, PBKDF2_ITERATIONS, KEY_LEN, PBKDF2_DIGEST);
}

/**
 * Encrypt plaintext JSON string with AES-256-GCM.
 * Returns binary buffer in the IVDK format.
 */
export async function encryptDictionary(plaintext: string, password: string): Promise<Buffer> {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = await deriveKey(password, salt);

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf-8')),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([MAGIC, salt, iv, encrypted, authTag]);
}

/**
 * Decrypt an IVDK-format buffer with AES-256-GCM.
 * Throws DictionaryError on magic mismatch or decryption failure.
 */
export async function decryptDictionary(data: Buffer, password: string): Promise<string> {
  // Validate magic bytes
  if (data.length < MAGIC_LEN + SALT_LEN + IV_LEN + AUTH_TAG_LEN) {
    throw new DictionaryError('Invalid encrypted dictionary: too short', { length: data.length });
  }

  const magic = data.subarray(0, MAGIC_LEN);
  if (!magic.equals(MAGIC)) {
    throw new DictionaryError('Invalid encrypted dictionary: bad magic bytes', {
      got: magic.toString('ascii'),
    });
  }

  let offset = MAGIC_LEN;
  const salt = data.subarray(offset, offset + SALT_LEN);
  offset += SALT_LEN;
  const iv = data.subarray(offset, offset + IV_LEN);
  offset += IV_LEN;
  const authTag = data.subarray(data.length - AUTH_TAG_LEN);
  const encrypted = data.subarray(offset, data.length - AUTH_TAG_LEN);

  const key = await deriveKey(password, salt);

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch {
    throw new DictionaryError('Decryption failed: wrong password or corrupted data');
  }
}

/** Check if a buffer has the IVDK magic bytes (is an encrypted dictionary). */
export function isEncryptedDictionary(data: Buffer): boolean {
  return data.length >= MAGIC_LEN && data.subarray(0, MAGIC_LEN).equals(MAGIC);
}
