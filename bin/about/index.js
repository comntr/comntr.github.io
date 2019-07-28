define(["require", "exports", "src/log", "src/user"], function (require, exports, logger, user_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ID_EXAMPLE = '#example';
    const ID_FILTER_TAG = '#filter-tag';
    const ID_PUBLIC_KEY = '#public-key';
    const $ = (sel) => document.querySelector(sel);
    const log = logger.tagged('about');
    function init() {
        log.i('init()');
        $(ID_FILTER_TAG).addEventListener('focusout', () => refresh());
        refresh();
    }
    exports.init = init;
    async function refresh() {
        let publicKey = await user_1.gUser.getPublicKey();
        let filterTag = $(ID_FILTER_TAG).textContent;
        let filterId = await user_1.gUser.deriveFilterId(filterTag);
        let url = location.origin + `?tag=${filterTag}&filter=${filterId}`;
        let html = `
<iframe id="comntr"
  referrerpolicy="no-referrer"
  sandbox="allow-scripts allow-same-origin allow-popups">
</iframe>
<script>
  document.querySelector('#comntr').src =
    '${url}' + '#' + location.href;
</script>
`.trim();
        $(ID_EXAMPLE).textContent = html;
        $(ID_FILTER_TAG).textContent = filterTag;
        $(ID_PUBLIC_KEY).textContent = publicKey.slice(0, 7) +
            ' [' + publicKey.length / 2 + ' bytes]';
    }
});
//# sourceMappingURL=index.js.map