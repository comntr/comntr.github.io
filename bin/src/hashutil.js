define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function hs2a(hs) {
        let a = new Uint8Array(hs.length / 2);
        for (let i = 0; i < a.length; i++) {
            let si = hs.slice(i * 2, i * 2 + 2);
            a[i] = parseInt(si, 16);
        }
        return a;
    }
    exports.hs2a = hs2a;
    function hd2s(x) {
        return (0x100 + x).toString(16).slice(1);
    }
    exports.hd2s = hd2s;
    function a2hs(a) {
        return [...a].map(hd2s).join('');
    }
    exports.a2hs = a2hs;
    function xorall(list) {
        if (list.length < 1)
            return null;
        let a = list[0].map(x => x);
        for (let i = 1; i < list.length; i++)
            for (let j = 0; j < a.length; j++)
                a[j] ^= list[i][j];
        return a;
    }
    exports.xorall = xorall;
    function sha1(str) {
        let bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++)
            bytes[i] = str.charCodeAt(i) & 0xFF;
        return new Promise(resolve => {
            crypto.subtle.digest('SHA-1', bytes).then(buffer => {
                let hash = Array.from(new Uint8Array(buffer)).map(byte => {
                    return ('0' + byte.toString(16)).slice(-2);
                }).join('');
                resolve(hash);
            });
        });
    }
    exports.sha1 = sha1;
});
//# sourceMappingURL=hashutil.js.map