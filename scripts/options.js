window.onload = async function () {
    createForumsList();
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

async function createForumsList() {
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
    createForumsList();
    // Supprimer le snapshot du forum
    deleteForumSnapshot(forum.getId());
}

function deleteForumSnapshot(forumId) {
    chrome.storage.local.remove(forumId, () => {
        cnsl(`Forum ${forumId} snapshot deleted`);
    });
}