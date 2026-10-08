# Security policy

Mivu 0.1.x is under release validation. Report vulnerabilities against the latest source or candidate artifact; older candidates may contain fixed issues.

## Reporting

Use the repository's [Security tab](https://github.com/aminbahrabadi/mivu/security) to submit a private vulnerability report when GitHub private reporting is available. If it is unavailable, open a minimal issue requesting a private contact channel without posting exploit details, private paths, or document contents. Do not publish a working exploit before the maintainer has had a chance to investigate.

Include the version/commit, distribution and WebKitGTK version, attack requirements, observed impact, and a minimal synthetic Markdown fixture. Remove sensitive information. There is no promised response SLA for this volunteer project.

## Threat model

Markdown and every resource reference are untrusted. Mivu never edits source files or executes document code. It uses raw-HTML-disabled Markdown parsing, an HTML allowlist sanitizer, a restrictive CSP, native navigation rejection, limited IPC capabilities, bounded reads, raster signature checks, and capability-based local directories. External browser/mail links require an explicit user click; remote document images and fonts are never fetched automatically.

The canonical model, limits, and remaining validation are in [README.md](README.md#security-model). Keep the operating system and WebKitGTK updated. These defenses do not isolate Mivu from a compromised operating system, a compromised dependency/build, or a WebKit image-decoder vulnerability. Resource limits reduce excessive allocation but are not a complete denial-of-service sandbox. User selection grants access to that document and relative supported resources inside its parent folder; choose a narrow folder for untrusted collections.
