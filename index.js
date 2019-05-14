const QUERY_PARAM_DATA_SERVER = 's';
const DEFAULT_DATA_SERVER = 'https://comntr.live:42751';
const SHA1_PATTERN = /^[a-f0-9]{40}$/;
const URL_PATTERN = /^https?:\/\//;
const COMMENT_DATE_PATTERN = /^Date: (.+)$/m;
const COMMENT_PARENT_PATTERN = /^Parent: (.+)$/m;
const COMMENT_BODY_PATTERN = /\n\n([^\x00]+)/m;

let gTopic = null; // SHA1

const log = (...args) => console.log(...args);
const $ = selector => document.querySelector(selector);

log('Waiting for window.onload event.');
window.onhashchange = () => renderComments();
window.onload = () => {
  $.comments = $('#all-comments');
  renderComments();
};

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
    topicEl.innerHTML = `URL: <a href="${topicId}">${topicId}</a>`;
  } else {
    topicEl.textContent = topicId;
  }

  if (!SHA1_PATTERN.test(topicId)) {
    log('Getting SHA1 of the topic:', topicId);
    topicId = await sha1(topicId);
    log('SHA1:', topicId);
  }

  gTopic = topicId;
  getComments(topicId);

  buttonAdd.onclick = async () => {
    buttonAdd.disabled = true;
    let textarea = $('#comment');
    let text = textarea.value.trim();
    try {
      let { hash, body } = await postComment(text, topicId);
      textarea.value = '';
      let html = makeCommentHtml(parseCommentBody(body, hash));
      let cont = document.createElement('div');
      cont.innerHTML = html;
      let div = cont.firstChild;
      cont.innerHTML = '';
      $.comments.insertBefore(div, $.comments.firstChild);
    } finally {
      buttonAdd.disabled = false;
    }
  };
}

function getQueryParam(name) {
  let args = location.search.slice(1).split('&');
  let arg = args.find(s => s.startsWith(name + '='));
  let value = arg && arg.slice(name.length + 1);
  log('Query: ?' + name + '=', value);
  return value;
}

async function getServer() {
  return getQueryParam(QUERY_PARAM_DATA_SERVER) ||
    DEFAULT_DATA_SERVER;
}

async function postComment(text, topicId = gTopic) {
  let status = $('#status');
  status.textContent = 'Prepairing comment.';

  try {
    if (!text) throw new Error('Cannot post empty comments.');
    let body = await makeCommentBody(text, topicId);
    let hash = await sha1(body);
    let host = await getServer();
    let url = host + '/' + topicId + '/' + hash;
    status.textContent = 'Posting comment.';
    log('Sending comment:', JSON.stringify(body));
    let rsp = await fetch(url, { method: 'POST', body });
    status.textContent = rsp.status + ' ' + rsp.statusText;
    if (!rsp.ok) throw new Error(status.textContent);
    return { hash, body };
  } catch (err) {
    status.textContent = err && (err.stack || err.message || err);
  }
}

async function makeCommentBody(text, topicId = gTopic) {
  return [
    'Date: ' + new Date().toISOString(),
    'Parent: ' + topicId,
    '',
    text,
  ].join('\n');
}

async function getComments(topicId = gTopic) {
  let status = $('#status');

  if (!SHA1_PATTERN.test(topicId))
    throw new Error('Invalid topic id: ' + topicId);

  try {
    status.textContent = 'Prepairing request.';
    let host = await getServer();
    let url = host + '/' + topicId;
    status.textContent = 'Fetching comments.';
    let ctime = Date.now();
    let rsp = await fetch(url);
    log(rsp.status, rsp.statusText);
    status.textContent = rsp.status + ' ' + rsp.statusText;

    if (rsp.status != 200) return;

    let body = await rsp.text();
    let stime = rsp.headers.get('Duration');

    ctime = Date.now() - ctime;
    log('Server time:', stime, 'ms');
    log('Request time:', ctime - stime, 'ms');

    let json = JSON.parse(body);
    let rtime = Date.now();
    let htmls = [];
    let comments = [];

    for (let hash in json) {
      try {
        let body = json[hash];
        let parsed = parseCommentBody(body, hash);
        comments.push(parsed);
      } catch (error) {
        log('Bad comment:', error)
      }
    }

    log('Comments:', comments.length);
    comments.sort((c1, c2) => c2.date - c1.date);

    for (let parsed of comments) {
      let html = makeCommentHtml(parsed);
      htmls.push(html);
    }

    $.comments.innerHTML = htmls.join('');
    rtime = Date.now() - rtime;
    log('Render time:', rtime, 'ms');
  } catch (err) {
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

function makeCommentHtml({ text, date }) {
  return `<div><div>${date.toJSON()}</div><div>${text}</div></div>`;
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
