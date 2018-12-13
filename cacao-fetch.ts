window.addEventListener('message', function(event) {
    if (event.source !== window) {
        return;
    }
    console.log('Cacao got', event.data);
    if (event.data.type && event.data.type === 'CACAO_BODY_FETCH') {
        window.postMessage({
            type: 'CACAO_BODY_CHUNK',
            chunk: 'Hello123',
            id: event.data.id,
        }, '*');
        window.postMessage({
            type: 'CACAO_BODY_CHUNK',
            chunk: undefined,
            id: event.data.id,
        }, '*');
    }
});

const scr = document.createElement("script");
scr.src = browser.extension.getURL('cacao-client.js');
(document.head || document.documentElement as any).appendChild(scr);
