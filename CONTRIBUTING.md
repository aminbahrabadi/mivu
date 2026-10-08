# Contributing to Mivu

Mivu's scope is reading Markdown well. Start with [README.md](README.md), which contains setup, architecture, security boundaries, tests, and the release checklist.

For a bug, include the Mivu version/commit, application (Desktop or Firefox), OS and WebKitGTK/Firefox version, reproduction steps, and a small synthetic fixture. Never upload private documents. For a feature, discuss how it improves reading before implementing it; editing, accounts, telemetry, and plugin systems are outside the product scope. Report vulnerabilities through [SECURITY.md](SECURITY.md).

Create a feature branch from main, make focused Conventional Commits, and open a PR with the problem, resulting behavior, and validation evidence. Keep unrelated files untouched and preserve the MIT license. Explain changes to dependencies, IPC, resource boundaries, or packaging. Update README.md and CHANGELOG.md for user-visible changes.

Use strict TypeScript and plain CSS, Prettier for web/config/docs, rustfmt and Clippy for Rust. Prefer small modules and existing patterns; no frontend framework or speculative layers. Source documents must remain read-only.

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
pnpm check
pnpm format:check
pnpm check:rust
pnpm tauri build --debug --no-bundle
pnpm test:native
pnpm package:deb
```

Native tests need the documented Linux test packages and an isolated X11 display. Test fixtures live in tests/fixtures; use realistic English/Persian examples and adversarial cases. Tests must check behavior rather than copy the implementation. Describe manual tests separately from automation, especially Wayland, file-manager associations, assistive technology, and high-DPI displays.

Reviewers check source-file integrity, privacy, accessibility, edge cases, reproducibility, and whether every new dependency and abstraction is necessary. Follow [AGENTS.md](AGENTS.md) when using coding agents. Never force-push shared history or publish unverified release artifacts.

## Firefox contributions

Start with [firefox/README.md](firefox/README.md). Packaging needs only Python's
standard library; safety tests use Node without installs. Full reader tests reuse
the existing root jsdom development dependency:

```sh
pnpm install --frozen-lockfile
node --test firefox/tests/*.test.mjs
python3 -m unittest discover -s firefox/tests -p 'test_*.py' -v
python3 firefox/tools/build_amo.py
npm exec --yes --package=web-ext@10.7.0 -- web-ext lint --source-dir firefox/app
python3 firefox/tools/browser_smoke.py  # Firefox + geckodriver 0.37.1
```

Temporarily load the manifest through about:debugging and follow the extension's
manual smoke checklist. Report browser automation, OS drag, toolbar/keyboard and
human RTL/accessibility checks separately. Do not upload private documents or use
a personal Firefox profile for automation.

Preserve zero API/host permissions, no data collection, local assets, read-only
inputs and third-party notices. Do not edit the historical runtime while retaining
version 0.1.0; any runtime correction needs a new manifest version. Keep submitted
artifact hashes intact. Library updates must explain upstream provenance, local
modifications and reproducible reviewer sources. Root formatters skip historical
runtime; extension syntax, behavioral and package checks validate it separately.

Desktop and Firefox versions evolve independently, with no speculative shared
runtime package. Until the Desktop integration is merged, the Firefox integration
PR targets feat/linux-v0.1; rebase/retarget deliberately after that dependency is
resolved, without rewriting shared history. Never publish to AMO automatically.
