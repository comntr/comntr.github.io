import { log } from 'src/log';

const CONFIG_TABLE_SEL = '#config';

const storage = localStorage;

log.i('Module loaded. Now index.html needs to call init().');
window.onhashchange = init;

export function init() {
  let tbody = document.querySelector(CONFIG_TABLE_SEL + ' > tbody');
  tbody.innerHTML = '';
  log.i('Getting config from LS.');
  let filter = location.hash.slice(1).trim();
  if (filter) log.i('Filtering props by:', filter);
  for (let i = 0; i < storage.length; i++) {
    let key = storage.key(i);
    if (!filter || key.indexOf(filter) >= 0)
      addConfigProp(key);
  }
  log.i('Added all config props.');
  setPropSavedHandler();
}

function addConfigProp(key: string) {
  let value = storage.getItem(key);
  let tbody = document.querySelector(CONFIG_TABLE_SEL + ' > tbody');
  tbody.innerHTML += `<tr prop="${key}">
    <td class="key">${key}
    <td class="val" contenteditable spellcheck=false>${value}`;
}

function setPropSavedHandler() {
  let table: HTMLElement = document.querySelector(CONFIG_TABLE_SEL);
  table.addEventListener('focusout', e => {
    let tdval = e.target as HTMLElement;
    if (!tdval || !tdval.classList.contains('val')) return;
    let key = tdval.parentElement.getAttribute('prop')
    let newValue = tdval.textContent.trim();
    let oldValue = storage.getItem(key);
    let changed = newValue != oldValue;
    log.i('td.val:focusout:', JSON.stringify(key), 'changed?', changed);
    if (key && changed) {
      log.w('New value:', JSON.stringify(newValue + ''));
      storage.setItem(key, newValue);
      tdval.textContent = newValue;
    }
  });
}
