import { log } from 'src/log';
import { gConfig } from 'src/config';
import { gWatchlist } from 'src/watchlist';
import { gCache } from 'src/cache';
import { gDataServer } from 'src/dataserver';
import { gSender } from 'src/sender';
import { sha1 } from 'src/hashutil';

const SHA1_PATTERN = /^[a-f0-9]{40}$/;
const URL_PATTERN = /^https?:\/\//;
const COMMENT_DATE_PATTERN = /^Date: (.+)$/m;
const COMMENT_PARENT_PATTERN = /^Parent: (.+)$/m;
const COMMENT_BODY_PATTERN = /\n\n([^\x00]+)/m;

let gURL = null;
let gTopic = null; // SHA1
let gComments = null; // sha1 -> data

const $ = (selector: string): HTMLElement => document.querySelector(selector);

$.comments = null as HTMLElement;
$.topic = null as HTMLElement;
$.count = null as HTMLElement;
$.status = null as HTMLElement;

window.onhashchange = () => {
  resetComments();
  renderComments();
};

log('Waiting for window.onload event.');
window.onload = () => {
  log('Query params:', gConfig);

  $.comments = $('#all-comments');
  $.status = $('#status');
  $.topic = $('#topic');
  $.count = $('#comments-count');

  if (gConfig.ext) {
    log('Launched as the extension popup.');
    $.topic.style.display = 'none';
  }

  $.comments.onclick = event => handleCommentsClick(event.target);
  renderComments();
};

function updateCommentsCount() {
  $.count.textContent = Object.keys(gComments).length + ' comments';
}

function resetComments() {
  log('Resetting comments.');
  $.comments.innerHTML = '';
  $.count.innerHTML = '';
  gComments = null;
}

function isCollapseButton(x) {
  return x && x.className == 'c';
}

function isCommentContainer(x) {
  return x && x.className == 'cm';
}

function handleCommentsClick(target) {
  if (isCollapseButton(target)) {
    let comm = target;
    while (comm && !isCommentContainer(comm))
      comm = comm.parentElement;
    log('(Un)collapsing', comm.id);
    let subc = comm.querySelector('.sub');
    if (subc) {
      let disp = subc.style.display;
      subc.style.display = !disp ? 'none' : '';
      target.textContent = !disp ? 'Uncollapse' : 'Collapse';
    }
  }
}

async function renderComments() {
  let topicId = location.hash.slice(1);
  log('Rendering comments for topic:', topicId);

  let buttonAdd = $('#post-comment');
  let topicEl = $('#topic');

  if (!topicId) {
    let sampleUrl = 'http://example.com/';
    let sampleId = await sha1(sampleUrl);
    let href1 = location.href + '#' + sampleUrl;
    let href2 = location.href + '#' + sampleId;
    topicEl.innerHTML = [
      'Specify URL or its SHA-1:',
      `<a href="${href1}">${href1}</a>`,
      `<a href="${href2}">${href2}</a>`,
    ].map(s => '<div>' + s + '</div>').join('');
    return;
  }

  document.title = 'Comntr - ' + topicId;

  if (URL_PATTERN.test(topicId)) {
    topicEl.innerHTML = `<a href="${topicId}">${topicId}</a>`;
  } else {
    topicEl.textContent = topicId;
  }

  if (!SHA1_PATTERN.test(topicId)) {
    gURL = topicId;
    log('Getting SHA1 of the topic:', topicId);
    topicId = await sha1(topicId);
    log('SHA1:', topicId);
  }

  gTopic = topicId;
  buttonAdd.onclick = () => handlePostCommentButtonClick();
  await getComments(topicId);
  markAllCommentsAsRead();
}

function markAllCommentsAsRead() {
  if (!gWatchlist.isWatched(gTopic)) return;
  let size = Object.keys(gComments || {}).length;
  log(`Marking all ${size} comments as read.`);
  gWatchlist.setSize(gTopic, size);
}

async function handlePostCommentButtonClick() {
  let buttonAdd = $('#post-comment') as HTMLButtonElement;
  buttonAdd.disabled = true;
  let textarea = $('#comment') as HTMLTextAreaElement;
  let text = textarea.value.trim();

  try {
    if (!text) throw new Error('Cannot send an empty comment.');
    let { hash, body } = await gSender.postComment({
      text,
      topic: gTopic,
      parent: gTopic,
    });
    textarea.value = '';
    let html = makeCommentHtml(parseCommentBody(body, hash));
    let div = renderHtmlAsElement(html);
    $.comments.insertBefore(div, $.comments.firstChild);
    updateCommentsCount();
  } finally {
    buttonAdd.disabled = false;
  }

  gWatchlist.add(gTopic, gURL);
  markAllCommentsAsRead();
}

function renderHtmlAsElement(html) {
  let container = document.createElement('div');
  container.innerHTML = html;
  let element = container.children[0];
  container.innerHTML = '';
  return element;
}

async function getComments(thash = gTopic) {
  let status = $('#status');

  if (!SHA1_PATTERN.test(thash))
    throw new Error('Invalid topic id: ' + thash);

  try {
    status.textContent = 'Fetching comments.';
    let tcache = gCache.getTopic(thash);
    let xorhash = tcache.getXorHash();
    log('Cached xorhash:', xorhash);
    let list = [];

    try {
      list = await gDataServer.fetchComments(thash, xorhash);
    } catch (err) {
      log.e('Failed to get comments:', err);
    }

    log('Hashing comments.');
    let htime = Date.now();

    gComments = {};

    for (let chash of tcache.getCommentHashes()) {
      let cbody = tcache.getCommentData(chash);
      gComments[chash] = cbody;
    }

    let tasks = list.map(data => {
      return sha1(data).then(hash => {
        gComments[hash] = data;
        tcache.addComment(hash, data);
      });
    });
    await Promise.all(tasks);
    tcache.setCommentHashes(Object.keys(gComments));
    log('Hashing time:', Date.now() - htime, 'ms');
    updateCommentsCount();

    log('Generating html.');
    let rtime = Date.now();
    let comments = [];
    let byhash = {};

    for (let hash in gComments) {
      try {
        let body = gComments[hash];
        let parsed = parseCommentBody(body, hash);
        comments.push(parsed);
        byhash[parsed.hash] = parsed;
      } catch (error) {
        log('Bad comment:', error)
      }
    }

    log('Generating tree of comments:', comments.length);
    let tree = { [gTopic]: [] };

    for (let { hash, parent } of comments) {
      tree[parent] = tree[parent] || [];
      tree[parent].push(hash);
    }

    let render = phash => {
      let htmls = [];
      let hashes = tree[phash] || [];
      hashes.sort((h1, h2) => byhash[h2].date - byhash[h1].date);
      for (let chash of hashes) {
        let subc = render(chash);
        let comm = byhash[chash];
        let html = makeCommentHtml({ ...comm, subc });
        htmls.push(html);
      }
      return htmls.join('\n');
    };

    $.comments.innerHTML = render(gTopic);
    rtime = Date.now() - rtime;
    log('Render time:', rtime, 'ms');
    status.textContent = '';
  } catch (err) {
    log.e(err);
    status.textContent = err && (err.stack || err.message || err);
  }
}

function parseCommentBody(body, hash) {
  let [, date] = COMMENT_DATE_PATTERN.exec(body);
  let [, parent] = COMMENT_PARENT_PATTERN.exec(body);
  let [, text] = COMMENT_BODY_PATTERN.exec(body);
  return { date: new Date(date), parent, text, hash };
}

function makeCommentHtml({ text, date, hash, subc = '' }) {
  return `
    <div class="cm" id="cm-${hash}">
      <div class="hd">
        <span class="ts">${date.toLocaleTimeString()}</span>
        <span class="c" style="${subc ? '' : 'display:none'}">Collapse</span>
      </div>
      <div class="ct">${text}</div>
      <div class="sub">${subc}</div>
    </div>`;
}
