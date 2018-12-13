# Cacao (CORS Access-Control-Allow-Origin) Browser Extension

Cacao is a Cross-Origin (CORS) proxy.  It allows Javascript running in a web browser to access a remote HTTP resource without cross-origin restrictions.  It runs on several different platforms, and essentially works by adding a `Access-Control-Allow-Origin: *` header to an HTTP response.

This Cacao extension is for Chrome and Firefox browsers.  For now, you can:

1. Run:
```
$ npm install
$ npm run build
```

2. Then:
- On Chrome, go to `chrome://extensions` and `Load unpacked`
- On Firefox, go to `about:debugging` and `Load Temporary Add-on...`

3. Enjoy the bugs!  (See below.)

## FIXME: State of Brokenness

This extension does not currently work as intended.  See TODO.md.

## Current Architecture

The Cacao extension's architecture is to redirect http://localhost:9000/SOME-PATH to http://localhost:SOME-PORT/SOME-OTHER-PATH in the webextension, then use a PAC proxy script (also managed by the Cacao extension) to intercept http://localhost:SOME-PORT requests and proxy them to a different host.

See [Cacao Proxy](https://github.com/michaelfig/cacao) for more details.

Michael FIG <michael+cacao@fig.org>, 2018-12-12
