* Map URLs to backend fetch parameters, so we can properly proxy any kind of Fetch URL.

* Remove cacao Fetch option (including 'downgrade'), and just use http://127.0.0.1:9000/* URIs to achieve mixed content.  Test with HTTPS.

* Implement an options_ui page.  Add the "storage" manifest permission, and use it to communicate options.  See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/options_ui

* Add a `X-Cacao-Forwarded: <URL>` and `X-Cacao-Implementation: Cacao Browser Extension's Fetch API` header, adding to `Access-Control-Expose-Headers`.
