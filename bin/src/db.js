define(["require", "exports", "src/log"], function (require, exports, log_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class DB {
        constructor(name) {
            this.name = name;
            this.version = 1;
            this.tnames = new Set();
        }
        openTable(name) {
            if (this.tnames.has(name))
                throw new Error(`Table ${this.name}.${name} alredy opened.`);
            let t = new Table(name, this);
            this.tnames.add(name);
            return t;
        }
        init() {
            if (this.ready)
                return this.ready;
            let time = Date.now();
            this.ready = new Promise((resolve, reject) => {
                let req = indexedDB.open(this.name, this.version);
                req.onupgradeneeded = (e) => {
                    log_1.log.i(this.name + ':upgradeneeded');
                    let db = e.target.result;
                    for (let tname of this.tnames) {
                        log_1.log.i('Opening a table:', tname);
                        db.createObjectStore(tname);
                    }
                };
                req.onsuccess = (e) => {
                    log_1.log.i(this.name + ':success', Date.now() - time, 'ms');
                    this.db = e.target.result;
                    resolve(this.db);
                };
                req.onerror = e => {
                    log_1.log.e(this.name + ':error', e);
                    reject(e);
                };
            });
            return this.ready;
        }
    }
    exports.DB = DB;
    class Table {
        constructor(name, db) {
            this.name = name;
            this.db = db;
        }
        async get(key) {
            let db = await this.db.init();
            return new Promise((resolve, reject) => {
                let t = db.transaction(this.name, 'readonly');
                let s = t.objectStore(this.name);
                let r = s.get(key);
                r.onerror = () => reject(new Error(`${this.name}.get(${key}) failed: ${r.error}`));
                r.onsuccess = () => resolve(r.result);
            });
        }
        async set(key, value) {
            let db = await this.db.init();
            await new Promise((resolve, reject) => {
                let t = db.transaction(this.name, 'readwrite');
                let s = t.objectStore(this.name);
                let r = s.put(value, key);
                r.onerror = () => reject(new Error(`${this.name}.set(${key}) failed: ${r.error}`));
                r.onsuccess = () => resolve();
            });
        }
        async remove(key) {
            let db = await this.db.init();
            await new Promise((resolve, reject) => {
                let t = db.transaction(this.name, 'readwrite');
                let s = t.objectStore(this.name);
                let r = s.delete(key);
                r.onerror = () => reject(new Error(`${this.name}.remove(${key}) failed: ${r.error}`));
                r.onsuccess = () => resolve();
            });
        }
        async keys() {
            let db = await this.db.init();
            return new Promise((resolve, reject) => {
                let t = db.transaction(this.name, 'readonly');
                let s = t.objectStore(this.name);
                let r = s.getAllKeys();
                r.onerror = () => reject(new Error(`${this.name}.keys() failed: ${r.error}`));
                r.onsuccess = () => resolve(r.result);
            });
        }
    }
    exports.Table = Table;
    function openDb(name) {
        return new DB(name);
    }
    exports.openDb = openDb;
});
//# sourceMappingURL=db.js.map