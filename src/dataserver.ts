import { log } from './log';
import { gConfig } from './config';

export class HttpError extends Error {
  constructor(public status: number, public statusText: string) {
    super(status + ' ' + statusText);
  }
}

class DataServer {
  async postComment(topicId, { hash, body }) {
    let host = gConfig.s;
    let url = host + '/' + topicId + '/' + hash;
    log(url, JSON.stringify(body));

    if (gConfig.act > 0 && Math.random() < gConfig.act)
      throw new HttpError(567, 'Throttled with ?act=' + gConfig.act);

    let rsp = await fetch(url, { method: 'POST', body });
    log(rsp.status + ' ' + rsp.statusText);

    if (!rsp.ok) {
      log(await rsp.text());
      throw new HttpError(rsp.status, rsp.statusText);
    }
  }

  async fetchComments(thash, xorhash) {
    let host = gConfig.s;
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
      throw new HttpError(rsp.status, rsp.statusText);
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
    let host = gConfig.s;
    let url = host + '/rpc/GetCommentsCount';
    let body = JSON.stringify(topics);
    log(url);
    let rsp = await fetch(url, { method: 'POST', body });
    log(rsp.status + ' ' + rsp.statusText);

    if (!rsp.ok) {
      log(await rsp.text());
      throw new HttpError(rsp.status, rsp.statusText);
    }

    return rsp.json();
  }
}

export const gDataServer = new DataServer;
