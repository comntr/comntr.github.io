define(["require", "exports", "src/log", "src/config", "src/watchlist", "src/cache", "src/dataserver", "src/sender", "src/hashutil", "src/storage", "./src/user"], function (require, exports, log_1, config_1, watchlist_1, cache_1, dataserver_1, sender_1, hashutil_1, storage_1, user_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const SHA1_PATTERN = /^[a-f0-9]{40}$/;
    const URL_PATTERN = /^https?:\/\//;
    const COMMENT_DATE_PATTERN = /^Date: (.+)$/m;
    const COMMENT_USERNAME_PATTERN = /^User: (.+)$/m;
    const COMMENT_PARENT_PATTERN = /^Parent: (.+)$/m;
    const COMMENT_BODY_PATTERN = /\n\n([^\x00]+)/m;
    let gURL = null;
    let gTopic = null; // SHA1
    let gComments = null; // sha1 -> data
    let gDrafts = storage_1.gStorage.getEntry('.drafts');
    let gDraftsTimer = 0;
    const $ = (selector) => document.querySelector(selector);
    $.comments = null;
    $.topic = null;
    $.count = null;
    $.status = null;
    function init() {
        log_1.log('Query params:', config_1.gConfig);
        $.comments = $('#all-comments');
        $.status = $('#status');
        $.topic = $('#topic-url');
        $.count = $('#comments-count');
        if (config_1.gConfig.ext)
            log_1.log('Launched as the extension popup.');
        $.comments.onclick = event => handleCommentsAreaClick(event.target);
        $.comments.oninput = event => handleCommentEdited(event.target);
        sender_1.gSender.commentStateChanged.addListener(e => {
            if (e.thash == gTopic)
                updateCommentState(e.chash);
        });
        window.onhashchange = async () => {
            try {
                await resetComments();
                await renderComments();
                await loadDrafts();
            }
            catch (err) {
                $.status.textContent = err;
            }
        };
        window.onhashchange(null);
    }
    exports.init = init;
    function updateCommentState(chash) {
        log_1.log('Updating comment state:', chash);
        let cdiv = findCommentDivByHash(chash);
        if (!cdiv)
            return;
        let hdiv = cdiv.querySelector('.hd');
        let sdiv = hdiv.querySelector('.st');
        if (!sdiv) {
            sdiv = document.createElement('span');
            sdiv.classList.add('st');
            hdiv.appendChild(sdiv);
        }
        let state = sender_1.gSender.getCommentState(chash);
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
        log_1.log('Resetting comments.');
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
    function isPostButton(x) {
        return x && x.className == 'post';
    }
    function isCommentContainer(x) {
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
        if (!isCommentTextArea(target))
            return;
        if (target.id)
            return;
        clearTimeout(gDraftsTimer);
        gDraftsTimer = setTimeout(() => {
            gDraftsTimer = 0;
            saveDrafts();
        }, config_1.gConfig.dut * 1000);
    }
    function saveDrafts() {
        let time = Date.now();
        let divs = $.comments.querySelectorAll('.cm.draft');
        if (!divs.length)
            return;
        let drafts = gDrafts.json || {};
        let updates = 0;
        divs.forEach(cmDraft => {
            let cmParent = findCommentContainer(cmDraft);
            let chash = cmParent ? getCommentId(cmParent) : gTopic;
            let ctext = cmDraft.querySelector('.ct').textContent.trim();
            if (ctext && drafts[chash] != ctext) {
                drafts[chash] = ctext;
                updates++;
            }
            else if (!ctext && drafts[chash]) {
                delete drafts[chash];
                updates++;
            }
        });
        if (updates > 0) {
            gDrafts.json = drafts;
            log_1.log(`${updates} drafts updated in ${Date.now() - time} ms`);
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
        handlePostCommentButtonClick(target).then();
    }
    function handleCollapseButtonClick(target) {
        if (!isCollapseButton(target))
            return;
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
    function handleReplyButtonClick(target) {
        if (!isReplyButton(target))
            return;
        let comm = findCommentContainer(target);
        let chash = getCommentId(comm);
        let draft = setCommentDraftFor(chash);
        let ct = draft.querySelector('.ct');
        ct.focus();
    }
    function setCommentDraftFor(chash, ctext = '') {
        if (chash == gTopic) {
            let divDraft = $.comments.querySelector(':scope > .draft');
            let divText = divDraft && divDraft.querySelector('.ct');
            if (divText)
                divText.textContent = ctext;
            return;
        }
        let comm = findCommentDivByHash(chash);
        if (!comm)
            return;
        let subc = comm.querySelector('.sub');
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
        log_1.log('Rendering comments for topic:', topicId);
        if (!topicId)
            throw new Error('topic id is null');
        document.title = 'Comntr - ' + topicId;
        if (URL_PATTERN.test(topicId)) {
            let a = $.topic.querySelector('a');
            if (a)
                a.href = topicId;
        }
        else {
            log_1.log.i(`The topic id doesn't look like a URL, so hiding the URL link.`);
            $.topic.style.display = 'none';
        }
        if (!SHA1_PATTERN.test(topicId)) {
            gURL = topicId;
            topicId = await hashutil_1.sha1(topicId);
            log_1.log('sha1(topic):', topicId);
        }
        gTopic = topicId;
        await getComments(topicId);
        await markAllCommentsAsRead();
        await updateAllCommentStates();
    }
    function updateAllCommentStates() {
        let pending = sender_1.gSender.getPendingComments(gTopic);
        let failed = sender_1.gSender.getFailedComments(gTopic);
        for (let chash of [...pending, ...failed])
            updateCommentState(chash);
    }
    async function markAllCommentsAsRead() {
        if (!await watchlist_1.gWatchlist.isWatched(gTopic))
            return;
        let size = Object.keys(gComments || {}).length;
        log_1.log(`Marking all ${size} comments as read.`);
        await watchlist_1.gWatchlist.setSize(gTopic, size);
    }
    async function handlePostCommentButtonClick(buttonAdd) {
        if (!isPostButton(buttonAdd))
            return;
        let divComment = findCommentContainer(buttonAdd);
        let divParent = findCommentContainer(divComment);
        let divInput = divComment.querySelector('.ct');
        let divSubc = divParent ? divParent.querySelector('.sub') : $.comments;
        let text = divInput.textContent.trim();
        let phash = divParent ? divParent.id.slice(3) : gTopic;
        log_1.log('Replying to', phash, 'with', text);
        try {
            if (!text)
                throw new Error('Cannot send an empty comment.');
            buttonAdd.style.display = 'none';
            let drafts = gDrafts.json || {};
            delete drafts[phash];
            gDrafts.json = drafts;
            let { hash, body } = await sender_1.gSender.postComment({
                text,
                topic: gTopic,
                parent: phash,
            });
            let html = makeCommentHtml(parseCommentBody(body, hash));
            let div = renderHtmlAsElement(html);
            divSubc.insertBefore(div, divSubc.firstChild);
            divComment.remove();
            updateCommentsCount();
        }
        finally {
            buttonAdd.style.display = '';
        }
        await watchlist_1.gWatchlist.add(gTopic, gURL);
        await markAllCommentsAsRead();
    }
    function renderHtmlAsElement(html) {
        let container = document.createElement('div');
        container.innerHTML = html;
        let element = container.children[0];
        container.innerHTML = '';
        return element;
    }
    async function runAsyncStep(label, fn) {
        log_1.log.i('Started:', label);
        let time = Date.now();
        let res = await fn();
        let diff = Date.now() - time;
        if (diff > 10)
            log_1.log.w('Done:', label, diff, 'ms');
        return res;
    }
    async function getComments(thash = gTopic) {
        if (!SHA1_PATTERN.test(thash))
            throw new Error('Invalid topic id: ' + thash);
        try {
            let tcache = cache_1.gCache.getTopic(thash);
            let xorhash = await tcache.getXorHash();
            log_1.log('Cached xorhash:', xorhash);
            let rcdata = await runAsyncStep('Fetching comments.', async () => {
                try {
                    return await dataserver_1.gDataServer.fetchComments(thash, xorhash);
                }
                catch (err) {
                    log_1.log.e('Failed to get comments:', err);
                    $.status.textContent = 'Failed to download comments: ' + err;
                    return [];
                }
            });
            let rchashes = await runAsyncStep(`Computing SHA1 for the ${rcdata.length} fetched comments.`, () => Promise.all(rcdata.map(hashutil_1.sha1)));
            let chashes = await runAsyncStep('Getting comment hashes from the DB.', () => tcache.getCommentHashes());
            await runAsyncStep('Reading comment data from the DB.', async () => {
                gComments = {};
                for (let chash of chashes) {
                    let cbody = await tcache.getCommentData(chash);
                    gComments[chash] = cbody;
                }
            });
            await runAsyncStep('Saving new comments to the DB.', async () => {
                for (let i = 0; i < rchashes.length; i++) {
                    let data = rcdata[i];
                    let hash = rchashes[i];
                    if (gComments[hash])
                        continue;
                    gComments[hash] = data;
                    await tcache.addComment(hash, data);
                }
            });
            await runAsyncStep('Updating the xorhash.', () => tcache.setCommentHashes(Object.keys(gComments)));
            updateCommentsCount();
            let comments = [];
            let byhash = {};
            await runAsyncStep('Generating html.', async () => {
                for (let hash in gComments) {
                    try {
                        let body = gComments[hash];
                        let parsed = parseCommentBody(body, hash);
                        comments.push(parsed);
                        byhash[parsed.hash] = parsed;
                    }
                    catch (error) {
                        log_1.log.e('Bad comment:', error);
                    }
                }
            });
            await runAsyncStep('Generating tree of comments.', async () => {
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
                        let html = makeCommentHtml(Object.assign({}, comm, { subc }));
                        htmls.push(html);
                    }
                    return htmls.join('\n');
                };
                $.comments.innerHTML += render(gTopic);
            });
        }
        catch (err) {
            log_1.log.e(err);
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
            user: user_1.gUser.username.get(),
        });
        let div = renderHtmlAsElement(html);
        div.classList.add('draft');
        return div;
    }
    function makeCommentHtml({ user = null, text = '', // empty text means it's editable
    date = null, hash = null, subc = '' }) {
        return `
    <div class="cm" ${hash ? `id="cm-${hash}"` : ``}>
      <div class="hd">
        ${user ? `<span class="u">${user}</span>` : ``}
        ${date ? `<span class="ts">${getRelativeTime(date)}</span>` : ``}
        ${text ? `<span class="r">Reply</span>` : ``}
        ${!text ? `<span class="post">Send</span>` : ``}
        ${subc ? `<span class="c">Collapse</span>` : ``}
      </div>
      <div class="ct" ${!text ? `contenteditable` : ``}>${text}</div>
      ${subc ? `<div class="sub">${subc}</div>` : ``}
    </div>`;
    }
    function getRelativeTime(time) {
        const MINUTE = 60;
        const HOUR = 3600;
        const DAY = 86400;
        const MONTH = 30 * DAY;
        let diff = (Date.now() - time.getTime()) / 1000;
        if (diff < 0)
            return 'In the future';
        if (diff < 60)
            return 'A minute ago';
        if (diff < HOUR)
            return (diff / MINUTE | 0) + ' minutes ago';
        if (diff < DAY)
            return (diff / HOUR | 0) + ' hours ago';
        if (diff < MONTH)
            return (diff / DAY | 0) + ' days ago';
        return time.toLocaleDateString();
    }
});
//# sourceMappingURL=index.js.map