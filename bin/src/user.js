define(["require", "exports", "src/storage", "./hashutil"], function (require, exports, storage_1, hashutil_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const SIG_HEADER = 'Signature';
    const USER_HEADER = 'User';
    const gUserKeysLS = storage_1.gStorage.getEntry('user.keys');
    let gSupercop;
    let gUserKeys;
    async function getSupercop() {
        if (gSupercop)
            return gSupercop;
        gSupercop = await new Promise((resolve, reject) => {
            requirejs(['./supercop/index'], resolve, reject);
        });
        await new Promise(resolve => {
            let timer = setInterval(() => {
                try {
                    gSupercop.createSeed();
                    clearInterval(timer);
                    resolve();
                }
                catch (err) {
                }
            }, 1000);
        });
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
     *    User: <public key>\n
     *    ...
     *
     * The signature signs everything below the Signature header.
     */
    async function signComment(comment) {
        let supercop = await getSupercop();
        let keys = await getUserKeys();
        comment = USER_HEADER + ': ' + hashutil_1.a2hs(keys.publicKey) + '\n' + comment;
        let buffer = getTextBytes(comment);
        let signature = supercop.sign(buffer, keys.publicKey, keys.secretKey);
        comment = SIG_HEADER + ': ' + hashutil_1.a2hs(signature) + '\n' + comment;
        await verifyComment(comment);
        return comment;
    }
    async function verifyComment(comment) {
        let regex = new RegExp(`^${SIG_HEADER}: (\\w+)\\n${USER_HEADER}: (\\w+)\\n`);
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
    exports.gUser = {
        signComment,
        verifyComment,
    };
});
//# sourceMappingURL=user.js.map