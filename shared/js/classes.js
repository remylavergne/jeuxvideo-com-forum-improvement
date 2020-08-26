/**
 * Classe représentant un forum, avec le minimum d'informations
 * pour la communication entre le background script et les options.
 */
class Forum {
    /**
     * Informations pour l'affichage d'un forum suivi dans les options globales 
     * @param {String} name - Titre du forum // TODO => faire une regex
     * @param {String} url - URL du forum
     * @param {String} rssUrl - URL du flux RSS
     */
    constructor(name, url, rssUrl) {
        this.name = name;
        this.url = url;
        this.rssUrl = rssUrl;
    }

    /**
     * Récupérer l'id en fonction de l'url du forum.
     */
    getId() {
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
    static fromObject(obj) {
        return new Forum(obj.name, obj.url, obj.rssUrl);
    }
}

/**
 * Classe représentant un message d'un forum
 */
class Topic {
    /**
     * Constructeur permettant d'avoir un Topic
     * @param {String} id 
     * @param {String} url 
     * @param {String} subject 
     * @param {String} author 
     * @param {number} count - Nombre de réponse dans le topic
     * @param {number} date 
     * @param {String} innerHTML 
     * @param {String} forumId 
     * @param {String} forumUrl 
     * @param {String} forumTitle 
     */
    constructor(id, url, subject, author, count, date, innerHTML, forumId, forumUrl, forumTitle) {
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
    static fromHTML(element) {
        let id = element.dataset.id;
        let url = ''; // TODO => Récupérer l'URL du topic dans le futur
        let subject = element.children[0].innerText;
        let author = element.children[1].innerText;
        let count = element.children[2].innerText;
        let date = element.children[3].innerText;
        let innerHTML = element.innerHTML.trim();
        let forumId = ''; // TODO => Récupérer l'id du forum
        let forumUrl = ''
        let forumTitle = '';

        return new Topic(id, url, subject, author, count, date, innerHTML, forumId, forumUrl, forumTitle);
    }

    /**
     * Extrait les informations depuis le flux RSS d'un forum spécifique
     * @param {XMLDocument} item - Document XML représentant un objet Topic
     */
    static fromXML(item, forumUrl, forumTitle) {
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
    isReadPending() {
        this.readPending = true;
    }
}