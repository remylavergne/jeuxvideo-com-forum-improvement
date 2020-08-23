console.log('Background script loaded at', Date.now());
/**
 * Variables
 */
let debug = true;
let updates = [];

/**
 * Chrome API
 */

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.contentScripts === "requestCurrentTab") {
        sendTabToContentScripts(sender);
    }

    if (request.popup = 'doYouHaveUpdates') {
        cnsl('Popup asks for updates');
        chrome.runtime.sendMessage({ updates: updates });
    }
});

/**
 * Functions
 */

async function checkFollowedForumsUpdate() {
    const follows = await getFollowedForums();

    const updatesTemp = [];
    if (follows.followedForums && follows.followedForums.length > 0) {
        let badgeCount = 0;
        // Récupération des derniers sujets à jour pour chaque forum suivi
        for (fluxRss of follows.followedForums) {
            const topicsFromXML = await getTopics(fluxRss);
            const forumId = topicsFromXML[0].forumId;
            const snapshot = await getLastSnapshot(forumId);
            const snapshotTopics = snapshot[forumId].topics;

            // Extrait le nombre de topics mis à jour
            let updatedTopics = 0;
            for (topic of snapshotTopics) {
                let mostRecentTopic = topicsFromXML.find(t => t.id === topic.id);

                if (mostRecentTopic) {
                    const newMessage = (mostRecentTopic.count > topic.count);

                    if (newMessage) {
                        updatedTopics += 1;
                    }
                }
            }

            // Vérification de différence entre les topics du snapshot et du flux RSS nouveaux / anciens
            const xmlTopicIds = topicsFromXML.map(topic => topic.id);
            const snapshotTopicIds = snapshotTopics.map(topic => topic.id);

            const switchedForums = xmlTopicIds
                .filter(x => !snapshotTopicIds.includes(x))
                .concat(snapshotTopicIds.filter(x => !xmlTopicIds.includes(x)));

            if (switchedForums.length > 0 || updatedTopics > 0) {
                // Nouvelle mise à jour
                const update = new Update(forumId, topicsFromXML[0].forumUrl, switchedForums.length, updatedTopics);
                updatesTemp.push(update);
                badgeCount += 1;
                cnsl('Diff found for forum', topicsFromXML[0].forumUrl);
            }
        }

        // Update Popup informations
        updateBadge(badgeCount);
    } else {
        cnsl('Aucun forum suivi', {});
    }

    // Update instance -> Utiliser par la Popup
    updates = updatesTemp;
}

class Update {
    constructor(forumId, forumUrl, switchedForums, updatedTopics) {
        this.forumId = forumId;
        this.forumUrl = forumUrl;
        this.switchedForums = switchedForums;
        this.updatedTopics = updatedTopics;
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

// Le flux RSS est mis à jour toutes les 2 minutes
setInterval(checkFollowedForumsUpdate, 120000);

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
        this.createdAt = Date.now();
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
