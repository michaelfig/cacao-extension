# Cacao (CORS Access-Control-Allow-Origin) Browser Extension

Cacao is a Cross-Origin (CORS) proxy.  It allows Javascript running in a web browser to access a remote HTTP resource without cross-origin restrictions.  It runs on several different platforms, and essentially works by adding a `Access-Control-Allow-Origin: *` header to an HTTP response.

This Cacao Browser Extension is for Chrome and Firefox browsers.  It may work on Edge, but it has not yet been tested.

The production release of the extension is available from:

* [Chrome Web Store](https://chrome.google.com/webstore/detail/cacao-cors-proxy/ghkpkeholelocigdnkijbhilchjekppk)
* [Firefox Add-ons](https://addons.mozilla.org/en-CA/firefox/addon/cacao-cors-proxy/)

To run a development copy from this source tree, you can:

1. Run:
```
$ npm install
$ npm run build
```

2. Then:
- On Chrome, go to `chrome://extensions` and `Load unpacked`
- On Firefox, go to `about:debugging` and `Load Temporary Add-on...`

3. Go to the Cacao extension options page (about:addons on Firefox) and configure your proxy settings.

Note in Chrome that to use the extension on HTTPS sites, you will need to click the "shield" icon to allow the Cacao script to mix HTTP and HTTPS content.  This step is not necessary for Firefox.

## Current Architecture

The Cacao Browser Extension's architecture is to implement an interceptor for the Fetch API, then to tunnel requests for "magic hostports" to the content script, where it can bypass CORS.

See [Cacao Proxy](https://github.com/michaelfig/cacao) for more details.

Michael FIG <michael+cacao@fig.org>, 2018-12-12
