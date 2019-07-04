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
const CSS_CLASS_BLOCK_COMMENT = 'block'; // .cm.draft.block
const CSS_CLASS_BANNED_COMMENT = 'blocked'; // .cm.banned
const CSS_CLASS_MY_COMMENT = 'mine'; // .cm.mine
const CSS_BAN_USER_NOTE = 'ban-user-note'; // .cm.draft > .hd
const CSS_COMMENT_HEADER = 'hd'; // .cm > .hd
const CSS_COMMENT_TEXT = 'ct'; // .cm > .ct
const LS_DRAFTS_KEY = 'sys.drafts';
const SHA1_PATTERN = /^[a-f0-9]{40}$/;
const URL_PATTERN = /^https?:\/\//;
const COMMENT_DATE_PATTERN = /^Date: (.+)$/m;
const COMMENT_USERNAME_PATTERN = /^User: (.+)$/m;
const COMMENT_USERKEY_PATTERN = /^Public-Key: (.+)$/m;
const COMMENT_PARENT_PATTERN = /^Parent: (.+)$/m;
const COMMENT_BLOCKED_USER_PATTERN = /^Blocked-User: (\w+)$/m;
const COMMENT_BODY_PATTERN = /\n\n([^\x00]+)/m;

let log = tagged('ui').tagged('main');
let gURL = null;
let gTopic = null; // SHA1
let gComments: { [chash: string]: string } = null; // sha1 -> data
let gBlockedUsers: { [userid: string]: string } = null; // sha1(pubkey) -> cdata
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
      await loadBanList();
      await renderComments();
      await loadDrafts();
    } catch (err) {
      $.status.textContent = err;
    }
  };

  window.onhashchange(null);
}

async function loadBanList() {
  gBlockedUsers = null;
  let filterId = gConfig.filterId.get();
  if (!filterId) return;
  log.i('Loading blocked comments from:', filterId);
  let comments = await loadComments(filterId);
  for (let ch in comments) {
    let cdata = comments[ch];
    let match = COMMENT_BLOCKED_USER_PATTERN.exec(cdata);
    if (!match) {
      log.w('Bad comment:', cdata);
      continue;
    }
    let userid = match[1];
    log.i('Banned userid:', userid);
    if (!gBlockedUsers) gBlockedUsers = {};
    gBlockedUsers[userid] = cdata;
  }
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

function findCommentContainer(target: HTMLElement): HTMLElement {
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

  divs.forEach((cmDraft: HTMLElement) => {
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
  let subc: HTMLElement = comm.querySelector('.sub');
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
  log.i('User comment:\n' + gComments[chash]);
  let { userid, username } = await getCommentAuthorInfo(chash);
  if (!userid) return log.w('No user id found for comment', chash);
  let draft = setCommentDraftFor(chash);
  draft.classList.add(CSS_CLASS_BLOCK_COMMENT);
  let header = draft.querySelector(':scope > .' + CSS_COMMENT_HEADER);

  if (!header.querySelector(':scope > .' + CSS_BAN_USER_NOTE)) {
    let spanUserId = document.createElement('span');
    spanUserId.className = CSS_BAN_USER_NOTE;
    header.appendChild(spanUserId);
    spanUserId.textContent = [
      'User being blocked:',
      userid.slice(0, N_USERID_CHARS),
      username,
    ].join(' ');
  }

  let ctext = draft.querySelector(':scope > .' + CSS_COMMENT_TEXT) as HTMLElement;
  ctext.focus();
}

async function getCommentAuthorInfo(chash: string) {
  let cdata = gComments[chash];
  let pkMatch = cdata && /^Public-Key: (\w+)$/m.exec(cdata);
  let unMatch = cdata && /^User: (\S+)$/m.exec(cdata);
  let pubkey = pkMatch && pkMatch[1];
  let userid = pubkey && await sha1(pubkey);
  let username = unMatch && unMatch[1];
  return { userid, username, pubkey };
}

function handleReplyButtonClick(target) {
  if (!isReplyButton(target)) return;
  let comm = findCommentContainer(target);
  let chash = getCommentId(comm);
  let draft = setCommentDraftFor(chash);
  draft.classList.remove(CSS_CLASS_BLOCK_COMMENT);
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

async function handlePostCommentButtonClick(buttonAdd: HTMLElement) {
  if (!isPostButton(buttonAdd)) return;
  let divComment = findCommentContainer(buttonAdd);
  let isBanRequest = divComment.classList.contains(CSS_CLASS_BLOCK_COMMENT);
  let divParent = findCommentContainer(divComment);
  let divInput = divComment.querySelector('.ct');
  let divSubc = divParent ? divParent.querySelector('.sub') : $.comments;
  let text = divInput.textContent.trim();
  let phash = divParent ? divParent.id.slice(3) : gTopic;
  let banned = isBanRequest && await getCommentAuthorInfo(phash);

  log.i('Block request?', isBanRequest);
  log.i('Replying to', phash, 'with', text);

  try {
    if (!text) {
      throw new Error('Cannot send an empty comment.');
    }

    buttonAdd.style.display = 'none';
    let drafts = gDrafts.json || {};
    delete drafts[phash];
    gDrafts.json = drafts;

    let topic = isBanRequest ?
      gConfig.filterId.get() :
      gTopic;

    let headers = {
      'Parent': phash,
      'Blocked-User': isBanRequest && banned.userid,
    };

    let { hash, body } = await gSender.postComment({
      text,
      topic,
      headers,
    });

    divComment.remove();

    if (isBanRequest) {
      divParent.classList.add(CSS_CLASS_BANNED_COMMENT);
    } else {
      let html = makeCommentHtml(parseCommentBody(body, hash));
      let div = renderHtmlAsElement(html);
      divSubc.insertBefore(div, divSubc.firstChild);
      updateCommentsCount();
    }
  } finally {
    buttonAdd.style.display = '';
  }

  if (!isBanRequest) {
    await gWatchlist.add(gTopic, gURL);
    await markAllCommentsAsRead();
  }
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

async function loadComments(thash: string) {
  if (!SHA1_PATTERN.test(thash))
    throw new Error('Invalid topic id: ' + thash);

  let tcache = gCache.getTopic(thash);
  let xorhash = await tcache.getXorHash();
  let comments = {};

  log.i('Cached xorhash:', xorhash);

  let rcdata = await runAsyncStep(
    'Fetching comments.',
    async () => {
      try {
        return await gDataServer.fetchComments(thash, xorhash);
      } catch (err) {
        log.e('Failed to get comments:', err);
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
      for (let chash of chashes) {
        let cbody = await tcache.getCommentData(chash);
        comments[chash] = cbody;
      }
    });

  await runAsyncStep(
    'Saving new comments to the DB.',
    async () => {
      for (let i = 0; i < rchashes.length; i++) {
        let data = rcdata[i];
        let hash = rchashes[i];

        if (comments[hash]) continue;

        comments[hash] = data;
        await tcache.addComment(hash, data);
      }
    });

  await runAsyncStep(
    'Updating the xorhash.',
    () => tcache.setCommentHashes(Object.keys(comments)));

  return comments;
}

async function getComments(thash = gTopic) {
  try {
    gComments = await loadComments(thash);
    updateCommentsCount();

    let comments: ParsedCommentInfo[] = [];
    let byhash: { [chash: string]: ParsedCommentInfo } = {};
    let blocked: { [chash: string]: boolean } = {};
    let myPubKey = gUser.hasUserKeys() && await gUser.getPublicKey();

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
      'Looking for blocked users.',
      async () => {
        if (!gBlockedUsers) return;

        for (let chash in byhash) {
          let { pubkey } = byhash[chash];
          if (!pubkey) continue;
          let userid = await sha1(pubkey);
          if (gBlockedUsers[userid])
            blocked[chash] = true;
        }

        log.i('Blocked comments:', Object.keys(blocked).length);
      });

    await runAsyncStep(
      'Generating tree of comments.',
      async () => {
        let tree: { [chash: string]: string[] } = {};
        tree[gTopic] = [];

        for (let { hash, parent } of comments) {
          tree[parent] = tree[parent] || [];
          tree[parent].push(hash);
        }

        let render = (phash: string) => {
          let htmls = [];
          let hashes = tree[phash] || [];

          hashes.sort((h1, h2) =>
            +byhash[h2].date - +byhash[h1].date);

          for (let chash of hashes) {
            let subc = render(chash);
            let comm = byhash[chash];
            let html = makeCommentHtml({
              blocked: !!blocked[chash],
              isme: comm.pubkey == myPubKey,
              subc,
              ...comm,
            });
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

interface ParsedCommentInfo {
  user: string; // username
  parent: string; // phash
  text: string;
  date: Date;
  pubkey: string;
  hash: string; // chash
}

function parseCommentBody(body: string, hash: string): ParsedCommentInfo {
  let [, date] = COMMENT_DATE_PATTERN.exec(body);
  let [, parent] = COMMENT_PARENT_PATTERN.exec(body);
  let [, text] = COMMENT_BODY_PATTERN.exec(body);
  let [, user = null] = COMMENT_USERNAME_PATTERN.exec(body) || [];
  let [, pubkey = null] = COMMENT_USERKEY_PATTERN.exec(body) || [];
  return { user, date: new Date(date), parent, text, hash, pubkey };
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
  blocked = false,
  isme = false,
  date = null,
  hash = null,
  subc = '' }) {

  let html = text.replace(/([</&>])/gm,
    (_, ch) => '&#' + ch.charCodeAt(0) + ';');

  let classes = ['cm'];
  if (blocked) classes.push(CSS_CLASS_BANNED_COMMENT);
  if (isme) classes.push(CSS_CLASS_MY_COMMENT);

  return `
    <div class="${classes.join(' ')}" ${hash ? `id="cm-${hash}"` : ``}>
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

