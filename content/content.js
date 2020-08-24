const debug = false;
cnsl('Content script loaded at', Date.now());
let forumInfos = { id: '', isTopForum: false };
let lastTopics = [];
let snapshotInstance;

// Script qui se lance à tout les lancements de page.
chrome.runtime.sendMessage({ contentScripts: "requestCurrentTab" });

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    if (request.currentTab) {
        await init(request.currentTab);
    }

    // if (request)
});

async function init(tab) {
    forumInfos = getForumInformations(tab.url);

    if (forumInfos.isTopForum) {
        const currentTopics = extractTopicsFromHTML();
        const snapshot = await getLastSnapshot(forumInfos.id);

        if (!snapshot[forumInfos.id]) {
            forumSnapshot(forumInfos.id, currentTopics.topics);
        } else {
            const previousTopics = snapshot[forumInfos.id].topics;
            const snapshotChanges = searchChanges(previousTopics, currentTopics.topics);
            // Update views
            let htmlElementsToListen = injectUpdatedElement(currentTopics.elements, snapshotChanges.updated);
            // Update data in local storage with current
            updateSnapshot(forumInfos.id, snapshot, snapshotChanges);
            // Ecouter les événements sur les topics pour mettre à jour les données
            watchUnreadTopics(forumInfos.id, htmlElementsToListen);
        }

        addFollowButton();

        return new ForumInformations(forumInfos.id, snapshot);

    } else {
        cnsl('Its not a top forum topic');
    }
}

// Check if URL is a global game forum
function getForumInformations(forumUrl) {
    let regex = new RegExp(/\/0-\d+-0-1-0-1-0-/g);
    let matchs = forumUrl.match(regex);

    if (matchs && matchs.length > 0) {
        const forumId = matchs[0].split("-")[1];

        return { id: forumId, isTopForum: true };
    } else {
        return { id: 0, isTopForum: false };
    }
}

async function getLastSnapshot(forumId) {
    return new Promise(function (resolve, reject) {
        chrome.storage.local.get(forumId, function (result) {
            resolve(result);
        });
    });
}

/**
 * Cherche les topics qui ont été mis à jour.
 */
function searchChanges(previousTopics, currentTopics) {

    let updatedTopics = [];

    // Search updated topics since last visit
    for (topic of currentTopics) {

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
    let newTopics = [];
    for (id of newTopicsId) {
        let newTopic = currentTopics.find(t => t.id === id);
        newTopic.isReadPending();
        newTopics.push(newTopic);
        // Global update
        updatedTopics.push(newTopic);
    }

    // Topics sortis
    let missingTopics = [];
    for (id of missingTopicsId) {
        let missingTopic = previousTopics.find(t => t.id === id);
        missingTopics.push(missingTopic);
    }

    return new SnapshotChanges(updatedTopics, newTopics, missingTopics);
}

/**
 * Extraction des topics sous forme d'élément HTML, et création de leur correspondance en objet `Topic` 
 * @returns { topics: Topic[], elements: HTMLCollection }
 */
function extractTopicsFromHTML() {
    const htmlCollection = document.getElementsByClassName('topic-list');
    const topicsElements = htmlCollection[0].getElementsByTagName('li');

    var topics = [];
    for (var i = 1; i < topicsElements.length; i++) {
        topics.push(Topic.fromHTML(topicsElements[i]));
    }

    return { topics: topics, elements: topicsElements };
}

/**
 * Permet de sauvegarder les topics d'un forum
 * @param {String} forumId - L'id du forum. Fourni dans l'URL
 * @param {Topic[]} currentTopics - Liste des topics en objet custom
 */
function forumSnapshot(forumId, currentTopics) {
    chrome.storage.local.set({
        [forumId]: {
            createdTime: Date.now(),
            topics: currentTopics
        }
    }, () => {
        cnsl('Data saved', currentTopics);
    })
}

/**
 * Update visuellement les topics qui ont été mis à jour par rapport à la dernière visite
 * Les liens deviennnent bleus pour indiquer le nouveau contenu non lu
 * @param {HTMLCollection} topicElements - Les éléments des topics de la page courante
 * @param {Topic[]} updatedTopics - Les topics qui ont du nouveau contenu, et qu'il faut mettre en surbrillance
 */
function injectUpdatedElement(topicElements, updatedTopics) {

    let elements = [];
    for (topic of updatedTopics) {
        for (el of topicElements) {
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

async function watchUnreadTopics(forumId, elements) {

    for (i = 0; i < elements.length; i++) {
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
 * @param {String} forumId - Id du forum -> URL
 * @param {*} snapshot -> Les données du forum de la visite précédente
 * @param {SnapshotChanges} snapshotChanges - Les changements à répercuter sur le snapshot actuel
 */
async function updateSnapshot(forumId, snapshot, snapshotChanges) {

    // Remove deleted topics
    if (snapshotChanges.deleted.length > 0) {
        for (topic of snapshotChanges.deleted) {
            let index = snapshot[forumId].topics.findIndex(t => t.id === topic.id);
            snapshot[forumId].topics.splice(index, index >= 0 ? 1 : 0);
        }
    }

    // Add added topics
    if (snapshotChanges.added.length > 0) {
        for (topic of snapshotChanges.added) {
            snapshot[forumId].topics.push(topic);
        }
    }

    await forumSnapshot(forumId, snapshot[forumId].topics);

    return snapshot;
}
/**
 * Toutes les informations permettant de suivre un topic et ses évolutions
 */
class Topic {
    constructor(id, url, subject, author, count, date, innerHTML, forumId) {
        this.id = id;
        this.url = url;
        this.subject = subject;
        this.author = author;
        this.count = count;
        this.date = date;
        this.innerHTML = innerHTML;
        this.readPending = false;
        this.forumId = forumId;
        this.createdAt = Date.now();
    }

    static fromHTML(element) {
        let id = element.dataset.id;
        let url = ''; // TODO: Récupérer l'URL du topic dans le futur
        let subject = element.children[0].innerText;
        let author = element.children[1].innerText;
        let count = element.children[2].innerText;
        let date = element.children[3].innerText;
        let innerHTML = element.innerHTML.trim();
        let forumId = ''; // Récupérer l'id du forum

        return new Topic(id, url, subject, author, count, date, innerHTML, forumId);
    }

    /**
     * Extrait les informations depuis le flux RSS d'un forum spécifique
     * @param {XMLDocument} item - Document XML représentant un objet Topic
     */
    static fromXML(item) {
        const forumIdRegex = new RegExp(/forums\/\d+-(\d+)-\d+-/g);
        const idRegex = new RegExp(/forums\/\d+-\d+-(\d+)-/g);
        const subjectRegex = new RegExp(/:(.+)\(\d+ .+\)/g);
        const authorRegex = new RegExp(/topic: (.+)/g);
        const countRegex = new RegExp(/\((\d+) .+\)/g);
        // Process informations
        let globalInfos = item.getElementsByTagName('description')[0].childNodes[0].nodeValue.trim();
        let fullURL = item.getElementsByTagName('link')[0].childNodes[0].nodeValue.trim();

        let id = (fullURL.match(idRegex) || []).map(e => e.replace(idRegex, '$1'))[0].trim();
        let url = fullURL;
        let subject = (globalInfos.match(subjectRegex) || []).map(e => e.replace(subjectRegex, '$1'))[0].trim();
        let author = (globalInfos.match(authorRegex) || []).map(e => e.replace(authorRegex, '$1'))[0].trim();
        let count = (globalInfos.match(countRegex) || []).map(e => e.replace(countRegex, '$1'))[0].trim();
        let date = '';
        let innerHTML = '';
        let forumId = (fullURL.match(forumIdRegex) || []).map(e => e.replace(forumIdRegex, '$1'))[0].trim();

        return new Topic(id, url, subject, author, count, date, innerHTML, forumId);
    }

    isReadPending() {
        this.readPending = true;
    }
}

class SnapshotChanges {
    constructor(updated, added, deleted) {
        this.updated = updated;
        this.added = added;
        this.deleted = deleted;
    }
}

/**
 * Affichage des logs en debug
 * @param {String} text 
 * @param {any} data 
 */
function cnsl(text, data) {
    if (debug) {
        console.log(text, data);
    }
}


// ---------------------------------
// Live
// ---------------------------------


async function addFollowButton() {
    const isFollowed = await isFollowedForum();
    const followBtn = createButton(isFollowed);
    // Handle button clicks
    addLiveButtonListener(followBtn);
}

async function getFollowedForums() {
    return new Promise(function (resolve, reject) {
        chrome.storage.local.get('followedForums', function (result) {
            resolve(result);
        });
    });
}

async function isFollowedForum() {
    const follows = await getFollowedForums();
    cnsl('Liste des forums suivis', follows);
    const rssLink = document.getElementsByClassName('picto-rss')[0].href;

    if (follows['followedForums']) {
        let isFollowed = follows.followedForums.includes(rssLink);
        return isFollowed;
    }

    return false;
}

function createButton(isForumFollowed) {
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

function updateFollowButtonUI(followBtn, isForumFollowed) {
    if (isForumFollowed) {
        followBtn.innerHTML = '<a><button class="btn btn-poster-msg datalayer-push js-post-topic">Suivi</button></a>';
    } else {
        followBtn.innerHTML = '<a><button class="btn btn-poster-msg datalayer-push js-post-topic">Suivre</button></a>';
    }
}

function addLiveButtonListener(followBtn) {

    followBtn.addEventListener('click', async () => {
        // RSS Link
        const rssLink = document.getElementsByClassName('picto-rss')[0].href;
        let isFollowed = await isFollowedForum();
        // Contact background script
        chrome.runtime.sendMessage({ follow: new FollowStatus(rssLink, !isFollowed) });
        // Update button
        updateFollowButtonUI(followBtn, !isFollowed);
        // Retrieve follows and update
        let follows = await getFollowedForums();
        // TODO => Move this
        if (!follows['followedForums']) {
            follows.followedForums = [];
        }

        if (isFollowed) {
            let idx = follows.followedForums.findIndex(link => link === rssLink);
            follows.followedForums.splice(idx, 1);
        } else {
            follows.followedForums.push(rssLink);
        }
        // Update snapshot
        updateFollowStatus(follows);
    });
}

function updateFollowStatus(follows) {
    chrome.storage.local.set(follows, () => {
        cnsl('Liste de forum(s) suivi(s)', follows);
    })
}

class ForumInformations {
    constructor(forumId, snapshot) {
        this.forumId = forumId;
        this.snapshot = snapshot;
    }
}

class FollowStatus {
    constructor(rss, follow) {
        this.rss = rss;
        this.follow = follow;
    }
}