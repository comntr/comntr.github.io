import { EventSource } from 'src/event';
import { gCache, gComments } from 'src/cache';
import { gDataServer, HttpError } from 'src/dataserver';
import { sha1 } from 'src/hashutil';
import { log } from 'src/log';
import { PeriodicTask } from 'src/ptask';
import { gStorage } from 'src/storage';
import { gConfig } from 'src/config';
import { gUser } from 'src/user';

const LSKEY_PENDING = 'sys.staging.pending';
const LSKEY_FAILED = 'sys.staging.failed';

interface CommentHeaders {
  [name: string]: string;
}

interface PostCommentArgs {
  body: string;
  topic: string;
}

interface PendingComments {
  [chash: string]: string; // chash -> thash
}

interface FailedComments {
  [chash: string]: {
    thash: string;
    error: string;
  }
}

interface CommentStateEvent {
  chash: string;
  thash: string;
}

class CommentSender {
  private lspending = gStorage.getEntry(LSKEY_PENDING);
  private lsfailed = gStorage.getEntry(LSKEY_FAILED);
  private pending: PendingComments = this.lspending.json || {};
  private failed: FailedComments = this.lsfailed.json || {};

  private pt = new PeriodicTask({
    interval: gConfig.cri.get(),
    randomness: gConfig.ptr.get(),
    callback: () => this.tryToSendComments(),
  });

  public commentStateChanged = new EventSource<CommentStateEvent>();

  constructor() {
    this.pt.start();
    this.tryToSendComments();
  }

  async postComment({ body, topic }: PostCommentArgs) {
    log('Posting comment to', topic);
    let hash = await sha1(body);
    this.stageComment(hash, topic);
    // tslint:disable-next-line:no-floating-promises
    this.tryToSendComment(hash);
  }

  getCommentState(chash: string) {
    if (this.failed[chash])
      return 'failed';
    if (this.pending[chash])
      return 'pending';
    return 'sent';
  }

  getPendingComments(thash: string) {
    return Object.keys(this.pending).filter(chash => this.pending[chash] == thash);
  }

  getFailedComments(thash: string) {
    return Object.keys(this.failed).filter(chash => this.failed[chash].thash == thash);
  }

  private stageComment(chash, topic) {
    log('Staging comment:', chash);
    this.pending[chash] = topic;
    this.flushCache();
    this.commentStateChanged.fireEvent({
      chash,
      thash: topic,
    });
  }

  private flushCache() {
    this.lspending.json = this.pending;
    this.lsfailed.json = this.failed;
  }

  private tryToSendComments() {
    let count = Object.keys(this.pending).length;
    if (count < 1) return;
    log('Trying to send pending comments:', count);

    for (let hash in this.pending)
      // tslint:disable-next-line:no-floating-promises
      this.tryToSendComment(hash);
  }

  private async tryToSendComment(hash) {
    log('Trying to send comment:', hash);
    let topic = this.pending[hash];
    let body = await gCache.getTopic(topic).getCommentData(hash);
    try {
      await gDataServer.postComment(topic, { body });
      log('Comment sent:', hash);
      delete this.pending[hash];
      this.flushCache();
      this.commentStateChanged.fireEvent({
        chash: hash,
        thash: topic,
      });
    } catch (err) {
      log('Failed to send comment:', err);
      if (err instanceof HttpError) {
        if (err.status >= 400 && err.status < 500) {
          log('The server has rejected this comment. Resend it manually.');
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
    gComments[chash] = cbody;
    let tcache = gCache.getTopic(thash);
    await tcache.addComment(chash, cbody);
    let chashes = await tcache.getCommentHashes();
    await tcache.setCommentHashes([chash, ...chashes]);
  }

  async makeComment({ text, headers }) {
    let bodyHeaders = {
      'Date': new Date().toISOString(),
      'User': gUser.username.get(),
      ...headers,
    };

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
      log.i('Signing the comment.');
      body = await gUser.signComment(body);
      log.i('Verifying the signature.');
      let valid = await gUser.verifyComment(body);
      if (valid)
        log.i('Signature is ok.');
      else
        log.w('Signature is not ok.');
    } catch (err) {
      log.w('Failed to sign the comment:', err);
    }

    return body;
  }
}

export const gSender = new CommentSender;
