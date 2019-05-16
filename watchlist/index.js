const UNDO_ID_PREFIX = 'uw-';

window.onload = () => refreshList();
window.onclick = e => handleClick(e.target);
window.onbeforeunload = () => saveChanges();

async function refreshList() {
  let hashes = gWatchlist.get();
  let urls = hashes.map(h => gWatchlist.getUrl(h));
  let htmls = [];

  for (let i = 0; i < urls.length; i++) {
    let hash = hashes[i];
    let url = urls[i];
    let href = '#' + (url || hash);
    let html = `
      <div id="_${hash}">
        <b id="${UNDO_ID_PREFIX + hash}" title="Unwatch">X</b>
        <span>? comments</span>
        <a href="${href}">${href}</a>
      </div>`;
    htmls.push(html);
  }

  document.body.innerHTML = htmls.join('\n');

  let fetches = hashes.map(h => gDataServer.fetchCommentsCount(h));
  let counts = await Promise.all(fetches);

  for (let i = 0; i < hashes.length; i++) {
    let hash = hashes[i];
    let count = counts[i];
    let selector = `div#_${hash} > span`;
    let span = document.querySelector(selector);
    span.textContent = count + ' comments';
  }
}

async function handleClick(target) {
  let id = target && target.id;
  if (!id.startsWith(UNDO_ID_PREFIX)) return;

  if (target.textContent != '+') {
    target.textContent = '+';
    target.title = 'Add back to the watchlist';
  } else {
    target.textContent = 'X';
    target.title = 'Unwatch';
  }
}

function saveChanges() {
  let hashes = gWatchlist.get().filter(h => {
    let selector = '#' + UNDO_ID_PREFIX + h;
    let b = document.querySelector(selector);
    return !b || b.textContent != '+';
  });

  log(`The new watchlist:\n${hashes.join('\n')}`);
  gWatchlist.set(hashes);
}
