console.log('Content script loaded at', new Date().getSeconds());
let tab;
let forumInfos = { id: '', isTopForum: false };

// Script qui se lance à tout les lancements de page.
chrome.runtime.sendMessage({ contentScripts: "requestCurrentTab" });

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.currentTab) {
        // Sauvegarde de la tab courante
        tab = request.currentTab;
        init(request.currentTab);
    }
});

function init(tab) {
    console.log('=> Vérification de la page débuté');

    if (getForumInformations(tab.url).isTopForum) {
        checkBackupData(tab, (data) => {
            console.log('Data reçues dans le callback', data);
        });
    } else {
        console.log('Its not a top forum topic');
    }
}

// Check if URL is a global game forum
function getForumInformations(url) {
    let regex = new RegExp(/\/0-\d+-0-1-0-1-0-/g);
    let matchs = url.match(regex);

    const forumId = matchs[0].split("-")[1];

    if (matchs && matchs.length > 0) {
        return { id: forumId, isTopForum: true };
    }

    return { id: forumId, isTopForum: false };
}

function checkBackupData(tab, callback) {
    chrome.storage.local.get(['key'], function (result) {

    });
}


/**
 * Enregistre la liste de tous les topics du forum actuel (ex: Halo Infinite)
 */
function saveTopics() {

}

function reloadTab() {
    console.log('Tab reload !');
    chrome.runtime.sendMessage({ reloadPage: true });
}



/**
 * Check if the forum is followed or not.
 * This condition determine the follow button behaviour.
 */
function checkFollowStatus() {
    // TODO: Return boolean
    chrome.storage
}

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

function extractCurrentData() {

}

function saveFollowedForum() {

}

function setToLocalStorage(data) {
    chrome.storage.local.set(data, () => {
        console.log('Data saved', data);
    })
}

function getForumKey(tab) {

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

/**
 * Check last informations saved into storage and compare with actual content to adapt view.
 * E.g: Updated link to blue color => like normal behaviour
 */
function checkNewContent() {

}

// init();


