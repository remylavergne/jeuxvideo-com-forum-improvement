import { getCurrentDateAndTime } from "./functions";


export interface ChromeTab {
    frameId: number,
    id: string,
    origin: string,
    tab: Tab,
    url: string
}

export interface Tab {
    active: boolean,
    audible: boolean,
    autoDiscardable: boolean,
    discarded: boolean,
    favIconUrl: string,
    height: number,
    highlighted: boolean,
    id: number,
    incognito: boolean,
    index: number,
    mutedInfo: {muted: boolean},
    openerTabId: number,
    pinned: boolean,
    selected: boolean,
    status: string,
    title: string,
    url: string,
    width: number,
    windowId: number
}
/**
 * Classe représentant un forum, avec le minimum d'informations
 * pour la communication entre le background script et les options.
 */
export class Forum {
    name: string;
    url: string;
    rssUrl: string;
    /**
     * Informations pour l'affichage d'un forum suivi dans les options globales 
     * @param {string} name - Titre du forum // TODO => faire une regex
     * @param {string} url - URL du forum
     * @param {string} rssUrl - URL du flux RSS
     */
    constructor(name: string, url: string, rssUrl: string) {
        this.name = name;
        this.url = url;
        this.rssUrl = rssUrl;
    }

    /**
     * Récupérer l'id en fonction de l'url du forum.
     */
    getId(): string {
        // Check if URL is a global game forum
        let regex = new RegExp(/\/0-\d+-0-1-0-1-0-/g);
        let matchs = this.url.match(regex);

        if (matchs && matchs.length > 0) {
            const forumId = matchs[0].split("-")[1];

            return forumId;
        } else {
            return null;
        }
    }

    /**
     * Création d'un objet Forum
     * @param {Object} obj 
     */
    static fromObject(obj): Forum { // TODO => plus besoin avec les types
        return new Forum(obj.name, obj.url, obj.rssUrl);
    }
}

/**
 * Classe représentant un message d'un forum
 */
export class Topic {
    id: string;
    url: string;
    subject: string;
    author: string;
    count: string;
    date: string;
    innerHTML: string;
    readPending: boolean;
    forumId: string;
    forumUrl: string;
    createdAt: number;
    forumTitle: string;

    constructor(
        id: string,
        url: string,
        subject: string,
        author: string,
        count: string,
        date: string,
        innerHTML: string,
        forumId: string,
        forumUrl: string,
        forumTitle: string
    ) {
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
        this.forumTitle = forumTitle;
    }

    /**
     * Générer un Topic à partir d'un élément HTML représentant un message
     * @param {HTMLElement} element 
     */
    static fromHTML(element): Topic {
        // cnsl('element reçu de lHTML', element);
        const idRegex = new RegExp(/forums\/\d+-\d+-(\d+)-/g);
        const urlFull = element.querySelector('.lien-jv').href;
        const urlMatchs = urlFull.match(idRegex)[0].split('-');

        let id = urlMatchs[2];
        let url = urlFull;
        let subject = element.children[0].innerText;
        let author = element.children[1].innerText;
        let count = element.children[2].innerText;
        let date = element.children[3].innerText;
        let innerHTML = element.innerHTML.trim();
        let forumId = urlMatchs[1];
        let forumUrl = ''
        let forumTitle = '';

        return new Topic(id, url, subject, author, count, date, innerHTML, forumId, forumUrl, forumTitle);
    }

    /**
     * Extrait les informations depuis le flux RSS d'un forum spécifique
     * @param {XMLDocument} item - Document XML représentant un objet Topic
     */
    static fromXML(item: Element, forumUrl: string, forumTitle: string) {
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

        return new Topic(id, url, subject, author, count, date, innerHTML, forumId, forumUrl, forumTitle);
    }

    /**
     * Passer le topic en attente de lecture
     */
    isReadPending(): void {
        this.readPending = true;
    }
}

export interface ForumsFollowed {
    followedForums: Forum[];
}

export class Update {
    forumId: string;
    forumUrl: string;
    forumTitle: string;
    switchedForums: number;
    updatedTopics: number;
    forum: Forum;
    time: number;
    date: string;

    /**
     * Informations liées à une mise à jour d'un forum
     * @param {string} forumId 
     * @param {string} forumUrl 
     * @param {string} forumTitle
     * @param {number} switchedForums - Le nombre de nouveaux topics
     * @param {number} updatedTopics - Nombre de topics mis à jour
     * @param {Forum} forum - Informations générale pour l'affichage des options
     */
    constructor(forumId: string, forumUrl: string, forumTitle: string, switchedForums: number, updatedTopics: number, forum: Forum) {
        this.forumId = forumId;
        this.forumUrl = forumUrl;
        this.forumTitle = forumTitle;
        this.switchedForums = switchedForums;
        this.updatedTopics = updatedTopics;
        this.forum = forum;
        this.time = Date.now();
        this.date = getCurrentDateAndTime();
    }
}

export interface Snapshot {
    [key: string]: SnapshotTopics;
}

export interface SnapshotTopics {
    createdTime: number;
    topics: Topic[];
}

export interface ForumInfos {
    id?: string;
    topicId?: string;
    isTopForum: boolean;
    snapshot?: Snapshot;
    url: string;
}

export interface TopicsAndElements {
    elements: HTMLCollectionOf<HTMLLIElement>;
    topics: Topic[];
}

export class SnapshotChanges {
    updated: Topic[];
    added: Topic[];
    deleted: Topic[];

    constructor(updated: Topic[], added: Topic[], deleted: Topic[]) {
        this.updated = updated;
        this.added = added;
        this.deleted = deleted;
    }
}

export interface UpdateBackup {
    updates: Update[];
}

export interface GlobalConfiguration {
    globalConfig: Config
}

export interface DefaultGlobalConfiguration {
    globalConfig: Config
}
export interface Config {
    topic: TopicConfig;
}

export interface TopicConfig {
    previsu: boolean;
}