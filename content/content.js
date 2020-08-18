console.log('Content script loaded at', Date.now());
let tab;
let forumInfos = { id: '', isTopForum: false };
let lastTopics = [];

// Script qui se lance à tout les lancements de page.
chrome.runtime.sendMessage({ contentScripts: "requestCurrentTab" });

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.currentTab) {
        // tab = request.currentTab;
        init(request.currentTab);
    }
});

async function init(tab) {
    forumInfos = getForumInformations(tab.url);

    if (forumInfos.isTopForum) {
        const currentTopics = extractTopicsFromHTML();
        const snapshot = await getLastSnapshot(forumInfos.id);

        if (isFirstTime(snapshot)) {
            // console.log('First time', snapshot);
            forumSnapshot(forumInfos.id, currentTopics.topics);
        } else {
            // console.log('Second time', snapshot);
            const previousTopics = snapshot[forumInfos.id].topics;
            const snapshotChanges = searchChanges(previousTopics, currentTopics.topics);
            console.log('SnapshotChanges', snapshotChanges);
            // Update views
            // const updatedTopics = newElement(unreadTopics);
            let elementsWatched = injectUpdatedElement(currentTopics.elements, snapshotChanges.updated);
            // Update data in local storage with current
            watchUnreadTopics(elementsWatched); // TODO => Not working....
            updateSnapshot(forumInfos.id, snapshot, snapshotChanges);

            // const snapshotTest = await getLastSnapshot(forumInfos.id);

            // console.log('snapshot test', snapshotTest);
        }
    } else {
        console.log('Its not a top forum topic');
    }
}

function isFirstTime(snapshot) {
    return snapshot ? false : true;
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

    // Debug
    // console.log('previousTopics', previousTopics);
    // console.log('currentTopics', currentTopics);

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

    console.log('newTopicsId', newTopicsId);
    console.log('missingTopicsId', missingTopicsId);
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
    // TODO => Si nouveaux / missing topics => update du Snapshot

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
        // console.log('Data saved', currentTopics);
    })
}

// function removeSnapshot(forumId) {
//     chrome.storage.local.remove(forumId, () => {
//         // console.log('Data saved', currentTopics);
//     })
// }

// function newElement(topics) { // Pas obligatoire car on ne se sert plus de la classe lien-jv-unread

//     let unreadTopics = [];
//     for (topic of topics) {
//         topic.unreadState();
//         unreadTopics.push(topic);
//     }

//     // console.log('topics modifiés', unreadTopics);
//     return unreadTopics;
// }

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

function watchUnreadTopics(elements) {
    // Debug
    console.log('Unread topics to watch', elements);

    for (el of elements) {
        el.addEventListener('click', function () {
            el.getElementsByTagName('span')[0].getElementsByTagName('a')[0].style.color = 'pink';
        });
    }
}

/**
 * Permet de mettre à jour le snapshot.
 * @param {*} forumId
 * @param {*} snapshot 
 * @param {*} snapshotChanges 
 */
async function updateSnapshot(forumId, snapshot, snapshotChanges) {
    console.log('snapshot', snapshot);
    console.log('snapshotChanges', snapshotChanges);

    // Remove deleted topics
    if (snapshotChanges.deleted.length > 0) {
        for (topic of snapshotChanges.deleted) {
            let index = snapshot[forumId].topics.findIndex(t => t.id === topic.id);
            console.log('index', index);
            snapshot[forumId].topics.splice(index, index >= 0 ? 1 : 0);
            console.log('snapshot edité -- =>', snapshot[forumId].topics);
        }
    }

    // Add added topics
    if (snapshotChanges.added.length > 0) {
        for (topic of snapshotChanges.added) {
            snapshot[forumId].topics.push(topic);
            console.log('snapshot edité ++ =>', snapshot[forumId].topics);
        }
    }

    await forumSnapshot(forumId, snapshot[forumId].topics);
    
    return snapshot;
}

function updateData(element) {
    // Update de la couleur du lien au cas où l'utilisateur l'ouvre dans un nouvel onglet
    element.getElementsByTagName('span')[0].getElementsByTagName('a')[0].style.color = 'pink';
    console.log('Le lien sera update dans le local storage');
}

// function reloadTab() {
//     console.log('Tab reload !');
//     chrome.runtime.sendMessage({ reloadPage: true });
// }

/**
 * Add a new button to follow forum updates
 */
function addFollowButton() {
    // TODO: Disable du bouton si déjà suivi.
    var followBtn = document.createElement("A");
    followBtn.innerHTML = "<a id=\"followBtn\"><span class=\"btn btn-actu-new-list-forum\">Suivre</span></a>";

    let target = document.querySelector(".titre-bloc-forum");
    target.parentNode.insertBefore(followBtn, target.nextSibling);
}

// function addListenerToFollowButton() {
//     let followBtn = document.getElementById('followBtn');

//     followBtn.addEventListener('click', (event) => {
//         // TODO
//     });
// }

// function getFromLocalStorage(key) {
//     chrome.storage.local.get(key, function (result) {
//         console.log(result);
//     });
// }

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

    haveBeenUpdated(topic) {
        if (this.id !== topic.id) {
            // console.log('Error, not same topic id !');
            return false;
        }

        return this.count !== topic.count;
    }

    unreadState() {
        this.innerHTML = this.innerHTML.replace('lien-jv', 'lien-jv lien-jv-unread');
    }

    /**
     * Méthode pour dire qu'un topic n'a pas été lu
     * Use case => Lorsqu'un nouveau topic est ajouté, ou remonté, il n'a pas de valeur antérieure dans le snapshot,
     * le programme considère donc qu'il n'y a pas eu d'update sur ce topic, et ne l'affiche pas en bleu
     */
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
