// Inspired by: https://github.com/mdn/webextensions-examples/blob/master/proxy-blocker/proxy/proxy-script.js
interface PACConfig {
    magicHost: string;
    magicPort: number;
    numToProxy: {[proxyNum: number]: string};
}
let cacaoConfig: PACConfig;
let proxyRe: RegExp;

browser.runtime.onMessage.addListener((message: PACConfig) => {
    browser.runtime.sendMessage(`Cacao PAC received config ${JSON.stringify(message)}`);
    cacaoConfig = message;
    const magicHost = cacaoConfig.magicHost.replace(/([\.\$\*\?\+\(\)])/g, '\\$1');
    proxyRe = new RegExp(`^http://${magicHost}:(\\d+)$`, 'i');
    browser.runtime.sendMessage(`Cacao PAC generated RegExp ${proxyRe}`);
});

browser.runtime.sendMessage('init');

function FindProxyForURL(url: string, host: string) {
    browser.runtime.sendMessage(`Cacao PAC checking ${url}`);
    if (cacaoConfig && url) {
        const match = url.match(proxyRe);
        if (match) {
            const num = Number(match[1]) - cacaoConfig.magicPort;
            const destAddr = cacaoConfig.numToProxy[num];
            if (destAddr) {
                browser.runtime.sendMessage(`Cacao PAC using number ${num} (${destAddr})`);
                return `PROXY ${destAddr}`;
            }
            browser.runtime.sendMessage(`Cacao PAC cannot find number ${num}`);
        }
    }
    else {
        browser.runtime.sendMessage(`Cacao PAC not configured`);
    }
    // Fallback: just use the default access.
    return 'DIRECT';
}
