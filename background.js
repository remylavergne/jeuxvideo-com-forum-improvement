/**
 * Variables
 */
let updates = [];
cnsl('Background script loaded at', Date.now());
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
 * Vérifie pour chaque forum suivi, si du contenu est disponible.
 * Si oui, il compte le nombre de topic mis à jour, et vérifie aussi les différences entre nouveaux / anciens topics.
 * Le badge de l'extension affiche ensuite le nombre de forum avec du nouveau contenu.
 * 
 * Cette liste de forum à jour est mise en instance, et le popup vient la récupérer lorsque l'utilisateur l'ouvre pour avoir les informations.
 */
async function checkFollowedForumsUpdate() {
    const follows = await getFollowedForums();

    const updatesTemp = [];
    if (follows.followedForums && follows.followedForums.length > 0) {
        let badgeCount = 0;
        // Récupération des derniers sujets à jour pour chaque forum suivi
        for (forum of follows.followedForums) {
            const topicsFromXML = await getTopics(forum.rssUrl);
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
                const update = new Update(forumId, topicsFromXML[0].forumUrl, topicsFromXML[0].forumTitle, switchedForums.length / 2, updatedTopics, forum);
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
    /**
     * Informations liées à une mise à jour d'un forum
     * @param {String} forumId 
     * @param {String} forumUrl 
     * @param {String} forumTitle
     * @param {number} switchedForums - Le nombre de nouveaux topics
     * @param {number} updatedTopics - Nombre de topics mis à jour
     * @param {Forum} forum - Informations générale pour l'affichage des options
     */
    constructor(forumId, forumUrl, forumTitle, switchedForums, updatedTopics, forum) {
        this.forumId = forumId;
        this.forumUrl = forumUrl;
        this.forumTitle = forumTitle;
        this.switchedForums = switchedForums;
        this.updatedTopics = updatedTopics;
        this.forum = forum;
    }
}

/**
 * Mise à jour du nombre de forum mis à jour sur le badge de l'extension
 * @param {number} number - Nombre de forum mis à jour
 */
function updateBadge(number) {
    chrome.browserAction.setBadgeText({ text: number.toString() });
}

/**
 * Informations demandées par le content script au sujet de sa tab actuelle
 * @param {*} senderInformations 
 */
function sendTabToContentScripts(senderInformations) {
    chrome.tabs.sendMessage(senderInformations.tab.id, { currentTab: senderInformations });
}

/**
 * Extraction des informations sur les topics d'un forum
 * @param {String} rssLink - Flux RSS d'un forum spécifique
 */
async function getTopics(rssLink) {
    return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        request.open('GET', rssLink, true);

        request.onload = function () {
            if (this.status >= 200 && this.status < 400) {
                // Success!
                let parser = new DOMParser();
                let xmlDoc = parser.parseFromString(this.response, "text/xml");
                cnsl('Document XML du flux RSS', xmlDoc);
                // Title
                const title = xmlDoc.getElementsByTagName('title')[0].innerHTML;
                const forumTitleRegex = new RegExp(/(.+) - Forum jeuxvideo\.com/g);
                const forumTitle = (title.match(forumTitleRegex) || []).map(e => e.replace(forumTitleRegex, '$1'))[0].trim();
                cnsl('forumTitle', forumTitle);
                const items = xmlDoc.getElementsByTagName('item');
                const forumUrl = xmlDoc.getElementsByTagName('link')[0].innerHTML.trim();

                let topics = [];
                for (item of items) {
                    topics.push(Topic.fromXML(item, forumUrl, forumTitle));
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

/**
 * Démarrage de la vérification des mises à jour des forums.
 */
setInterval(checkFollowedForumsUpdate, 120000);