# Mivu for Firefox 0.1.0 — AMO source (security revision)

This is the exact standalone, permission-free runtime distributed in the accompanying AMO ZIP, plus reproducible offline packaging scripts. All execution assets are in `app/`.

## Build (Python 3 only, no npm)

```bash
cd firefox
python3 tools/build_amo.py
```

Upload only `dist/mivu-firefox-AMO-upload-v0.1.0-security-fixed.zip`, not this source ZIP.

## Privacy

The extension declares zero API and host permissions. It does not access web pages, browsing history, clipboard, or files unless chosen via a file input / drag and drop. No telemetry, automatic downloads, or remote scripts. The Firefox extension data collection declaration is `none`.

## Rendering security

1. Marked's raw HTML renderer is disabled.
2. Markdown HTML is parsed with DOMParser into an inert document.
3. An explicit tag/attribute allowlist removes dangerous nodes, event handlers, and unsafe links.
4. Only sanitized DOM nodes are imported and appended. No `innerHTML` assignment.
5. Selected raster images are signature-checked and inserted as local `blob:` objects. Network image requests are disallowed by CSP.
6. Legacy `highlightElement()` in the *bundled* highlight.js 11.0.1 file is patched to assign `textContent` instead of `innerHTML`; Mivu does not use `highlightElement()`. Its `highlight()` function is unaffected and syntax highlighting remains enabled.

## Third-party assets

- Marked 4.0.19 (`app/vendor/marked.js`), MIT license. See `app/vendor/LICENSE-marked.txt`.
- highlight.js 11.0.1 (`app/vendor/highlight.min.js`), BSD 3-Clause. See `app/vendor/LICENSE-highlight.txt`. Single-source safety patch described above.

These offline vendored libraries are compatibility assets; update them to current supported versions before a future feature release. Keep the shipped runtime and published source synchronized. For future source development, prefer the modern `markdown-it` + DOMPurify project if its bundled outputs are independently tested and AMO-validated.

## Testing

`python3 tools/build_amo.py` performs basic structural/static checks. Run full browser and adversarial Markdown tests before publishing. Static checks cannot replace a Mozilla AMO validation run and human security review.
