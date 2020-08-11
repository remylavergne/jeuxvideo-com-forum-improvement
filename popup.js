let title = document.querySelector('#hello');

document.querySelector('#clickMe').addEventListener('click', function(event) {
    console.log('test');
    // title.textContent = 'Salut';
    getCurrentTab();
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