/**
 * Applique la configuration de l'utilisateur à la partie topic / message
 */

import { cnsl, getForumInformations, getGlobalConfiguration } from "./functions";
import { defaultConfig } from "./objects";
import { TopicConfig, GlobalConfiguration } from "./classes";

 // Script qui se lance à tout les lancements de page / onglet / tab.
chrome.runtime.sendMessage({ contentScripts: "topic-config" });

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    if (request.contentTopicConfig) {
        const forum = getForumInformations(request.contentTopicConfig.url);
        if (!forum.isTopForum) {
            cnsl('=> Topic détecté, application de la configuration...');
            const config = await getGlobalConfiguration();
            const diffs = await findTopicConfigDiffs(config);
            
            if (diffs.length > 0) {
                applyConfiguration(config.globalConfig.topic, diffs);
            } else {
                cnsl('Aucune différence de configuration pour les Topics');
            }
        }
    }
});

enum ConfigDiffs {
    MESSAGE_PREV = "MESSAGE_PREV",
    HEADER_SIZE = "HEADER_SIZE"
}

async function findTopicConfigDiffs(config: GlobalConfiguration): Promise<ConfigDiffs[]> {
    return new Promise(async (resolve, reject) => {
        const topicConfig = config.globalConfig.topic;
        const defaultTopicConfig = defaultConfig.globalConfig.topic;
    
        const diffs: ConfigDiffs[] = [];
        if (topicConfig.previsu !== defaultTopicConfig.previsu) {
            diffs.push(ConfigDiffs.MESSAGE_PREV);
        }
    
        resolve(diffs);
    });
}

async function applyConfiguration(config: TopicConfig, diffs: ConfigDiffs[]) {

    for (let diff of diffs) {
        switch(diff) {
            case ConfigDiffs.MESSAGE_PREV:
                const buttonPrev = document.getElementsByClassName('btn-on-off active')[0];
                if (buttonPrev && !config.previsu) {
                    (buttonPrev as HTMLButtonElement).click();
                }
            break;
            case ConfigDiffs.HEADER_SIZE:
            break;
        }
    }
}