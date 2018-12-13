// Inspired by: https://github.com/mdn/webextensions-examples/blob/master/proxy-blocker/background/proxy-handler.js
console.log('Cacao extension loading');
const proxyScriptURL = 'cacao-pac.js';

const settings = {
    magicPort: 9000,
    // proxyHost: 'cacao.local',
    proxyHost: '127.0.0.1',
};

const pathMap: {[path: string]: string} = {};
const urlMap: {[url: string]: string} = {};
let nextPort = settings.magicPort + 1;

// FIXME: Derive from config.
pathMap['/mjpeg'] = `http://${settings.proxyHost}:${nextPort}/mjpg/video.mjpg`;
urlMap[`http://${settings.proxyHost}:${nextPort}`] = '216.8.159.21:80';
++nextPort;

function resolve(u: URL, pathMap: {[path: string]: string}) {
    // FIXME: Resolve also subpaths.
    const url = pathMap[u.pathname];
    if (url === undefined) {
        return;
    }
    // FIXME: Do concatenation of subpaths and query strings.
    const dst = new URL(url);
    dst.search = u.search;
    return dst;
}

function handleInit() {
    // FIXME: Initialize from actual settings.
    const magicPort = settings.magicPort;
    const proxyHost = settings.proxyHost;

    // Dispatch a magicPort request to a specific proxy.
    browser.webRequest.onBeforeRequest.addListener((arg) => {
        const u = new URL(arg.url);
        if (Number(u.port) !== magicPort) {
            return {};
        }

        const dst = resolve(u, pathMap);
        if (dst === undefined) {
            console.log(`Cacao could not resolve ${u.pathname}`);
            return {cancel: true};
        }

        console.log(`Cacao ${arg.url} -> ${dst.href}`);
        return {
            redirectUrl: dst.href,
        };
    },
    {urls: [`http://127.0.0.1/*`, `http://localhost/*`]},
    ['blocking']);

    // Register our request header rewriter.
    browser.webRequest.onBeforeSendHeaders.addListener((arg) => {
        let mapped = false;
        const dst = new URL(arg.url);
        const myHost = urlMap[`${dst.protocol}//${dst.host}`];
        if (!myHost) {
            // Not mapped.
            return {};
        }
        const headers = (arg.requestHeaders || []).map((hdr) => {
            if (hdr.name.match(/^host$/i)) {
                mapped = true;
                return {name: hdr.name, value: myHost};
            }
            if (hdr.name.match(/^cookie$/i)) {
                return {name: 'X-Cookie', value: 'none'};
            }
            return hdr;
        });
        if (!mapped) {
            headers.push({name: 'Host', value: myHost});
        }
        console.log(`Cacao request ${dst.href} ${JSON.stringify(headers)}`);
        return {
            requestHeaders: headers,
        };
    },
    {urls: [`http://${proxyHost}/*`]},
    ['blocking', 'requestHeaders']);

    // Register our response header rewriter.
    browser.webRequest.onHeadersReceived.addListener((arg) => {
        let mappedACAO = false;
        let mappedCC = false;
        const headers = (arg.responseHeaders || []).map((hdr) => {
            if (hdr.name.match(/^access-control-allow-origin$/i)) {
                mappedACAO = true;
                return {name: hdr.name, value: '*'};
            }
            if (hdr.name.match(/^cache-control$/i)) {
                mappedCC = true;
                return {name: hdr.name, value: 'no-cache'};
            }
            return hdr;
        });
        if (!mappedACAO) {
            headers.push({name: 'Access-Control-Allow-Origin', value: '*'});
        }
        if (!mappedCC) {
            headers.push({name: 'Cache-Control', value: 'no-cache'});
        }
        console.log(`Cacao response ${JSON.stringify(headers)}`);
        return {
            responseHeaders: headers,
        };
    },
    {urls: [`http://${proxyHost}/*`]},
    ['blocking', 'responseHeaders']);
}

let refreshSettings = () => {};
let refreshProxy = () => {};
let pacScript = '';

function handleMessage(message: any, sender: {url: string}) {
    // console.log(`Cacao got message: ${JSON.stringify(message)} from ${JSON.stringify(sender)}`);
    if (sender.url !== browser.extension.getURL(proxyScriptURL)) {
        return;
    }

    if (message === 'init') {
        handleInit();
        refreshSettings();
    }
    else {
        // After init, the only messages are log messages.
        console.log(message);
    }
}

browser.runtime.onMessage.addListener(handleMessage);

const proxy = (browser as any).proxy;

// Log any errors from the proxy script
proxy.onProxyError.addListener((error: any) => {
    console.error('Cacao Proxy error:', error);
});

// Register our proxy script.
if (proxy.register) {
    // Firefox's way.
    function refreshFirefoxSettings() {
        console.log('Cacao refreshing PAC settings');
        browser.runtime.sendMessage(urlMap, {toProxyScript: true});
    }
    refreshSettings = refreshFirefoxSettings;

    console.log(`Cacao registering ${proxyScriptURL}`);
    proxy.register(proxyScriptURL);
}
else {
    // Chrome's way.
    function refreshChromeProxy() {
        const config = {
            mode: 'pac_script',
            pacScript: {
                data: `var cacaoUrlMap = ${JSON.stringify(urlMap)};
${pacScript}`,
            },
        };
        console.log(`Cacao refreshing PAC ${proxyScriptURL}`);
        proxy.settings.set({value: config, scope: 'regular'}, 
            () => {
                proxy.settings.get({incognito: false}, (cfg: any) => {
                    console.log(`Cacao PAC set to: ${JSON.stringify(cfg)}`);
            });
        });
    }
    refreshProxy = refreshChromeProxy;

    // Fetch the proxy script, then refresh.
    fetch(browser.extension.getURL(proxyScriptURL))
    .then(res => res.text())
    .then(text => {
        pacScript = text;
        handleInit();
        refreshProxy();
    });
}
