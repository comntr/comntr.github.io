define(["require", "exports", "src/log"], function (require, exports, logger) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const $ = (sel) => document.querySelector(sel);
    const log = logger.tagged('captcha');
    const HOST = 'https://comntr.live:2556';
    const ID_QUESTION = '#question';
    const ID_ANSWER = '#answer';
    const ID_SIGNATURE = '#signature';
    const ID_VERIFY = '#verify';
    const ID_KEYS = '#keys';
    function init() {
        log.i('init()');
        let hash = getHash();
        let img = $(ID_QUESTION);
        img.src = HOST + '/question/' + hash;
        $(ID_VERIFY).addEventListener('click', verify);
    }
    exports.init = init;
    function getHash() {
        return location.hash.slice(1) || 'abc';
    }
    async function verify() {
        let answer = $(ID_ANSWER).textContent;
        log.i('answer:', answer);
        let hash = getHash();
        let url = HOST + '/postmark/' + hash + '?answer=' + answer;
        let res = await fetch(url);
        let text = await res.text();
        $(ID_SIGNATURE).textContent = res.status == 200 ?
            text : res.status + ' ' + res.statusText + ' ' + text;
        await loadKeys();
    }
    async function loadKeys() {
        let url = HOST + '/keys';
        let res = await fetch(url);
        let text = await res.text();
        $(ID_KEYS).textContent = text;
    }
});
//# sourceMappingURL=index.js.map