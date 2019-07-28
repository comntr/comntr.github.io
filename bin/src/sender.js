define(["require", "exports", "src/event", "src/cache", "src/dataserver", "src/hashutil", "src/log", "src/ptask", "src/storage", "src/config", "src/user"], function (require, exports, event_1, cache_1, dataserver_1, hashutil_1, log_1, ptask_1, storage_1, config_1, user_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const LSKEY_PENDING = 'sys.staging.pending';
    const LSKEY_FAILED = 'sys.staging.failed';
    class CommentSender {
        constructor() {
            this.lspending = storage_1.gStorage.getEntry(LSKEY_PENDING);
            this.lsfailed = storage_1.gStorage.getEntry(LSKEY_FAILED);
            this.pending = this.lspending.json || {};
            this.failed = this.lsfailed.json || {};
            this.pt = new ptask_1.PeriodicTask({
                interval: config_1.gConfig.cri.get(),
                randomness: config_1.gConfig.ptr.get(),
                callback: () => this.tryToSendComments(),
            });
            this.commentStateChanged = new event_1.EventSource();
            this.pt.start();
            this.tryToSendComments();
        }
        async postComment({ body, topic }) {
            log_1.log('Posting comment to', topic);
            let hash = await hashutil_1.sha1(body);
            this.stageComment(hash, topic);
            // tslint:disable-next-line:no-floating-promises
            this.tryToSendComment(hash);
        }
        getCommentState(chash) {
            if (this.failed[chash])
                return 'failed';
            if (this.pending[chash])
                return 'pending';
            return 'sent';
        }
        getPendingComments(thash) {
            return Object.keys(this.pending).filter(chash => this.pending[chash] == thash);
        }
        getFailedComments(thash) {
            return Object.keys(this.failed).filter(chash => this.failed[chash].thash == thash);
        }
        stageComment(chash, topic) {
            log_1.log('Staging comment:', chash);
            this.pending[chash] = topic;
            this.flushCache();
            this.commentStateChanged.fireEvent({
                chash,
                thash: topic,
            });
        }
        flushCache() {
            this.lspending.json = this.pending;
            this.lsfailed.json = this.failed;
        }
        tryToSendComments() {
            let count = Object.keys(this.pending).length;
            if (count < 1)
                return;
            log_1.log('Trying to send pending comments:', count);
            for (let hash in this.pending)
                // tslint:disable-next-line:no-floating-promises
                this.tryToSendComment(hash);
        }
        async tryToSendComment(hash) {
            log_1.log('Trying to send comment:', hash);
            let topic = this.pending[hash];
            let body = await cache_1.gCache.getTopic(topic).getCommentData(hash);
            try {
                await dataserver_1.gDataServer.postComment(topic, { body });
                log_1.log('Comment sent:', hash);
                delete this.pending[hash];
                this.flushCache();
                this.commentStateChanged.fireEvent({
                    chash: hash,
                    thash: topic,
                });
            }
            catch (err) {
                log_1.log('Failed to send comment:', err);
                if (err instanceof dataserver_1.HttpError) {
                    if (err.status >= 400 && err.status < 500) {
                        log_1.log('The server has rejected this comment. Resend it manually.');
                        delete this.pending[hash];
                        this.failed[hash] = { thash: topic, error: err + '' };
                        this.flushCache();
                        this.commentStateChanged.fireEvent({
                            chash: hash,
                            thash: topic,
                        });
                    }
                }
            }
        }
        async cacheComment({ thash, chash, cbody }) {
            cache_1.gComments[chash] = cbody;
            let tcache = cache_1.gCache.getTopic(thash);
            await tcache.addComment(chash, cbody);
            let chashes = await tcache.getCommentHashes();
            await tcache.setCommentHashes([chash, ...chashes]);
        }
        async makeComment({ text, headers }) {
            let bodyHeaders = Object.assign({ 'Date': new Date().toISOString(), 'User': user_1.gUser.username.get() }, headers);
            let bodyLines = [];
            for (let name in bodyHeaders) {
                let value = bodyHeaders[name];
                if (value)
                    bodyLines.push(name + ': ' + value);
            }
            bodyLines.push('');
            bodyLines.push(text);
            let body = bodyLines.join('\n');
            try {
                log_1.log.i('Signing the comment.');
                body = await user_1.gUser.signComment(body);
                log_1.log.i('Verifying the signature.');
                let valid = await user_1.gUser.verifyComment(body);
                if (valid)
                    log_1.log.i('Signature is ok.');
                else
                    log_1.log.w('Signature is not ok.');
            }
            catch (err) {
                log_1.log.w('Failed to sign the comment:', err);
            }
            return body;
        }
    }
    exports.gSender = new CommentSender;
});
//# sourceMappingURL=sender.js.map