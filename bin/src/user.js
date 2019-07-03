define(["require", "exports", "src/storage", "src/hashutil", "src/log", "./config"], function (require, exports, storage_1, hashutil_1, log_1, config_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const SIG_HEADER = 'Signature';
    const PUBKEY_HEADER = 'Public-Key';
    const gPublicKeyLS = storage_1.gStorage.getEntry('user.keys.public');
    const gSecretKeyLS = storage_1.gStorage.getEntry('user.keys.private');
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
                    }, config_1.gConfig.wasmt.get() * 1000);
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
                        }, config_1.gConfig.scpi.get() * 1000);
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
        let pubKey = gPublicKeyLS.text;
        let secKey = gSecretKeyLS.text;
        if (pubKey && secKey) {
            return gUserKeys = {
                publicKey: hashutil_1.hs2a(pubKey),
                secretKey: hashutil_1.hs2a(secKey),
            };
        }
        let supercop = await getSupercop();
        log_1.log.i('Generating ed25519 keys.');
        let seed = supercop.createSeed();
        gUserKeys = supercop.createKeyPair(seed);
        gPublicKeyLS.text = hashutil_1.a2hs(gUserKeys.publicKey);
        gSecretKeyLS.text = hashutil_1.a2hs(gUserKeys.secretKey);
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
    async function deriveFilterId(tag) {
        let keys = await getUserKeys();
        return await hashutil_1.sha1([
            await hashutil_1.sha1(hashutil_1.a2hs(keys.publicKey)),
            await hashutil_1.sha1(tag),
        ].join(''));
    }
    async function getPublicKey() {
        let keys = await getUserKeys();
        return hashutil_1.a2hs(keys.publicKey);
    }
    exports.gUser = {
        signComment,
        verifyComment,
        deriveFilterId,
        getPublicKey,
        username: new UserNameProp,
    };
});
//# sourceMappingURL=user.js.map