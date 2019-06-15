define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.log = (...args) => console.log(...args);
    exports.log.i = (...args) => console.log(...args);
    exports.log.w = (...args) => console.warn(...args);
    exports.log.e = (...args) => console.error(...args);
});
//# sourceMappingURL=log.js.map