import { gStorage } from 'src/storage';
import { hs2a, a2hs } from './hashutil';

const SIG_HEADER = 'Signature';
const USER_HEADER = 'User';

interface Supercop {
  ready(callback: Function): void;
  createSeed(): Uint8Array;
  createKeyPair(seed: Uint8Array): UserKeys;
  sign(message: Uint8Array, publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array;
  verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean;
}

interface UserKeys {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

const gUserKeysLS = gStorage.getEntry('user.keys');

let gSupercop: Supercop;
let gUserKeys: UserKeys;

async function getSupercop(): Promise<Supercop> {
  if (gSupercop) return gSupercop;

  gSupercop = await new Promise((resolve, reject) => {
    requirejs(['./supercop/index'], resolve, reject);
  });

  await new Promise(resolve => {
    let timer = setInterval(() => {
      try {
        gSupercop.createSeed();
        clearInterval(timer);
        resolve();
      } catch (err) {
        
      }
    }, 1000);
  });

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
 *    User: <public key>\n
 *    ...
 * 
 * The signature signs everything below the Signature header.
 */
async function signComment(comment: string) {
  let supercop = await getSupercop();
  let keys = await getUserKeys();
  comment =  USER_HEADER + ': ' + a2hs(keys.publicKey) + '\n' + comment;
  let buffer = getTextBytes(comment);
  let signature = supercop.sign(buffer, keys.publicKey, keys.secretKey);
  comment = SIG_HEADER + ': ' + a2hs(signature) + '\n' + comment;
  // await verifyComment(comment);
  return comment;
}

async function verifyComment(comment: string) {
  let regex = new RegExp(`^${SIG_HEADER}: (\\w+)\\n${USER_HEADER}: (\\w+)\\n`);
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
