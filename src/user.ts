import { gStorage } from 'src/storage';
import { hs2a, a2hs } from 'src/hashutil';
import { log } from 'src/log';

const SIG_HEADER = 'Signature';
const PUBKEY_HEADER = 'Public-Key';
const SC_POLL_INTERVAL = 0.5; // seconds
const SC_WASM_TIMEOUT = 3; // seconds

interface Supercop {
  ready(callback: Function): void;
  createSeed(): Uint8Array;
  createKeyPair(seed: Uint8Array): UserKeys;
  sign(message: Uint8Array, publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array;
  verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean;
}

interface UserKeys {
  publicKey: Uint8Array; // 32 bytes
  secretKey: Uint8Array; // 64 bytes
}

const gUserKeysLS = gStorage.getEntry('user.keys');

let gSupercop: Supercop; // Ed25519
let gUserKeys: UserKeys;

async function getSupercop(): Promise<Supercop> {
  if (gSupercop) return gSupercop;

  log.i('Loading supercop.wasm.');
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Timed out.'));
        }, SC_WASM_TIMEOUT * 1000);
      }),
      new Promise((resolve, reject) => {
        requirejs(['./supercop/index'], sc => {
          log.i('Waiting for supercop.wasm to initialize.');
          gSupercop = sc;
          let timer = setInterval(() => {
            try {
              gSupercop.createSeed();
              clearInterval(timer);
              resolve();
            } catch (err) {
              // wasm not ready
            }
          }, SC_POLL_INTERVAL * 1000);
        }, reject);
      }),
    ]);
  } catch (err) {
    log.e('Failed to load supercop.wasm:', err);
    throw err;
  }

  return gSupercop;
}

async function getUserKeys() {
  if (gUserKeys) return gUserKeys;

  let keys = gUserKeysLS.json;
  if (keys) {
    return gUserKeys = {
      publicKey: hs2a(keys.publicKey),
      secretKey: hs2a(keys.secretKey),
    };
  }

  let supercop = await getSupercop();
  log.i('Generating ed25519 keys.');
  let seed = supercop.createSeed();
  gUserKeys = supercop.createKeyPair(seed);
  gUserKeysLS.json = {
    publicKey: a2hs(gUserKeys.publicKey),
    secretKey: a2hs(gUserKeys.secretKey),
  };
  return gUserKeys;
}

function getTextBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * The signed comment gets two extra headers at the top:
 * 
 *    Signature: <signature>\n
 *    Public-Key: <public key>\n
 *    ...
 * 
 * The signature signs everything below the Signature header.
 */
async function signComment(comment: string) {
  let supercop = await getSupercop();
  let keys = await getUserKeys();
  comment = PUBKEY_HEADER + ': ' + a2hs(keys.publicKey) + '\n' + comment;
  let buffer = getTextBytes(comment);
  let signature = supercop.sign(buffer, keys.publicKey, keys.secretKey);
  comment = SIG_HEADER + ': ' + a2hs(signature) + '\n' + comment;
  return comment;
}

async function verifyComment(comment: string) {
  let regex = new RegExp(`^${SIG_HEADER}: (\\w+)\\n${PUBKEY_HEADER}: (\\w+)\\n`);
  let match = regex.exec(comment);
  if (!match) return false;
  let signature = hs2a(match[1]);
  let publicKey = hs2a(match[2]);
  let signedPart = comment.slice(comment.indexOf('\n') + 1);
  let signedPartBytes = getTextBytes(signedPart);
  let supercop = await getSupercop();
  let valid = supercop.verify(signature, signedPartBytes, publicKey);
  return valid;
}

export const gUser = {
  signComment,
  verifyComment,
};