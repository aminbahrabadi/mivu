# Mivu

**Just read Markdown.**

A minimal, beautiful, read-only Markdown reader. MIT licensed, Linux-first, built with Tauri 2, Rust, and vanilla TypeScript. Version 0.1.0 is in development; it is not yet a validated release.

## Implemented features

- Native open dialog and drag-and-drop, UTF-8 Markdown, friendly errors, Unicode paths.
- Read-only rendering, bounded documents (8 MiB), and Ctrl+O.
- GFM tables, task lists, nested lists, autolinks, syntax highlighting, local Markdown links and PNG/JPEG/GIF/WebP images.
- System/light/dark themes, per-block Persian/English direction, search across formatted text, selection/copy, keyboard reading zoom.
- Startup and single-instance command-line opening, containing-directory watching with debounced automatic refresh and scroll preservation.
- No editing, accounts, telemetry, cloud, plugins, terminals, or remote content loading.

## Screenshots

Actual Mivu WebKit screenshots captured on Zorin OS 18.1 using an isolated X11 display.

![Reader, light appearance](docs/screenshots/reader-light.png)
![Persian and English, dark appearance](docs/screenshots/persian-dark.png)

## Architecture

Rust owns explicitly selected documents. The main window can request the native picker or the current snapshot; it cannot read arbitrary paths. TypeScript receives a revisioned snapshot and renders through markdown-it with raw HTML disabled and DOMPurify sanitization. Failed opens leave the previous document intact. Source files are opened for reading only.

The selected document's parent directory becomes a `cap-std` directory capability. Linked documents and images resolve relative to the active document, inside that original boundary. Traversal and symlink escapes fail even during path replacement. Raster images are size-limited and signature-checked; SVG and remote images are blocked. HTTP(S) and mail links open outside Mivu only on a user click.

## Development setup

Use Node 24, pnpm 12, and Rust stable (1.88 or later). Linux needs GTK 3, WebKitGTK 4.1, librsvg, libxdo, OpenSSL, and build tools. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
pnpm check
pnpm check:rust
pnpm package:deb
```

## Implementation roadmap

The durable execution plan is [docs/implementation.md](docs/implementation.md). No unfinished feature is advertised as available.

| Phase | Scope                         | Status                                                            |
| ----- | ----------------------------- | ----------------------------------------------------------------- |
| 0     | Tooling, shell, CI            | Validated                                                         |
| 1     | Native file opening           | Validated                                                         |
| 2     | Secure Markdown rendering     | Validated                                                         |
| 3     | Reading experience and RTL    | Validated                                                         |
| 4     | Linux integration and refresh | Native and package smoke validated; manual desktop checks pending |
| 5     | Security and robustness       | Pending                                                           |
| 6     | Tests and performance         | Pending                                                           |
| 7     | Packaging and release CI      | Pending                                                           |

## License

[MIT](LICENSE). Copyright 2026 Amin Bahrabadi.
