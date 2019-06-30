export const log = (...args) => console.log(...args);
log.i = (...args) => console.log(...args);
log.w = (...args) => console.warn(...args);
log.e = (...args) => console.error(...args);

export const tagged = (tag: string) => {
  let prefix = '[' + tag + ']';

  return {
    w: (...args) => console.warn(prefix, 'W', ...args),
    i: (...args) => console.info(prefix, 'I', ...args),
    d: (...args) => console.log(prefix, 'D', ...args),
    e: (...args) => console.error(prefix, 'E', ...args),
    tagged: (tag2: string) => tagged(tag + '.' + tag2),
  };
};

