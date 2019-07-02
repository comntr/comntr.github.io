import { gStorage } from 'src/storage';
import { hs2a, a2hs } from 'src/hashutil';
import { log } from 'src/log';
import { gConfig } from './config';

const SIG_HEADER = 'Signature';
const PUBKEY_HEADER = 'Public-Key';

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

const gPublicKeyLS = gStorage.getEntry('user.keys.public');
const gSecretKeyLS = gStorage.getEntry('user.keys.private');
const gUserNameLS = gStorage.getEntry('user.name');

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
        }, gConfig.wasmt.get() * 1000);
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
          }, gConfig.scpi.get() * 1000);
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

  let pubKey = gPublicKeyLS.text;
  let secKey = gSecretKeyLS.text;

  if (pubKey && secKey) {
    return gUserKeys = {
      publicKey: hs2a(pubKey),
      secretKey: hs2a(secKey),
    };
  }

  let supercop = await getSupercop();
  log.i('Generating ed25519 keys.');
  let seed = supercop.createSeed();
  gUserKeys = supercop.createKeyPair(seed);
  gPublicKeyLS.text = a2hs(gUserKeys.publicKey);
  gSecretKeyLS.text = a2hs(gUserKeys.secretKey);
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

class UserNameProp {
  get() {
    let name = gUserNameLS.text;
    if (!name) {
      name = 'user-' + Math.random().toString(16).slice(2, 6);
      log.i('Generated username:', name);
      this.set(name);
    }
    return name;
  }

  set(name: string) {
    gUserNameLS.text = name;
    log.i('Updated username:', name);
  }
}

export const gUser = {
  signComment,
  verifyComment,
  getUserKeys,
  username: new UserNameProp,
};
