export class LSStorage {
  getEntry(key: string) {
    return new LSEntry(key);
  }
}

export class LSEntry {
  constructor(private key: string) {

  }

  getValue() {
    return localStorage.getItem(this.key) || '';
  }

  setValue(value: string) {
    if (value) {
      localStorage.setItem(this.key, value);
    } else {
      localStorage.removeItem(this.key);
    }
  }
}

export const gStorage = new LSStorage;
