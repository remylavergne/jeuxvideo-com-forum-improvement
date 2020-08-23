chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.updates) {
        updateForumsList(request.updates);
    }
});

// Premier événement trigger à l'ouverture de la popup
window.onload = function () {
    askBackgroundForExistingUpdates();

}

function askBackgroundForExistingUpdates() {
    chrome.runtime.sendMessage({ popup: 'doYouHaveUpdates' });
}

const list = document.getElementsByClassName('forum-urls')[0];

function updateForumsList(updates) {
    for (update of updates) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = update.forumUrl;
        a.target = '_blank';
        a.innerHTML = update.forumUrl + ' ' + '(' + update.switchedForums + ')' + '(' + update.updatedTopics + ')';
        li.appendChild(a);

        list.appendChild(li);
    }
}
