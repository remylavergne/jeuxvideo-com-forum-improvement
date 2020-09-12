import { ForumsFollowed, Snapshot, UpdateBackup, GlobalConfiguration, ForumInfos, Topic } from "./classes";

const debug = true; // TODO => export into global configuration

/**
 * Extrait l'id d'un forum en fonction de son URL et déduit si c'est bien la première page.
 * @param {string} forumUrl 
 */
export function getForumInformations(forumUrl: string): ForumInfos {
    let regex = new RegExp(/\/0-\d+-0-1-0-1-0-/g);
    let matchs = forumUrl.match(regex);

    if (matchs && matchs.length > 0) {
        // Top forum
        const forumId = matchs[0].split("-")[1];
        return { id: forumId, isTopForum: true, url: forumUrl };
    } else {
        // Topic
        const topicRegex = new RegExp(/forums\/\d+-\d+-\d+-/g);
        const matchs = forumUrl.match(topicRegex);

        if (matchs && matchs[0]) {
            const split = matchs[0].split('-');
            const forumId = split[1];
            const topicId = split[2];
            return { id: forumId, isTopForum: false, url: forumUrl, topicId: topicId };
        } else {
            return { id: null, isTopForum: false, url: forumUrl, topicId: null };
        }
    }
}

/**
* Permet de sauvegarder les topics d'un forum
* @param {string} forumId - L'id du forum. Fourni dans l'URL
* @param {Topic[]} currentTopics - Liste des topics en objet custom
*/
export function forumSnapshot(forumId: string, topics: Topic[]): void {
    // Create a Snapshot
    const snapshot: Snapshot = {
        [forumId]: {
            createdTime: Date.now(),
            topics: topics
        }
    };
    // Save it
    chrome.storage.local.set(snapshot, () => {
        cnsl('Snapshot sauvegardé', snapshot);
    })
}

/**
 * Met à jour la liste des forums suivis par l'utilisateur
 * @param {Forum[]} followedForums - Liste des forums suivis
 */
export function updateFollowStatus(followedForums: ForumsFollowed): void {
    chrome.storage.local.set(followedForums, () => {
        cnsl('JV Live => Liste de forum(s) suivi(s)', followedForums);
    })
}

export function backupUpdates(updateBackup: UpdateBackup): void {
    chrome.storage.local.set(updateBackup, () => {
        cnsl('JV Live => Updates sauvegardées', updateBackup);
    })
}

export function getUpdates(): Promise<UpdateBackup> {
    return new Promise<UpdateBackup>(function (resolve, reject) {
        chrome.storage.local.get('updates', function (result: UpdateBackup) {
            resolve(result);
        });
    });
}

/**
 * Contacte le background script pour mettre à jour le badge de l'extension
 * @param count Nombre d'update backup
 */
export function updateBadgeCount(count: string): void {
    cnsl('Update badge to =>', count);
    chrome.runtime.sendMessage({ updateBadge: count });
}

/**
 * Récupère les informations de la dernière visite du forum.
 * @param {string} forumId 
 */
export async function getLastSnapshot(forumId: string): Promise<Snapshot> {
    return new Promise<Snapshot>(function (resolve, reject) {
        chrome.storage.local.get(forumId, function (result: Snapshot) {
            resolve(result);
        });
    });
}

/**
 * Récupération du localStorage de tous les forums suivis par l'utilisateur
 */
export async function getFollowedForums(): Promise<ForumsFollowed> {
    return new Promise<ForumsFollowed>(function (resolve, reject) {
        chrome.storage.local.get('followedForums', function (result: ForumsFollowed) {
            resolve(result);
        });
    });
}

export async function getGlobalConfiguration(): Promise<GlobalConfiguration> {
    return new Promise(function (resolve, reject) {
        chrome.storage.local.get('globalConfig', function (result: GlobalConfiguration) {
            resolve(result);
        });
    });
}

export function setGlobalConfiguration(globalConfig: GlobalConfiguration): void {
    chrome.storage.local.set(globalConfig, () => {
        cnsl('JV Live => Configuration sauvegardées', globalConfig);
    })
}

// ---------------------------------------------------
// -------            Utils                 ----------
// ---------------------------------------------------

/**
 * Formate l'heure et la date du jour au moment de l'appel de la méthode
 */
export function getCurrentDateAndTime(): string {
    var today = new Date();
    // Time
    let hours = today.getHours().toString();
    let minutes = today.getMinutes().toString();
    let seconds = today.getSeconds().toString();
    // Format Time
    hours = formatTwoChar(hours);
    minutes = formatTwoChar(minutes);
    seconds = formatTwoChar(seconds);
    // Date
    let day = today.getDate().toString();
    let month = (today.getMonth() + 1).toString();
    let year = today.getFullYear().toString();
    // Format Date
    day = formatTwoChar(day);
    month = formatTwoChar(month);

    var date = day + '/' + month + '/' + year
    var time = hours + ":" + minutes + ":" + seconds;
    return time + ' ' + date;
}

function formatTwoChar(i): string {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

/**
 * Affichage des logs en debug
 * @param {string} text 
 * @param {any} data 
 */
export function cnsl(text: string, data: any = '') {
    if (debug) {
        console.log('JV Live => ' + text, data);
    }
}
