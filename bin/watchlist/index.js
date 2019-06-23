define(["require", "exports", "src/log", "src/watchlist", "src/dataserver"], function (require, exports, log_1, watchlist_1, dataserver_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const UNDO_ID_PREFIX = 'uw-';
    window.onload = () => refreshList();
    window.onclick = e => handleClick(e.target);
    window.onbeforeunload = () => saveChanges();
    async function refreshList() {
        let hashes = watchlist_1.gWatchlist.get();
        if (hashes.length < 1)
            return;
        let urls = await Promise.all(hashes.map(h => watchlist_1.gWatchlist.getUrl(h)));
        let htmls = [];
        for (let i = 0; i < urls.length; i++) {
            let hash = hashes[i];
            let url = urls[i];
            let href = '#' + (url || hash);
            let html = `
      <div id="_${hash}">
        <b id="${UNDO_ID_PREFIX + hash}" title="Unwatch">X</b>
        <span>? comments</span>
        <a href="/${href}">${href}</a>
      </div>`;
            htmls.push(html);
        }
        document.body.innerHTML = htmls.join('\n');
        let counts = await dataserver_1.gDataServer.fetchCommentsCount(hashes);
        log_1.log('Counts:', counts);
        for (let i = 0; i < hashes.length; i++) {
            let hash = hashes[i];
            let count = counts[i];
            let lastSeen = await watchlist_1.gWatchlist.getSize(hash);
            let diff = count - lastSeen;
            let selector = `div#_${hash} > span`;
            let span = document.querySelector(selector);
            span.textContent = '+' + diff + ' new comments';
        }
    }
    async function handleClick(target) {
        let id = target && target.id;
        if (!id.startsWith(UNDO_ID_PREFIX))
            return;
        if (target.textContent != '+') {
            target.textContent = '+';
            target.title = 'Add back to the watchlist';
        }
        else {
            target.textContent = 'X';
            target.title = 'Unwatch';
        }
    }
    function saveChanges() {
        let hashes = watchlist_1.gWatchlist.get().filter(h => {
            let selector = '#' + UNDO_ID_PREFIX + h;
            let b = document.querySelector(selector);
            return !b || b.textContent != '+';
        });
        log_1.log(`The new watchlist:\n${hashes.join('\n')}`);
        watchlist_1.gWatchlist.set(hashes);
    }
});
//# sourceMappingURL=index.js.map