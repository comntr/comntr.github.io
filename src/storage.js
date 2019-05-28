class LSStorage {
  getEntry(key) {
    return new LSEntry(key);
  }
}

class LSEntry {
  constructor(key) {
    this.key = key;
  }

  getValue() {
    return localStorage.getItem(this.key) || '';
  }

  setValue(value) {
    if (value) {
      localStorage.setItem(this.key, value);
    } else {
      localStorage.removeItem(this.key);
    }
  }
}

const gStorage = new LSStorage;
