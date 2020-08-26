window.onload = async function (eventHandler, ev) {
    updateForumsList();
};

const body = document.getElementsByTagName('body')[0];
console.log(body);
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

    // TODO => Retourner les éléments pour bind un clic listener
}

async function removeForumSubscription(forumUrl) {
    console.log('forum to delete url ', forumUrl);
    // Récupérer les forums encore une fois.
    // L'utilisateur peut avoir suivi / supprimer d'autres forums entre temps
    const data = await getFollowedForums();
    // Trouver l'index du forum dans la liste
    const urls = data.followedForums.map(forum => forum.url);
    const idx = urls.findIndex(url => url === forumUrl);

    data.followedForums.splice(idx, 1);

    updateFollowStatus(data.followedForums);
    // Refresh UI
    updateForumsList();
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