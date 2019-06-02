define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class LSStorage {
        getEntry(key) {
            return new LSEntry(key);
        }
    }
    exports.LSStorage = LSStorage;
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
            }
            else {
                this.remove();
            }
        }
        remove() {
            localStorage.removeItem(this.key);
        }
        get json() {
            let text = this.text;
            return text ? JSON.parse(text) : undefined;
        }
        set json(value) {
            if (value === undefined)
                this.remove();
            else
                this.text = JSON.stringify(value);
        }
        get text() {
            return this.getValue();
        }
        set text(value) {
            this.setValue(value);
        }
    }
    exports.LSEntry = LSEntry;
    exports.gStorage = new LSStorage;
});
//# sourceMappingURL=storage.js.map