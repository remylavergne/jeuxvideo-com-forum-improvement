console.log('Background script loaded at', Date.now());
let debug = true;
let updates = [];
// Récupère les messages émis
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.contentScripts === "requestCurrentTab") {
        sendTabToContentScripts(sender);
    } else if (request.follow) {
        console.log('Request follow received', request.follow);
        // Check follow status
    }

    if (request.popup = 'doYouHaveUpdates') {
        cnsl('Popup asks for updates');
        chrome.runtime.sendMessage({ updates: updates });
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
        let badgeCount = 0;
        updates = [];
        // Récupération des derniers sujets à jour
        for (fluxRss of follows.followedForums) {
            const topicsFromXML = await getTopics(fluxRss);
            const forumId = topicsFromXML[0].forumId;
            cnsl('Topics extraits', topicsFromXML);
            // allTopics.concat(topicsFromXML); // TODO => Obligatoire ?
            const snapshot = await getLastSnapshot(forumId);

            // Vérification de différence entre les topics du snapshot et du flux RSS
            const xmlIds = topicsFromXML.map(topic => topic.id);
            const snapshotIds = snapshot[forumId].topics.map(topic => topic.id);
            const difference = xmlIds
                .filter(x => !snapshotIds.includes(x))
                .concat(snapshotIds.filter(x => !xmlIds.includes(x)));

            cnsl('difference', difference);

            if (difference.length > 0) {
                // Nouvelle mise à jour
                const update = new Update(forumId, topicsFromXML[0].forumUrl, difference.length);
                updates.push(update);
                // Update popup with a new link
                // cnsl('Update found for forum', forumId);
                badgeCount += 1;
            }
        }

        // Update Popup informations
        updateBadge(badgeCount);
    } else {
        cnsl('Aucun forum suivi');
    }
}

class Update {
    constructor(forumId, forumUrl, diff) {
        this.forumId = forumId;
        this.forumUrl = forumUrl;
        this.diff = diff;
    }
}

async function getFollowedForums() {
    return new Promise(function (resolve, reject) {
        chrome.storage.local.get('followedForums', function (result) {
            resolve(result);
        });
    });
}

function updateBadge(number) {
    chrome.browserAction.setBadgeText({ text: number.toString() });
}


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
                let forumUrl = xmlDoc.getElementsByTagName('link')[0].innerHTML.trim();

                let topics = [];
                for (item of items) {
                    topics.push(Topic.fromXML(item, forumUrl));
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

setInterval(checkFollowedForumsUpdate, 240 * 1000);

class Topic {
    constructor(id, url, subject, author, count, date, innerHTML, forumId, forumUrl) {
        this.id = id;
        this.url = url;
        this.subject = subject;
        this.author = author;
        this.count = count;
        this.date = date;
        this.innerHTML = innerHTML;
        this.readPending = false;
        this.forumId = forumId;
        this.forumUrl = forumUrl;
    }

    /**
     * Extrait les informations depuis le flux RSS d'un forum spécifique
     * @param {XMLDocument} item - Document XML représentant un objet Topic
     */
    static fromXML(item, forumUrl) {
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

        return new Topic(id, url, subject, author, count, date, innerHTML, forumId, forumUrl);
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
