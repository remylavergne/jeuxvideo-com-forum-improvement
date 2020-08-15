let title = document.querySelector('#hello');
let followBtn = document.getElementById('follow');

followBtn.addEventListener('click', function(event) {
    console.log('test');
    // title.textContent = 'Salut';
    getCurrentTab();
});

chrome.tabs.query({
    "active": true,
    "currentWindow": true
}, (tabs) => {
    console.log(tabs[0]);
});

 function getCurrentTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {

        // since only one tab should be active and in the current window at once
        // the return variable should only have one entry
        var activeTab = tabs[0];
        var activeTabId = activeTab.id; // or do whatever you need

       alert(getTabUrl(activeTab));
    
     });
 }

 function getTabUrl(tab) {
    return tab.url;
 }