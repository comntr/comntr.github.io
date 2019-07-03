let gQueryParams = null;

function getQueryParams() {
  if (gQueryParams) return gQueryParams;
  let dict = {};
  let args = location.search.slice(1).split('&');
  for (let arg of args) {
    let i = arg.indexOf('=');
    if (i < 0) i = arg.length;
    let name = decodeURIComponent(arg.slice(0, i));
    let value = decodeURIComponent(arg.slice(i + 1));
    dict[name] = value;
  }
  return gQueryParams = dict;
}

interface Prop<T> {
  get(): T;
  set(value: T): void;
}

// Reads a JSON property from the URL ?<...> query.
function qprop<T>(name: string, defval?: T): Prop<T> {
  return {
    get() {
      let qp = getQueryParams();
      let str = qp[name];
      if (!str) return defval;

      try {
        return JSON.parse(str);
      } catch (err) {
        return str;
      }
    },
    set() {
      // noop
    },
  };
}

// Reads a JSON property from localStorage.
function lsprop<T>(name: string, defval?: T): Prop<T> {
  return {
    get() {
      let str = localStorage.getItem(name);
      if (!str) {
        if (defval !== undefined) {
          let json = typeof defval === 'string' ?
            defval : JSON.stringify(defval);
          localStorage.setItem(name, json);
        }
        return defval;
      }

      try {
        return JSON.parse(str);
      } catch (err) {
        return str;
      }
    },
    set(value) {
      if (value === undefined) {
        localStorage.removeItem(name);
      } else if (typeof value === 'string') {
        localStorage.setItem(name, value);
      } else {
        let json = JSON.stringify(value);
        localStorage.setItem(name, json);
      }
    },
  };
}

// Returns the first non-undefined value.
function msprop<T>(props: Prop<T>[], defval?: T): Prop<T> {
  return {
    get() {
      for (let prop of props) {
        let val = prop.get();
        if (val !== undefined)
          return val;
      }
      return defval;
    },
    set(value) {
      for (let prop of props)
        prop.set(value);
    },
  };
}

export const gConfig = {
  ext: qprop('ext', false),

  // filter.id = sha1(
  //    sha1(user.keys.public) +
  //    sha1(filter.tag))
  filterTag: qprop<string>('tag'),
  filterId: qprop<string>('filter'),

  // add-comment throttling: 0.99 would throttle 99% of attempts
  act: msprop<number>([
    qprop('act'),
    lsprop('debug.send.throttling', 0.0),
  ]),

  srv: msprop<string>([
    qprop('srv'),
    lsprop('user.remote.url', 'https://comntr.live:42751'),
  ]),

  // interval in seconds between resending comments
  cri: msprop<number>([
    qprop('cri'),
    lsprop('user.send.retry.delay', 600),
  ]),

  ptr: msprop<number>([
    qprop('ptr'),
    lsprop('user.send.retry.rand', 0.5),
  ]),

  // drafts update timeout in seconds
  dut: msprop<number>([
    qprop('dut'),
    lsprop('user.edit.timeout', 1),
  ]),

  // signs all comments before sending
  sign: msprop<boolean>([
    qprop('sign'),
    lsprop('user.send.sign', true),
  ]),

  scpi: msprop<number>([
    qprop('scpi'),
    lsprop('user.supercop.poll', 0.5),
  ]),

  wasmt: msprop<number>([
    qprop('wasmt'),
    lsprop('user.wasm.timeout', 3),
  ]),

  lrucap: msprop<number>([
    qprop('lrucap'),
    lsprop('user.cache.maxurls', 100),
  ]),

  dmode: msprop<boolean>([
    qprop('dm'),
    lsprop('user.ui.mode.dark', false),
  ]),

  dqps: msprop<number>([
    qprop('qs'),
    lsprop('stats.ui.step.qps', 0.25),
  ]),
};
