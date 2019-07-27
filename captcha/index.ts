import * as logger from 'src/log';

const $ = (sel: string): HTMLElement => document.querySelector(sel);
const log = logger.tagged('captcha');

const ID_QUESTION = '#question';
const ID_ANSWER = '#answer';
const ID_SIGNATURE = '#signature';
const ID_VERIFY = '#verify';

export function init() {
  log.i('init()');
  let hash = location.hash.slice(1) || 'abc';
  let img = $(ID_QUESTION) as HTMLImageElement;
  img.src += hash;
  $(ID_VERIFY).addEventListener('click', verify);
}

async function verify() {
  let answer = $(ID_ANSWER).textContent;
  log.i('answer:', answer);
  let img = $(ID_QUESTION) as HTMLImageElement;
  let url = img.src.replace(
    /\/question\/(.+)$/,
    '/postmark/$1?answer=' + answer);
  let res = await fetch(url);
  let text = await res.text();
  $(ID_SIGNATURE).textContent = res.status == 200 ?
    text : res.status + ' ' + res.statusText + ' ' + text;
}
