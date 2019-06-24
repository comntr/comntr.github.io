define(["require", "exports", "src/log"], function (require, exports, log_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const CONFIG_TABLE_SEL = '#config';
    const storage = localStorage;
    log_1.log.i('Module loaded. Now index.html needs to call init().');
    window.onhashchange = init;
    async function init() {
        let tbody = document.querySelector(CONFIG_TABLE_SEL + ' > tbody');
        tbody.innerHTML = '';
        setPropSavedHandler();
        log_1.log.i('Getting config from LS.');
        let filter = location.hash.slice(1).trim();
        if (filter)
            log_1.log.i('Filtering props by:', filter);
        let keys = getStorageKeys();
        log_1.log.i('All keys:', keys.length);
        keys = keys.filter(key => !filter || key.indexOf(filter) >= 0);
        keys.sort();
        log_1.log.i('Keys filtered and sorted:', keys.length);
        for (let key of keys) {
            await sleep(0); // to unblock UI
            addConfigProp(key);
        }
        log_1.log.i('Added all config props.');
    }
    exports.init = init;
    function getStorageKeys() {
        let keys = [];
        for (let i = 0; i < storage.length; i++) {
            let key = storage.key(i);
            keys.push(key);
        }
        return keys;
    }
    function sleep(dt) {
        return new Promise(resolve => {
            setTimeout(resolve, dt * 1000);
        });
    }
    function addConfigProp(key) {
        let value = storage.getItem(key);
        let tbody = document.querySelector(CONFIG_TABLE_SEL + ' > tbody');
        tbody.innerHTML += `<tr prop="${key}">
    <td class="key">${key}
    <td class="val" contenteditable spellcheck=false>${value}`;
    }
    function setPropSavedHandler() {
        let table = document.querySelector(CONFIG_TABLE_SEL);
        table.addEventListener('focusout', e => {
            let tdval = e.target;
            if (!tdval || !tdval.classList.contains('val'))
                return;
            let key = tdval.parentElement.getAttribute('prop');
            let newValue = tdval.textContent.trim();
            let oldValue = storage.getItem(key);
            let changed = newValue != oldValue;
            log_1.log.i('td.val:focusout:', JSON.stringify(key), 'changed?', changed);
            if (key && changed) {
                log_1.log.w('New value:', JSON.stringify(newValue + ''));
                storage.setItem(key, newValue);
                tdval.textContent = newValue;
            }
        });
    }
});
//# sourceMappingURL=index.js.map