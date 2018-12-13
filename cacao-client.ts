console.log('Cacao installing fetch extension');
installFetch();

function installFetch() {
    let nextId = 0;
    const streamControl: {[id: number]: any} = {};
    window.addEventListener('message', function(event) {
        if (event.source !== window) {
            return;
        }

        if (event.data.type && event.data.type === 'CACAO_BODY_CHUNK') {
            const controller = streamControl[event.data.id];
            const chunk = event.data.chunk;
            if (controller) {
                if (chunk === undefined) {
                    delete streamControl[event.data.id];
                    controller.close();
                }
                else {
                    controller.enqueue(chunk);
                }
            }
        }
    });
    const oldFetch = window.fetch;
    window.fetch = (input: RequestInfo, init?: RequestInit & {cacao: boolean}) => {
        if (init && init.cacao) {
            const id = ++nextId;
            console.log('Cacao fetch starting', id, input, init);
            const stream = new (ReadableStream as any)({
                start(controller: any) {
                    window.postMessage({
                        type: 'CACAO_BODY_FETCH',
                        input, init, id
                    }, '*');
                    streamControl[id] = controller;
                },
                pull(controller: any) {

                },
                cancel() {
                    console.log(`Cancelling controller ${id}`);
                    delete streamControl[id];
                },
            });
            const resp = new Response(stream);
            return Promise.resolve(resp);
        }
        console.log('Cacao fetch falling back', input, init);
        return oldFetch(input, init);
    }
}
