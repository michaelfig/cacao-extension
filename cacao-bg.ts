// Inspired by: https://github.com/mdn/webextensions-examples/blob/master/proxy-blocker/background/proxy-handler.js
console.log(`Cacao extension loading`);

// FIXME: Derive from config.
const matchPatterns = [
    `*://*.poc.ts.liveblockauctions.com/ms/publish.html`,
    `*://localhost/publish.html`,
//    `file:///Users/michael/src/*`
];

// Register our content script.
if (browser.contentScripts) {
    browser.contentScripts.register({
        matches: matchPatterns,
        js: [{
            file: 'browser-polyfill.min.js',
        }, {
            file: 'cacao-server.js',
        }],
        runAt: 'document_start',
    }).then(results => {
        console.log(`Cacao content script results:`, results);
    });
}