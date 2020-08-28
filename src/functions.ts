import { ForumsFollowed, Snapshot, Update, UpdateBackup, GlobalConfiguration } from "./classes";

const debug = true; // TODO => export into global configuration

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

/**
 * Affichage des logs en debug
 * @param {string} text 
 * @param {any} data 
 */
export function cnsl(text: string, data: any = '') {
    if (debug) {
        console.log(text, data);
    }
}
