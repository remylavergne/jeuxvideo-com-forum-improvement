console.log('Content script loaded at', new Date().getSeconds());
let tab;
let forumInfos = { id: '', isTopForum: false };

// Script qui se lance à tout les lancements de page.
chrome.runtime.sendMessage({ contentScripts: "requestCurrentTab" });

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.currentTab) {
        tab = request.currentTab;
        init(request.currentTab);
    }
});

function init(tab) {
    console.log('=> Vérification de la page débuté');

    forumInfos = getForumInformations(tab.url);

    if (forumInfos.isTopForum) {
        let backupData = checkBackupData();
        console.log(`Backup data for forum id ${forumInfos.id}`, backupData);
        if (backupData) {
            // TODO : Comparer avec les anciennes données.
        } else {
            // Sauvegarder les données
            extractTopics();
            // backupTopicData();
        }
    } else {
        console.log('Its not a top forum topic');
    }
}

// Check if URL is a global game forum
function getForumInformations(forumUrl) {
    let regex = new RegExp(/\/0-\d+-0-1-0-1-0-/g);
    let matchs = forumUrl.match(regex);

    const forumId = matchs[0].split("-")[1];

    if (matchs && matchs.length > 0) {
        return { id: forumId, isTopForum: true };
    }

    return { id: forumId, isTopForum: false };
}

function checkBackupData(forumId) {
    chrome.storage.local.get(forumId, function (result) {
        return result;
    });
}

function extractTopics() {
    const htmlCollection = document.getElementsByClassName('topic-list');
    const topicsElements = htmlCollection[0].getElementsByTagName('li');

    var topics = [];
    for (var i = 1; i < topicsElements.length; i++) {
        topics.push(Topic.fromHTMLElement(topicsElements[i]));
    }

    console.log('Nombre de topics créés', topics.length);
    return topics;
}

function backupTopicData() {
    chrome.storage.local.set(data, () => {
        console.log('Data saved', data);
    })
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

function addListenerToFollowButton() {
    let followBtn = document.getElementById('followBtn');

    followBtn.addEventListener('click', (event) => {
        // TODO
    });
}

/**
 * 
 * @param {*} key string[]
 */
function getFromLocalStorage(key) {
    chrome.storage.local.get(key, function (result) {
        console.log(result.valeur);
    });
}

class Topic {

    subject = '';
    count = 0;
    date = '';

    constructor() {}

    static fromHTMLElement(element) {
        console.log('Topic element reçu', element);
        return new Topic()
    }
}


