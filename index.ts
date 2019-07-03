import { tagged } from 'src/log';
import { gConfig } from 'src/config';
import { gWatchlist } from 'src/watchlist';
import { gCache } from 'src/cache';
import { gDataServer } from 'src/dataserver';
import { gSender } from 'src/sender';
import { sha1 } from 'src/hashutil';
import { gStorage } from 'src/storage';
import { gUser } from 'src/user';
import * as dmode from 'src/dmode';

const N_USERID_CHARS = 7;
const CSS_CLASS_ADMIN = 'admin'; // <body>
const CSS_CLASS_BLOCK = 'block'; // .cm.draft
const LS_DRAFTS_KEY = 'sys.drafts';
const SHA1_PATTERN = /^[a-f0-9]{40}$/;
const URL_PATTERN = /^https?:\/\//;
const COMMENT_DATE_PATTERN = /^Date: (.+)$/m;
const COMMENT_USERNAME_PATTERN = /^User: (.+)$/m;
const COMMENT_PARENT_PATTERN = /^Parent: (.+)$/m;
const COMMENT_BODY_PATTERN = /\n\n([^\x00]+)/m;

let log = tagged('ui').tagged('main');
let gURL = null;
let gTopic = null; // SHA1
let gComments: { [chash: string]: string } = null; // sha1 -> data
let gDrafts = gStorage.getEntry(LS_DRAFTS_KEY);
let gDraftsTimer = 0;
let gIsAdmin = false;

const $ = (selector: string): HTMLElement => document.querySelector(selector);

$.comments = null as HTMLElement;
$.topic = null as HTMLElement;
$.count = null as HTMLAnchorElement;
$.status = null as HTMLElement;

export function init() {
  logConfig();

  $.comments = $('#all-comments');
  $.status = $('#status');
  $.topic = $('#topic-url');
  $.count = $('#comments-count') as HTMLAnchorElement;

  if (gConfig.ext.get())
    log.i('Launched as the extension popup.');

  dmode.init(); // Switch to the dark mode, if necessary.

  $.comments.onclick = event => handleCommentsAreaClick(event.target);
  $.comments.oninput = event => handleCommentEdited(event.target);

  gSender.commentStateChanged.addListener(e => {
    if (e.thash == gTopic)
      updateCommentState(e.chash);
  });

  window.onhashchange = async () => {
    try {
      await resetComments();
      await initAdminMode();
      await renderComments();
      await loadDrafts();
    } catch (err) {
      $.status.textContent = err;
    }
  };

  window.onhashchange(null);
}

async function initAdminMode() {
  gIsAdmin = false;

  let filterId = gConfig.filterId.get();
  let filterTag = gConfig.filterTag.get();

  if (!filterId) return;
  log.i('There is a ?filter=<...> set for this page');
  log.i('Filter id:', filterId);
  log.i('Filter tag:', filterTag);

  if (!filterTag) {
    log.w('?filter=<...> must come together with ?tag=<...>');
    return;
  }

  if (!gUser.hasUserKeys()) {
    log.i(`The user doesn't have ed25519 keys and thus can't be the admin.`);
    return;
  }

  let adminFilterId = await gUser.deriveFilterId(filterTag);

  if (adminFilterId == filterId)
    gIsAdmin = true;

  document.body.classList.toggle(CSS_CLASS_ADMIN, gIsAdmin);
  log.i('Admin?', gIsAdmin);

  if (!gIsAdmin) {
    log.i('If this user was the admin, the filter id would be', adminFilterId);
    return;
  }
}

function logConfig() {
  let json = {};
  for (let name in gConfig)
    json[name] = gConfig[name].get();
  log.i('Current config:', json);
}

function updateCommentState(chash) {
  log.i('Updating comment state:', chash);
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
  log.i('Resetting comments.');
  $.status.textContent = '';
  $.comments.innerHTML = '';
  $.count.textContent = 'Fetching comments...';
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

function isBlockButton(x) {
  return x && x.className == 'ban';
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

  clearTimeout(gDraftsTimer);
  gDraftsTimer = setTimeout(() => {
    gDraftsTimer = 0;
    saveDrafts();
  }, gConfig.dut.get() * 1000);
}

function saveDrafts() {
  let time = Date.now();
  let divs = $.comments.querySelectorAll('.cm.draft');
  if (!divs.length) return;
  let drafts = gDrafts.json || {};
  let updates = 0;

  divs.forEach(cmDraft => {
    let cmParent = findCommentContainer(cmDraft);
    let chash = cmParent ? getCommentId(cmParent) : gTopic;
    let ctext = cmDraft.querySelector('.ct').textContent.trim();
    if (ctext && drafts[chash] != ctext) {
      drafts[chash] = ctext;
      updates++;
    } else if (!ctext && drafts[chash]) {
      delete drafts[chash];
      updates++;
    }
  });

  if (updates > 0) {
    gDrafts.json = drafts;
    log.i(`${updates} drafts updated in ${Date.now() - time} ms`);
  }
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
  handleBlockButtonClick(target);
  // tslint:disable-next-line:no-floating-promises
  handlePostCommentButtonClick(target);
}

function handleCollapseButtonClick(target) {
  if (!isCollapseButton(target)) return;
  let comm = findCommentContainer(target);
  let subc = comm.querySelector('.sub');
  if (subc) {
    let n = subc.querySelectorAll('.cm').length;
    let disp = subc.style.display;
    subc.style.display = !disp ? 'none' : '';
    target.textContent = disp ? 'Collapse' :
      n < 2 ? 'Expand' : `Expand (${n} comments)`;
  }
}

async function handleBlockButtonClick(target) {
  if (!isBlockButton(target)) return;
  let comm = findCommentContainer(target);
  let chash = getCommentId(comm);
  let userid = await getCommentAuthorId(chash);
  if (!userid) {
    log.w('No user id found for comment', chash);
    return;
  }
  let draft = setCommentDraftFor(chash);
  draft.classList.add(CSS_CLASS_BLOCK);
  let ct: HTMLElement = draft.querySelector('.ct');
  ct.textContent = [
    'Block-User: ' + userid.slice(0, N_USERID_CHARS),
    'Reason: Just Cause',
  ].join('\n');
}

async function getCommentAuthorId(chash: string): Promise<string> {
  let cdata = gComments[chash];
  let match = cdata && /^Public-Key: (\w+)$/m.exec(cdata);
  let pubkey = match && match[1];
  let userid = pubkey && await sha1(pubkey);
  return userid;
}

function handleReplyButtonClick(target) {
  if (!isReplyButton(target)) return;
  let comm = findCommentContainer(target);
  let chash = getCommentId(comm);
  let draft = setCommentDraftFor(chash);
  draft.classList.remove(CSS_CLASS_BLOCK);
  let ct: HTMLElement = draft.querySelector('.ct');
  ct.focus();
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

  return repl;
}

async function renderComments() {
  let topicId = location.hash.slice(1);
  log.i('Rendering comments for topic:', topicId);
  if (!topicId) throw new Error('topic id is null');

  document.title = 'Comntr - ' + topicId;
  $.count.href = location.origin + '#' + topicId;

  if (URL_PATTERN.test(topicId) && !gConfig.ext.get()) {
    let a = $.topic.querySelector('a');
    if (a) a.href = topicId;
  } else {
    $.topic.style.display = 'none';
  }

  if (!SHA1_PATTERN.test(topicId)) {
    gURL = topicId;
    topicId = await sha1(topicId);
    log.i('sha1(topic):', topicId);
  }

  gTopic = topicId;
  await getComments(topicId);
  await markAllCommentsAsRead();
  await updateAllCommentStates();
}

function updateAllCommentStates() {
  let pending = gSender.getPendingComments(gTopic);
  let failed = gSender.getFailedComments(gTopic);
  for (let chash of [...pending, ...failed])
    updateCommentState(chash);
}

async function markAllCommentsAsRead() {
  if (!await gWatchlist.isWatched(gTopic)) return;
  let size = Object.keys(gComments || {}).length;
  log.i(`Marking all ${size} comments as read.`);
  await gWatchlist.setSize(gTopic, size);
}

async function handlePostCommentButtonClick(buttonAdd) {
  if (!isPostButton(buttonAdd)) return;
  let divComment = findCommentContainer(buttonAdd);
  let divParent = findCommentContainer(divComment);
  let divInput = divComment.querySelector('.ct');
  let divSubc = divParent ? divParent.querySelector('.sub') : $.comments;
  let text = divInput.textContent.trim();
  let phash = divParent ? divParent.id.slice(3) : gTopic;
  log.i('Replying to', phash, 'with', text);

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

  await gWatchlist.add(gTopic, gURL);
  await markAllCommentsAsRead();
}

function renderHtmlAsElement(html) {
  let container = document.createElement('div');
  container.innerHTML = html;
  let element = container.children[0];
  container.innerHTML = '';
  return element as HTMLElement;
}

async function runAsyncStep<T>(label, fn: () => Promise<T>) {
  log.i('Started:', label);
  let time = Date.now();
  let res = await fn();
  let diff = Date.now() - time;
  if (diff > 10) log.w('Done:', label, diff, 'ms');
  return res;
}

async function getComments(thash = gTopic) {
  if (!SHA1_PATTERN.test(thash))
    throw new Error('Invalid topic id: ' + thash);

  try {
    let tcache = gCache.getTopic(thash);
    let xorhash = await tcache.getXorHash();
    log.i('Cached xorhash:', xorhash);

    let rcdata = await runAsyncStep(
      'Fetching comments.',
      async () => {
        try {
          return await gDataServer.fetchComments(thash, xorhash);
        } catch (err) {
          log.e('Failed to get comments:', err);
          $.status.textContent = 'Failed to download comments: ' + err;
          return [];
        }
      });

    let rchashes = await runAsyncStep(
      `Computing SHA1 for the ${rcdata.length} fetched comments.`,
      () => Promise.all(rcdata.map(sha1)));

    let chashes = await runAsyncStep(
      'Getting comment hashes from the DB.',
      () => tcache.getCommentHashes());

    await runAsyncStep(
      'Reading comment data from the DB.',
      async () => {
        gComments = {};
        for (let chash of chashes) {
          let cbody = await tcache.getCommentData(chash);
          gComments[chash] = cbody;
        }
      });

    await runAsyncStep(
      'Saving new comments to the DB.',
      async () => {
        for (let i = 0; i < rchashes.length; i++) {
          let data = rcdata[i];
          let hash = rchashes[i];

          if (gComments[hash]) continue;

          gComments[hash] = data;
          await tcache.addComment(hash, data);
        }
      });

    await runAsyncStep(
      'Updating the xorhash.',
      () => tcache.setCommentHashes(Object.keys(gComments)));

    updateCommentsCount();

    let comments = [];
    let byhash = {};

    await runAsyncStep(
      'Generating html.',
      async () => {
        for (let hash in gComments) {
          try {
            let body = gComments[hash];
            let parsed = parseCommentBody(body, hash);
            comments.push(parsed);
            byhash[parsed.hash] = parsed;
          } catch (error) {
            log.e('Bad comment:', error)
          }
        }
      });

    await runAsyncStep(
      'Generating tree of comments.',
      async () => {
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
      });
  } catch (err) {
    log.e(err);
    $.status.textContent = err;
  }
}

function parseCommentBody(body, hash) {
  let [, date] = COMMENT_DATE_PATTERN.exec(body);
  let [, parent] = COMMENT_PARENT_PATTERN.exec(body);
  let [, text] = COMMENT_BODY_PATTERN.exec(body);
  let [, user = null] = COMMENT_USERNAME_PATTERN.exec(body) || [];
  return { user, date: new Date(date), parent, text, hash };
}

function findCommentDivByHash(chash) {
  return $('#cm-' + chash);
}

function createNewCommentDiv() {
  let html = makeCommentHtml({
    user: gUser.username.get(),
  });
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

  let html = text.replace(/([<>])/gm,
    (_, ch) => '&#' + ch.charCodeAt(0) + ';');

  return `
    <div class="cm" ${hash ? `id="cm-${hash}"` : ``}>
      <div class="hd">
        ${user ? `<span class="u">${user}</span>` : ``}
        ${date ? `<span class="ts">${getRelativeTime(date)}</span>` : ``}
        ${text ? `<span class="r">Reply</span>` : `<span class="post">Send</span>`}
        ${subc ? `<span class="c">Collapse</span>` : ``}
        ${gIsAdmin && text ? `<span class="ban">Block</span>` : ``}
      </div>
      <div class="ct" ${!text ? `contenteditable` : ``}>${html}</div>
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

