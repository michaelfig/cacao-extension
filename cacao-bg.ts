// Inspired by: https://github.com/mdn/webextensions-examples/blob/master/proxy-blocker/background/proxy-handler.js
console.log(`Cacao extension loading`);

// FIXME: Derive from config.
const matchPatterns = [
    `*://*.poc.ts.liveblockauctions.com/ms/publish.html`,
//    `file:///Users/michael/src/*`
];

const whitelist = new Set<string>([`http://216.8.159.21/mjpg/video.mjpg`]);

// Register our response header rewriter.
browser.contentScripts.register({
    matches: matchPatterns,
    js: [{
        file: 'browser-polyfill.min.js',
    }, {
        file: 'cacao-fetch.js',
    }],
    runAt: 'document_start',
}).then(results => {
    console.log(`Cacao content script results:`, results);
});
