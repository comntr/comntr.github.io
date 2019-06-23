import { log } from 'src/log';
import { gStorage } from 'src/storage';
import { gCache } from 'src/cache';

const WATCHLIST_LSKEY = '.watchlist';
const META_KEY_URL = 'url';
const META_KEY_SIZE = 'size';

class WatchList {
  private lsentry = gStorage.getEntry(WATCHLIST_LSKEY);

  get() {
    let value = this.lsentry.getValue();
    return !value ? [] : value.split(',');
  }

  set(hashes: string[]) {
    let value = hashes.join(',');
    this.lsentry.setValue(value);
  }

  async setUrl(hash: string, url: string): Promise<void> {
    let t = gCache.getTopic(hash);
    return t.metadata.set(META_KEY_URL, url);
  }

  async getUrl(hash: string): Promise<string> {
    let t = gCache.getTopic(hash);
    return t.metadata.get(META_KEY_URL);
  }

  async setSize(hash: string, size: number): Promise<void> {
    let t = gCache.getTopic(hash);
    return t.metadata.set(META_KEY_SIZE, size);
  }

  async getSize(hash: string): Promise<number> {
    let t = gCache.getTopic(hash);
    return t.metadata.get(META_KEY_SIZE)
      .then(n => n || 0);
  }

  async add(hash: string, url: string) {
    log('Adding URL to the watchlist:', url);
    let hashes = this.get();
    let i = hashes.findIndex(h => h == hash);
    if (i >= 0) hashes.splice(i, 1);
    hashes.splice(0, 0, hash);
    this.set(hashes);
    if (url) await this.setUrl(hash, url);
  }

  async isWatched(hash) {
    return !!await this.getUrl(hash);
  }
}

export const gWatchlist = new WatchList;
