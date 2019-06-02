function getQueryParams<T>(defaults: T) {
  let dict = { ...defaults };
  let args = location.search.slice(1).split('&');
  for (let arg of args) {
    let i = arg.indexOf('=');
    if (i < 0) i = arg.length;
    let name = decodeURIComponent(arg.slice(0, i));
    let value = decodeURIComponent(arg.slice(i + 1));
    try {
      dict[name] = JSON.parse(value);
    } catch (err) {
      dict[name] = value;
    }
  }
  return dict;
}

export function getQueryParam(name) {
  return gConfig[name];
}

export const gConfig = getQueryParams({
  ext: false,
  act: 0.0, // add-comment throttling: 0.99 would throttle 99% of attempts
  srv: 'https://comntr.live:42751',
  cri: 600, // interval in seconds between resending comments
});
