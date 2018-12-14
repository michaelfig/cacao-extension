// This is a function type that allows us to replace an old Cacao fetch
// with new guts (and not leak resources when reloading the extension).
type FetchUpgrader = (newFetch: typeof window.fetch) => typeof window.fetch;
interface Window {
    __CACAO_FETCH_UPGRADE__?: FetchUpgrader;
};

(function installCacao() {
    let oldFetch: typeof window.fetch;
    if (window.__CACAO_FETCH_UPGRADE__) {
        console.log('Cacao fetch upgrading existing Cacao window.fetch');
        oldFetch = window.__CACAO_FETCH_UPGRADE__(cacaoFetch);
    }
    else {
        console.log('Cacao fetch installing new Cacao window.fetch');
        oldFetch = window.fetch;
        window.fetch = cacaoFetch;
    }

    // To upgrade this instance, we remove our listeners and
    // install the new Fetch.
    window.__CACAO_FETCH_UPGRADE__ = (newFetch) => {
        cacaoUnload();
        window.fetch = newFetch;
        return oldFetch;
    };

    // Add our event listeners and initialize.
    window.addEventListener('message', cacaoOnMessage);
    window.addEventListener('beforeunload', cacaoUnload);
    send({type: 'CACAO_FETCH_INIT'});

    function send(obj: any) {
        window.postMessage(obj, '*');
    }

    // FIXME: We need to be more aggressive in preventing resource leaks
    // on Firefox.
    function cacaoUnload() {
        console.log(`Cacao fetch unloading`);
        window.removeEventListener('beforeunload', cacaoUnload);
        window.removeEventListener('message', cacaoOnMessage);
        send({type: 'CACAO_FETCH_ABORT', id: '*'});
    }

    let nextId = 0;
    let pathMap = {};
    let proxyHosts: string[];
    const streamControl: {[id: number]: any} = {};
    const connectors: {[id: number]: ((ret: any) => void)[]} = {};
    function cacaoOnMessage(event: MessageEvent) {
        if (event.source !== window) {
            return;
        }

        switch (event.data.type) {
            case 'CACAO_BODY_CHUNK': {
                const {id, chunk} = event.data;
                const controller = streamControl[id];
                if (controller) {
                    if (chunk === undefined) {
                        // Close the stream.
                        console.log(`Cacao fetch closing ${id}`);
                        delete streamControl[event.data.id];
                        controller.close();
                    }
                    else {
                        // Send on the chunk.
                        controller.enqueue(chunk);
                    }
                }
                break;
            }

            case 'CACAO_FETCH_BEGIN': {
                const {id, status, statusText, headers} = event.data;
                const connector = connectors[id];
                if (connector) {
                    delete connectors[id];
                    const stream = new (ReadableStream as any)({
                        start(controller: any) {
                            streamControl[id] = controller;
                            send({type: 'CACAO_FETCH_READ_BODY', id});
                        },
                        pull(controller: any) {
                            // Not apparently needed.
                        },
                        cancel() {
                            console.log(`Cancelling controller ${id}`);
                            delete streamControl[id];
                        },
                    });

                    const hdr = new Headers();
                    for (const key in (headers as {[key: string]: string})) {
                        hdr.set(key, headers[key]);
                    }
                    const respInit = {
                        status,
                        statusText,
                        headers: hdr,
                    };

                    const resp = new Response(stream, respInit);
                    connector[0](resp);
                }
                break;
            }

            case 'CACAO_FETCH_REJECTED': {
                const {id, reason} = event.data;
                console.log(`Cacao fetch rejecting ${id}: ${reason}`);
                const connector = connectors[id];
                if (connector) {
                    delete connectors[id];
                    connector[1](reason);
                }
                break;
            }

            case 'CACAO_FETCH_CONFIG': {
                const {config} = event.data;
                console.log(`Cacao fetch configuring with`, config);
                pathMap = config.pathMap;
                proxyHosts = config.proxyHosts;
                break;
            }
        }
    };

    // Taken verbatim from cacao/lib/src/resolve.dart.
    function buildQuery(a: string, b: string) {
        const prefix = (a === '' && b === '') ? '' : '?';
        const sep = (a !== '' && b !== '') ? '&' : '';
        return prefix + a + sep + b;
    }

    // Taken verbatim from cacao/lib/src/resolve.dart.
    function resolve(requested: URL, prepend: string, add = '') {
        const pre = new URL(prepend);
        let path: string;
        if (pre.pathname.endsWith('/')) {
            if (add.startsWith('/')) {
                path = pre.pathname + add.substr(1);
            }
            else {
                path = pre.pathname + add;
            }
        }
        else if (add === '' || add.startsWith('/')) {
            path = pre.pathname + add;
        }
        else {
            path = pre.pathname + '/' + add;
        }
        const addQuery = buildQuery(pre.search.substr(1), requested.search.substr(1));
        pre.pathname = path;
        pre.search = addQuery;
        return pre;
    }

    // Taken verbatim from cacao/lib/src/findUri.dart.
    function findUri(requested: URL, pathMap: {[path: string]: string}) {
        // Use the longest matching pathMap.
        const segs = requested.pathname.substr(1).split('/').map(decodeURIComponent);
        const trailSlash = segs.length > 0 && segs[segs.length - 1] == '';
        for (let i = segs.length - (trailSlash ? 1 : 0); i >= 0; --i) {
            const toMatch = '/' +
                segs.filter((_, index) => index < i).join('/');
            const toPrepend = pathMap[toMatch];
            if (toPrepend !== undefined) {
                const toAdd = segs
                    .filter((_, index) => index >= i)
                    .map(encodeURIComponent)
                    .join('/');
                const suffix = trailSlash ? '/' : '';
                return resolve(requested, toPrepend, toAdd + suffix);
            }
        }
        
        // Do the default mapping, if there is one.
        const defaultUrl = pathMap[''];
        if (defaultUrl === undefined) {
            throw Error('Cacao fetch: no default Url in pathMap');
        }
        const toAdd = requested.pathname === '/' ? '' : requested.pathname;
        return resolve(requested, defaultUrl, toAdd);
    }

    function cacaoFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
        // We have to carefully remove non-cloneable init parameters.
        try {
            const {signal, ...initRest} = init;
            if (typeof input === 'string') {
                const url = new URL(input);
                if (proxyHosts && proxyHosts.indexOf(url.host) >= 0) {
                    const id = ++nextId;
                    console.log('Cacao fetch intercepting', id, input, init);

                    const dst = findUri(url, pathMap);
                    console.log(`Cacao fetch remap ${id} ${input} -> ${dst.href}`);
                    if (signal) {
                        signal.addEventListener('abort', () => {
                            send({type: 'CACAO_FETCH_ABORT', id});
                        });
                    }
                    return new Promise((resolve, reject) => {
                        connectors[id] = [resolve, reject];
                        send({type: 'CACAO_FETCH_REQUEST', input: dst.href, init: initRest, id});
                    });
                }
            }
            console.log('Cacao fetch falling back to old Fetch API', input, init);
            return oldFetch(input, init);
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
})();
