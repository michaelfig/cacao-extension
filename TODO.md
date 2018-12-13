* Blocking Chrome issue: Proxy PAC scripts are not called for localhost (or 127.0.0.1).  This means that Cacao cannot be used for its intended function: to allow the fetch API to fetch localhost URLs that are proxied to remote hosts.

* Blocking Firefox issue: a webextension cannot set "Access-Control-Allow-Origin: *" in browser.webRequest.onHeadersReceived: it is simply ignored.  This means Cacao cannot be used for its intended function: to allow the fetch API to fetch localhost URLs that are cross-origin.

* Report the above issues and make note of their issue number in the point above.

* After those issues are resolved, implement a options_ui page.  Add the "storage" manifest permission, and use it to communicate options.  See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/options_ui

* Fix the Cacao icons to be cacao48.ico, cacao96.ico instead of cacao.svg so that it works on Chrome.
