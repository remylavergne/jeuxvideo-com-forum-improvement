import { UpdateBackup } from "./classes";
import { getUpdates, cnsl } from "./functions";


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
const noUpdate = document.getElementById('no-update');
const date = document.getElementById('footer-date');

function updateForumsList(backup: UpdateBackup): void {

    cnsl('Mise à jour reçue(s)', backup);
    

    if (backup.updates.length > 0) {
        noUpdate.hidden = true;

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

        date.innerHTML = backup.updates[0].date;
        cnsl('date span', date);
    }

    // TODO : Au clic sur un lien, le retirer de la liste (visibility hide ?)
}
