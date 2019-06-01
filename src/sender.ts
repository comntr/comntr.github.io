import { sha1 } from 'src/hashutil';
import { gDataServer } from 'src/dataserver';
import { gCache, gComments } from 'src/cache';
import { gStorage } from 'src/storage';
import { log } from 'src/log';

const LSKEY_STAGING = '.staging';
const LSKEY_SENDING = '.sending';
const RT_INTERVAL = 60;
const RT_RANDMNESS = 0.25;

interface PostCommentArgs {
  text: string;
  topic: string;
  parent: string;
  status: (text: string) => void;
}

interface PostRandomCommentsArgs {
  topic?: string,
  size?: number;
  prefix?: string;
}

class RandomizedTimer {
  private timer = 0;

  constructor(
    private interval: number,
    private randmness: number,
    private callback: () => void) {

  }

  stop() {
    clearTimeout(this.timer);
    this.timer = 0;
  }

  start() {
    this.stop();
    this.schedule();
  }

  schedule() {
    let factor = 1 + this.randmness * (2 * Math.random() - 1);
    let delay = this.interval * factor;
    this.timer = setTimeout(() => {
      this.stop();
      this.callback.call(null);
    }, delay * 1000 | 0);
  }

  fire() {
    this.stop();
    setTimeout(() => {
      this.start();
      this.callback.call(null);   
    }, 0);
  }
}

class CommentSender {
  private staging = gStorage.getEntry(LSKEY_STAGING);
  private sending = gStorage.getEntry(LSKEY_SENDING);
  private rt = new RandomizedTimer(RT_INTERVAL, RT_RANDMNESS,
    () => this.sendComments());

  constructor() {
    this.staging.text = this.staging.text || '[]';
    this.sending.text = this.sending.text || '[]';

    this.unsendAll();
    this.rt.start();
  }

  async postComment({
    text,
    parent,
    topic,
    status,
  }: PostCommentArgs) {
    try {
      status('Prepairing comment.');
      if (!text) throw new Error('Cannot post empty comments.');
      let body = await this.makeCommentBody({ text, parent });
      let hash = await sha1(body);
      this.cacheComment(topic, hash, body);
      this.stageComment(hash, topic);
      status('Posting comment.');
      this.rt.fire();
      status('');
      gComments[hash] = body;
      return { hash, body };
    } catch (err) {
      status(err);
      throw err;
    }
  }

  private sendComments() {
    let comments = this.getUnsentComments();
    log('Sending comments:', comments);
    this.sending.json = [...comments];
    this.staging.json = [];
    for (let hash of comments) {
      let topic = this.getTopicRef(hash).text;
      let body = gCache.getTopic(topic).getCommentData(hash);
      gDataServer.postComment(topic, {
        hash,
        body,
      }).then(() => {
        log('Comment sent:', hash);
        this.getTopicRef(hash).remove();
        let set = new Set(this.sending.json);
        set.delete(hash);
        this.sending.json = [...set];
      });
    }
  }

  private getUnsentComments() {
    return new Set([
      ...this.staging.json,
      ...this.sending.json,
    ]);
  }

  private unsendAll() {
    let comments = this.getUnsentComments();
    log('Moving back to staging:', comments);
    this.staging.json = [...comments];
    this.sending.json = [];
  }

  private stageComment(chash, topic) {
    log('Staging comment:', chash);
    let set = new Set([chash, ...this.staging.json]);
    this.staging.json = [...set];
    this.getTopicRef(chash).text = topic;
  }

  private getTopicRef(chash) {
    return gStorage.getEntry(chash + '.topic');
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
        status: () => { },
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
