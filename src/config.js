function getQueryParams() {
  let dict = {};
  let args = location.search.slice(1).split('&');
  for (let arg of args) {
    let i = arg.indexOf('=');
    if (i < 0) i = arg.length;
    let name = decodeURIComponent(arg.slice(0, i));
    let value = decodeURIComponent(arg.slice(i + 1));
    dict[name] = value;
  }
  return dict;
}

function getQueryParam(name) {
  return gQuery[name];
}

const gQuery = getQueryParams();
