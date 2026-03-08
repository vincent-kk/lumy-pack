import { describe, it, expect } from 'vitest';
import { encryptDictionary, decryptDictionary, isEncryptedDictionary } from '../../dictionary/encryption.js';
import { Dictionary } from '../../dictionary/dictionary.js';

describe('Dictionary encryption', () => {
  it('magic bytes IVDK present at start of encrypted file', async () => {
    const dict = Dictionary.create();
    const plaintext = JSON.stringify(dict.toJSON());
    const encrypted = await encryptDictionary(plaintext, 'password123');
    expect(encrypted.subarray(0, 4).toString('ascii')).toBe('IVDK');
  });

  it('isEncryptedDictionary returns true for encrypted data', async () => {
    const dict = Dictionary.create();
    const plaintext = JSON.stringify(dict.toJSON());
    const encrypted = await encryptDictionary(plaintext, 'password123');
    expect(isEncryptedDictionary(encrypted)).toBe(true);
  });

  it('isEncryptedDictionary returns false for plain JSON', () => {
    const dict = Dictionary.create();
    const plaintext = Buffer.from(JSON.stringify(dict.toJSON()), 'utf-8');
    expect(isEncryptedDictionary(plaintext)).toBe(false);
  });

  it('round-trip: encrypt → decrypt returns original plaintext', async () => {
    const dict = Dictionary.create();
    dict.addEntity('홍길동', 'PER', 'NER', 0.95);
    const plaintext = JSON.stringify(dict.toJSON());
    const encrypted = await encryptDictionary(plaintext, 'secret-password');
    const decrypted = await decryptDictionary(encrypted, 'secret-password');
    expect(decrypted).toBe(plaintext);
  });

  it('wrong password throws DictionaryError', async () => {
    const plaintext = JSON.stringify(Dictionary.create().toJSON());
    const encrypted = await encryptDictionary(plaintext, 'correct-password');
    await expect(decryptDictionary(encrypted, 'wrong-password')).rejects.toThrow('Decryption failed');
  });

  it('encrypted file is not readable as plain JSON', async () => {
    const plaintext = JSON.stringify(Dictionary.create().toJSON());
    const encrypted = await encryptDictionary(plaintext, 'password');
    expect(() => JSON.parse(encrypted.toString('utf-8'))).toThrow();
  });

  it('different passwords produce different ciphertext', async () => {
    const plaintext = 'test data';
    const enc1 = await encryptDictionary(plaintext, 'password1');
    const enc2 = await encryptDictionary(plaintext, 'password2');
    expect(enc1.equals(enc2)).toBe(false);
  });

  it('same password produces different ciphertext (random IV)', async () => {
    const plaintext = 'test data';
    const enc1 = await encryptDictionary(plaintext, 'password');
    const enc2 = await encryptDictionary(plaintext, 'password');
    // Different because of random IV and salt
    expect(enc1.equals(enc2)).toBe(false);
  });

  it('decryptDictionary throws on invalid magic bytes', async () => {
    const fakeData = Buffer.alloc(64, 0);
    fakeData.write('XXXX', 0, 'ascii');
    await expect(decryptDictionary(fakeData, 'password')).rejects.toThrow('bad magic bytes');
  });
});
