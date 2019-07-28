import * as logger from 'src/log';
import { gUser } from 'src/user';
import { a2hs } from 'src/hashutil';

const ID_EXAMPLE = '#example';
const ID_FILTER_TAG = '#filter-tag';
const ID_PUBLIC_KEY = '#public-key';

const $ = (sel: string): HTMLElement => document.querySelector(sel);
const log = logger.tagged('about');

export function init() {
  log.i('init()');
  $(ID_FILTER_TAG).addEventListener('focusout', () => refresh());
  refresh();
}

async function refresh() {
  let publicKey = await gUser.getPublicKey();
  let filterTag = $(ID_FILTER_TAG).textContent;
  let filterId = await gUser.deriveFilterId(filterTag);
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
