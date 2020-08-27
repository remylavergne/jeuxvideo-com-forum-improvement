import { cnsl, getLastSnapshot, getFollowedForums, updateFollowStatus } from "./functions";
import { ForumInfos, TopicsAndElements, Snapshot, Topic, SnapshotChanges, Forum } from "./classes";

cnsl('Content script loaded at', Date.now());
let forumInfos: ForumInfos;
let currentTab; // TODO => Faire une interface pour un objet tab

// Script qui se lance à tout les lancements de page / onglet / tab.
chrome.runtime.sendMessage({ contentScripts: "requestCurrentTab" });

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    if (request.currentTab) {
        currentTab = request.currentTab;
        await init(request.currentTab);
    }
});

// TODO => Faire une méthode de vérification aléatoire pour savoir si le background job tourne toujours

/**
 * Initialise les méthodes pour la page actuelle.
 * Vérification du premier niveau du forum.
 * @param {*} tab - Informations de la tab courante
 */
async function init(tab): Promise<void> {
    forumInfos = getForumInformations(tab.url);

    if (forumInfos.isTopForum) {
        const currentTopics: TopicsAndElements = extractTopicsFromHTML();
        const snapshot: Snapshot = await getLastSnapshot(forumInfos.id);

        if (!snapshot[forumInfos.id]) {
            // Save Snapshot
            forumSnapshot(forumInfos.id, currentTopics.topics);
        } else {
            const previousTopics: Topic[] = snapshot[forumInfos.id].topics;
            const snapshotChanges: SnapshotChanges = searchChanges(previousTopics, currentTopics.topics);
            // Update views
            let htmlElementsToListen = injectUpdatedElement(currentTopics.elements, snapshotChanges.updated);
            // Update data in local storage with current
            updateSnapshot(forumInfos.id, snapshot, snapshotChanges);
            // Ecouter les événements sur les topics pour mettre à jour les données
            watchUnreadTopics(forumInfos.id, htmlElementsToListen);
        }

        addFollowButton();

        // // return new ForumInformations(forumInfos.id, snapshot);
        // return { id: forumInfos.id, snapshot: snapshot, isTopForum: true };
    } else {
        cnsl('Its not a top forum topic');
    }
}

/**
 * Extrait l'id d'un forum en fonction de son URL et déduit si c'est bien la première page.
 * @param {string} forumUrl 
 */
function getForumInformations(forumUrl: string): ForumInfos {
    let regex = new RegExp(/\/0-\d+-0-1-0-1-0-/g);
    let matchs = forumUrl.match(regex);

    if (matchs && matchs.length > 0) {
        const forumId = matchs[0].split("-")[1];

        return { id: forumId, isTopForum: true };
    } else {
        return { id: null, isTopForum: false };
    }
}

/**
 * Cherche les topics qui ont été mis à jour.
 */
function searchChanges(previousTopics: Topic[], currentTopics: Topic[]): SnapshotChanges {

    let updatedTopics: Topic[] = [];

    // Search updated topics since last visit
    for (let topic of currentTopics) {

        let topicFound = previousTopics.find(t => t.id === topic.id);

        if (topicFound) {
            const isDiff = (topicFound.count !== topic.count) || topicFound.isReadPending;

            if (isDiff) {
                updatedTopics.push(topic);
            }
        }
    }

    // Trouver des nouveaux topics, ou des vieux topics qui remontent

    let previousTopicsId = previousTopics.map(topic => topic.id);
    let currentTopicsId = currentTopics.map(topic => topic.id);

    let newTopicsId = currentTopicsId.filter(x => !previousTopicsId.includes(x));
    let missingTopicsId = previousTopicsId.filter(x => !currentTopicsId.includes(x));

    // Nouveaux topics
    let newTopics: Topic[] = [];
    for (let id of newTopicsId) {
        let newTopic = currentTopics.find(t => t.id === id);
        newTopic.isReadPending();
        newTopics.push(newTopic);
        // Global update
        updatedTopics.push(newTopic);
    }

    // Topics sortis
    let missingTopics: Topic[] = [];
    for (let id of missingTopicsId) {
        let missingTopic = previousTopics.find((t: Topic) => t.id === id);
        missingTopics.push(missingTopic);
    }

    return new SnapshotChanges(updatedTopics, newTopics, missingTopics);
}

/**
 * Extraction des topics sous forme d'élément HTML, et création de leur correspondance en objet `Topic` 
 * @returns { topics: Topic[], elements: HTMLCollection }
 */
function extractTopicsFromHTML(): TopicsAndElements {
    const htmlCollection: HTMLCollection = document.getElementsByClassName('topic-list');
    const topicsElements: HTMLCollectionOf<HTMLLIElement> = htmlCollection[0].getElementsByTagName('li');

    var topics: Topic[] = [];
    for (var i = 1; i < topicsElements.length; i++) {
        topics.push(Topic.fromHTML(topicsElements[i]));
    }

    return { topics: topics, elements: topicsElements };
}

/**
 * Permet de sauvegarder les topics d'un forum
 * @param {string} forumId - L'id du forum. Fourni dans l'URL
 * @param {Topic[]} currentTopics - Liste des topics en objet custom
 */
function forumSnapshot(forumId: string, topics: Topic[]): void {
    // Create a Snapshot
    const snapshot: Snapshot = {
        [forumId]: {
            createdTime: Date.now(),
            topics: topics
        }
    };
    // Save it
    chrome.storage.local.set(snapshot, () => {
        cnsl('Data saved', snapshot);
    })
}

/**
 * Update visuellement les topics qui ont été mis à jour par rapport à la dernière visite
 * Les liens deviennnent bleus pour indiquer le nouveau contenu non lu
 * @param {HTMLCollection} topicElements - Les éléments des topics de la page courante
 * @param {Topic[]} updatedTopics - Les topics qui ont du nouveau contenu, et qu'il faut mettre en surbrillance
 */
function injectUpdatedElement(topicElements: HTMLCollectionOf<HTMLLIElement>, updatedTopics: Topic[]): HTMLLIElement[] {

    let elements: HTMLLIElement[] = [];
    for (let topic of updatedTopics) {
        for (let el of topicElements) {
            if (el.dataset.id === topic.id) {
                el.innerHTML = topic.innerHTML;
                el.getElementsByTagName('span')[0].getElementsByTagName('a')[0].style.color = '#006bd7';
                // Save element reference to watch it
                elements.push(el);
            }
        }
    }

    return elements;
}

/**
 * Applique un clic listener sur chaque topic en attente de lecture.
 * @param {string} forumId 
 * @param {HTMLElement} elements 
 */
async function watchUnreadTopics(forumId, elements) {

    for (let i = 0; i < elements.length; i++) {
        (function (index) {
            let el = elements[index];
            el.addEventListener('click', async function () {
                el.getElementsByTagName('span')[0].getElementsByTagName('a')[0].style.color = '#777';
                // Update snapshot
                let snapshot = await getLastSnapshot(forumInfos.id);
                let idx = snapshot[forumId].topics.findIndex(t => t.id === el.dataset.id);
                // Create new topic object with current topic element informations
                let updatedTopic = Topic.fromHTML(el);
                snapshot[forumId].topics[idx] = updatedTopic;
                // Synchronize updated snapshot to local storage
                forumSnapshot(forumId, snapshot[forumId].topics);
            }, false);
        })(i)
    }
}

/**
 * Permet de mettre à jour le snapshot.
 * @param {string} forumId - Id du forum -> URL
 * @param {*} snapshot -> Les données du forum de la visite précédente
 * @param {SnapshotChanges} snapshotChanges - Les changements à répercuter sur le snapshot actuel
 */
async function updateSnapshot(forumId: string, snapshot: Snapshot, snapshotChanges: SnapshotChanges): Promise<Snapshot> {

    // Remove deleted topics
    if (snapshotChanges.deleted.length > 0) {
        for (let topic of snapshotChanges.deleted) {
            let index = snapshot[forumId].topics.findIndex(t => t.id === topic.id);
            snapshot[forumId].topics.splice(index, index >= 0 ? 1 : 0);
        }
    }

    // Add added topics
    if (snapshotChanges.added.length > 0) {
        for (let topic of snapshotChanges.added) {
            snapshot[forumId].topics.push(topic);
        }
    }

    forumSnapshot(forumId, snapshot[forumId].topics);

    return snapshot;
}

async function addFollowButton() {
    const isFollowed = await isFollowedForum();
    const followBtn = createButton(isFollowed);
    // Handle button clicks
    addLiveButtonListener(followBtn);
}

/**
 * Vérifie si le forum est déjà suivi, ou non.
 * @return {boolean}
 */
async function isFollowedForum(): Promise<boolean> {
    const follows = await getFollowedForums();
    const rssLink = (document.getElementsByClassName('picto-rss')[0] as HTMLLinkElement).href;

    if (follows['followedForums']) {
        // Map() all RSS links
        const rssURLs = follows.followedForums.map((forum: Forum) => forum.rssUrl);
        let isFollowed = rssURLs.includes(rssLink);
        return isFollowed;
    }

    return false;
}

/**
 * Création du bouton pour suivre un forum
 * @param {boolean} isForumFollowed - Etat du bouton en fonction du statut de suivi
 */
function createButton(isForumFollowed: boolean): HTMLDivElement {
    // Récupération du bloc header
    // /!\ Il y a 2 header-bloc
    let forumHeaderBloc = document.getElementsByClassName('titre-head-bloc')[0];
    // Création de l'espace des options
    let forumOptions = document.createElement('div');
    forumOptions.classList.add('forum-options');
    // Création du bouton follow
    let followBtn = document.createElement('div');
    followBtn.classList.add('follow-btn');
    // Button condition
    updateFollowButtonUI(followBtn, isForumFollowed);
    // Insertion des options
    forumOptions.appendChild(followBtn);
    // Ajout de la vue
    forumHeaderBloc.after(forumOptions);

    return followBtn;
}

function updateFollowButtonUI(followBtn: HTMLDivElement, isForumFollowed: boolean) {
    if (isForumFollowed) {
        followBtn.innerHTML = '<a><button class="btn btn-poster-msg datalayer-push js-post-topic">Suivi</button></a>';
    } else {
        followBtn.innerHTML = '<a><button class="btn btn-poster-msg datalayer-push js-post-topic">Suivre</button></a>';
    }
}

/**
 * Ajoute un listener de clic sur le bouton "Suivre"
 * @param {HTMLElement} followBtn 
 */
function addLiveButtonListener(followBtn: HTMLDivElement): void {

    followBtn.addEventListener('click', async () => {
        // Récupération du lien RSS du forum
        const rssLink = (document.getElementsByClassName('picto-rss')[0] as HTMLLinkElement).href;
        // Vérifie si le forum actuel est suivi, ou non
        let isFollowed = await isFollowedForum();
        // Update button
        updateFollowButtonUI(followBtn, !isFollowed);
        // Retrieve follows and update
        const follows = await getFollowedForums();

        if (!follows['followedForums']) {
            follows.followedForums = [];
        }

        if (isFollowed) {
            const links = follows.followedForums.map((forum: Forum) => forum.rssUrl);
            let idx = links.findIndex((link: string) => link === rssLink);
            // On supprime le forum du suivi
            follows.followedForums.splice(idx, 1);
        } else {
            const newFollowedForum = new Forum(currentTab.tab.title, currentTab.tab.url, rssLink);
            follows.followedForums.push(newFollowedForum);
        }
        // Update snapshot
        updateFollowStatus({ followedForums: follows.followedForums});

        // Ask to start background check
        chrome.runtime.sendMessage({ startBackgroundNotifications: true }, (response) => {
            cnsl(response);
        })
    });
}

