# v0.1.0 validation record

This is evidence for release consideration, not a declaration of a fully validated release. README.md remains canonical for product behavior and architecture.

## Environment

- Zorin OS 18.1, Ubuntu noble base; Linux 7.0.0-38-generic, x86_64.
- Intel Core i7-12650H; glibc 2.39; GTK 3.24; WebKitGTK 2.52.6.
- Node 24.12.0, pnpm 12.10.1, Rust 1.92.0. Locked dependencies currently require Rust >= 1.90; the minimum compiler itself has not been separately tested.
- Native interaction automation uses Xvfb/X11. A separate startup/layout smoke uses the real Wayland session. GDK_SCALE=2 is checked on X11. No kernel/GPU/system-upgrade changes were made.

## Automated checks

| Command                                                   | Evidence                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                          | Dependency installation and locked resolution succeeded                                                      |
| `pnpm check`                                              | TypeScript, ESLint, 33 Vitest tests and production frontend build passed                                     |
| `pnpm format:check`                                       | Prettier passed                                                                                              |
| `pnpm check:rust`                                         | rustfmt, Clippy with warnings denied, 7 Rust tests passed                                                    |
| `pnpm tauri build --debug --no-bundle --ci -- --locked`   | Debug desktop build passed; native interaction suite passed                                                  |
| `pnpm package:linux`                                      | Optimized Debian and AppImage builds succeeded; final artifact retest recorded below                         |
| `test-results/tooling/actionlint -shellcheck= -pyflakes=` | Actionlint 1.7.12 checked workflow syntax and expressions; optional external linters were disabled           |
| `python3 -m py_compile scripts/*.py`                      | Python harnesses compile                                                                                     |
| `python3 scripts/inspect_packages.py`                     | Package identity, runtime dependencies, files and type-2 AppImage header checked; SHA-256 manifest generated |

The actual native suite checks the GTK picker, GTK URI drag source, Unicode/spaced paths, decoded local PNG, relative Markdown navigation, appearances, search/zoom, computed Persian/LTR directions, resizing, startup and second-instance CLI, file writes/atomic replacement/deletion/recovery, refresh scroll preservation, denied unrestricted filesystem IPC and rejected origin navigation. Fixture hashes are asserted unchanged. The Debian mode extracts into an isolated XDG tree, validates its desktop entry, rebuilds only that private MIME database, identifies both extensions, and launches through `gio`. This is not a host dpkg installation or a human double-click test.

## Performance methodology

`pnpm bench` measures synchronous parse/highlight/sanitize/DOM-fragment creation in jsdom using representative GFM. Three minimum samples are not a statistical performance guarantee. These results must not be presented as native browser latency.

`pnpm bench:native` runs the optimized binary with an isolated profile/display, generates approximately 8/64/512/2048 KiB of dense repeated GFM, and takes three samples each. Source contains tables, code, tasks and a small local PNG. It waits for `aria-busy=false`, records the first heading's DOM appearance separately, and samples a 50 ms timer to observe main-thread scheduling gaps. Image decoding can finish later. Startup includes WebDriver session negotiation and warm OS caches; it is not a disk-cold timing. RSS sums the application/WebKit descendants, double-counting shared pages, one second after rendering. The desktop host is not a controlled benchmark lab.

Initial measurements revealed multi-second synchronous blocking. Parsing/highlighting was moved to a cancellable worker, and sanitized complete blocks are inserted with animation-frame backpressure. This improves interactivity while trading some total completion time for yielding. An experimental per-element CSS `content-visibility` optimization regressed dense-document rendering (512 KiB took about 7.4 seconds and 2 MiB exceeded the 30-second harness deadline); it was not included.

Final measurements are stored alongside this report after the final optimized rebuild. Raw harness output belongs in ignored `test-results/`; selected baseline JSON is retained in docs/benchmarks for reproducibility.

## Package verification

Debian installs `/usr/bin/mivu`, the Mivu desktop launcher, hicolor icons, Markdown MIME XML and the original MIT license. Maintainer scripts update desktop/MIME databases without changing user defaults. Local metadata conservatively requires `libc6 >= 2.39`, matching the binary's highest GLIBC symbol. The local packages are for the Ubuntu 24.04/Zorin baseline; they cannot establish Ubuntu 22.04 or Debian 12 compatibility.

AppImage bundling uses upstream Linuxdeploy tools and extraction mode on this host. Testing found that AppRun changed the working directory, breaking relative CLI arguments. Mivu restores the runtime-provided original directory (`OWD`, falling back to preserved `PWD` for older extraction runtimes) before single-instance initialization; the full AppImage native suite is the regression check. FUSE mounting and a clean different host remain separate acceptance checks.

## Remaining release gates

- Clean-system apt installation/removal, actual file-manager Open With/default selection/double-click, and verifying unchanged host defaults.
- Human long-session reading, mixed-language punctuation review, screen-reader behavior and keyboard-only acceptance.
- Actual fractional-scale monitors and complete Wayland/Xorg foreground/drag behavior. Automated startup and 2× layout checks alone do not establish these.
- Ubuntu 22.04/Debian 12 installation using an older-host CI artifact; Windows/macOS are future targets.
- Public tagged release publication. No tag or public release is created during implementation.

## Known limits

Dense multi-megabyte GFM still creates a large DOM and consumes substantial WebKit memory. Worker parsing is cancellable, but a single very large block and DOM insertion can cause scheduling delays. Source/image byte limits and image-count budgets reduce resource use; they do not eliminate denial-of-service or compressed-image dimension risks. Local SVG/remote images, references outside the initially selected folder, and non-UTF-8 filenames are deliberately unsupported. Use the Open dialog to establish a different folder boundary.
