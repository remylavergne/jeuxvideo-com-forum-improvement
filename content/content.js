console('Content script loaded at', Date.now());

const debug = false;
let forumInfos = { id: '', isTopForum: false };
let lastTopics = [];

// Script qui se lance à tout les lancements de page.
chrome.runtime.sendMessage({ contentScripts: "requestCurrentTab" });

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.currentTab) {
        init(request.currentTab);
    }
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
    } else {
        console('Its not a top forum topic');
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
function searchChanges(previousTopics, currentTopics) { // TODO => Refactor cette méthode :D

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

    // DEBUG
    // console.log('previousTopicsId', previousTopicsId);
    // console.log('currentTopicsId', currentTopicsId);

    let newTopicsId = currentTopicsId.filter(x => !previousTopicsId.includes(x));
    let missingTopicsId = previousTopicsId.filter(x => !currentTopicsId.includes(x));

    // console.log('newTopicsId', newTopicsId);
    // console.log('missingTopicsId', missingTopicsId);
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
        topics.push(new Topic(topicsElements[i]));
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
        console('Data saved', currentTopics);
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
        // TODO => Refactor
        (function (index) {
            let el = elements[index];
            el.addEventListener('click', async function () {
                el.getElementsByTagName('span')[0].getElementsByTagName('a')[0].style.color = '#777';
                // Update snapshot
                let snapshot = await getLastSnapshot(forumInfos.id);
                let idx = snapshot[forumId].topics.findIndex(t => t.id === el.dataset.id);
                // Create new topic object with current topic element informations
                let updatedTopic = new Topic(el);
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
class Topic {
    constructor(element) {
        this.id = element.dataset.id;
        this.url = ''; // TODO: Récupérer l'URL du topic dans le futur
        this.subject = element.children[0].innerText;
        this.author = element.children[1].innerText;
        this.count = element.children[2].innerText;
        this.date = element.children[3].innerText;
        this.innerHTML = element.innerHTML.trim();
        this.readPending = false;
    }

    isRead() {
        this.readPending = false;
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
function console(text, data) {
    if (debug) {
        console.log(text, data);
    }
}
