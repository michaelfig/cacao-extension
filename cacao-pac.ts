// Inspired by: https://github.com/mdn/webextensions-examples/blob/master/proxy-blocker/proxy/proxy-script.js
declare var cacaoUrlMap: IProxyUrlMap;
interface IProxyUrlMap {
    [url: string]: string;
}
let proxyUrlMap: IProxyUrlMap = typeof cacaoUrlMap === 'undefined' ? undefined : cacaoUrlMap;
declare var chrome: any;

const runtime = typeof browser === 'undefined' ? typeof chrome === 'undefined' ? undefined : chrome.runtime : browser.runtime;
function log(msg: string) {
    if (runtime) {
        runtime.sendMessage(msg);
    }
}

function FindProxyForURL(url: string, host: string) {
    const match = url.match(/^[^\/]*:\/\/[^\/]*/);
    if (match) {
        const proxy = proxyUrlMap && proxyUrlMap[match[0]];
        if (proxy) {
            log(`Cacao PAC ${match[0]} -> ${proxy}`);
            return `PROXY ${proxy}`;
        }
        log(`Cacao PAC ${match[0]} -> not mapped`);
    }
    else {
        log(`Cacao PAC ${url} -> cannot find hostport`);
    }

    // Fallback: just use the default access.
    return 'DIRECT';
}

if (runtime) {
    runtime.onMessage.addListener((message: IProxyUrlMap) => {
        runtime.sendMessage(`Cacao PAC received config ${JSON.stringify(message)}`);
        proxyUrlMap = message;
    });

    runtime.sendMessage('init');
}