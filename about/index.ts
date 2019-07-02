import { tagged } from 'src/log';
import { gUser } from 'src/user';
import { sha1, a2hs } from 'src/hashutil';

const ID_EXAMPLE = '#example';
const ID_FILTER = '#filter-id';
const ID_PUBLIC_KEY = '#public-key';

const $ = (sel: string): HTMLElement => document.querySelector(sel);
const log = tagged('about');

export async function init() {
  log.i('init()');
  let keys = await gUser.getUserKeys();
  let roomId = 'MyFirstFilter';
  let filterId = await sha1([
    await sha1(a2hs(keys.publicKey)),
    await sha1(roomId),
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
  $(ID_PUBLIC_KEY).textContent = a2hs(keys.publicKey);
}
