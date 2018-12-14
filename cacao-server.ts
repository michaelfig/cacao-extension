function send(obj: any, transferable: Array<Transferable> = []) {
    window.postMessage(obj, '*');
}
let abortControllers: {[id: number]: AbortController} = {};
window.addEventListener('message', function(event) {
    if (event.source !== window) {
        return;
    }
    // console.log('Cacao got', event.data);
    if (event.data.type && event.data.type === 'CACAO_FETCH_ABORT') {
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
    }
    if (event.data.type && event.data.type === 'CACAO_FETCH_REQUEST') {
        const {id, init, input} = event.data;
        // Allow aborting.
        const abortController = new AbortController();
        abortControllers[id] = abortController;
        init.signal = abortController.signal;
        fetch(input, init).then(resp => {
            if (!resp.ok) {
                send({type: 'CACAO_FETCH_REJECTED', id, reason: 'not ok'});
                return;
            }
            const headers: {[key: string]: string} = {};
            resp.headers.forEach((val, key) => {
                headers[key] = val;
            });
            send({type: 'CACAO_FETCH_BEGIN', id,
                status: resp.status,
                statusText: resp.statusText,
                headers,
            });

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
        })
        .catch(reason => {
            send({type: 'CACAO_FETCH_REJECTED', id, reason: reason.toString()});
        });
    }
});

const scr = document.createElement("script");
scr.src = browser.extension.getURL('cacao-client.js');
(document.head || document.documentElement as any).appendChild(scr);
