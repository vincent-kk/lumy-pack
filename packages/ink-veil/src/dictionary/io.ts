/**
 * I/O layer for the Dictionary.
 * This file uses node:fs and is NOT re-exported from transform/ subpath.
 */
import { readFile, writeFile } from "node:fs/promises";
import { DictionaryError } from "../errors/types.js";
import { Dictionary } from "./dictionary.js";
import {
  encryptDictionary,
  decryptDictionary,
  isEncryptedDictionary,
} from "./encryption.js";
import type { DictionaryJSON } from "./types.js";

/** Save a dictionary to a JSON file. */
export async function saveDictionary(
  dict: Dictionary,
  path: string,
): Promise<void> {
  const data = dict.toJSON();
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

/** Load a dictionary from a JSON file. */
export async function loadDictionary(path: string): Promise<Dictionary> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (cause) {
    throw new DictionaryError(`Failed to read dictionary file: ${path}`, {
      path,
      cause,
    });
  }

  let data: DictionaryJSON;
  try {
    data = JSON.parse(raw) as DictionaryJSON;
  } catch (cause) {
    throw new DictionaryError(`Failed to parse dictionary JSON: ${path}`, {
      path,
      cause,
    });
  }

  return Dictionary.fromJSON(data);
}

/** Save a dictionary to an encrypted binary file (AES-256-GCM). */
export async function saveDictionaryEncrypted(
  dict: Dictionary,
  path: string,
  password: string,
): Promise<void> {
  const plaintext = JSON.stringify(dict.toJSON(), null, 2);
  const encrypted = await encryptDictionary(plaintext, password);
  await writeFile(path, encrypted);
}

/** Load a dictionary from an encrypted binary file (AES-256-GCM). */
export async function loadDictionaryEncrypted(
  path: string,
  password: string,
): Promise<Dictionary> {
  let data: Buffer;
  try {
    data = await readFile(path);
  } catch (cause) {
    throw new DictionaryError(`Failed to read encrypted dictionary: ${path}`, {
      path,
      cause,
    });
  }

  if (!isEncryptedDictionary(data)) {
    throw new DictionaryError(
      `File does not appear to be an encrypted dictionary (missing IVDK magic): ${path}`,
      { path },
    );
  }

  const plaintext = await decryptDictionary(data, password);

  let parsed: DictionaryJSON;
  try {
    parsed = JSON.parse(plaintext) as DictionaryJSON;
  } catch (cause) {
    throw new DictionaryError("Failed to parse decrypted dictionary JSON", {
      path,
      cause,
    });
  }

  return Dictionary.fromJSON(parsed);
}
