window.onload = async function (eventHandler, ev) {
    updateForumsList();
};

const body = document.getElementsByTagName('body')[0];

body.addEventListener('click', event => {
    if (!event.target.classList.contains('btn-remove')) {
        return;
    }

    removeForumSubscription(event.target.id);
});

// Get HTML Elements
const list = document.getElementsByClassName('forum-urls')[0];

// -- Functions

async function getFollowedForums() {
    return new Promise(function (resolve, reject) {
        chrome.storage.local.get('followedForums', function (result) {
            resolve(result);
        });
    });
}

async function updateForumsList() {
    const data = await getFollowedForums();
    const followedForums = data.followedForums;
    // Nettoyage de l'UI
    list.innerHTML = '';

    for (forum of followedForums) {
        // Element de la liste
        const li = document.createElement('li');
        // Lien
        const a = document.createElement('a');
        a.classList.add('link');
        a.href = forum.url;
        a.target = '_blank';
        a.innerHTML = forum.name;
        // Bouton 
        const button = document.createElement('button');
        button.classList.add('btn-remove');
        button.id = forum.url;
        button.innerText = 'X';
        button.title = 'Ne plus suivre';

        // Ajouter au DOM
        li.appendChild(button);
        li.appendChild(a);
        list.appendChild(li);
    }
}

async function removeForumSubscription(forumUrl) {
    // Récupérer les forums encore une fois.
    // L'utilisateur peut avoir suivi / supprimer d'autres forums entre temps
    const data = await getFollowedForums();
    // Trouver l'index du forum dans la liste
    const urls = data.followedForums.map(forum => forum.url);
    const idx = urls.findIndex(url => url === forumUrl);
    // Get id
    const forum = Forum.fromObject(data.followedForums[idx]);

    data.followedForums.splice(idx, 1);

    updateFollowStatus(data.followedForums);
    // Refresh UI
    updateForumsList();
    // Supprimer le snapshot du forum
    deleteForumSnapshot(forum.getId());
}

/**
 * Met à jour la liste des forums suivis par l'utilisateur
 * @param {Forum[]} followedForums - Liste des forums suivis
 */
function updateFollowStatus(followedForums) {
    chrome.storage.local.set({ followedForums: followedForums }, () => {
        console.log('Forums suivis à jour');
    })
}

function deleteForumSnapshot(forumId) {
    chrome.storage.local.remove(forumId, () => {
        console.log(`Forum ${forumId} snapshot deleted`);
    });
}

class Forum {
    /**
     * Informations pour l'affichage d'un forum suivi dans les options globales 
     * @param {String} name - Titre du forum // TODO => faire une regex
     * @param {String} url - URL du forum
     * @param {String} rssUrl - URL du flux RSS
     */
    constructor(name, url, rssUrl) {
        this.name = name;
        this.url = url;
        this.rssUrl = rssUrl;
    }

    getId() {
        // Check if URL is a global game forum
        let regex = new RegExp(/\/0-\d+-0-1-0-1-0-/g);
        let matchs = this.url.match(regex);

        if (matchs && matchs.length > 0) {
            const forumId = matchs[0].split("-")[1];

            return forumId;
        } else {
            return null;
        }
    }

    static fromObject(obj) {
        return new Forum(obj.name, obj.url, obj.rssUrl);
    }
}