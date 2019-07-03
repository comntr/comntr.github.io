import * as logger from 'src/log';
import { gUser } from 'src/user';
import { a2hs } from 'src/hashutil';

const ID_EXAMPLE = '#example';
const ID_FILTER_TAG = '#filter-tag';
const ID_PUBLIC_KEY = '#public-key';

const $ = (sel: string): HTMLElement => document.querySelector(sel);
const log = logger.tagged('about');

export async function init() {
  log.i('init()');
  let publicKey = await gUser.getPublicKey();
  let filterTag = 'FooBar';
  let filterId = await gUser.deriveFilterId(filterTag);
  let url = 'https://comntr.github.io'
    + `?tag=${filterTag}&filter=${filterId}`;

  $(ID_EXAMPLE).textContent = `
<iframe id="comntr"
  referrerpolicy="no-referrer">
</iframe>
<script>
  document.querySelector('#comntr').src =
    '${url}' + '#' + location.host;
</script>
`.trim();

  $(ID_FILTER_TAG).textContent = filterTag;
  $(ID_PUBLIC_KEY).textContent = publicKey;
}
