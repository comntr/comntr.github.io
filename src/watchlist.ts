import { log } from './log';
import { gStorage } from './storage';

const WATCHLIST_LSKEY = '.watchlist';

class WatchList {
  private lsentry = gStorage.getEntry(WATCHLIST_LSKEY);

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

  setUrl(hash, url: string) {
    let key = WatchList.getUrlKey(hash);
    let lse = gStorage.getEntry(key);
    lse.setValue(url);
  }

  getUrl(hash) {
    let key = WatchList.getUrlKey(hash);
    let lse = gStorage.getEntry(key);
    return lse.getValue();
  }

  setSize(hash, size) {
    let key = WatchList.getSizeKey(hash);
    let lse = gStorage.getEntry(key);
    lse.setValue(size + '');
  }

  getSize(hash) {
    let key = WatchList.getSizeKey(hash);
    return +localStorage.getItem(key) || 0;
  }

  add(hash, url) {
    log('Adding URL to the watchlist:', url);
    let hashes = this.get();
    let i = hashes.findIndex(h => h == hash);
    if (i >= 0) hashes.splice(i, 1);
    hashes.splice(0, 0, hash);
    this.set(hashes);
    if (url) this.setUrl(hash, url);
  }

  isWatched(hash) {
    return !!this.getUrl(hash);
  }
}

export const gWatchlist = new WatchList;
