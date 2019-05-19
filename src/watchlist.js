const WATCHLIST_LSKEY = '.watchlist';

function getValue(key) {
  return localStorage.getItem(key) || '';
}

function setValue(key, value) {
  if (value) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
}

class WatchList {
  static getUrlKey(hash) {
    return hash + '.url';
  }

  static getSizeKey(hash) {
    return hash + '.size';
  }

  get() {
    let value = getValue(WATCHLIST_LSKEY);
    return !value ? [] : value.split(',');
  }

  set(hashes) {
    let value = hashes.join(',');
    setValue(WATCHLIST_LSKEY, value);
  }

  setUrl(hash, url) {
    let key = WatchList.getUrlKey(hash);
    setValue(key, url);
  }

  getUrl(hash) {
    let key = WatchList.getUrlKey(hash);
    return localStorage.getItem(key);
  }

  setSize(hash, size) {
    let key = WatchList.getSizeKey(hash);
    setValue(key, size + '');
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

let gWatchlist = new WatchList;
