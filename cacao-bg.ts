// Inspired by: https://github.com/mdn/webextensions-examples/blob/master/proxy-blocker/background/proxy-handler.js
console.log('Cacao extension loading');
const proxyScriptURL = 'cacao-pac.js';

const defaultSettings = {
    magicHost: '127.0.0.1',
    magicPort: 9000,
    '/mjpeg': 'http://216.8.159.21/mjpg/video.mjpg',
};

// Register our proxy script.
(browser as any).proxy.register(proxyScriptURL);

// Log any errors from the proxy script
(browser as any).proxy.onProxyError.addListener((error: {message: string}) => {
    console.error(`Cacao Proxy error: ${error.message}`);
});

function resolve(u: URL, ptn: {[path: string]: number}, ntp: {[num: number]: string}) {
    // FIXME: Resolve also subpaths.
    const num = ptn[u.pathname];
    if (num === undefined) {
        return num;
    }
    // FIXME: Do concatenation of subpaths.
    u.pathname = ntp[num];
    return num;
}

function handleInit() {
    // FIXME: Initialize from default settings.
    const magicHost = defaultSettings.magicHost;
    const magicPort = defaultSettings.magicPort;

    const pathToNum: {[path: string]: number} = {
        '/mjpeg': 1,
    };

    const numToPath: {[num: number]: string} = {
        1: '/mjpg/video.mjpg',
    }

    const numToHost: {[num: number]: string} = {
        1: '216.8.159.21',
    }

    const numToProxy: {[num: number]: string} = {
        1: '216.8.159.21:80',
    };

    // Register our request header rewriter.
    browser.webRequest.onBeforeSendHeaders.addListener((arg) => {
        const u = new URL(arg.url);
        if (Number(u.port) !== magicPort) {
            return {};
        }

        const num = resolve(u, pathToNum, numToPath);
        if (num === undefined) {
            console.log(`Cacao could not resolve ${u.pathname}`);
            return {cancel: true};
        }

        let mapped = false;
        const headers = (arg.requestHeaders || []).map((hdr) => {
            if (hdr.name.match(/^host$/i)) {
                mapped = true;
                return {name: hdr.name, value: numToHost[num]};
            }
            return hdr;
        });
        if (!mapped) {
            headers.push({name: 'Host', value: numToHost[num]});
        }
        console.log(`Cacao request ${JSON.stringify(headers)}`);
        u.host = `127.0.0.1:${9000 + num}`;
        return {
            redirectUrl: u.href,
            requestHeaders: headers,
        };
    },
    {urls: [`http://${magicHost}/*`]},
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
    {urls: [`http://127.0.0.1/*`]},
    ['blocking', 'responseHeaders']);

    console.log('Cacao initializing PAC settings');
    browser.runtime.sendMessage({
        magicHost,
        magicPort,
        numToProxy,
    }, {toProxyScript: true});
}

function handleMessage(message: any, sender: {url: string}) {
    // console.log(`Cacao got message: ${JSON.stringify(message)}`);
    if (sender.url !== browser.extension.getURL(proxyScriptURL)) {
        return;
    }

    if (message === 'init') {
        handleInit();
    }
    else {
        // After init, the only messages are log messages.
        console.log(message);
    }
}

browser.runtime.onMessage.addListener(handleMessage);
