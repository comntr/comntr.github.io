import { EventSource } from 'src/event';
import { gCache, gComments } from 'src/cache';
import { gDataServer, HttpError } from 'src/dataserver';
import { sha1 } from 'src/hashutil';
import { log } from 'src/log';
import { PeriodicTask } from 'src/ptask';
import { gStorage } from 'src/storage';
import { gConfig } from './config';

const LSKEY_PENDING = '.staging.pending';
const LSKEY_FAILED = '.staging.failed';
const PT_RANDMNESS = 0.5;

interface PostCommentArgs {
  text: string;
  topic: string;
  parent: string;
}

interface PostRandomCommentsArgs {
  topic?: string,
  size?: number;
  prefix?: string;
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

type CommentState = 'pending' | 'failed' | 'sent';

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
    interval: gConfig.cri,
    randomness: PT_RANDMNESS,
    callback: () => this.tryToSendComments(),
  });

  public commentStateChanged = new EventSource<CommentStateEvent>();

  constructor() {
    this.pt.start();
    this.tryToSendComments();
  }

  async postComment({ text, parent, topic }: PostCommentArgs) {
    log('Posting comment to', topic);
    let body = await this.makeCommentBody({ text, parent });
    let hash = await sha1(body);
    gComments[hash] = body;
    this.cacheComment(topic, hash, body);
    this.stageComment(hash, topic);
    this.tryToSendComment(hash);
    return { hash, body };
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
      this.tryToSendComment(hash);
  }

  private async tryToSendComment(hash) {
    log('Trying to send comment:', hash);
    let topic = this.pending[hash];
    let body = gCache.getTopic(topic).getCommentData(hash);
    try {
      await gDataServer.postComment(topic, { hash, body });
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

  private cacheComment(thash, chash, cbody) {
    let tcache = gCache.getTopic(thash);
    tcache.addComment(chash, cbody);
    tcache.setCommentHashes([chash, ...tcache.getCommentHashes()]);
  }

  private async postRandomComments({
    size = 100,
    topic = '',
    prefix = 'test-',
  }: PostRandomCommentsArgs = {}) {
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

  private async makeCommentBody({ text, parent }) {
    return [
      'Date: ' + new Date().toISOString(),
      'Parent: ' + parent,
      '',
      text,
    ].join('\n');
  }
}

export const gSender = new CommentSender;
