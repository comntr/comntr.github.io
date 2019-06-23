define(["require", "exports", "./hashutil", "./log", "./storage", "src/db"], function (require, exports, hashutil_1, log_1, storage_1, db) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    //  /indexedDb
    //    /<t-hash>                 <-- DB
    //      /metadata               <-- Object store with topic metadata
    //        ("xorhash", "...")
    //      /comments               <-- Object store with topic comments
    //        (<c-hash>, <c-data>)
    //        ...
    const LRU_CACHE_TOPICS_KEY = '.cache.topics';
    const LRU_CACHE_TOPICS_CAP = 100;
    const LRU_CACHE_TOPICS_SEP = ',';
    const DB_TABLE_COMMENTS = 'comments';
    const DB_TABLE_METADATA = 'metadata';
    const DB_ENTRY_XORHASH = 'xorhash';
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
                    let t = this.topics.get(h);
                    this.topics.delete(h);
                    t.remove();
                }
            }
            let list = this.thashes.join(LRU_CACHE_TOPICS_SEP);
            this.lsentry.setValue(list);
            return topic;
        }
    }
    class CachedTopic {
        constructor(thash) {
            this.metadata = {
                get: key => this.mt.get(key),
                set: (key, value) => this.mt.set(key, value),
                remove: key => this.mt.remove(key),
            };
            this.db = db.openDb(thash);
            this.ct = this.db.openTable(DB_TABLE_COMMENTS);
            this.mt = this.db.openTable(DB_TABLE_METADATA);
        }
        getCommentData(chash) {
            return this.ct.get(chash);
        }
        addComment(chash, cdata) {
            return this.ct.set(chash, cdata);
        }
        getCommentHashes() {
            return this.ct.keys();
        }
        async setCommentHashes(list) {
            let xorh = hashutil_1.xorall(list.map(hashutil_1.hs2a));
            if (!xorh)
                return;
            log_1.log('New xorhash:', hashutil_1.a2hs(xorh));
            await this.mt.set(DB_ENTRY_XORHASH, hashutil_1.a2hs(xorh));
        }
        async getXorHash() {
            return this.mt.get(DB_ENTRY_XORHASH);
        }
        async remove() {
            for (let chash of await this.getCommentHashes())
                await this.ct.remove(chash);
            await this.mt.remove(DB_ENTRY_XORHASH);
        }
    }
    exports.gCache = new LRUCache;
    exports.gComments = {};
});
//# sourceMappingURL=cache.js.map