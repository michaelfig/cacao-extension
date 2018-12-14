(function installCacao() {
    if ((window as any).___CACAO_INSTALLED___) {
        return;
    }

    console.log('Cacao fetch installing extension');
    (window as any).___CACAO_INSTALLED___ = true;
    window.addEventListener('beforeunload', function(event) {
        console.log(`Cacao fetch unloading`);
        window.postMessage({
            type: 'CACAO_FETCH_ABORT', id: '*',
        }, '*');
});
    let nextId = 0;
    const streamControl: {[id: number]: any} = {};
    const connectors: {[id: number]: ((ret: any) => void)[]} = {};
    window.addEventListener('message', function(event) {
        if (event.source !== window) {
            return;
        }

        if (event.data.type && event.data.type === 'CACAO_FETCH_BEGIN') {
            const {id, status, statusText, headers} = event.data;
            const connector = connectors[id];
            if (connector) {
                delete connectors[id];
                const stream = new (ReadableStream as any)({
                    start(controller: any) {
                        streamControl[id] = controller;
                    },
                    pull(controller: any) {
    
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
        }
        if (event.data.type && event.data.type === 'CACAO_FETCH_REJECTED') {
            const {id, reason} = event.data;
            console.log(`Cacao fetch rejecting ${id}: ${reason}`);
            const connector = connectors[id];
            if (connector) {
                delete connectors[id];
                connector[1](reason);
            }
        }
        if (event.data.type && event.data.type === 'CACAO_BODY_CHUNK') {
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
        }
    });
    const oldFetch = window.fetch;
    window.fetch = function cacaoFetch(input: RequestInfo, init?: RequestInit & {cacao: boolean | 'downgrade'}) {
        const {cacao, signal, ...initRest} = init;
        if (cacao) {
            const id = ++nextId;
            console.log('Cacao fetch starting', id, input, init);
            const down = cacao === 'downgrade' ? input.toString().replace(/^(http)s:/, '$1:') : input;
            if (signal) {
                signal.addEventListener('abort', () => {
                    window.postMessage({
                        type: 'CACAO_FETCH_ABORT', id,
                    }, '*');
                });
            }
            return new Promise((resolve, reject) => {
                connectors[id] = [resolve, reject];
                window.postMessage({
                    type: 'CACAO_FETCH_REQUEST',
                    input: down, init: initRest, id
                }, '*');
            });
        }
        console.log('Cacao fetch falling back', input, init);
        return oldFetch(input, init);
    }
})();
