import { gCache, gComments } from 'src/cache';
import { gDataServer, HttpError } from 'src/dataserver';
import { sha1 } from 'src/hashutil';
import { log } from 'src/log';
import { PeriodicTask } from 'src/ptask';
import { gStorage } from 'src/storage';

const LSKEY_STAGING = '.staging';
const PT_INTERVAL = 60;
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

class CommentSender {
  private lsprop = gStorage.getEntry(LSKEY_STAGING);
  private comments = this.lsprop.json || {}; // chash -> thash
  private pt = new PeriodicTask({
    interval: PT_INTERVAL,
    randomness: PT_RANDMNESS,
    callback: () => this.tryToSendComments(),
  });

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

  private stageComment(chash, topic) {
    log('Staging comment:', chash);
    this.comments[chash] = topic;
    this.flushCache();
  }

  private flushCache() {
    this.lsprop.json = this.comments;
  }

  private tryToSendComments() {
    log('Trying to send pending comments:', Object.keys(this.comments).length);

    for (let hash in this.comments)
      this.tryToSendComment(hash);
  }

  private async tryToSendComment(hash) {
    log('Trying to send comment:', hash);
    let topic = this.comments[hash];
    let body = gCache.getTopic(topic).getCommentData(hash);
    try {
      await gDataServer.postComment(topic, { hash, body });
      log('Comment sent:', hash);
      this.uncacheComment(hash);
    } catch (err) {
      log('Failed to send comment:', err);
      if (err instanceof HttpError) {
        if (err.status >= 400 && err.status < 500) {
          log('The server has rejected this comment. Resend it manually.');
          this.uncacheComment(hash);
        }
      }
      throw err;
    }
  }

  private uncacheComment(hash) {
    if (this.comments[hash]) {
      delete this.comments[hash];
      this.flushCache();
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
