// Récupère les messages émis
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // alert('Requete reçue');
    if (request.todo === "showPageAction") {
        // TODO: Do something
        // alert('Bonne requête');
    }
});