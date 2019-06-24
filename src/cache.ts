import { xorall, hs2a, a2hs } from 'src/hashutil';
import { log } from 'src/log';
import { gStorage } from 'src/storage';
import * as db from 'src/db';
import { gConfig } from 'src/config';

//  /indexedDb
//    /<t-hash>                 <-- DB
//      /metadata               <-- Object store with topic metadata
//        ("xorhash", "...")
//      /comments               <-- Object store with topic comments
//        (<c-hash>, <c-data>)
//        ...

const LRU_CACHE_TOPICS_KEY = 'sys.cache.topics';
const LRU_CACHE_TOPICS_SEP = ',';
const DB_TABLE_COMMENTS = 'comments';
const DB_TABLE_METADATA = 'metadata';
const DB_ENTRY_XORHASH = 'xorhash';

type THash = string;
type CHash = string;

class LRUCache {
  private topics = new Map<THash, CachedTopic>();
  private lsentry = gStorage.getEntry(LRU_CACHE_TOPICS_KEY);
  private thashes: string[]; // The last used thash is at the end of the array.

  constructor() {
    let list = this.lsentry.getValue();
    this.thashes = !list ? [] : list.split(LRU_CACHE_TOPICS_SEP);
  }

  getTopic(thash: string) {
    let topic = this.topics.get(thash);

    if (topic) {
      let i = this.thashes.findIndex(h => h == thash);
      this.thashes.splice(i, 1);
    } else {
      log('Initializing topic cache:', thash);
      topic = new CachedTopic(thash);
      this.topics.set(thash, topic);
    }

    this.thashes.push(thash);

    let diff = this.thashes.length - gConfig.lrucap.get();
    if (diff > 0) {
      let removed = this.thashes.splice(0, diff);
      for (let h of removed) {
        log('Uncaching topic:', h);
        let t = this.topics.get(h);
        this.topics.delete(h);
        // tslint:disable-next-line:no-floating-promises
        t.remove();
      }
    }

    let list = this.thashes.join(LRU_CACHE_TOPICS_SEP);
    this.lsentry.setValue(list);
    return topic;
  }
}

class CachedTopic {
  private db: db.DB;
  private ct: db.Table<string>; // comments table
  private mt: db.Table<any>; // metadata table

  metadata = {
    get: key => this.mt.get(key),
    set: (key, value) => this.mt.set(key, value),
    remove: key => this.mt.remove(key),
  };

  constructor(thash: string) {
    this.db = db.openDb(thash);
    this.ct = this.db.openTable<string>(DB_TABLE_COMMENTS);
    this.mt = this.db.openTable<string>(DB_TABLE_METADATA);
  }

  getCommentData(chash: CHash): Promise<string> {
    return this.ct.get(chash);
  }

  addComment(chash: CHash, cdata: string): Promise<void> {
    return this.ct.set(chash, cdata);
  }

  getCommentHashes(): Promise<string[]> {
    return this.ct.keys();
  }

  async setCommentHashes(list: string[]) {
    let xorh = xorall(list.map(hs2a));
    if (!xorh) return;
    log('New xorhash:', a2hs(xorh));
    await this.mt.set(DB_ENTRY_XORHASH, a2hs(xorh)); 
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

interface CMemCache {
  [chash: string]: string;
}

export const gCache = new LRUCache;
export const gComments: CMemCache = {};

