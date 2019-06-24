define(["require", "exports", "src/log", "src/storage", "src/cache"], function (require, exports, log_1, storage_1, cache_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const WATCHLIST_LSKEY = 'sys.watchlist';
    const META_KEY_URL = 'url';
    const META_KEY_SIZE = 'size';
    class WatchList {
        constructor() {
            this.lsentry = storage_1.gStorage.getEntry(WATCHLIST_LSKEY);
        }
        get() {
            let value = this.lsentry.getValue();
            return !value ? [] : value.split(',');
        }
        set(hashes) {
            let value = hashes.join(',');
            this.lsentry.setValue(value);
        }
        async setUrl(hash, url) {
            let t = cache_1.gCache.getTopic(hash);
            return t.metadata.set(META_KEY_URL, url);
        }
        async getUrl(hash) {
            let t = cache_1.gCache.getTopic(hash);
            return t.metadata.get(META_KEY_URL);
        }
        async setSize(hash, size) {
            let t = cache_1.gCache.getTopic(hash);
            return t.metadata.set(META_KEY_SIZE, size);
        }
        async getSize(hash) {
            let t = cache_1.gCache.getTopic(hash);
            return t.metadata.get(META_KEY_SIZE)
                .then(n => n || 0);
        }
        async add(hash, url) {
            log_1.log('Adding URL to the watchlist:', url);
            let hashes = this.get();
            let i = hashes.findIndex(h => h == hash);
            if (i >= 0)
                hashes.splice(i, 1);
            hashes.splice(0, 0, hash);
            this.set(hashes);
            if (url)
                await this.setUrl(hash, url);
        }
        async isWatched(hash) {
            return !!await this.getUrl(hash);
        }
    }
    exports.gWatchlist = new WatchList;
});
//# sourceMappingURL=watchlist.js.map