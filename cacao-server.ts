interface CacaoSettings {
    [key: string]: any;
    whitelist: string[];
    magic: string[];
    pathMap: {[path: string]: string};
    whitelistDebug: boolean;
};

const defaultSettings : CacaoSettings = {
    whitelist: ['*://localhost:8080/publish.html'],
    magic: ['localhost:9000', '127.0.0.1:9000'],
    pathMap: {'': 'https://example.com'},
    whitelistDebug: false,
};

browser.storage.local.get()
    .then((storedSettings: CacaoSettings) => {
        const settings: CacaoSettings = {
            ...defaultSettings,
            ...storedSettings
        };
        if (!storedSettings) {
            console.log(`Cacao initializing default settings`);
            browser.storage.local.set(settings);
        }

        handleInit(settings);
    })
    .catch(e => {
        console.error(`Cacao cannot load settings`, e);
    });

function handleInit(firstSettings: CacaoSettings) {
    let settings = firstSettings;

    const href = document.URL;
    const currentUrl = new URL(href);

    function wlDebug(...args: any[]) {
        if (settings.whitelistDebug) {
            console.log(...args);
        }
    }

    function buildRegExp(pattern: string, toAppend = '') {
        const re = pattern.replace(/[\\\*\$\^\.\*\+]/g, (substring) => {
            if (substring === '*') {
                return '.*';
            }
            else {
                return '\\' + substring;
            }
        });
        return new RegExp(`^${re}${toAppend}\$`, 'i');
    }

    let doInstall = false;
    for (const urlStr of settings.whitelist) {
        const noWildcardProtocol = urlStr.replace(/^\*:/, 'http:');
        const url = new URL(noWildcardProtocol);
        if (noWildcardProtocol === urlStr && url.protocol !== currentUrl.protocol) {
            wlDebug(`Cacao whitelist: ${href} does not match protocol ${url.protocol}`);
            continue;
        }
        const hostRe = buildRegExp(decodeURIComponent(url.host));
        if (!currentUrl.host.match(hostRe)) {
            wlDebug(`Cacao whitelist: ${href} does not match host ${hostRe}`);
            continue;
        }
        const pathRe = buildRegExp(url.pathname, '(/.*|)');
        if (!currentUrl.pathname.match(pathRe)) {
            wlDebug(`Cacao whitelist: ${href} does not match path ${pathRe}`);
            continue;
        }

        wlDebug(`Cacao whitelist: ${href} matched ${urlStr}`);
        doInstall = true;
        break;
    }

    if (!doInstall) {
        console.log(`Cacao ignoring ${href}; not whitelisted`);
        return;
    }

    console.log(`Cacao hooking into ${href} Fetch API`);
    function send(obj: any, transferable: Array<Transferable> = []) {
        window.postMessage(obj, '*');
    }
    let abortControllers: {[id: number]: AbortController} = {};
    let responses: {[id: number]: Response} = {};

    // Allow updates to settings.
    browser.storage.onChanged.addListener(function updateSettings(newSettings) {
        console.log(`Cacao updating settings`);
        for (const key in newSettings) {
            settings[key] = newSettings[key].newValue;
        }
        send({type: 'CACAO_FETCH_CONFIG',
            config: {
                pathMap: settings.pathMap,
                proxyHosts: settings.magic,
            },
        });
    });

    window.addEventListener('message', function(event) {
        if (event.source !== window) {
            return;
        }

        // console.log('Cacao got', event.data);
        switch (event.data.type) {
            case 'CACAO_FETCH_ABORT': {
                const {id} = event.data;
                console.log(`Cacao fetch aborting ${id}`);
                if (id === '*') {
                    const ab = abortControllers;
                    abortControllers = {};
                    for (const i in ab) {
                        const abortController = ab[i];
                        abortController.abort();
                    }
                    return;
                }
                const abortController = abortControllers[id];
                if (abortController) {
                    delete abortControllers[id];
                    abortController.abort();
                }
                break;
            }
        
            case 'CACAO_FETCH_REQUEST': {
                const {id, init, input} = event.data;

                const myInit = {...init};

                // Allow aborting.
                const abortController = new AbortController();
                abortControllers[id] = abortController;
                myInit.signal = abortController.signal;

                // Merge headers.
                const hdr = new Headers();
                for (const key in (init.headers || {})) {
                    hdr.set(key, init.headers[key]);
                }

                // Replace embedded credentials with a header.
                const url = new URL(input);
                if (url.username || url.password) {
                    const creds = btoa(url.username + ':' + url.password);
                    hdr.append('Authorization', `Basic ${creds}`);
                    url.username = '';
                    url.password = '';
                }
                myInit.headers = hdr;
                
                // Actually send the request.
                fetch(url.href, myInit).then(resp => {
                    if (!resp.ok) {
                        send({type: 'CACAO_FETCH_REJECTED', id, reason: 'not ok'});
                        return;
                    }
                    const headers: {[key: string]: string} = {};
                    resp.headers.forEach((val, key) => {
                        headers[key] = val;
                    });
                    responses[id] = resp;
                    send({type: 'CACAO_FETCH_BEGIN', id,
                        status: resp.status,
                        statusText: resp.statusText,
                        headers,
                    });
                })
                .catch(reason => {
                    send({type: 'CACAO_FETCH_REJECTED', id, reason: reason.toString()});
                });
                break;
            }

            case 'CACAO_FETCH_READ_BODY': {
                const {id} = event.data;

                const resp = responses[id];
                if (resp) {
                    const reader = resp.body.getReader();
                    function pushRead() {
                        reader.read().then(function readChunk(attrs) {
                            if (attrs.done) {
                                send({type: 'CACAO_BODY_CHUNK', id, chunk: undefined});
                                return;
                            }

                            const chunk = attrs.value;
                            send({type: 'CACAO_BODY_CHUNK', id, chunk}, [chunk]);
                            pushRead();
                        }).catch(function onError(error) {
                            console.error(error);
                            send({type: 'CACAO_BODY_CHUNK', id, chunk: undefined});
                        })
                    }
                            
                    pushRead();
                }
                break;
            }

            case 'CACAO_FETCH_INIT': {
                send({type: 'CACAO_FETCH_CONFIG',
                    config: {
                        pathMap: settings.pathMap,
                        proxyHosts: settings.magic,
                    },
                });
                break;
            }
        }
    });

    const scr = document.createElement("script");
    scr.src = browser.extension.getURL('cacao-client.js');
    (document.head || document.documentElement).appendChild(scr);
}
