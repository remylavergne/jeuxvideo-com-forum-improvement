import { Update } from "./classes";

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

function updateForumsList(updates: Update[]): void {
    for (let update of updates) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.classList.add('link');
        a.href = update.forumUrl;
        a.target = '_blank';
        a.innerHTML = update.forumTitle + ' : ' + update.updatedTopics + ' sujet(s) à jour et ' + update.switchedForums + ' nouveau(x)';
        li.appendChild(a);

        list.appendChild(li);
    }
}
