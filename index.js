const DATA_SERVER = 'https://comntr.live:42751';
const SHA1_PATTERN = /^[a-f0-9]{40}$/;

const $ = selector => document.querySelector(selector);
const log = (...args) => console.log(...args);

log('Waiting for window.onload event.');
window.onload = () => renderComments(location.hash.slice(1));

async function renderComments(topicId) {
  log('Rendering comments for topic:', topicId);

  let buttonAdd = $('#post-comment');
  let elTopicHash = $('#topic-hash');

  if (!topicId) {
    let sampleUrl = 'http://example.com';
    let sampleId = await sha1(sampleUrl);
    let href1 = location.href + '#' + sampleUrl;
    let href2 = location.href + '#' + sampleId;
    elTopicHash.innerHTML = [
      'Specify URL or its SHA-1:',
      `<a href="${href1}">${href1}</a>`,
      `<a href="${href2}">${href2}</a>`,
    ].map(s => '<div>' + s + '</div>').join('');
    return;
  }

  if (!SHA1_PATTERN.test(topicId)) {
    log('This is not a valid topic id:', topicId);
    elTopicHash.title = topicId;
    topicId = await sha1(topicId);
  }

  getComments(topicId);

  buttonAdd.onclick = async () => {
    buttonAdd.disabled = true;
    let textarea = $('#comment');
    let text = textarea.value.trim();
    try {
      await postComment(topicId, text);
      textarea.value = '';
      await getComments(topicId);
    } finally {
      buttonAdd.disabled = false;
    }
  };
}

async function getServer() {
  return DATA_SERVER;
}

async function postComment(topicId, text) {
  let status = $('#status');

  status.textContent = 'Prepairing comment.';

  try {
    if (!text) throw new Error('Cannot post empty comments.');
    let commId = await sha1(text);
    let host = await getServer();
    let url = host + '/' + topicId + '/' + commId;
    status.textContent = 'Posting comment.';
    let rsp = await fetch(url, { method: 'POST', body: text });
    status.textContent = rsp.status + ' ' + rsp.statusText;
    if (!rsp.ok) throw new Error(stats.textContent);
  } catch (err) {
    status.textContent = err && (err.stack || err.message || err);
  }
}

async function getComments(topicId) {
  let status = $('#status');
  let comments = $('#all-comments');
  let elTopicHash = $('#topic-hash');

  if (!SHA1_PATTERN.test(topicId))
    throw new Error('Invalid topic id: ' + topicId);

  try {
    status.textContent = 'Prepairing request.';
    let href = location.origin + '#' + topicId;
    elTopicHash.innerHTML = `<a href="${href}">${topicId}</a>`;
    let host = await getServer();
    let url = host + '/' + topicId;
    status.textContent = 'Fetching comments.';
    let rsp = await fetch(url);
    status.textContent = rsp.status + ' ' + rsp.statusText;
    if (rsp.status != 200) return;

    let json = JSON.parse(await rsp.text());
    status.textContent = '';
    comments.innerHTML = '';

    for (let hash in json) {
      comments.innerHTML += `
      <div id="${hash}">
        ${json[hash]}
      </div>`;
    }
  } catch (err) {
    status.textContent = err && (err.stack || err.message || err);
  }
};

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
