# Mivu

**Just read Markdown.**

A minimal, beautiful, read-only Markdown reader. MIT licensed, Linux-first, built with Tauri 2, Rust, and vanilla TypeScript. Version 0.1.0 is in development; it is not yet a validated release.

## Development

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

| Phase | Scope                         | Status    |
| ----- | ----------------------------- | --------- |
| 0     | Tooling, shell, CI            | Validated |
| 1     | Native file opening           | Pending   |
| 2     | Secure Markdown rendering     | Pending   |
| 3     | Reading experience and RTL    | Pending   |
| 4     | Linux integration and refresh | Pending   |
| 5     | Security and robustness       | Pending   |
| 6     | Tests and performance         | Pending   |
| 7     | Packaging and release CI      | Pending   |

## License

[MIT](LICENSE). Copyright 2026 Amin Bahrabadi.
