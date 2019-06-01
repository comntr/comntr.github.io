import { log } from './log';
import { getQueryParam } from './config';

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

  async fetchComments(thash, xorhash) {
    let host = getServer();
    let url = host + '/' + thash;
    let ctime = Date.now();
    log(url);
    let headers = new Headers;
    if (xorhash) headers.append('If-None-Match', xorhash);
    let rsp = await fetch(url, { headers });
    log(rsp.status + ' ' + rsp.statusText);

    if (rsp.status == 304) {
      log('Request time (304 Not Modified):', Date.now() - ctime, 'ms');
      return [];
    }

    if (!rsp.ok) {
      log(await rsp.text());
      throw new Error(rsp.status + ' ' + rsp.statusText);
    }

    let body = await rsp.text();
    let contentType = rsp.headers.get('Content-Type');
    let boundary = /\bboundary="(\w+)"/.exec(contentType);
    if (!boundary) return [];
    let comments = body.split('\n--' + boundary[1] + '\n');

    log('Request time:', Date.now() - ctime, 'ms');
    return comments;
  }

  async fetchCommentsCount(topics) {
    let host = getServer();
    let url = host + '/rpc/GetCommentsCount';
    let body = JSON.stringify(topics);
    log(url);
    let rsp = await fetch(url, { method: 'POST', body });
    log(rsp.status + ' ' + rsp.statusText);

    if (!rsp.ok) {
      log(await rsp.text());
      throw new Error(rsp.status + ' ' + rsp.statusText);
    }

    return rsp.json();
  }
}

export const gDataServer = new DataServer;
