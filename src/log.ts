export const log = (...args) => console.log(...args);
log.i = (...args) => console.log(...args);
log.w = (...args) => console.warn(...args);
log.e = (...args) => console.error(...args);