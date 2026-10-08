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
| `pnpm check`                                              | TypeScript, ESLint, 40 Vitest tests and production frontend build passed                                     |
| `pnpm format:check`                                       | Prettier passed                                                                                              |
| `pnpm check:rust`                                         | rustfmt, Clippy with warnings denied, 7 Rust tests passed                                                    |
| `pnpm tauri build --debug --no-bundle --ci -- --locked`   | Debug desktop build passed; native interaction suite passed                                                  |
| `pnpm package:linux`                                      | Optimized Debian and AppImage builds succeeded; both full native suites passed                               |
| `test-results/tooling/actionlint -shellcheck= -pyflakes=` | Actionlint 1.7.12 checked workflow syntax and expressions; optional external linters were disabled           |
| `python3 -m py_compile scripts/*.py`                      | Python harnesses compile                                                                                     |
| `python3 scripts/inspect_packages.py`                     | Package identity, runtime dependencies, files and type-2 AppImage header checked; SHA-256 manifest generated |

The actual native suite checks the GTK picker, GTK URI drag source, Unicode/spaced paths, decoded local PNG, relative Markdown navigation, appearances, search/zoom, computed Persian/LTR directions, resizing, relative startup and second-instance CLI, file writes/atomic replacement/deletion/recovery, refresh scroll preservation, denied unrestricted filesystem IPC and rejected origin navigation. Fixture hashes are asserted unchanged. A private D-Bus session without service activation prevents interaction with the user's Mivu instance or host portal/keyring services. Accessibility-bus warnings in this isolated harness are expected; assistive-technology acceptance remains manual. The Debian mode extracts into an isolated XDG tree, validates its desktop entry, rebuilds only that private MIME database, identifies both extensions, and launches through `gio`. This is not a host dpkg installation or a human double-click test.

## Desktop table-layout regression

The post-merge table fix is checked against `tests/fixtures/tables.md`, a representative eight-column table, mixed Persian/English cells, and a long unbroken identifier. The native WebKit regression fails against the original release binary because headers and short values wrap into multiple lines. With the fix it passes in light/dark themes at 1000 and 560 pixel window widths, plus 180% reading zoom: labels stay on one line, descriptions retain readable line lengths, cell padding prevents overlap, wide tables scroll locally, and the reader does not overflow. The full native interaction suite also passes. Captures are generated under `test-results/tables-after/`; the user's original private document was not opened or copied.

## Desktop mixed-direction regression

`tests/fixtures/mixed-rtl.md` reproduces English-prefixed Persian paragraphs and bullets, an English paragraph containing a Persian quotation, opposite-direction nested lists, inline code/URLs, a blockquote and table cells. The original preview binary fails the native regression: the first two paragraphs and four bullets are LTR, with no RTL list indentation. The updated debug binary passes the full suite in both themes at 1000/560 pixel widths, including 180% zoom, English phrase geometry, list indentation, LTR code, unchanged search text and containment. Maximum zoom exposed mixed-list markers overflowing their parent; assigning logical indentation to each item fixes it. Automatic direction remains a word-share heuristic; the original private document was not opened or copied.

The rebuilt Zorin/Ubuntu 24.04 `.deb` also passed the complete extracted-package native suite and apt reinstall simulation. It is 3,691,380 bytes, requires glibc >= 2.39, and has SHA-256 `ed4e6afc992b1d603b935ad0ad79b4ac9054222d00d3baf1a4bd7ef955f0c180`. Its metadata and integration files were checked; this is local package evidence, not a host installation or an AppImage rebuild. The existing published preview assets remain unchanged.

## Performance methodology

The recorded benchmarks below predate the table and mixed-direction fixes and have not been rerun for these changes.

`pnpm bench` measures synchronous parse/highlight/sanitize/DOM-fragment creation in jsdom using representative GFM. Three minimum samples are not a statistical performance guarantee. These results must not be presented as native browser latency.

`pnpm bench:native` runs the optimized binary with an isolated profile/display, generates approximately 8/64/512/2048 KiB of dense repeated GFM, and takes three samples each. Source contains tables, code, tasks and a small local PNG. It waits for `aria-busy=false`, records the first heading's DOM appearance separately, and samples a 50 ms timer to observe main-thread scheduling gaps. Image decoding can finish later. Startup includes WebDriver session negotiation and warm OS caches; it is not a disk-cold timing. RSS sums the application/WebKit descendants, double-counting shared pages, one second after rendering. The desktop host is not a controlled benchmark lab.

Initial measurements revealed multi-second synchronous blocking. Parsing/highlighting was moved to a cancellable worker, and sanitized complete blocks are inserted with animation-frame backpressure. This improves interactivity while trading some total completion time for yielding. An experimental per-element CSS `content-visibility` optimization regressed dense-document rendering (512 KiB took about 7.4 seconds and 2 MiB exceeded the 30-second harness deadline); it was not included.

Final baselines from 2026-10-08 are retained in [native JSON](benchmarks/native-zorin18.1.json) and [frontend JSON](benchmarks/frontend-zorin18.1.json), including environment and provenance. Native runs were sequential with no concurrent build or microbenchmark. The optimized executable was built from the application code in commit `40ede98`; later benchmark/config changes did not change application code or generated frontend assets.

| Dense GFM size | Median complete open | Median first heading in DOM | Summed process-tree RSS |
| -------------- | -------------------- | --------------------------- | ----------------------- |
| 8 KiB          | 114.81 ms            | 99.60 ms                    | 469.32 MiB              |
| 64 KiB         | 204.05 ms            | 134.38 ms                   | 546.20 MiB              |
| 512 KiB        | 1080.43 ms           | 276.89 ms                   | 778.97 MiB              |
| 2048 KiB       | 5855.98 ms           | 669.07 ms                   | 1232.96 MiB             |

Process-cold startup samples were 1983.94, 977.34, 991.51 ms (median 991.51 ms). Empty-view summed RSS was 439.42 MiB. Refresh samples were 386.96, 380.17, 371.20 ms (median 380.17 ms), including debounce and complete rendering. The largest observed interval of the 50 ms timer was 196 ms. These RSS values double-count shared pages and are not unique physical memory or a disk-cold startup measurement.

The jsdom microbenchmark mean fragment-creation times were 37.28 ms for 8 KiB, 226.78 ms for 64 KiB, and 1975.38 ms for 512 KiB. It does not model worker scheduling or WebKit layout. Only the repository's tests directory is included, so an ignored fresh-clone smoke checkout cannot silently duplicate benchmark execution.

## Package verification

Local final candidates: `Mivu_0.1.0_amd64.deb` (3,691,006 bytes) and `Mivu_0.1.0_amd64.AppImage` (85,309,944 bytes). Both passed the full GTK/WebKit native suite, including relative startup/relaunch, image decoding, drop, watch recovery, graceful native window close, and security assertions. [The local artifact manifest](package-manifest.json) records SHA-256 checksums and dependencies. These checksums apply to local Zorin builds, not separately generated CI artifacts.

Debian installs `/usr/bin/mivu`, the Mivu desktop launcher, hicolor icons, Markdown MIME XML and the original MIT license. Maintainer scripts update desktop/MIME databases without changing user defaults. Local metadata conservatively requires `libc6 >= 2.39`, matching the binary's highest GLIBC symbol. The local packages are for the Ubuntu 24.04/Zorin baseline; they cannot establish Ubuntu 22.04 or Debian 12 compatibility.

AppImage bundling uses upstream Linuxdeploy tools and extraction mode on this host. Testing found that AppRun changed the working directory, breaking relative CLI arguments. Mivu restores the runtime-provided original directory (`OWD`, falling back to preserved `PWD` for older extraction runtimes) before single-instance initialization, captures it for initial arguments, and returns to AppRun's directory before constructing the WebKit view. This preserves the bundled library's relative helper-process paths. The full AppImage native suite is the regression check. FUSE mounting and a clean different host remain separate acceptance checks.

## CI and reproducibility

The Ubuntu 22.04 Actions run at `83da12d` passed frozen installation, frontend/Rust checks, the complete debug native suite, and production packaging. Its extracted-package test exposed a harness assertion using `xdg-mime`, whose headless generic backend returned `text/plain` rather than consulting the shared MIME database. The harness now checks GIO's `standard::content-type`, matching GNOME file-manager behavior. The corrected workflow also tests the AppImage directory/close regression. Consult [GitHub Actions](https://github.com/aminbahrabadi/mivu/actions) and the candidate PR for the final run's status and independently built artifacts.

A separate fresh local clone passed frozen dependency installation and frontend checks. The native CI job builds from a fresh checkout. This does not establish human installation acceptance or a fully offline dependency-installation workflow.

## Remaining manual acceptance

- Clean-system apt installation/removal, actual file-manager Open With/default selection/double-click, and verifying unchanged host defaults.
- Human long-session reading, mixed-language punctuation review, screen-reader behavior and keyboard-only acceptance.
- Actual fractional-scale monitors and complete Wayland/Xorg foreground/drag behavior. Automated startup and 2× layout checks alone do not establish these.
- Ubuntu 22.04/Debian 12 installation using an older-host CI artifact; Windows/macOS are future targets.

The maintainer explicitly authorized publishing desktop v0.1.0 before these manual checks, with acceptance to follow installation. The [tagged release](https://github.com/aminbahrabadi/mivu/releases/tag/v0.1.0) uses independently built Ubuntu 22.04 CI artifacts after automated checks and checksum verification. Release asset checksums, rather than the local-build hashes above, identify those downloads. Publication does not establish completion of the outstanding checks or support for untested distributions.

## Known limits

Dense multi-megabyte GFM still creates a large DOM and consumes substantial WebKit memory. Worker parsing is cancellable, but a single very large block and DOM insertion can cause scheduling delays. Source/image byte limits and image-count budgets reduce resource use; they do not eliminate denial-of-service or compressed-image dimension risks. Local SVG/remote images, references outside the initially selected folder, and non-UTF-8 filenames are deliberately unsupported. Use the Open dialog to establish a different folder boundary.
