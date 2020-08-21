console.log('Background script loaded at', Date.now());
// Récupère les messages émis
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.contentScripts === "requestCurrentTab") {
        sendTabToContentScripts(sender);
    } else if (request.follow) {
        console.log('Request follow received');
    }

    if (request.reloadPage) {
        console.log('Reload requested');
        chrome.tabs.reload();
    }
});

setInterval(() => console.log('Hello from background script'), 10000);

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

// Check if URL is a global game forum
function isTopForum(url) {
    let regex = new RegExp(/\/0-\d+-0-1-0-1-0-/g);
    let matchs = url.match(regex);

    if (matchs && matchs.length > 0) {
        return true;
    }

    return false;
}
