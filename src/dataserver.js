const QUERY_PARAM_DATA_SERVER = 's';
const DEFAULT_DATA_SERVER = 'https://comntr.live:42751';

function getServer() {
  return getQueryParam(QUERY_PARAM_DATA_SERVER) ||
    DEFAULT_DATA_SERVER;
}

class DataServer {
  async postComment(topicId, { hash, body }) {
    let host = getServer();
    let url = host + '/' + topicId + '/' + hash;
    log(url, JSON.stringify(body));
    let rsp = await fetch(url, { method: 'POST', body });
    log(rsp.status + ' ' + rsp.statusText);

    if (!rsp.ok) {
      log(await rsp.text());
      throw new Error(rsp.status + ' ' + rsp.statusText);
    }
  }

  async fetchComments(topicId) {
    let host = getServer();
    let url = host + '/' + topicId;
    let ctime = Date.now();
    log(url);
    let rsp = await fetch(url);
    log(rsp.status + ' ' + rsp.statusText);

    if (!rsp.ok) {
      log(await rsp.text());
      throw new Error(rsp.status + ' ' + rsp.statusText);
    }

    let body = await rsp.text();
    let stime = rsp.headers.get('Duration');

    ctime = Date.now() - ctime;
    log('Server time:', stime, 'ms');
    log('Request time:', ctime - stime, 'ms');

    return JSON.parse(body);
  }

  async fetchCommentsCount(topicId) {
    let host = getServer();
    let url = host + '/' + topicId + '/size';
    log(url);
    let rsp = await fetch(url);
    log(rsp.status + ' ' + rsp.statusText);

    if (!rsp.ok) {
      log(await rsp.text());
      throw new Error(rsp.status + ' ' + rsp.statusText);
    }

    let body = await rsp.text();
    return parseInt(body);
  }
}

const gDataServer = new DataServer;
