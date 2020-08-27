import { UpdateBackup } from "./classes";
import { getUpdates } from "./functions";


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    // if (request.updates) {
    //     updateForumsList(request.updates);
    // }
});

// Premier événement trigger à l'ouverture de la popup
window.onload = async function () {
    const updates = await getUpdates();
    updateForumsList(updates);
}

const list = document.getElementsByClassName('forum-urls')[0];

function updateForumsList(backup: UpdateBackup): void {
    for (let update of backup.updates) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.classList.add('link');
        a.href = update.forumUrl;
        a.target = '_blank';
        a.innerHTML = update.forumTitle + ' : ' + update.updatedTopics + ' sujet(s) à jour et ' + update.switchedForums + ' nouveau(x)';
        li.appendChild(a);

        list.appendChild(li);
    }
    // TODO : Au clic sur un lien, le retirer de la liste (visibility hide ?)
}
