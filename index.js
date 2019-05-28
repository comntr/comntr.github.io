const SHA1_PATTERN = /^[a-f0-9]{40}$/;
const URL_PATTERN = /^https?:\/\//;
const COMMENT_DATE_PATTERN = /^Date: (.+)$/m;
const COMMENT_PARENT_PATTERN = /^Parent: (.+)$/m;
const COMMENT_BODY_PATTERN = /\n\n([^\x00]+)/m;

let gURL = null;
let gTopic = null; // SHA1
let gComments = null; // sha1 -> data

const $ = selector => document.querySelector(selector);

log('Waiting for window.onload event.');
window.onhashchange = () => {
  resetComments();
  renderComments();
};
window.onload = () => {
  log('Query params:', gQuery);

  $.comments = $('#all-comments');
  $.topic = $('#topic');

  if (gQuery.ext) {
    log('Launched as the extension popup.');
    $.topic.style.display = 'none';
  }

  $.comments.onclick = event => handleCommentsClick(event.target);
  renderComments();
};

function resetComments() {
  log('Resetting comments.');
  $.comments.innerHTML = '';
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
    let sampleUrl = 'http://example.com';
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
  let buttonAdd = $('#post-comment');
  buttonAdd.disabled = true;
  let textarea = $('#comment');
  let text = textarea.value.trim();

  try {
    let { hash, body } = await postComment({ text });
    textarea.value = '';
    let html = makeCommentHtml(parseCommentBody(body, hash));
    let div = renderHtmlAsElement(html);
    $.comments.insertBefore(div, $.comments.firstChild);
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

async function postComment({ text, parent = gTopic, topicId = gTopic }) {
  let status = $('#status');
  status.textContent = 'Prepairing comment.';

  try {
    if (!text) throw new Error('Cannot post empty comments.');
    let body = await makeCommentBody({ text, parent });
    let hash = await sha1(body);
    status.textContent = 'Posting comment.';
    await gDataServer.postComment(topicId, { hash, body });
    status.textContent = '';
    gComments[hash] = body;
    return { hash, body };
  } catch (err) {
    status.textContent = err && (err.stack || err.message || err);
  }
}

async function postRandomComments({ size = 100, prefix = 'x' }) {
  let hashes = [gTopic];

  for (let i = 0; i < size; i++) {
    let parent = hashes[Math.random() * hashes.length | 0];

    let { hash } = await postComment({
      text: prefix + i,
      parent: parent,
    });

    hashes.push(hash);
  }
}

async function makeCommentBody({ text, parent = gTopic }) {
  return [
    'Date: ' + new Date().toISOString(),
    'Parent: ' + parent,
    '',
    text,
  ].join('\n');
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
    let list = await gDataServer.fetchComments(thash, xorhash);

    log('Hashing comments.');
    let htime = Date.now();
    
    gComments = {};

    for (let chash of tcache.getCommentHashes()) {
      let cbody = tcache.getCommentData(chash);
      gComments[chash] = cbody;
    }

    let tasks = list.map(data => {
      let chash = tcache.getCommentHash(data);
      if (chash) {
        gComments[chash] = data;
        return;
      }
      return sha1(data).then(hash => {
        gComments[hash] = data;
        tcache.addComment(hash, data);
      });
    });
    await Promise.all(tasks);
    tcache.setCommentHashes(Object.keys(gComments));    
    log('Hashing time:', Date.now() - htime, 'ms');

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
  date = new Date(date);
  return { date, parent, text, hash };
}

function makeCommentHtml({ text, date, hash, subc = '' }) {
  return `
    <div class="cm" id="cm-${hash}">
      <div class="hd">
        <span class="u">User123</span>
        <span class="ts">${date.toLocaleTimeString()}</span>
        <span class="r">Reply</span>
        <span class="c" style="${subc ? '' : 'display:none'}">Collapse</span>
      </div>
      <div class="ct">${text}</div>
      <div class="sub">${subc}</div>
    </div>`;
}

function sha1(str) {
  let bytes = new Uint8Array(str.length);

  for (let i = 0; i < str.length; i++)
    bytes[i] = str.charCodeAt(i) & 0xFF;

  return new Promise(resolve => {
    crypto.subtle.digest('SHA-1', bytes).then(buffer => {
      let hash = Array.from(new Uint8Array(buffer)).map(byte => {
        return ('0' + byte.toString(16)).slice(-2);
      }).join('');

      resolve(hash);
    });
  });
}
