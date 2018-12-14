////////////////////////////////
// FIXME: Derive from config.
const enabledOrigins = [
    `https://v5.poc.ts.liveblockauctions.com/ms/publish.html`,
    `http://localhost:8080/publish.html`,
//    `file:///Users/michael/src/*`
];

const pathMap = {
    '/mjpeg': 'http://216.8.159.21/mjpg/video.mjpg',
    '/cam1': 'http://192.168.100.1/mjpeg',
    '/cam2': 'http://192.168.100.2/-wvhttp-01-/video.cgi',
    '/cam3': 'http://root:VB-C300@192.168.100.3/-wvhttp-01-/GetOneShot?frame_count=0',
    '/cam4': 'http://192.168.100.4/-wvhttp-01-/video.cgi',
};

const proxyHosts = ['127.0.0.1:9000', 'localhost:9000'];

const whitelistDebug = false;
/////////////////////////////////

const href = document.URL;
const currentUrl = new URL(href);

function wlDebug(...args: any[]) {
    if (whitelistDebug) {
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
for (const urlStr of enabledOrigins) {
    const url = new URL(urlStr);
    if (url.protocol !== currentUrl.protocol) {
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
}
else {
    console.log(`Cacao hooking into ${href} Fetch API`);
    function send(obj: any, transferable: Array<Transferable> = []) {
        window.postMessage(obj, '*');
    }
    let abortControllers: {[id: number]: AbortController} = {};
    let responses: {[id: number]: Response} = {};
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
                    config: {pathMap, proxyHosts}});
                break;
            }
        }
    });

    const scr = document.createElement("script");
    scr.src = browser.extension.getURL('cacao-client.js');
    (document.head || document.documentElement).appendChild(scr);
}
