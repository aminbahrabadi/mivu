# Security policy

Mivu Desktop 0.1.x is under release validation. Firefox 0.1.0 is a historical submission awaiting Mozilla review; its runtime is preserved in the repository. Report the affected application and exact version/commit/artifact. Repository integration does not silently patch that submitted package.

## Reporting

Use the repository's [Security tab](https://github.com/aminbahrabadi/mivu/security) to submit a private vulnerability report when GitHub private reporting is available. If it is unavailable, open a minimal issue requesting a private contact channel without posting exploit details, private paths, or document contents. Do not publish a working exploit before the maintainer has had a chance to investigate.

Include the version/commit, distribution and WebKitGTK or Firefox version, attack requirements, observed impact, and a minimal synthetic Markdown fixture. Remove sensitive information. There is no promised response SLA for this volunteer project.

## Desktop threat model

Markdown and every resource reference are untrusted. Mivu never edits source files or executes document code. It uses raw-HTML-disabled Markdown parsing, an HTML allowlist sanitizer, a restrictive CSP, native navigation rejection, limited IPC capabilities, bounded reads, raster signature checks, and capability-based local directories. External browser/mail links require an explicit user click; remote document images and fonts are never fetched automatically.

The canonical model, limits, and remaining validation are in [README.md](README.md#security-model). Keep the operating system and WebKitGTK updated. These defenses do not isolate Mivu from a compromised operating system, a compromised dependency/build, or a WebKit image-decoder vulnerability. Resource limits reduce excessive allocation but are not a complete denial-of-service sandbox. User selection grants access to that document and relative supported resources inside its parent folder; choose a narrow folder for untrusted collections.

## Firefox threat model

The standalone extension accepts only explicitly selected/dropped browser Files.
It has zero API/host permissions, no content scripts, no visited-site access,
native messaging, uploads or remote scripts. Marked suppresses raw HTML; a DOM
allowlist strips active/namespace markup, handlers and clobbering attributes before
importing nodes. Links are restricted and images are placeholders until matching,
validated rasters are selected explicitly. Blob URLs are revoked as the reader
switches/closes. Only theme preference is stored locally.

CSP denies network connections and active embedding; browser HTTP(S)/mail
navigation is allowed following a user click. Browser parsing and image decoding
remain trust dependencies. Synchronous large-document processing and decoded
image dimensions are not a complete DoS boundary. The submitted image-selection
race and custom highlighter provenance gap are documented in the
[Firefox implementation review](firefox/docs/audit.md), with exact dependency
[notices/advisory checks](firefox/third-party/README.md). Passing tests or Mozilla
lint is not a claim of vulnerability freedom or store approval.

Use the same private reporting process for browser and native issues. Include the
manifest/Firefox version, whether interaction was required, and a synthetic
Markdown/image fixture. Any fix to Firefox runtime requires a new version and
separate verified submission; never replace historical release evidence. Keep
Firefox and the host OS updated. See [Firefox's security model](firefox/README.md#security-model)
for current limits and remaining browser acceptance checks.
