import { cnsl, getFollowedForums, getLastSnapshot, backupUpdates, setGlobalConfiguration, getGlobalConfiguration, forumSnapshot } from "./functions";
import { ForumsFollowed, Topic, Snapshot, Update, GlobalConfiguration, ForumInfos } from "./classes";
import { defaultConfig } from "./objects";

/**
 * Variables
 */

cnsl('Background script loaded at', Date.now());

/**
 * Chrome API
 */

chrome.runtime.onInstalled.addListener((details) => {
    createBackgroundJobNotifier();
    updateBadge("0");
    cnsl('Détails à l\'installation', details);
    setDefaultGlobalConfiguration();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === 'backgroundNotifications') {
        checkFollowedForumsUpdate();
    }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.contentScripts === "content") {
        sendTabToContentScripts(sender);
    }

    if (request.contentScripts === "topic-config") {
        chrome.tabs.sendMessage(sender.tab.id, { contentTopicConfig: sender });
    }

    if (request.updateBadge) {
        cnsl('Count du badge reçu', request.updateBadge);
        updateBadge(request.updateBadge);
    }

    if (request.userReplyTo) {
        const forumInfos: ForumInfos = request.userReplyTo;

        getLastSnapshot(forumInfos.id).then((snapshot: Snapshot) => {
            try {
                let topics = snapshot[forumInfos.id].topics;
                const topic = topics.find((topic: Topic) => topic.id === forumInfos.topicId);
                // Le forum n'est pas forcément enregistré (accès au forum via un lien direct vers le message).
                // Donc, il n'y a pas de sauvegarde à modifier !
                if (topic) {
                    let tempCount = topic.count;
                    tempCount = '' + (Number(tempCount) + 1);
                    topics.find((topic: Topic) => topic.id === forumInfos.topicId).count = tempCount;
                    // On sauvegarde la modification
                    forumSnapshot(forumInfos.id, topics);
                }
            } catch (e) {
                cnsl('Erreur à l\'incrémentation du nombre de message', e);
            }
        });
    }

    if (request.isBackgroundJobRunning) {
        chrome.alarms.getAll((alarms) => {
            cnsl('Alarmes courantes', alarms);
            if (alarms.length === 0) {
                sendResponse('No alarm set...');
                createBackgroundJobNotifier();
            } else {
                // Search Background Notifier alarm
                const alarm = alarms.find(a => a.name === 'backgroundNotifications');
                if (!alarm) {
                    cnsl('Background job notifier created');
                    createBackgroundJobNotifier();
                }
            }
        })
    }
});

/**
 * Création d'un job pour vérifier les mises à jour des forums suivis.
 */
function createBackgroundJobNotifier(): void {
    chrome.alarms.create('backgroundNotifications', { periodInMinutes: 2 });
}

/**
 * Initialise une configuration par défaut des options.
 */
function setDefaultGlobalConfiguration(): void {
    getGlobalConfiguration().then((config: GlobalConfiguration) => {
        if (!config.globalConfig) {
            setGlobalConfiguration(defaultConfig);
        }
    })
}

/**
 * Vérifie pour chaque forum suivi, si du contenu est disponible.
 * Si oui, il compte le nombre de topic mis à jour, et vérifie aussi les différences entre nouveaux / anciens topics.
 * Le badge de l'extension affiche ensuite le nombre de forum avec du nouveau contenu.
 * 
 * Cette liste de forum à jour est mise en instance, et le popup vient la récupérer lorsque l'utilisateur l'ouvre pour avoir les informations.
 */
async function checkFollowedForumsUpdate() {
    const forums: ForumsFollowed = await getFollowedForums();

    const updatesTemp: Update[] = [];
    if (forums.followedForums && forums.followedForums.length > 0) {

        let badgeCount = 0;
        // Récupération des derniers sujets à jour pour chaque forum suivi
        for (let forum of forums.followedForums) {
            const topicsFromXML: Topic[] = await getTopics(forum.rssUrl);
            const forumId = topicsFromXML[0].forumId;
            const snapshot: Snapshot = await getLastSnapshot(forumId);
            const snapshotTopics: Topic[] = snapshot[forumId].topics;

            // Extrait le nombre de topics mis à jour
            let updatedTopics = 0;
            for (let topic of snapshotTopics) {
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
            }
        }

        // Update Popup informations
        updateBadge(badgeCount.toString());
    } else {
        cnsl('Aucun forum suivi');
    }

    backupUpdates({ updates: updatesTemp });
}

/**
 * Mise à jour du nombre de forum mis à jour sur le badge de l'extension
 * @param {number} number - Nombre de forum mis à jour
 */
function updateBadge(number: string): void {
    chrome.browserAction.setBadgeText({ text: number });
}

/**
 * Informations demandées par le content script au sujet de sa tab actuelle
 * @param {*} senderInformations 
 */
function sendTabToContentScripts(senderInformations): void {
    chrome.tabs.sendMessage(senderInformations.tab.id, { currentTab: senderInformations });
}

/**
 * Extraction des informations sur les topics d'un forum
 * @param {string} rssLink - Flux RSS d'un forum spécifique
 */
async function getTopics(rssLink: string): Promise<Topic[]> {
    return new Promise<Topic[]>(function (resolve, reject) {
        var request = new XMLHttpRequest();
        request.open('GET', rssLink, true);

        request.onload = function () {
            if (this.status >= 200 && this.status < 400) {
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

                let topics: Topic[] = [];
                for (let item of items) {
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