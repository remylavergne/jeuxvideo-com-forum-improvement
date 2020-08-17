console.log('Content script loaded at', Date.now());
let tab;
let forumInfos = { id: '', isTopForum: false };
let lastTopics = [];

// Script qui se lance à tout les lancements de page.
chrome.runtime.sendMessage({ contentScripts: "requestCurrentTab" });

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.currentTab) {
        tab = request.currentTab;
        init(request.currentTab);
    }
});

async function init(tab) {
    forumInfos = getForumInformations(tab.url);

    if (forumInfos.isTopForum) {
        const currentTopics = extractTopics();
        const previousTopicsInfos = await checkBackupData(forumInfos.id);
        
        if (previousTopicsInfos) {
            const previousTopics = previousTopicsInfos[forumInfos.id].topics;
            const unreadTopics = searchUpdate(previousTopics, currentTopics.topics);
            // Update views
            const updatedTopics = newElement(unreadTopics);
            injectUpdatedElement(currentTopics.elements, updatedTopics);
            // Update data in local storage with current
            // removeTopicData(forumInfos.id);
            // backupTopicData(forumInfos.id, currentTopics.topics);
        } else {
            backupTopicData(forumInfos.id, currentTopics.topics);
        }
    } else {
        console.log('Its not a top forum topic');
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

async function checkBackupData(forumId) {
    return new Promise(function(resolve, reject) {
        chrome.storage.local.get(forumId, function (result) {
            resolve(result);
        });
    });
}

/**
 * Cherche les topics qui ont été mis à jour.
 */
function searchUpdate(previousTopics, currentTopics) {

    let updatedTopics = [];

    for (topic of currentTopics) {
        const isDiff = previousTopics.find(t => t.id === topic.id).count !== topic.count;

        if (isDiff) {
            updatedTopics.push(topic);
        }
    }

    // console.log('Topics différents', updatedTopics);
    return updatedTopics;
}

function extractTopics() {
    const htmlCollection = document.getElementsByClassName('topic-list');
    const topicsElements = htmlCollection[0].getElementsByTagName('li');

    var topics = [];
    for (var i = 1; i < topicsElements.length; i++) {
        topics.push(new Topic(topicsElements[i]));
    }

    return { topics: topics, elements: topicsElements };
}

function backupTopicData(forumId, currentTopics) {
    chrome.storage.local.set({
        [forumId]: {
            createdTime: Date.now(),
            topics: currentTopics
        }
    }, () => {
        // console.log('Data saved', currentTopics);
    })
}

function removeTopicData(forumId) {
    chrome.storage.local.remove(forumId, () => {
        // console.log('Data saved', currentTopics);
    })
}

function newElement(topics) {

    let unreadTopics = [];
    for (topic of topics) {
        topic.unreadState();
        unreadTopics.push(topic);
    }

    // console.log('topics modifiés', unreadTopics);
    return unreadTopics;
}

function injectUpdatedElement(topicElements, updatedTopics) {

    // console.log('topicElements', topicElements);
    for (topic of updatedTopics) {
        for (el of topicElements) {
            if (el.dataset.id === topic.id) {
                el.innerHTML = topic.innerHTML;
                el.getElementsByTagName('span')[0].getElementsByTagName('a')[0].style.color = '#006bd7';
            }
        }
    }
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
}
