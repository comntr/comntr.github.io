define(["require", "exports", "./log", "./config"], function (require, exports, log_1, config_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
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
            let host = config_1.gConfig.srv;
            let url = host + '/' + topicId + '/' + hash;
            log_1.log(url, JSON.stringify(body));
            if (config_1.gConfig.act > 0 && Math.random() < config_1.gConfig.act)
                throw new HttpError(567, 'Throttled with ?act=' + config_1.gConfig.act);
            let rsp = await fetch(url, { method: 'POST', body });
            log_1.log(rsp.status + ' ' + rsp.statusText);
            if (!rsp.ok) {
                log_1.log(await rsp.text());
                throw new HttpError(rsp.status, rsp.statusText);
            }
        }
        async fetchComments(thash, xorhash) {
            let host = config_1.gConfig.srv;
            let url = host + '/' + thash;
            let ctime = Date.now();
            log_1.log(url);
            let headers = new Headers;
            if (xorhash)
                headers.append('If-None-Match', xorhash);
            let rsp = await fetch(url, { headers });
            log_1.log(rsp.status + ' ' + rsp.statusText);
            if (rsp.status == 304) {
                log_1.log('Request time (304 Not Modified):', Date.now() - ctime, 'ms');
                return [];
            }
            if (!rsp.ok) {
                log_1.log(await rsp.text());
                throw new HttpError(rsp.status, rsp.statusText);
            }
            let body = await rsp.text();
            let contentType = rsp.headers.get('Content-Type');
            let boundary = /\bboundary="(\w+)"/.exec(contentType);
            if (!boundary)
                return [];
            let comments = body.split('\n--' + boundary[1] + '\n');
            log_1.log('Request time:', Date.now() - ctime, 'ms');
            return comments;
        }
        async fetchCommentsCount(topics) {
            let host = config_1.gConfig.srv;
            let url = host + '/rpc/GetCommentsCount';
            let body = JSON.stringify(topics);
            log_1.log(url);
            let rsp = await fetch(url, { method: 'POST', body });
            log_1.log(rsp.status + ' ' + rsp.statusText);
            if (!rsp.ok) {
                log_1.log(await rsp.text());
                throw new HttpError(rsp.status, rsp.statusText);
            }
            return rsp.json();
        }
    }
    exports.gDataServer = new DataServer;
});
//# sourceMappingURL=dataserver.js.map