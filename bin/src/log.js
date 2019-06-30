define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.log = (...args) => console.log(...args);
    exports.log.i = (...args) => console.log(...args);
    exports.log.w = (...args) => console.warn(...args);
    exports.log.e = (...args) => console.error(...args);
    exports.tagged = (tag) => {
        let prefix = '[' + tag + ']';
        return {
            w: (...args) => console.warn(prefix, 'W', ...args),
            i: (...args) => console.info(prefix, 'I', ...args),
            d: (...args) => console.log(prefix, 'D', ...args),
            e: (...args) => console.error(prefix, 'E', ...args),
            tagged: (tag2) => exports.tagged(tag + '.' + tag2),
        };
    };
});
//# sourceMappingURL=log.js.map