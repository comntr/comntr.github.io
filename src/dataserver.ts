import { tagged } from './log';
import { gConfig } from './config';

const log = tagged('srv.data');

export class HttpError extends Error {
  constructor(public status: number, public statusText: string) {
    super(status + ' ' + statusText);
  }
}

export interface RulesSpec {
  owner?: string;
}

class DataServer {
  async postComment(topicId, { hash, body }) {
    let host = gConfig.srv.get();
    let url = host + '/' + topicId + '/' + hash;
    log.i('POST ' + url + '\n' + body);

    if (gConfig.act.get() > 0 && Math.random() < gConfig.act.get())
      throw new HttpError(567, 'Throttled with ?act=' + gConfig.act.get());

    let rsp = await fetch(url, { method: 'POST', body });
    log.i(rsp.status + ' ' + rsp.statusText);

    if (!rsp.ok) {
      log.i(await rsp.text());
      throw new HttpError(rsp.status, rsp.statusText);
    }
  }

  async fetchComments(thash, xorhash) {
    let host = gConfig.srv.get();
    let url = host + '/' + thash;
    let ctime = Date.now();
    log.i(url);
    let headers = new Headers;
    if (xorhash) headers.append('If-None-Match', xorhash);
    let rsp = await fetch(url, { headers });
    log.i(rsp.status + ' ' + rsp.statusText);

    if (rsp.status == 304) {
      log.i('Request time (304 Not Modified):', Date.now() - ctime, 'ms');
      return [];
    }

    if (!rsp.ok) {
      log.i(await rsp.text());
      throw new HttpError(rsp.status, rsp.statusText);
    }

    let body = await rsp.text();
    let contentType = rsp.headers.get('Content-Type');
    let boundary = /\bboundary="(\w+)"/.exec(contentType);
    if (!boundary) return [];
    let comments = body.split('\n--' + boundary[1] + '\n');

    log.i('Request time:', Date.now() - ctime, 'ms');
    return comments;
  }

  async fetchCommentsCount(topics) {
    let host = gConfig.srv.get();
    let url = host + '/rpc/GetCommentsCount';
    let body = JSON.stringify(topics);
    log.i(url);
    let rsp = await fetch(url, { method: 'POST', body });
    log.i(rsp.status + ' ' + rsp.statusText);

    if (!rsp.ok) {
      log.i(await rsp.text());
      throw new HttpError(rsp.status, rsp.statusText);
    }

    return rsp.json();
  }

  async getRules(thash: string): Promise<RulesSpec> {
    let host = gConfig.srv.get();
    let url = host + '/' + thash + '/rules';
    let rsp = await fetch(url);

    if (!rsp.ok) {
      if (rsp.status == 404) return null;
      log.i(await rsp.text());
      throw new HttpError(rsp.status, rsp.statusText);
    }

    let json = rsp.json();
    return json;
  }

  async setRules(thash: string, rules: RulesSpec): Promise<void> {
    let host = gConfig.srv.get();
    let url = host + '/' + thash + '/rules';
    let json = JSON.stringify(rules);
    let rsp = await fetch(url, { method: 'POST', body: json });

    if (!rsp.ok) {
      log.i(await rsp.text());
      throw new HttpError(rsp.status, rsp.statusText);
    }

    log.i('Rules updated:', thash, json);
  }
}

export const gDataServer = new DataServer;
