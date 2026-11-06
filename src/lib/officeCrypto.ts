import CFB from 'cfb';

const BLOCK_VERIFIER_INPUT = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
const BLOCK_VERIFIER_VALUE = new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);
const BLOCK_KEY_VALUE = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);
const SEGMENT_LENGTH = 4096;
export const DEFAULT_EXCEL_PASSWORD = 'VelvetSweatshop';

type KeyParams = {
  salt: Uint8Array;
  keyBits: number;
  blockSize: number;
  hashSize: number;
  hashAlgorithm: string;
};

type PasswordKeyParams = KeyParams & {
  spinCount: number;
  encryptedVerifierHashInput: Uint8Array;
  encryptedVerifierHashValue: Uint8Array;
  encryptedKeyValue: Uint8Array;
};

export class PasswordRequiredError extends Error {
  constructor(message = 'PASSWORD_REQUIRED') {
    super(message);
    this.name = 'PasswordRequiredError';
  }
}

export class WrongPasswordError extends Error {
  constructor() {
    super('WRONG_PASSWORD');
    this.name = 'WrongPasswordError';
  }
}

const subtle = () => globalThis.crypto.subtle;

const toBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const base64 = (value: string | null) => {
  if (!value) throw new Error('INVALID_ENCRYPTION_INFO');
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const subtleHash = (name: string) => {
  const normalized = name.toUpperCase().replace('-', '');
  if (normalized === 'SHA512') return 'SHA-512';
  if (normalized === 'SHA384') return 'SHA-384';
  if (normalized === 'SHA256') return 'SHA-256';
  if (normalized === 'SHA1') return 'SHA-1';
  throw new Error('UNSUPPORTED_HASH');
};

const digest = async (algorithm: string, data: Uint8Array) => new Uint8Array(await subtle().digest(algorithm, toBuffer(data)));

const fit = (bytes: Uint8Array, length: number, pad: number) => {
  if (bytes.length >= length) return bytes.slice(0, length);
  const out = new Uint8Array(length).fill(pad);
  out.set(bytes);
  return out;
};

const littleEndian32 = (value: number) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
};

async function aesCbcDecryptRaw(keyBytes: Uint8Array, iv: Uint8Array, data: Uint8Array) {
  if (data.length === 0 || data.length % 16 !== 0) throw new Error('INVALID_CIPHER_LENGTH');
  const key = await subtle().importKey('raw', toBuffer(keyBytes), { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
  const lastBlock = data.slice(data.length - 16);
  const paddingBlock = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: toBuffer(lastBlock) }, key, new ArrayBuffer(0)));
  const padded = concat(data, paddingBlock.slice(0, 16));
  return new Uint8Array(await subtle().decrypt({ name: 'AES-CBC', iv: toBuffer(iv) }, key, toBuffer(padded)));
}

function readAttributes(element: Element | null, prefix: string): KeyParams {
  if (!element) throw new Error('INVALID_ENCRYPTION_INFO');
  const cipher = element.getAttribute('cipherAlgorithm');
  const chaining = element.getAttribute('cipherChaining');
  if (cipher !== 'AES' || chaining !== 'ChainingModeCBC') throw new Error(`UNSUPPORTED_CIPHER_${prefix}`);
  return {
    salt: base64(element.getAttribute('saltValue')),
    keyBits: Number(element.getAttribute('keyBits')),
    blockSize: Number(element.getAttribute('blockSize')),
    hashSize: Number(element.getAttribute('hashSize')),
    hashAlgorithm: element.getAttribute('hashAlgorithm') || 'SHA512',
  };
}

function parseXmlAttributes(xml: string) {
  const tag = (name: string) => {
    const match = new RegExp(`<(?:\\w+:)?${name}\\b([^>]*)/?>`).exec(xml);
    if (!match) return null;
    const attributes = new Map<string, string>();
    for (const attr of match[1].matchAll(/(\w+)="([^"]*)"/g)) attributes.set(attr[1], attr[2]);
    return { getAttribute: (key: string) => attributes.get(key) ?? null } as unknown as Element;
  };
  return { keyData: tag('keyData'), encryptedKey: tag('encryptedKey') };
}

function parseEncryptionInfo(info: Uint8Array) {
  const view = new DataView(info.buffer, info.byteOffset, info.byteLength);
  const major = view.getUint16(0, true);
  const minor = view.getUint16(2, true);
  if (major !== 4 || minor !== 4) throw new Error('UNSUPPORTED_ENCRYPTION');
  const xml = new TextDecoder('utf-8').decode(info.slice(8));
  const { keyData, encryptedKey } = parseXmlAttributes(xml);
  const keyParams = readAttributes(keyData, 'KEYDATA');
  const passwordBase = readAttributes(encryptedKey, 'PASSWORD');
  const passwordParams: PasswordKeyParams = {
    ...passwordBase,
    spinCount: Number(encryptedKey!.getAttribute('spinCount')),
    encryptedVerifierHashInput: base64(encryptedKey!.getAttribute('encryptedVerifierHashInput')),
    encryptedVerifierHashValue: base64(encryptedKey!.getAttribute('encryptedVerifierHashValue')),
    encryptedKeyValue: base64(encryptedKey!.getAttribute('encryptedKeyValue')),
  };
  return { keyParams, passwordParams };
}

async function deriveSecretKey(password: string, params: PasswordKeyParams) {
  const algorithm = subtleHash(params.hashAlgorithm);
  const passwordBytes = new Uint8Array(password.length * 2);
  for (let index = 0; index < password.length; index++) {
    const code = password.charCodeAt(index);
    passwordBytes[index * 2] = code & 0xff;
    passwordBytes[index * 2 + 1] = code >> 8;
  }
  let hash = await digest(algorithm, concat(params.salt, passwordBytes));
  const buffer = new Uint8Array(4 + hash.length);
  const counter = new DataView(buffer.buffer);
  for (let index = 0; index < params.spinCount; index++) {
    counter.setUint32(0, index, true);
    buffer.set(hash, 4);
    hash = await digest(algorithm, buffer);
  }
  const keyLength = params.keyBits / 8;
  const blockKey = async (block: Uint8Array) => fit(await digest(algorithm, concat(hash, block)), keyLength, 0x36);
  const iv = fit(params.salt, params.blockSize, 0x36);
  const verifierInput = await aesCbcDecryptRaw(await blockKey(BLOCK_VERIFIER_INPUT), iv, params.encryptedVerifierHashInput);
  const verifierValue = await aesCbcDecryptRaw(await blockKey(BLOCK_VERIFIER_VALUE), iv, params.encryptedVerifierHashValue);
  const expected = await digest(algorithm, verifierInput.slice(0, params.salt.length));
  const actual = verifierValue.slice(0, expected.length);
  if (expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) throw new WrongPasswordError();
  const secret = await aesCbcDecryptRaw(await blockKey(BLOCK_KEY_VALUE), iv, params.encryptedKeyValue);
  return secret.slice(0, keyLength);
}

async function decryptPackage(secretKey: Uint8Array, params: KeyParams, encrypted: Uint8Array) {
  const algorithm = subtleHash(params.hashAlgorithm);
  const view = new DataView(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength);
  const size = Number(view.getBigUint64(0, true));
  const output = new Uint8Array(Math.ceil((encrypted.length - 8) / 16) * 16);
  let written = 0;
  for (let offset = 8, segment = 0; offset < encrypted.length; offset += SEGMENT_LENGTH, segment++) {
    let chunk = encrypted.slice(offset, Math.min(offset + SEGMENT_LENGTH, encrypted.length));
    if (chunk.length % 16 !== 0) chunk = chunk.slice(0, chunk.length - (chunk.length % 16));
    if (!chunk.length) break;
    const iv = fit(await digest(algorithm, concat(params.salt, littleEndian32(segment))), params.blockSize, 0x36);
    const plain = await aesCbcDecryptRaw(secretKey, iv, chunk);
    output.set(plain, written);
    written += plain.length;
  }
  return output.slice(0, size);
}

export function isOleCompound(bytes: Uint8Array) {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return bytes.length > 8 && signature.every((value, index) => bytes[index] === value);
}

export function isEncryptedOffice(bytes: Uint8Array) {
  if (!isOleCompound(bytes)) return false;
  try {
    const container = CFB.read(bytes, { type: 'array' });
    return Boolean(CFB.find(container, 'EncryptionInfo') && CFB.find(container, 'EncryptedPackage'));
  } catch {
    return false;
  }
}

export async function decryptOfficeFile(bytes: Uint8Array, password: string) {
  const container = CFB.read(bytes, { type: 'array' });
  const infoEntry = CFB.find(container, 'EncryptionInfo');
  const packageEntry = CFB.find(container, 'EncryptedPackage');
  if (!infoEntry || !packageEntry) throw new Error('NOT_ENCRYPTED');
  const info = Uint8Array.from(infoEntry.content as ArrayLike<number>);
  const encrypted = Uint8Array.from(packageEntry.content as ArrayLike<number>);
  const { keyParams, passwordParams } = parseEncryptionInfo(info);
  const secret = await deriveSecretKey(password, passwordParams);
  return decryptPackage(secret, keyParams, encrypted);
}
