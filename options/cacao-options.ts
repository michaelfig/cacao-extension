(function() {
    const defaultSettings : CacaoSettings = {
        whitelist: ['*://localhost:8080/publish.html'],
        magic: ['localhost:9000', '127.0.0.1:9000'],
        pathMap: {'': 'https://example.com'},
        whitelistDebug: false,
    };
    
    const whitelist: HTMLTextAreaElement = document.querySelector('#whitelist');
    const magic: HTMLTextAreaElement = document.querySelector('#magic');
    const mappings: HTMLTextAreaElement = document.querySelector('#mappings');
    const whitelistDebug: HTMLInputElement = document.querySelector('#whitelistDebug');
    const save: HTMLButtonElement = document.querySelector('#save');
    const reset: HTMLButtonElement = document.querySelector('#reset');

    save.addEventListener('click', actualStoreSettings);
    reset.addEventListener('click', resetSettings);
    
    if (false) {
        whitelist.addEventListener('change', debounceStoreSettings);
        magic.addEventListener('change', debounceStoreSettings);
        mappings.addEventListener('change', debounceStoreSettings);
        whitelistDebug.addEventListener('click', debounceStoreSettings);
    }

    let debounce = 0;
    function debounceStoreSettings() {
        console.log('debounceStoreSettings');
        if (debounce) {
            clearTimeout(debounce);
        }
        debounce = setTimeout(actualStoreSettings, 3000);
    }

    function actualStoreSettings() {
        console.log('actualStoreSettings');
        debounce = 0;
        storeSettings();
    }

    function resetSettings() {
        const settings = defaultSettings;
        browser.storage.local.set(settings)
            .then(() => updateUI(settings));
    }

    function storeSettings() {
        const pathMap: {[path: string]: string} = {};
        mappings.value.split('\n').forEach(pm => {
            if (pm.match(/^\s*$/)) {
                return;
            }
            const match = pm.match(/^((\/[^:=]+)=)(.*)$/);
            if (match) {
                const path = match[2] || '';
                pathMap[path] = match[3];
            }
            else {
                pathMap[''] = pm;
            }
        });

        const settings: CacaoSettings = {
            whitelist: whitelist.value.split('\n').filter(s => !s.match(/^\s*$/)),
            magic: magic.value.split('\n').filter(s => !s.match(/^\s*$/)),
            pathMap,
            whitelistDebug: whitelistDebug.checked,
        };

        browser.storage.local.set(settings)
            .then(() => updateUI(settings));
    }

    function updateUI(restoredSettings: CacaoSettings) {
        const settings = {
            ...defaultSettings,
            ...restoredSettings
        };

        whitelist.value = settings.whitelist.join('\n');
        magic.value = settings.magic.join('\n');
        mappings.value = Object.entries(settings.pathMap).map(([key, value]) => {
            if (key) {
                return `${key}=${value}`;
            }
            return value;
        }).join('\n');
        whitelistDebug.checked = settings.whitelistDebug;
    }

    function onError(e: any) {
        console.error(e);
    }

    browser.storage.local.get().then(updateUI, onError);
})();
