define(["require", "exports", "src/log", "src/user", "src/hashutil"], function (require, exports, log_1, user_1, hashutil_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ID_EXAMPLE = '#example';
    const ID_FILTER = '#filter-id';
    const ID_PUBLIC_KEY = '#public-key';
    const $ = (sel) => document.querySelector(sel);
    const log = log_1.tagged('about');
    async function init() {
        log.i('init()');
        let keys = await user_1.gUser.getUserKeys();
        let roomId = 'MyFirstFilter';
        let filterId = await hashutil_1.sha1([
            await hashutil_1.sha1(hashutil_1.a2hs(keys.publicKey)),
            await hashutil_1.sha1(roomId),
        ].join(''));
        let url = 'https://comntr.github.io'
            + `?room=${roomId}&filter=${filterId}`;
        $(ID_EXAMPLE).textContent = `
<iframe id="comntr"
  referrerpolicy="no-referrer">
</iframe>
<script>
  document.querySelector('#comntr').src =
    '${url}' + '#' + location.host;
</script>
`.trim();
        $(ID_FILTER).textContent = roomId;
        $(ID_PUBLIC_KEY).textContent = hashutil_1.a2hs(keys.publicKey);
    }
    exports.init = init;
});
//# sourceMappingURL=index.js.map