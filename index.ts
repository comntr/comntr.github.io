import { log } from 'src/log';
import { gConfig } from 'src/config';
import { gWatchlist } from 'src/watchlist';
import { gCache } from 'src/cache';
import { gDataServer } from 'src/dataserver';
import { gSender } from 'src/sender';
import { sha1 } from 'src/hashutil';
import { gStorage } from 'src/storage';

const SHA1_PATTERN = /^[a-f0-9]{40}$/;
const URL_PATTERN = /^https?:\/\//;
const COMMENT_DATE_PATTERN = /^Date: (.+)$/m;
const COMMENT_PARENT_PATTERN = /^Parent: (.+)$/m;
const COMMENT_BODY_PATTERN = /\n\n([^\x00]+)/m;

let gURL = null;
let gTopic = null; // SHA1
let gComments = null; // sha1 -> data
let gDrafts = gStorage.getEntry('.drafts');

const $ = (selector: string): HTMLElement => document.querySelector(selector);

$.comments = null as HTMLElement;
$.topic = null as HTMLElement;
$.count = null as HTMLAnchorElement;
$.status = null as HTMLElement;

export function init() {
  log('Query params:', gConfig);

  $.comments = $('#all-comments');
  $.status = $('#status');
  $.topic = $('#topic');
  $.count = $('#comments-count') as HTMLAnchorElement;

  if (gConfig.ext) {
    log('Launched as the extension popup.');
    $.topic.style.display = 'none';
  }

  $.comments.onclick = event => handleCommentsAreaClick(event.target);
  $.comments.oninput = event => handleCommentEdited(event.target);

  gSender.commentStateChanged.addListener(e => {
    if (e.thash == gTopic)
      updateCommentState(e.chash);
  });

  window.onhashchange = async () => {
    if (gConfig.ext)
      $.count.href = location.origin + location.hash;
    await resetComments();
    await renderComments();
    await loadDrafts();
  };

  window.onhashchange(null);
}

function updateCommentState(chash) {
  log('Updating comment state:', chash);
  let cdiv = findCommentDivByHash(chash);
  if (!cdiv) return;
  let hdiv = cdiv.querySelector('.hd');
  let sdiv = hdiv.querySelector('.st');
  if (!sdiv) {
    sdiv = document.createElement('span');
    sdiv.classList.add('st');
    hdiv.appendChild(sdiv);
  }
  let state = gSender.getCommentState(chash);
  sdiv.setAttribute('state', state);
  switch (state) {
    case 'sent':
      sdiv.innerHTML = 'Sent';
      break;
    case 'failed':
      sdiv.innerHTML = 'Failed';
      break;
    case 'pending':
      sdiv.innerHTML = 'Sending...';
      break;
  }
}

function updateCommentsCount() {
  $.count.textContent = Object.keys(gComments).length + ' comments';
}

function resetComments() {
  log('Resetting comments.');
  $.comments.innerHTML = '';
  $.count.textContent = '';
  gComments = null;
  let placeholder = createNewCommentDiv();
  $.comments.appendChild(placeholder);
}

function isCollapseButton(x) {
  return x && x.className == 'c';
}

function isReplyButton(x) {
  return x && x.className == 'r';
}

function isPostButton(x) {
  return x && x.className == 'post';
}

function isCommentContainer(x: HTMLElement) {
  return x && x.classList.contains('cm');
}

function isCommentTextArea(x) {
  return x && x.className == 'ct';
}

function getCommentId(x) {
  return isCommentContainer(x) ? x.id.slice(3) : null;
}

function findCommentContainer(target) {
  let comm = target.parentElement;
  while (comm && !isCommentContainer(comm))
    comm = comm.parentElement;
  return comm;
}

function handleCommentEdited(target) {
  if (!isCommentTextArea(target)) return;
  if (target.id) return;
  let time = Date.now();
  let divComment = findCommentContainer(target);
  divComment = findCommentContainer(divComment);
  let chash = divComment ? getCommentId(divComment) : gTopic;
  let ctext = target.textContent.trim();
  log('Saving draft for:', chash);
  let drafts = gDrafts.json || {};
  drafts[chash] = ctext;
  gDrafts.json = drafts;
  log('Saving the draft has taken:', Date.now() - time, 'ms');
}

function loadDrafts() {
  let drafts = gDrafts.json || {};

  for (let chash in drafts) {
    let ctext = drafts[chash];
    setCommentDraftFor(chash, ctext);
  }
}

function handleCommentsAreaClick(target) {
  handleCollapseButtonClick(target);
  handleReplyButtonClick(target);
  handlePostCommentButtonClick(target);
}

function handleCollapseButtonClick(target) {
  if (!isCollapseButton(target)) return;
  let comm = findCommentContainer(target);
  let subc = comm.querySelector('.sub');
  if (subc) {
    let disp = subc.style.display;
    subc.style.display = !disp ? 'none' : '';
    target.textContent = !disp ? 'Uncollapse' : 'Collapse';
  }
}

function handleReplyButtonClick(target) {
  if (!isReplyButton(target)) return;
  let comm = findCommentContainer(target);
  let chash = getCommentId(comm);
  setCommentDraftFor(chash);
}

function setCommentDraftFor(chash, ctext = '') {
  if (chash == gTopic) {
    let divDraft = $.comments.querySelector(':scope > .draft');
    let divText = divDraft && divDraft.querySelector('.ct');
    if (divText) divText.textContent = ctext;
    return;
  }

  let comm = findCommentDivByHash(chash);
  if (!comm) return;
  let subc = comm.querySelector('.sub') as HTMLElement;

  if (!subc) {
    subc = renderHtmlAsElement(`<div class="sub"></div>`);
    comm.appendChild(subc);
  }

  let repl = subc.querySelector(':scope > .draft');

  if (!repl) {
    repl = createNewCommentDiv();
    subc.insertBefore(repl, subc.firstChild);
  }

  if (ctext) {
    repl.querySelector('.ct').textContent = ctext;
  }
}

async function renderComments() {
  let topicId = location.hash.slice(1);
  log('Rendering comments for topic:', topicId);

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
    topicId = await sha1(topicId);
    log('sha1(topic):', topicId);
  }

  gTopic = topicId;
  await getComments(topicId);
  markAllCommentsAsRead();
  updateAllCommentStates();
}

function updateAllCommentStates() {
  let pending = gSender.getPendingComments(gTopic);
  let failed = gSender.getFailedComments(gTopic);
  for (let chash of [...pending, ...failed])
    updateCommentState(chash);
}

function markAllCommentsAsRead() {
  if (!gWatchlist.isWatched(gTopic)) return;
  let size = Object.keys(gComments || {}).length;
  log(`Marking all ${size} comments as read.`);
  gWatchlist.setSize(gTopic, size);
}

async function handlePostCommentButtonClick(buttonAdd) {
  if (!isPostButton(buttonAdd)) return;
  let divComment = findCommentContainer(buttonAdd);
  let divParent = findCommentContainer(divComment);
  let divInput = divComment.querySelector('.ct');
  let divSubc = divParent ? divParent.querySelector('.sub') : $.comments;
  let text = divInput.textContent.trim();
  let phash = divParent ? divParent.id.slice(3) : gTopic;
  log('Replying to', phash, 'with', text);

  try {
    if (!text) throw new Error('Cannot send an empty comment.');
    buttonAdd.style.display = 'none';
    let drafts = gDrafts.json || {};
    delete drafts[phash];
    gDrafts.json = drafts;

    let { hash, body } = await gSender.postComment({
      text,
      topic: gTopic,
      parent: phash,
    });


    let html = makeCommentHtml(parseCommentBody(body, hash));
    let div = renderHtmlAsElement(html);
    divSubc.insertBefore(div, divSubc.firstChild);
    divComment.remove();
    updateCommentsCount();
  } finally {
    buttonAdd.style.display = '';
  }

  gWatchlist.add(gTopic, gURL);
  markAllCommentsAsRead();
}

function renderHtmlAsElement(html) {
  let container = document.createElement('div');
  container.innerHTML = html;
  let element = container.children[0];
  container.innerHTML = '';
  return element as HTMLElement;
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

    $.comments.innerHTML += render(gTopic);
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

function findCommentDivByHash(chash) {
  return $('#cm-' + chash);
}

function createNewCommentDiv() {
  let html = makeCommentHtml({ user: 'You' });
  let div = renderHtmlAsElement(html);
  div.classList.add('draft');
  return div;
}

function makeCommentHtml({
  user = null,
  text = '', // empty text means it's editable
  date = null,
  hash = null,
  subc = '' }) {

  return `
    <div class="cm" ${hash ? `id="cm-${hash}"` : ``}>
      <div class="hd">
        ${user ? `<span class="u">${user}</span>` : ``}
        ${date ? `<span class="ts">${getRelativeTime(date)}</span>` : ``}
        ${text ? `<span class="r">Reply</span>` : ``}
        ${!text ? `<span class="post" title="Post comment.">Post</span>` : ``}
        ${subc ? `<span class="c">Collapse</span>` : ``}
      </div>
      <div class="ct" ${!text ? `contenteditable` : ``}>${text}</div>
      ${subc ? `<div class="sub">${subc}</div>` : ``}
    </div>`;
}

function getRelativeTime(time: Date) {
  const MINUTE = 60;
  const HOUR = 3600;
  const DAY = 86400;
  const MONTH = 30 * DAY;

  let diff = (Date.now() - time.getTime()) / 1000;

  if (diff < 0) return 'In the future';
  if (diff < 60) return 'A minute ago';
  if (diff < HOUR) return (diff / MINUTE | 0) + ' minutes ago';
  if (diff < DAY) return (diff / HOUR | 0) + ' hours ago';
  if (diff < MONTH) return (diff / DAY | 0) + ' days ago';

  return time.toLocaleDateString();
}

