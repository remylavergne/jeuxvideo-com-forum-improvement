import { cnsl, getLastSnapshot, getFollowedForums, updateFollowStatus, getForumInformations, getUpdates, backupUpdates, updateBadgeCount, forumSnapshot } from "./functions";
import { ForumInfos, TopicsAndElements, Snapshot, Topic, SnapshotChanges, Forum, ChromeTab, UpdateBackup } from "./classes";

cnsl('Content script loaded at', Date.now());
let forumInfos: ForumInfos;
let currentTab: ChromeTab;
let currentTopicsInstance: TopicsAndElements;

// Script qui se lance à tout les lancements de page / onglet / tab.
chrome.runtime.sendMessage({ contentScripts: "content" });

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    if (request.currentTab) {
        currentTab = request.currentTab;
        forumInfos = getForumInformations(request.currentTab.url);
        if (forumInfos.isTopForum) {
            initialization();
            addOptionsButtons();
            checkUpdateBackup();
            checkBackgroundNotifierStatus();
        }
    }
});

// TODO => Mettre les topics clos en lu
// TODO => Possibilité de ne pas suivre des topics (jugés inintéressants) => Grosse feature

/**
 * Initialise les méthodes pour la page actuelle.
 * Vérification du premier niveau du forum.
 * @param {*} tab - Informations de la tab courante
 */
async function initialization(): Promise<void> {

    const currentTopics: TopicsAndElements = extractTopicsFromHTML();
    currentTopicsInstance = currentTopics; // TODO => Extract this ? 
    const snapshot: Snapshot = await getLastSnapshot(forumInfos.id);

    if (!snapshot[forumInfos.id]) {
        // Première visite du forum
        forumSnapshot(forumInfos.id, currentTopics.topics);
    } else {
        // Récupération des topics du snapshot
        const snapshotTopics: Topic[] = snapshot[forumInfos.id].topics;
        // Détecter tous les changements depuis la dernière visite
        const snapshotChanges: SnapshotChanges = findUpdatedTopics(snapshotTopics, currentTopics.topics);
        // Update views
        let unreadItems = colorizeItems(currentTopics.elements, snapshotChanges.updated);
        // Ecouter les événements sur les topics pour mettre à jour les données
        watchUnreadTopics(forumInfos.id, unreadItems);
        // Update data in local storage with current
        updateSnapshot(forumInfos.id, snapshot, snapshotChanges);
    }
}

/**
 * Cette méthode permet d'extraire une liste de topics mis à jour :
 * - Les anciens topics avec de nouvelles réponses
 * - Les nouveaux topics, ou ceux qui sont remontés en première page
 * - Les topics qui sont passés dans les pages 2 et + (donc plus visibles)
 * @param previousTopics - Les topics issus du dernier Snapshot
 * @param currentTopics - Les topics actuels extraient au chargement de la page
 */
function findUpdatedTopics(previousTopics: Topic[], currentTopics: Topic[]): SnapshotChanges {
    let updatedTopics: Topic[] = [];

    for (let currentTopic of currentTopics) {
        let previousTopicFound = previousTopics.find((t: Topic) => t.id === currentTopic.id);

        if (previousTopicFound) {
            const isUpdated = (previousTopicFound.count !== currentTopic.count) || previousTopicFound.isReadPending;

            if (isUpdated) {
                // Copy params from previous topic
                currentTopic.hasUserResponse = previousTopicFound.hasUserResponse;
                currentTopic.readPending = previousTopicFound.readPending;

                updatedTopics.push(currentTopic);
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
 * Update visuellement les topics qui ont été mis à jour par rapport à la dernière visite
 * Les liens deviennnent bleus pour indiquer le nouveau contenu non lu
 * @param {HTMLCollection} topicElements - Les éléments des topics de la page courante
 * @param {Topic[]} updatedTopics - Les topics qui ont du nouveau contenu, et qu'il faut mettre en surbrillance
 */
function colorizeItems(topicElements: HTMLCollectionOf<HTMLLIElement>, updatedTopics: Topic[]): HTMLLIElement[] {

    let elements: HTMLLIElement[] = [];

    for (let topic of updatedTopics) {
        for (let el of topicElements) {
            if (el.dataset.id === topic.id) { // TODO => Vérifier le dataset, car sur certain forum ça ne fonctionne pas...
                el.innerHTML = topic.innerHTML;
                if (!topic.hasUserResponse) {
                    applyUnreadColor(el);
                } else {
                    applyUnreadParticipatingColor(el);
                }
                // Save element reference to watch it
                elements.push(el);
            }
        }
    }

    return elements;
}

function applyUnreadColor(element: HTMLLIElement): void {
    element.getElementsByTagName('span')[0].getElementsByTagName('a')[0].style.color = '#006bd7';
}

function applyUnreadParticipatingColor(element: HTMLLIElement): void {
    element.getElementsByTagName('span')[0].getElementsByTagName('a')[0].style.color = '#ff572e';
}

/**
 * Applique un clic listener sur chaque topic en attente de lecture.
 * @param {string} forumId 
 * @param {HTMLElement} elements 
 */
async function watchUnreadTopics(forumId, elements) {

    for (let i = 0; i < elements.length; i++) {
        (function (index) {
            let el = elements[index] as HTMLLIElement;
            el.addEventListener('click', async function () {
                el.getElementsByTagName('span')[0].getElementsByTagName('a')[0].style.color = '#777';
                // Update snapshot
                let snapshot = await getLastSnapshot(forumInfos.id);
                let idx = snapshot[forumId].topics.findIndex(t => t.id === el.dataset.id);
                // Create new topic object with current topic element informations
                if (idx !== -1) {
                    let updatedTopic = Topic.fromHTML(el);
                    snapshot[forumId].topics[idx].count = updatedTopic.count;
                    snapshot[forumId].topics[idx].readPending = false;
                    // Synchronize updated snapshot to local storage
                    forumSnapshot(forumId, snapshot[forumId].topics);
                }
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

function addOptionsButtons() {
    isFollowedForum().then((isFollowed: boolean) => {
        // Récupération du bloc header
        // /!\ Il y a 2 header-bloc
        let forumHeaderBloc = document.getElementsByClassName('titre-head-bloc')[0];
        // Création de l'espace des options
        let forumOptions = document.createElement('div');
        forumOptions.classList.add('forum-options');
        // Create buttons
        const followBtn = createFollowButton(isFollowed);
        const readAllBtn = createReadAllButton();
        // Insert buttons
        forumOptions.appendChild(followBtn);
        forumOptions.appendChild(readAllBtn);
        // Add option container
        forumHeaderBloc.after(forumOptions);

        // Handle button clicks
        addLiveButtonListener(followBtn);
        addReadAllButtonListener(readAllBtn);
    });
}

/** Si ce forum était dans les mises à jour trouvées, il faut le supprimer */
function checkUpdateBackup(): void {
    getUpdates().then((updateBackup: UpdateBackup) => {
        if (updateBackup.updates.length > 0) {
            const idx = updateBackup.updates.map(u => u.forumUrl).findIndex(url => url === currentTab.url);
            cnsl('Index dans les update du forum', idx);
            if (idx >= 0) {
                updateBackup.updates.splice(idx, 1);
                backupUpdates(updateBackup);
                updateBadgeCount(updateBackup.updates.length.toString());
            }
        }
    });
}

/**
 * Au chargement d'une page du forum, on vérifie si le job de synchronisation fonctionne toujours.
 */
function checkBackgroundNotifierStatus(): void {
    chrome.runtime.sendMessage({ isBackgroundJobRunning: true }, (responseCallback) => {
        cnsl(responseCallback);
    });
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
function createFollowButton(isForumFollowed: boolean): HTMLDivElement {
    // Création du bouton follow
    let followBtn = document.createElement('div');
    followBtn.classList.add('follow-btn');
    // Button condition
    updateFollowButtonUI(followBtn, isForumFollowed);

    return followBtn;
}

function updateFollowButtonUI(followBtn: HTMLDivElement, isForumFollowed: boolean) {
    if (isForumFollowed) {
        followBtn.innerHTML = '<a><button class="optionButton">Suivi</button></a>';
    } else {
        followBtn.innerHTML = '<a><button class="optionButton">Suivre</button></a>';
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
        updateFollowStatus({ followedForums: follows.followedForums });

        // Ask to start background check
        chrome.runtime.sendMessage({ startBackgroundNotifications: true }, (response) => {
            cnsl(response);
        })
    });
}

function addReadAllButtonListener(readAllBtn: HTMLDivElement): void {
    readAllBtn.addEventListener('click', () => {
        // Colorize all link to grey (like when user opened it)
        for (var i = 1; i < currentTopicsInstance.elements.length; i++) {
            currentTopicsInstance.elements[i].getElementsByTagName('span')[0].getElementsByTagName('a')[0].style.color = '#777';
        }
        // Update Snapshot count of each
        const forumId = forumInfos.id;
        getLastSnapshot(forumInfos.id).then((snapshot: Snapshot) => {
            for (let currentTopic of currentTopicsInstance.topics) {
                const index = snapshot[forumId].topics.findIndex(t => t.id === currentTopic.id);
                if (index !== -1){
                    snapshot[forumId].topics[index].count = currentTopic.count;
                    snapshot[forumId].topics[index].readPending = false;
                }
            }
            // Update Snapshot
            forumSnapshot(forumId, snapshot[forumId].topics);
        });
    })
}

/**
 * Bouton permettant de lire tous les topics en une fois
 */
function createReadAllButton(): HTMLDivElement {
    // Création du bouton follow
    let readAllBtn = document.createElement('div');
    readAllBtn.classList.add('read-all');
    readAllBtn.innerHTML = '<a><button class="optionButton">Tout lire</button></a>';

    return readAllBtn;
}

