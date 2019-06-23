define(["require", "exports", "src/storage", "src/hashutil", "src/log"], function (require, exports, storage_1, hashutil_1, log_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const SIG_HEADER = 'Signature';
    const PUBKEY_HEADER = 'Public-Key';
    const SC_POLL_INTERVAL = 0.5; // seconds
    const SC_WASM_TIMEOUT = 3; // seconds
    const gUserKeysLS = storage_1.gStorage.getEntry('user.keys');
    const gUserNameLS = storage_1.gStorage.getEntry('user.name');
    let gSupercop; // Ed25519
    let gUserKeys;
    async function getSupercop() {
        if (gSupercop)
            return gSupercop;
        log_1.log.i('Loading supercop.wasm.');
        try {
            await Promise.race([
                new Promise((resolve, reject) => {
                    setTimeout(() => {
                        reject(new Error('Timed out.'));
                    }, SC_WASM_TIMEOUT * 1000);
                }),
                new Promise((resolve, reject) => {
                    requirejs(['./supercop/index'], sc => {
                        log_1.log.i('Waiting for supercop.wasm to initialize.');
                        gSupercop = sc;
                        let timer = setInterval(() => {
                            try {
                                gSupercop.createSeed();
                                clearInterval(timer);
                                resolve();
                            }
                            catch (err) {
                                // wasm not ready
                            }
                        }, SC_POLL_INTERVAL * 1000);
                    }, reject);
                }),
            ]);
        }
        catch (err) {
            log_1.log.e('Failed to load supercop.wasm:', err);
            throw err;
        }
        return gSupercop;
    }
    async function getUserKeys() {
        if (gUserKeys)
            return gUserKeys;
        let keys = gUserKeysLS.json;
        if (keys) {
            return gUserKeys = {
                publicKey: hashutil_1.hs2a(keys.publicKey),
                secretKey: hashutil_1.hs2a(keys.secretKey),
            };
        }
        let supercop = await getSupercop();
        log_1.log.i('Generating ed25519 keys.');
        let seed = supercop.createSeed();
        gUserKeys = supercop.createKeyPair(seed);
        gUserKeysLS.json = {
            publicKey: hashutil_1.a2hs(gUserKeys.publicKey),
            secretKey: hashutil_1.a2hs(gUserKeys.secretKey),
        };
        return gUserKeys;
    }
    function getTextBytes(text) {
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
    async function signComment(comment) {
        let supercop = await getSupercop();
        let keys = await getUserKeys();
        comment = PUBKEY_HEADER + ': ' + hashutil_1.a2hs(keys.publicKey) + '\n' + comment;
        let buffer = getTextBytes(comment);
        let signature = supercop.sign(buffer, keys.publicKey, keys.secretKey);
        comment = SIG_HEADER + ': ' + hashutil_1.a2hs(signature) + '\n' + comment;
        return comment;
    }
    async function verifyComment(comment) {
        let regex = new RegExp(`^${SIG_HEADER}: (\\w+)\\n${PUBKEY_HEADER}: (\\w+)\\n`);
        let match = regex.exec(comment);
        if (!match)
            return false;
        let signature = hashutil_1.hs2a(match[1]);
        let publicKey = hashutil_1.hs2a(match[2]);
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
                log_1.log.i('Generated username:', name);
                this.set(name);
            }
            return name;
        }
        set(name) {
            gUserNameLS.text = name;
            log_1.log.i('Updated username:', name);
        }
    }
    exports.gUser = {
        signComment,
        verifyComment,
        username: new UserNameProp,
    };
});
//# sourceMappingURL=user.js.map