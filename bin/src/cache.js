define(["require", "exports", "./hashutil", "./log", "./storage"], function (require, exports, hashutil_1, log_1, storage_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const LRU_CACHE_TOPICS_KEY = '.cache.topics';
    const LRU_CACHE_TOPICS_CAP = 100;
    const LRU_CACHE_TOPICS_SEP = ',';
    class LRUCache {
        constructor() {
            this.topics = new Map();
            this.lsentry = storage_1.gStorage.getEntry(LRU_CACHE_TOPICS_KEY);
            let list = this.lsentry.getValue();
            this.thashes = !list ? [] : list.split(LRU_CACHE_TOPICS_SEP);
        }
        getTopic(thash) {
            let topic = this.topics.get(thash);
            if (topic) {
                let i = this.thashes.findIndex(h => h == thash);
                this.thashes.splice(i, 1);
            }
            else {
                log_1.log('Initializing topic cache:', thash);
                topic = new CachedTopic(thash);
                this.topics.set(thash, topic);
            }
            this.thashes.push(thash);
            let diff = this.thashes.length - LRU_CACHE_TOPICS_CAP;
            if (diff > 0) {
                let removed = this.thashes.splice(0, diff);
                for (let h of removed) {
                    log_1.log('Uncaching topic:', h);
                    let t = this.topics[h];
                    this.topics.delete(h);
                    if (t)
                        t.remove();
                }
            }
            let list = this.thashes.join(LRU_CACHE_TOPICS_SEP);
            this.lsentry.setValue(list);
            return topic;
        }
    }
    // <t-hash>.comments = [<c-hash>, <c-hash>, ...]
    // <t-hash>.xorhash = <...>
    // <c-hash>.data = <...>
    class CachedTopic {
        constructor(thash) {
            this.thash = thash;
            this.lsentry = storage_1.gStorage.getEntry(thash + '.comments');
            this.lsxorhash = storage_1.gStorage.getEntry(thash + '.xorhash');
        }
        getCommentData(chash) {
            return storage_1.gStorage.getEntry(chash + '.data').getValue();
        }
        addComment(chash, cdata) {
            storage_1.gStorage.getEntry(chash + '.data').setValue(cdata);
        }
        getCommentHashes() {
            let list = this.lsentry.getValue();
            return !list ? [] : list.split(LRU_CACHE_TOPICS_SEP);
        }
        setCommentHashes(list) {
            this.lsentry.setValue(list.join(LRU_CACHE_TOPICS_SEP));
            let xorh = hashutil_1.xorall(list.map(hashutil_1.hs2a));
            if (!xorh)
                return;
            log_1.log('New cached xorhash:', hashutil_1.a2hs(xorh));
            this.lsxorhash.setValue(hashutil_1.a2hs(xorh));
        }
        getXorHash() {
            return this.lsxorhash.getValue();
        }
        remove() {
            for (let chash of this.getCommentHashes()) {
                let lse = storage_1.gStorage.getEntry(chash + '.data');
                let cdata = lse.getValue();
                lse.setValue(null);
                storage_1.gStorage.getEntry(cdata).setValue(null);
            }
            this.lsentry.setValue(null);
        }
    }
    exports.gCache = new LRUCache;
    exports.gComments = {};
});
//# sourceMappingURL=cache.js.map