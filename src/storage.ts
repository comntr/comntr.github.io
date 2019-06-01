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
      this.remove();
    }
  }

  remove() {
    localStorage.removeItem(this.key);
  }

  get json() {
    return JSON.parse(this.getValue());
  }

  set json(value) {
    this.setValue(JSON.stringify(value));
  }

  get text() {
    return this.getValue();
  }

  set text(value) {
    this.setValue(value);
  }
}

export const gStorage = new LSStorage;
