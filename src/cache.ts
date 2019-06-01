import { xorall, hs2a, a2hs } from './hashutil';
import { log } from './log';
import { gStorage, LSEntry } from './storage';

const LRU_CACHE_TOPICS_KEY = '.cache.topics';
const LRU_CACHE_TOPICS_CAP = 100;
const LRU_CACHE_TOPICS_SEP = ',';

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

    let diff = this.thashes.length - LRU_CACHE_TOPICS_CAP;
    if (diff > 0) {
      let removed = this.thashes.splice(0, diff);
      for (let h of removed) {
        log('Uncaching topic:', h);
        let t = this.topics[h];
        this.topics.delete(h);
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
  private lsentry: LSEntry;
  private lsxorhash: LSEntry;

  constructor(private thash: string) {
    this.lsentry = gStorage.getEntry(thash + '.comments');
    this.lsxorhash = gStorage.getEntry(thash + '.xorhash');
  }

  getCommentData(chash: CHash) {
    return gStorage.getEntry(chash + '.data').getValue();
  }

  addComment(chash: CHash, cdata: string) {
    gStorage.getEntry(chash + '.data').setValue(cdata);
  }

  getCommentHashes() {
    let list = this.lsentry.getValue();
    return !list ? [] : list.split(LRU_CACHE_TOPICS_SEP);
  }

  setCommentHashes(list) {
    this.lsentry.setValue(list.join(LRU_CACHE_TOPICS_SEP));
    let xorh = xorall(list.map(hs2a));
    if (!xorh) return;
    log('New cached xorhash:', a2hs(xorh));
    this.lsxorhash.setValue(a2hs(xorh));
  }

  getXorHash() {
    return this.lsxorhash.getValue();
  }

  remove() {
    for (let chash of this.getCommentHashes()) {
      let lse = gStorage.getEntry(chash + '.data');
      let cdata = lse.getValue();
      lse.setValue(null);
      gStorage.getEntry(cdata).setValue(null);
    }

    this.lsentry.setValue(null);
  }
}

export const gCache = new LRUCache;
export const gComments = {};

