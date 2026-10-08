# Contributing to Mivu

Mivu's scope is reading Markdown well. Start with [README.md](README.md), which contains setup, architecture, security boundaries, tests, and the release checklist.

For a bug, include the Mivu version/commit, OS and WebKitGTK version, reproduction steps, and a small synthetic fixture. Never upload private documents. For a feature, discuss how it improves reading before implementing it; editing, accounts, telemetry, and plugin systems are outside the product scope. Report vulnerabilities through [SECURITY.md](SECURITY.md).

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
