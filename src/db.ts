import { log } from 'src/log';

export class DB {
  public version = 1;

  private tnames = new Set<string>();
  private ready: Promise<IDBDatabase>;
  public db: IDBDatabase;

  constructor(public name: string) {

  }

  openTable<T>(name: string): Table<T> {
    if (this.tnames.has(name))
      throw new Error(`Table ${this.name}.${name} alredy opened.`);
    let t = new Table<T>(name, this);
    this.tnames.add(name);
    return t;
  }

  init(): Promise<IDBDatabase> {
    if (this.ready) return this.ready;
    let time = Date.now();

    this.ready = new Promise<IDBDatabase>((resolve, reject) => {
      let req = indexedDB.open(this.name, this.version);
      req.onupgradeneeded = (e: any) => {
        log.i(this.name + ':upgradeneeded');
        let db: IDBDatabase = e.target.result;
        for (let tname of this.tnames) {
          log.i('Opening a table:', tname);
          db.createObjectStore(tname);
        }
      };
      req.onsuccess = (e: any) => {
        log.i(this.name + ':success', Date.now() - time, 'ms');
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = e => {
        log.e(this.name + ':error', e);
        reject(e);
      };
    });

    return this.ready;
  }
}

export class Table<T> {
  constructor(public name: string, private db: DB) {

  }

  async get(key: string): Promise<T> {
    let db = await this.db.init();
    return new Promise<T>((resolve, reject) => {
      let t = db.transaction(this.name, 'readonly');
      let s = t.objectStore(this.name);
      let r = s.get(key);
      r.onerror = () => reject(new Error(`${this.name}.get(${key}) failed: ${r.error}`));
      r.onsuccess = () => resolve(r.result);
    });
  }

  async set(key: string, value: T): Promise<void> {
    let db = await this.db.init();
    await new Promise((resolve, reject) => {
      let t = db.transaction(this.name, 'readwrite');
      let s = t.objectStore(this.name);
      let r = s.put(value, key);
      r.onerror = () => reject(new Error(`${this.name}.set(${key}) failed: ${r.error}`));
      r.onsuccess = () => resolve();
    });
  }

  async remove(key: string): Promise<void> {
    let db = await this.db.init();
    await new Promise((resolve, reject) => {
      let t = db.transaction(this.name, 'readwrite');
      let s = t.objectStore(this.name);
      let r = s.delete(key);
      r.onerror = () => reject(new Error(`${this.name}.remove(${key}) failed: ${r.error}`));
      r.onsuccess = () => resolve();
    });
  }

  async keys(): Promise<string[]> {
    let db = await this.db.init();
    return new Promise<string[]>((resolve, reject) => {
      let t = db.transaction(this.name, 'readonly');
      let s = t.objectStore(this.name);
      let r = s.getAllKeys();
      r.onerror = () => reject(new Error(`${this.name}.keys() failed: ${r.error}`));
      r.onsuccess = () => resolve(r.result as string[]);
    });
  }
}

export function openDb(name: string): DB {
  return new DB(name);
}
