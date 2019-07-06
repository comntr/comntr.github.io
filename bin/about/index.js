define(["require", "exports", "src/log", "src/user"], function (require, exports, logger, user_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ID_EXAMPLE = '#example';
    const ID_IFRAME = '#comntr';
    const ID_RIGHT_DIV = '#right';
    const ID_FILTER_TAG = '#filter-tag';
    const ID_PUBLIC_KEY = '#public-key';
    const $ = (sel) => document.querySelector(sel);
    const log = logger.tagged('about');
    async function init() {
        log.i('init()');
        let publicKey = await user_1.gUser.getPublicKey();
        let filterTag = 'FooBar';
        let filterId = await user_1.gUser.deriveFilterId(filterTag);
        let url = location.origin + `?tag=${filterTag}&filter=${filterId}`;
        let html = `
<iframe id="comntr"
  referrerpolicy="no-referrer">
</iframe>
<script>
  document.querySelector('#comntr').src =
    '${url}' + '#' + location.href;
</script>
`.trim();
        $(ID_EXAMPLE).textContent = html;
        $(ID_FILTER_TAG).textContent = filterTag;
        $(ID_PUBLIC_KEY).textContent = publicKey;
    }
    exports.init = init;
});
//# sourceMappingURL=index.js.map