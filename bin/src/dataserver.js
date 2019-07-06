define(["require", "exports", "./log", "./config", "./user"], function (require, exports, log_1, config_1, user_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const log = log_1.tagged('srv.data');
    const H_FILTER_TAG = 'X-Tag';
    const H_SIGNATURE = 'X-Signature';
    const H_PUBKEY = 'X-Public-Key';
    class HttpError extends Error {
        constructor(status, statusText) {
            super(status + ' ' + statusText);
            this.status = status;
            this.statusText = statusText;
        }
    }
    exports.HttpError = HttpError;
    class DataServer {
        async postComment(topicId, { hash, body }) {
            let host = config_1.gConfig.srv.get();
            let url = host + '/' + topicId + '/' + hash;
            log.i('POST ' + url + '\n' + body);
            if (config_1.gConfig.act.get() > 0 && Math.random() < config_1.gConfig.act.get())
                throw new HttpError(567, 'Throttled with ?act=' + config_1.gConfig.act.get());
            let rsp = await fetch(url, { method: 'POST', body });
            log.i(rsp.status + ' ' + rsp.statusText);
            if (!rsp.ok) {
                log.i(await rsp.text());
                throw new HttpError(rsp.status, rsp.statusText);
            }
        }
        async fetchComments(thash, xorhash) {
            let host = config_1.gConfig.srv.get();
            let url = host + '/' + thash;
            let ctime = Date.now();
            log.i(url);
            let headers = new Headers;
            if (xorhash)
                headers.append('If-None-Match', xorhash);
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
            if (!boundary)
                return [];
            let comments = body.split('\n--' + boundary[1] + '\n');
            log.i('Request time:', Date.now() - ctime, 'ms');
            return comments;
        }
        async fetchCommentsCount(topics) {
            let host = config_1.gConfig.srv.get();
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
        async getRules(thash) {
            let host = config_1.gConfig.srv.get();
            let url = host + '/' + thash + '/rules';
            let rsp = await fetch(url);
            if (!rsp.ok) {
                if (rsp.status == 404)
                    return null;
                log.i(await rsp.text());
                throw new HttpError(rsp.status, rsp.statusText);
            }
            let json = rsp.json();
            return json;
        }
        async setRules(thash, tag, rules) {
            let host = config_1.gConfig.srv.get();
            let url = host + '/' + thash + '/rules';
            let body = JSON.stringify(rules);
            let pubkey = await user_1.gUser.getPublicKey();
            let signature = await user_1.gUser.signText(body);
            let headers = new Headers;
            headers.append(H_FILTER_TAG, tag);
            headers.append(H_PUBKEY, pubkey);
            headers.append(H_SIGNATURE, signature);
            let rsp = await fetch(url, { method: 'POST', body, headers });
            if (!rsp.ok) {
                log.i(await rsp.text());
                throw new HttpError(rsp.status, rsp.statusText);
            }
            log.i('Rules updated:', thash, rules);
        }
    }
    exports.gDataServer = new DataServer;
});
//# sourceMappingURL=dataserver.js.map