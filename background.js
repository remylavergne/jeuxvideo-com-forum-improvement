console.log('Background script loaded at', Date.now());
let debug = true;
// Récupère les messages émis
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.contentScripts === "requestCurrentTab") {
        sendTabToContentScripts(sender);
    } else if (request.follow) {
        console.log('Request follow received', request.follow);
        // Check follow status
    }

    if (request.reloadPage) {
        console.log('Reload requested');
        chrome.tabs.reload();
    }
});

async function checkFollowedForumsUpdate() {
    cnsl('Start forum update search', Date.now());
    let follows = await getFollowedForums();

    if (follows.followedForums && follows.followedForums.length > 0) {
        for (fluxRss of follows.followedForums) {
            cnsl('Followed =>', fluxRss);
            let topicsFromXML = await getTopics(fluxRss);

            cnsl('Topics extraits', topicsFromXML);
        }
    } else {
        cnsl('Aucun forum suivi');
    }
}

async function getFollowedForums() {
    return new Promise(function (resolve, reject) {
        chrome.storage.local.get('followedForums', function (result) {
            resolve(result);
        });
    });
}

console.log('Background script initialize');

// function getCurrentTab() {
//     chrome.tabs.query({
//         "active": true,
//         "currentWindow": true
//     }, (tabs) => {
//         console.log(tabs[0]);
//         return tabs[0];
//     });
// }

function sendTabToContentScripts(senderInformations) {
    console.log(senderInformations);
    chrome.tabs.sendMessage(senderInformations.tab.id, { currentTab: senderInformations });
}

async function getLastSnapshot(forumId) {
    return new Promise(function (resolve, reject) {
        chrome.storage.local.get(forumId, function (result) {
            resolve(result);
        });
    });
}

async function getTopics(rssLink) {
    return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        request.open('GET', rssLink, true);
    
        request.onload = function () {
            if (this.status >= 200 && this.status < 400) {
                // Success!
                let parser = new DOMParser();
                let xmlDoc = parser.parseFromString(this.response, "text/xml");
                let items = xmlDoc.getElementsByTagName('item');
    
                let topics = [];
                for (item of items) {
                    topics.push(Topic.fromXML(item));
                }
    
                cnsl('Topics from XML', topics);
    
                resolve(topics);
            } else {
                // We reached our target server, but it returned an error
                cnsl('Request to update forum / topic failed');
                reject('Error');
            }
        };
    
        request.onerror = function () {
            // There was a connection error of some sort
        };
    
        request.send();
    });
}

setInterval(checkFollowedForumsUpdate, 30000);

class FollowUps {
    constructor(links) {
        this.links = links;
    }
}

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
    }

    // static fromHTML(element) {
    //     let id = element.dataset.id;
    //     let url = ''; // TODO: Récupérer l'URL du topic dans le futur
    //     let subject = element.children[0].innerText;
    //     let author = element.children[1].innerText;
    //     let count = element.children[2].innerText;
    //     let date = element.children[3].innerText;
    //     let innerHTML = element.innerHTML.trim();
    //     let forumId = ''; // Récupérer l'id du forum

    //     return new Topic(id, url, subject, author, count, date, innerHTML, forumId);
    // }

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

// --------------------------------
// Utils
// --------------------------------

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
