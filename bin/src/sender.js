define(["require", "exports", "src/event", "src/cache", "src/dataserver", "src/hashutil", "src/log", "src/ptask", "src/storage", "./config"], function (require, exports, event_1, cache_1, dataserver_1, hashutil_1, log_1, ptask_1, storage_1, config_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const LSKEY_PENDING = '.staging.pending';
    const LSKEY_FAILED = '.staging.failed';
    const PT_RANDMNESS = 0.5;
    class CommentSender {
        constructor() {
            this.lspending = storage_1.gStorage.getEntry(LSKEY_PENDING);
            this.lsfailed = storage_1.gStorage.getEntry(LSKEY_FAILED);
            this.pending = this.lspending.json || {};
            this.failed = this.lsfailed.json || {};
            this.pt = new ptask_1.PeriodicTask({
                interval: config_1.gConfig.cri,
                randomness: PT_RANDMNESS,
                callback: () => this.tryToSendComments(),
            });
            this.commentStateChanged = new event_1.EventSource();
            this.pt.start();
            this.tryToSendComments();
        }
        async postComment({ text, parent, topic }) {
            log_1.log('Posting comment to', topic);
            let body = await this.makeCommentBody({ text, parent });
            let hash = await hashutil_1.sha1(body);
            cache_1.gComments[hash] = body;
            this.cacheComment(topic, hash, body);
            this.stageComment(hash, topic);
            this.tryToSendComment(hash);
            return { hash, body };
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
                this.tryToSendComment(hash);
        }
        async tryToSendComment(hash) {
            log_1.log('Trying to send comment:', hash);
            let topic = this.pending[hash];
            let body = cache_1.gCache.getTopic(topic).getCommentData(hash);
            try {
                await dataserver_1.gDataServer.postComment(topic, { hash, body });
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
        cacheComment(thash, chash, cbody) {
            let tcache = cache_1.gCache.getTopic(thash);
            tcache.addComment(chash, cbody);
            tcache.setCommentHashes([chash, ...tcache.getCommentHashes()]);
        }
        async postRandomComments({ size = 100, topic = '', prefix = 'test-', } = {}) {
            let hashes = [topic];
            for (let i = 0; i < size; i++) {
                let parent = hashes[Math.random() * hashes.length | 0];
                let { hash } = await this.postComment({
                    text: prefix + i,
                    parent: parent,
                    topic: topic,
                });
                hashes.push(hash);
            }
        }
        async makeCommentBody({ text, parent }) {
            return [
                'Date: ' + new Date().toISOString(),
                'Parent: ' + parent,
                '',
                text,
            ].join('\n');
        }
    }
    exports.gSender = new CommentSender;
});
//# sourceMappingURL=sender.js.map