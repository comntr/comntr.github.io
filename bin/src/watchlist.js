define(["require", "exports", "./log", "./storage"], function (require, exports, log_1, storage_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const WATCHLIST_LSKEY = '.watchlist';
    class WatchList {
        constructor() {
            this.lsentry = storage_1.gStorage.getEntry(WATCHLIST_LSKEY);
        }
        static getUrlKey(hash) {
            return hash + '.url';
        }
        static getSizeKey(hash) {
            return hash + '.size';
        }
        get() {
            let value = this.lsentry.getValue();
            return !value ? [] : value.split(',');
        }
        set(hashes) {
            let value = hashes.join(',');
            this.lsentry.setValue(value);
        }
        setUrl(hash, url) {
            let key = WatchList.getUrlKey(hash);
            let lse = storage_1.gStorage.getEntry(key);
            lse.setValue(url);
        }
        getUrl(hash) {
            let key = WatchList.getUrlKey(hash);
            let lse = storage_1.gStorage.getEntry(key);
            return lse.getValue();
        }
        setSize(hash, size) {
            let key = WatchList.getSizeKey(hash);
            let lse = storage_1.gStorage.getEntry(key);
            lse.setValue(size + '');
        }
        getSize(hash) {
            let key = WatchList.getSizeKey(hash);
            return +localStorage.getItem(key) || 0;
        }
        add(hash, url) {
            log_1.log('Adding URL to the watchlist:', url);
            let hashes = this.get();
            let i = hashes.findIndex(h => h == hash);
            if (i >= 0)
                hashes.splice(i, 1);
            hashes.splice(0, 0, hash);
            this.set(hashes);
            if (url)
                this.setUrl(hash, url);
        }
        isWatched(hash) {
            return !!this.getUrl(hash);
        }
    }
    exports.gWatchlist = new WatchList;
});
//# sourceMappingURL=watchlist.js.map