import { getFollowedForums, updateFollowStatus, cnsl, getGlobalConfiguration, setGlobalConfiguration } from "./functions";
import { Forum, GlobalConfiguration, TopicConfig } from "./classes";

window.onload = async function () {
    createForumsList();

    // DEV
    // setGlobalConfiguration({ globalConfig: { topic: { previsu: true}}});

    getGlobalConfiguration()
        .then((globalConfig: GlobalConfiguration) => {
            displayCurrentConfiguration(globalConfig);
        }).catch(e => cnsl('Erreur à la récupération de la config', e));
};

const body = document.getElementsByTagName('body')[0];

body.addEventListener('click', event => {
    const el = (event.target as Element);
    if (!el.classList.contains('btn-remove')) {
        return;
    }

    removeForumSubscription(el.id);
});

// Get HTML Elements
const list = document.getElementsByClassName('forum-urls')[0];

// -- Functions

async function createForumsList(): Promise<void> {
    const data = await getFollowedForums();
    const followedForums = data.followedForums;
    // Nettoyage de l'UI
    list.innerHTML = '';

    for (let forum of followedForums) {
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

async function removeForumSubscription(forumUrl): Promise<void> {
    // Récupérer les forums encore une fois.
    // L'utilisateur peut avoir suivi / supprimer d'autres forums entre temps
    const data = await getFollowedForums();
    // Trouver l'index du forum dans la liste
    const urls = data.followedForums.map(forum => forum.url);
    const idx = urls.findIndex(url => url === forumUrl);
    // Get id
    const forum = Forum.fromObject(data.followedForums[idx]);

    data.followedForums.splice(idx, 1);

    updateFollowStatus({ followedForums: data.followedForums });
    // Refresh UI
    createForumsList();
    // Supprimer le snapshot du forum
    deleteForumSnapshot(forum.getId());
}

function deleteForumSnapshot(forumId: string) {
    chrome.storage.local.remove(forumId, () => {
        cnsl(`Forum ${forumId} snapshot deleted`);
    });
}

function displayCurrentConfiguration(config: GlobalConfiguration) {
    setMessagePrev(config);
}

// Default value === true
function setMessagePrev(config: GlobalConfiguration): void {
    const messagePrevSwitch = (document.getElementById('option-prev') as HTMLInputElement);
    messagePrevSwitch.checked = config.globalConfig.topic.previsu;
    // Listener
    messagePrevSwitch.addEventListener('input', function (event) {
        // Update config
        config.globalConfig.topic.previsu = messagePrevSwitch.checked;
        // Save it
        setGlobalConfiguration(config);
    });
}
