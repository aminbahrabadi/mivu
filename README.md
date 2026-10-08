# Mivu

**Just read Markdown.**

A minimal, beautiful, read-only Markdown reader, available as a Linux-first desktop application and a permission-free Firefox extension. Both keep documents local, with no accounts, telemetry, uploads or network-loaded assets. Open source under the MIT license.

**Desktop v0.1.0 is a release candidate under validation, not a published stable release.** Native WebKit automation runs on Zorin OS 18.1. Human desktop acceptance and older-distribution compatibility remain release gates; see [validation](#validation-and-manual-desktop-checklist).

## Available applications

- **Mivu Desktop:** Tauri 2, Rust and vanilla TypeScript. Linux-first, with native
  file handling, constrained relative resources and external-change refresh.
- **Mivu for Firefox:** Manifest V3, standalone JavaScript, browser-selected files,
  Marked and locally bundled highlight.js. **Firefox 0.1.0 is submitted to Mozilla
  and awaiting review** according to the supplied submission record; no public AMO
  listing is verified yet. It works without Desktop installed and declares no API
  or host permissions. See [Firefox setup, architecture and release evidence](firefox/README.md).

Versions and release gates are independent. Shared product/design standards are
conceptual; these applications have separate runtime implementations.

| Capability                                     | Desktop candidate                         | Firefox submitted 0.1.0                           |
| ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Explicit Markdown selection and file drop      | Native picker/drop                        | Browser file input/drop                           |
| GFM and inert task lists                       | Implemented                               | Implemented                                       |
| Code highlighting                              | 8 colored language grammars               | 34 tokenizing grammars; current CSS is monochrome |
| Light/dark/system and Persian/Arabic blocks    | Implemented; LTR code                     | Implemented; LTR code                             |
| Search and reading zoom                        | Across inline formatting; 2,000-match cap | Per text node; 500-match cap                      |
| Local raster images                            | Constrained directory capability          | Explicitly select images; basename matching       |
| Local Markdown/heading links                   | Validated open / anchor scroll            | Inactive text; reopen files explicitly            |
| External HTTP(S)/mail links                    | System handler after click                | Browser/mail navigation after click               |
| Automatic external-file refresh                | Implemented                               | Unavailable under this file-selection model       |
| CLI, Linux Open With and MIME registration     | Implemented; installed acceptance pending | Outside extension responsibilities                |
| Remote image loads, editing, accounts, uploads | Excluded                                  | Excluded                                          |

Capabilities were inspected and automated checks were run; human/platform
acceptance and historical dependency provenance limits remain explicit in each
application's validation report.

## Desktop features

Implemented:

- Native file picker, drag-and-drop, `.md` and `.markdown`, UTF-8 and Unicode paths.
- Startup file arguments and forwarding to the existing application window.
- GFM headings, tables, nested lists, disabled task lists, strikethrough, autolinks, links, and images.
- Syntax highlighting for Bash, CSS, JavaScript, JSON, Python, Rust, TypeScript, and XML/HTML; other languages remain readable plain code.
- Constrained relative Markdown links and local PNG/JPEG/GIF/WebP images.
- System, light, and dark themes; comfortable typography, scrolling, text selection and copying.
- Persian, Arabic-script, English, and mixed-language blocks; code remains left-to-right.
- Literal document search, keyboard shortcuts, and reading zoom.
- Debounced external-change refresh, including atomic saves, with scroll preservation.
- Debian/AppImage packaging configuration, desktop entry, and Markdown MIME registration.

Remote images, SVG images, raw HTML, editing/saving, code execution, accounts, cloud synchronization, databases, telemetry, plugins, and terminals are intentionally outside v0.1. Mermaid diagrams and mathematics are proposed future features, not currently rendered.

## Screenshots

Actual Mivu screenshots from the Linux WebKit window on an isolated X11 display on Zorin OS 18.1. These are application captures, not mockups.

![Light reader](docs/screenshots/reader-light.png)
![Persian and English in dark mode](docs/screenshots/persian-dark.png)

## Installation

Use artifacts from an intentionally tagged, verified release when available. No stable release has been published as part of this implementation. Build locally with the commands below if you want to evaluate the candidate.

### Desktop: Debian / Ubuntu / Zorin

From the directory containing the package:

```sh
sudo apt install ./Mivu_0.1.0_amd64.deb
mivu README.md
```

The package installs `mivu`, a menu launcher, icons, and a MIME definition. GTK 3, WebKitGTK 4.1, libxdo, shared-mime-info, and a suitable glibc are runtime dependencies; apt resolves them. The package records its build host's minimum glibc version conservatively. A package built on Ubuntu 24.04 must not be advertised as Ubuntu 22.04 compatible. CI builds on Ubuntu 22.04 to establish the older baseline; Debian 12 and Ubuntu 22.04 still require actual installation checks before claiming support.

Mivu appears in **Open With**. Installation never changes your default Markdown handler. To make double-clicks open Mivu, select it yourself in the file manager's file-properties/default-application UI.

Uninstall:

```sh
sudo apt remove mivu
```

This removes the application, not your Markdown files. Theme preferences and WebKit caches under your XDG application directories can remain.

### Desktop: AppImage

```sh
chmod +x Mivu_0.1.0_amd64.AppImage
./Mivu_0.1.0_amd64.AppImage README.md
```

AppImage retains the build host's glibc baseline. It does not automatically install desktop associations. If FUSE 2 is unavailable, use the supported extraction mode:

```sh
APPIMAGE_EXTRACT_AND_RUN=1 ./Mivu_0.1.0_amd64.AppImage README.md
```

On Ubuntu 24.04, `libfuse2t64` enables normal FUSE execution. Do not remove your system's FUSE 3 package. Delete the AppImage to uninstall it.

### Firefox

Until Mozilla approves a public listing, use a temporary development installation:
open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**,
and select `firefox/app/manifest.json` or the locally built extension ZIP. Activate
Mivu through its extension action and select/drop Markdown. Temporary installation
ends when Firefox restarts. No desktop package or additional extension permission
is needed. Browser minimum is declared as 128.0; actual automation ran on 155.0.1.
Firefox 128/ESR/Android remain untested. The minimum-version data-declaration
warnings and installation details are in [firefox/README.md](firefox/README.md).

When approved, install from the maintainer's verified Mozilla Add-ons listing;
no approved listing/download URL is claimed here. Remove the extension through
Firefox's Add-ons Manager. Source documents remain untouched.

## Desktop usage

Launch **Mivu** from the application menu, choose **Open**, or drop one Markdown document into the window. Opening another document replaces the current view; Mivu does not save or modify it. Empty files and failed opens have explicit states; a failed open preserves the previous document.

```sh
mivu README.md
mivu '/home/you/Documents/راهنما with spaces.markdown'
```

One file argument is supported, relative to the invoking directory. A second launch sends its file to the existing instance and requests foreground focus; a compositor may restrict focus stealing.

The appearance selector chooses system, light, or dark. The choice persists locally. Filesystem changes refresh automatically after a short debounce. Deleted or unreadable documents show an error while retaining the last readable view; restoration can recover automatically. Reopen a file if its containing directory was moved or a watcher failed.

| Shortcut                       | Action                            |
| ------------------------------ | --------------------------------- |
| Ctrl+O                         | Native open dialog                |
| Ctrl+F                         | Find literal text in the document |
| Enter / Shift+Enter in search  | Next / previous match             |
| Escape                         | Close search                      |
| Ctrl++ / Ctrl+-                | Increase / decrease reading size  |
| Ctrl+0                         | Reset reading size                |
| Ctrl+C                         | Copy selected text                |
| Arrows, Page Up/Down, Home/End | Standard keyboard scrolling       |

The application handles Command in place of Ctrl for its own shortcuts on future macOS builds. Search spans inline formatting, stays inside text blocks, and caps visible results at 2,000, reporting the cap. Reading size ranges from 60% to 180%.

Relative links resolve from the current document directory inside the originally selected document's folder. Clicking a local Markdown link opens it through Rust validation. Heading links scroll inside the view. HTTP(S) and mail links open the system browser/mail application only after a user click. Remote images show a blocked-content placeholder and never fetch automatically.

## Desktop development setup

On Ubuntu 24.04 / Zorin OS 18.1:

```sh
sudo apt update
sudo apt install --no-install-recommends build-essential pkg-config libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev libxdo-dev patchelf python3
```

Install Rust stable with rustup and Node.js 24.12 or later (Node 24 LTS recommended). Rust 1.90 is the declared minimum; the current stable toolchain is used in CI. Install the pinned pnpm version, then clone and run:

```sh
npm install --global pnpm@12.10.1
git clone https://github.com/aminbahrabadi/mivu.git
cd mivu
# Until the implementation PRs are merged:
git switch feat/firefox-extension-integration
pnpm install --frozen-lockfile
pnpm tauri dev
```

If global npm installation is inappropriate, run commands through `npm exec --yes --package=pnpm@12.10.1 -- pnpm ...`. Development serves only on `127.0.0.1:1420`. Production contains the assets and runs offline. Network access is needed to install dependencies and download packaging tools, not to read documents.

For native automated tests:

```sh
sudo apt install --no-install-recommends dbus-daemon webkit2gtk-driver xvfb xauth python3-gi gir1.2-gtk-3.0 x11-utils desktop-file-utils shared-mime-info
pnpm tauri build --debug --no-bundle --ci -- --locked
pnpm test:native
```

The native harness needs Linux X11 and uses Xvfb, the system WebKitWebDriver, and libxdo. No browser download or Node browser framework is required. For real screenshots, pass `--screenshots docs/screenshots` explicitly; normal tests write only ignored `test-results/` artifacts.

## Architecture overview

```mermaid
flowchart TB
  Standards[Shared product standards: read-only, offline privacy, calm typography, RTL]
  Standards -.-> Desktop
  Standards -.-> Firefox
  subgraph Desktop[Desktop runtime]
    Native[Explicit native selection: Rust directory capability] --> MD[Worker: markdown-it and highlight.js]
    MD --> Safe[DOMPurify and native URL/resource validation]
    Safe --> Window[Tauri WebKit reader]
    Watch[Native directory watcher / Linux CLI and MIME] --> Native
  end
  subgraph Firefox[Firefox runtime]
    Action[Permission-free action: own reader tab] --> File[Explicit browser File / selected raster blobs]
    File --> Marked[Marked and bundled highlight.js]
    Marked --> Allowlist[Inert DOM parsing and attribute/element allowlist]
    Allowlist --> Page[Extension reader, restrictive CSP]
  end
  Window -->|user-clicked link| System[System browser/mail]
  Page -->|user-clicked link| Browser[Browser/mail navigation]
```

The dotted connections represent shared standards, not shared code. Native
filesystem capabilities and WebExtensions `File` objects are different trust
boundaries. Neither renderer has arbitrary filesystem or visited-page access.

## Desktop architecture

```mermaid
flowchart LR
  User[Picker, drop, CLI] --> Native[Rust document session]
  Native --> Cap[Read-only directory capability]
  Cap --> Snapshot[Revisioned UTF-8 snapshot]
  Snapshot --> Parser[Worker: markdown-it and highlight.js]
  Parser --> Sanitize[DOMPurify and URL validation]
  Sanitize --> Reader[Vanilla TypeScript reader]
  Reader -->|validated relative reference| Native
  Cap -->|bounded raster bytes| Reader
  Watch[Containing-directory watcher] --> Native
  Native -->|document and error events| Reader
  Reader -->|explicit external-link click| Browser[System browser via Rust]
```

### Responsibilities and state

Rust owns selected paths, the current `OpenDocument`, a directory capability, revision numbers, image budget, watcher generation, and a single watcher. A mutex serializes native document transitions. Blocking picker, filesystem reads, and second-instance work run outside the UI thread. Only five application commands are exposed: `pick_document`, `current_document`, `open_relative`, `read_image`, and `open_external`.

TypeScript owns the toolbar, rendered article, current snapshot, search UI, and reading size. There is no global state library. Revision numbers reject stale snapshots and image replies. A new document focuses the reader; refreshing the same path preserves scroll and search focus. Theme selection uses localStorage and CSS variables; system appearance follows `prefers-color-scheme` only when selected.

### File-to-view pipeline

1. The native picker, native drop event, or command-line launch explicitly supplies a path.
2. Rust validates the extension and regular-file type, resolves the selected file, and opens its parent as a `cap-std` directory capability.
3. A bounded read accepts valid UTF-8, strips an optional UTF-8 BOM, and publishes a revisioned snapshot. Failed opens retain the previous snapshot.
4. A dedicated worker parses with raw HTML disabled; eight explicit highlight.js grammars color supported fenced code. It emits complete top-level blocks in small batches with frontend backpressure. DOMPurify sanitizes each batch before insertion; no worker HTML bypasses the sanitizer. Switching documents terminates obsolete workers.
5. The renderer validates links, assigns unique heading IDs, sets `dir="auto"` per text block and table cell, and sets code to `dir="ltr"`. The reader inserts sanitized fragments between animation frames, keeping long-document parsing off the UI thread. A single enormous nested block can still require a larger insertion.
6. Images initially have inert references, never document-provided `src` URLs. A small worker pool requests bounded raster bytes from Rust and inserts validated data URLs. Stale responses are discarded.

### Watcher lifecycle

The watcher observes the active document's containing directory, rather than its inode, so atomic rename replacement is detected. It filters access and unrelated-file events, coalesces noisy changes for 180 ms, and imposes a 600 ms maximum debounce to avoid starvation. A bounded event queue limits retained work. Each switch drops the previous watcher and advances a generation; obsolete callbacks cannot refresh the new document. Closing the window drops the watcher. Unchanged contents avoid rerendering. Errors are deduplicated, and recovery clears the error.

### Security model

Every document and reference is untrusted. Native directory capabilities constrain linked Markdown and image access to the initially selected folder, including symlink resolution and replacement races. Opening a new file with the picker/drop/CLI establishes a new boundary. Links into parent folders outside that boundary require explicit selection with Open. This deliberately trades unrestricted README traversal for predictable local-file privacy.

- Source files are opened with read-only options; no write/save command exists.
- Documents are limited to 8 MiB and must be regular UTF-8 files. Unix nonblocking opens avoid hanging on a replacement FIFO.
- Images are limited to 4 MiB each, 24 MiB of native bytes per document revision, and 128 image elements. PNG/JPEG/GIF/WebP signatures must match the extension. SVG and remote images are blocked.
- Raw HTML is disabled; an explicit sanitizer allowlist removes active markup, inline handlers, styles, and document-provided image sources. Task checkboxes are disabled.
- Unsafe schemes, absolute filesystem references, malformed escapes, credentials in external URLs, and traversal escapes are rejected. Rust validates native boundaries independently of frontend checks.
- Capabilities grant only these reader commands and event subscriptions. The renderer has no unrestricted filesystem, shell, dialog-plugin, or network API.
- Production CSP restricts scripts/assets to the application, denies frames/objects/forms, and permits only Tauri IPC connections. Trusted inline style updates support reading zoom; untrusted Markdown styles are removed. Native navigation permits only the application origin.
- External HTTP(S)/mailto navigation is delegated to a system application after a trusted user click. Private document contents are not logged.

This is not an OS sandbox for the whole process. WebKit and raster decoding remain system dependencies, malformed inputs can consume resources within the limits, and very large DOMs can slow reading. A compressed image's dimensions are not currently bounded. Keep system security updates current. See [SECURITY.md](SECURITY.md) for disclosure and support.

### Linux integration and portability

Linux packaging owns the freedesktop launcher, MIME XML, icons, and database-update maintainer scripts. `Exec=mivu %f` passes one file without shell interpolation. The single-instance plugin forwards later launch arguments and their working directory. AppImage startup temporarily restores the runtime-provided `OWD` (or preserved `PWD` in older extraction runtimes) for forwarding and captures it for initial arguments. It then returns to AppRun's directory before creating the WebKit view, whose bundled helper paths are relative. Native GTK drops and file selection share the same validated opening flow.

Document validation, rendering, themes, and search are portable. CLI/path processing uses native path types. Windows/macOS icon assets exist, and platform libraries are isolated in Rust/Tauri and Linux bundle configuration. Windows/macOS builds, native associations, signed installers, and their lifecycle differences are future validation work; no cross-platform release is claimed. Non-UTF-8 filenames are not a supported v0.1 interface, although Unicode filenames are supported.

## Firefox architecture

Firefox MV3 supports `background.scripts`. The tiny background listens to an
action click and opens its own reader tab using `browser.tabs.create`; creating
that tab needs no `tabs` permission. There are no content scripts or host grants.
The reader accepts only user-selected/dropped browser `File` objects, validates
Markdown extension/8 MiB/UTF-8, and retains one document in page-local state.

Marked suppresses raw HTML. Code is escaped or highlighted, links are filtered,
and all images become inert placeholders. A `DOMParser`/tag-and-attribute
allowlist creates a sanitized fragment imported directly into the article;
no HTML assignment or serialize/reparse step is used. Text blocks/cells get
`dir="auto"`, code stays LTR. Search, zoom and theme are reader-page concerns;
only theme is persisted locally. The CSP denies network connections, remote
scripts, objects and forms.

**Add images** authorizes individual PNG/JPEG/GIF/WebP files, validates type,
signature and 12 MiB per-file/30-file limits, and creates revocable blobs matched
by basename. There is no directory scope, file watching or automatic local-link
opening. Remote references remain placeholders. The pending-image race, decoded
image/large-document resource limits and incomplete highlight.js upstream build
provenance are documented in the [implementation review](firefox/docs/audit.md).
The exact submitted runtime is hash-guarded; future runtime corrections require
a new Firefox version. Detailed modules, reviewer sources, permission model and
manual checks live in [firefox/README.md](firefox/README.md).

## Repository structure

```text
mivu/
├── src/
│   ├── main.ts, app.ts              # startup, toolbar, events and reader state
│   ├── core/                       # snapshots, parser/worker, batching, sanitizer, references
│   ├── features/                   # search and appearance
│   ├── ui/                         # empty state, images and fragment scrolling
│   └── styles/                     # shared layout, Markdown typography, themes
├── src-tauri/
│   ├── src/                        # lifecycle, commands, documents, CLI, watcher, security
│   ├── capabilities/, permissions/ # narrow IPC grants
│   ├── icons/                      # project-owned native assets
│   ├── tauri.conf.json             # application, window and CSP configuration
│   ├── tauri.linux.conf.json        # Linux packaging
│   └── mivu.desktop, mivu-mime.xml  # desktop and MIME integration
├── firefox/
│   ├── app/                        # unchanged Firefox 0.1.0 reader, MV3 manifest and vendor assets
│   ├── tools/, tests/              # offline ZIP build, Firefox smoke and regressions
│   ├── releases/                   # submitted artifact hash and complete inventory
│   ├── third-party/, docs/         # licenses, readable vendor view, findings and screenshots
│   └── README.md                   # detailed extension development and reviewer instructions
├── tests/                          # desktop Vitest tests, benchmark and realistic fixtures
├── scripts/                        # native smoke, benchmarks and package checks
├── assets/mivu.svg                 # original icon source
├── docs/screenshots/               # actual application captures
├── .github/workflows/              # quality, artifacts and tagged release draft
├── README.md                       # canonical product and architecture documentation
├── AGENTS.md, CONTRIBUTING.md, SECURITY.md, CHANGELOG.md
└── LICENSE                         # original MIT license
```

## Architectural decisions

- **Tauri rather than Electron:** reuse the system WebKit renderer and keep native file access in Rust. This avoids shipping Chromium/Node, but Linux behavior and security updates depend on the distribution's WebKitGTK.
- **Vanilla TypeScript rather than a framework:** a toolbar and one document view need little state. Explicit DOM modules keep the dependency and maintenance cost small. Large future UI changes should reassess this decision with evidence.
- **markdown-it rather than a custom parser:** established Markdown/GFM behavior, extensible rendering rules, and tested parsing. DOMPurify adds defense in depth rather than assuming parser output is sufficient.
- **Linux first:** validate actual GTK/WebKit, freedesktop, and distribution behavior before advertising more platforms. An older CI build host avoids assuming a newer glibc binary works everywhere.
- **Read-only capabilities:** explicitly selected documents authorize a bounded directory scope; the renderer cannot request arbitrary paths. This makes security properties inspectable and testable.
- **Minimal dependencies:** no UI framework, persistence service, browser test framework, or extension system. `cap-std` is a deliberate addition for race-resistant filesystem boundaries; `notify` handles native watcher differences.

## Desktop testing and benchmarks

```sh
pnpm check             # strict TypeScript, ESLint, Vitest, production frontend
pnpm format:check      # Prettier
pnpm check:rust        # rustfmt, Clippy with denied warnings, cargo tests
pnpm test:native       # after building the debug binary
pnpm bench             # jsdom render/sanitize microbenchmarks
pnpm bench:native      # after building the release binary
```

Frontend tests exercise GFM, malicious HTML/URLs, reference classification, direction attributes, heading anchors, search across formatting, theme selection, failed opens, refresh state, and stale responses. Rust tests exercise limits, UTF-8, supported extensions, permission errors, regular-file validation, relative capability boundaries, symlinks/FIFOs, CLI paths, external URLs, navigation, and watcher replacement/debounce/cleanup.

Native automation runs the actual packaged WebKit application: GTK selection and file drag, local raster decoding, link navigation, RTL/LTR computed directions, resizing, search/zoom, second-instance and startup arguments, external writes/atomic saves/deletion/recovery, package launcher/MIME identification, denied filesystem IPC, and blocked origin navigation. It uses copied temporary documents, isolated XDG state, and a private D-Bus session without host service activation; it never changes your default handler.

Reproduce a failure with the same command and OS/WebKit versions. Native logs, screenshots, benchmark JSON, and package manifests are under ignored `test-results/`. A port collision or missing test package is a harness failure, not evidence that the application passed.

Benchmarks generate representative GFM from `tests/fixtures/reading.md`. Native timings include second-instance IPC, parsing, sanitization, and DOM insertion, with three samples per size. Startup measures process-cold launches with warm OS caches, including WebDriver negotiation; it is not a disk-cold startup claim. Process-tree RSS double-counts shared pages. On the recorded Zorin/Xvfb baseline, median complete opening was about 115 ms for 8 KiB, 204 ms for 64 KiB, 1.08 s for 512 KiB, and 5.86 s for 2 MiB of dense GFM. The 2 MiB case used about 1.20 GiB of summed process-tree RSS, which double-counts shared pages; large DOMs remain a performance limit. Startup, first-content, scheduling gaps, memory and watcher measurements with full conditions are in [docs/validation.md](docs/validation.md). Microbenchmarks under jsdom are not desktop timing predictions.

## Firefox development, testing and packaging

Builds use Python's standard library only and work offline. The full reader suite
reuses existing root jsdom/Prettier development dependencies; no extension npm
runtime dependency, bundler or monorepo manager is added.

```sh
python3 firefox/tools/build_amo.py
python3 -m unittest discover -s firefox/tests -p 'test_*.py' -v
node --test firefox/tests/safety.test.mjs  # no dependency installation
pnpm install --frozen-lockfile
node --test firefox/tests/*.test.mjs
npm exec --yes --package=web-ext@10.7.0 -- web-ext lint --source-dir firefox/app
python3 firefox/tools/browser_smoke.py   # installed Firefox + geckodriver 0.37.1
```

AMO/source ZIPs are written to ignored `firefox/dist/`. Submitted v0.1.0 runtime
file-content parity is verified on every build; fixed metadata makes output
ordering/timestamps deterministic. A source archive includes licenses, tests and
reviewer materials. Full regeneration of the custom highlighter from upstream
is unproven; do not conflate runtime reconstruction with that remaining gap.

The path-filtered Firefox workflow runs syntax, unit/security/policy/package
checks, Mozilla lint and isolated Firefox smoke tests, and uploads ZIPs/logs.
There is no AMO signing or publishing. Firefox versions use the manifest and
intentional `firefox-vX.Y.Z` tags; Desktop metadata/tags remain independent.
Runtime changes must bump Firefox beyond submitted 0.1.0 and pass validation
before a separate maintainer submission decision. See [Firefox release workflow](firefox/README.md#build-amo-packaging-and-historical-reproduction).

## Desktop building and releasing

```sh
pnpm build                             # frontend only
pnpm tauri build --debug --no-bundle    # development desktop executable
pnpm package:deb                       # optimized executable and .deb
APPIMAGE_EXTRACT_AND_RUN=1 pnpm package:appimage
APPIMAGE_EXTRACT_AND_RUN=1 pnpm package:linux
python3 scripts/inspect_packages.py
```

Outputs are under `src-tauri/target/release/bundle/deb/` and `appimage/`. The package helper supplies a conservative host glibc dependency and locked Rust resolution. AppImage bundling downloads upstream Linuxdeploy tools and can require the extraction environment setting shown above. Package inspection asserts identity, integration files, dependencies, and AppImage headers, then records SHA-256 checksums. To exercise the Debian package without installing it:

```sh
dbus-run-session --config-file=scripts/dbus-test.conf -- xvfb-run -a python3 scripts/native_smoke.py --deb src-tauri/target/release/bundle/deb/Mivu_0.1.0_amd64.deb
```

GitHub Actions runs frontend/Rust quality and native WebKit tests on pull requests. Branch/manual/tag builds additionally produce packages on Ubuntu 22.04, smoke-test Debian and AppImage packages, inspect artifacts, and upload them. Actions are pinned to commit SHAs, checkout credentials are not persisted, and ordinary jobs have read-only repository permissions.

Version numbers in package.json, Cargo.toml, tauri.conf.json, lockfiles, and CHANGELOG.md must agree. After all automated and manual release gates pass, a maintainer intentionally pushes a matching `vX.Y.Z` tag. The tag workflow verifies versions and creates a **draft** release with the verified CI artifacts; publishing is a separate maintainer action after checking installation and portability. No public release is created automatically on main or during implementation. Do not upload newer-host binaries as older-compatible artifacts.

## Validation and manual desktop checklist

Automated evidence and exact limitations live in [docs/validation.md](docs/validation.md). A successful build alone does not complete the release gate.

On a clean Zorin OS 18.1 installation:

1. Install the verified `.deb` using apt; confirm Mivu appears in the menu with its icon. Launch from the menu and terminal.
2. Use Open and drop `tests/fixtures/reading.md`; check tables, disabled tasks, code scrolling, local images, selection/copy, and an explicitly clicked external link.
3. Open `tests/fixtures/persian.md` in both appearances. Check mixed punctuation, inline English, table cells, LTR code, and comfortable narrow/wide layouts.
4. Test all shortcuts, tab focus, keyboard scrolling, system theme changes, zoom reset, and screen-reader announcements/focus.
5. Copy a fixture to a path with spaces and Persian characters and test `mivu 'path'`, Open With, and double-click after deliberately selecting Mivu as its handler. Confirm installation did not change existing defaults.
6. Modify only the copied fixture externally; test normal writes, atomic replacement, deletion and restoration. Check refresh, scroll preservation, errors, and switching documents repeatedly.
7. Repeat launch, drop, foreground requests and resizing in Wayland and Xorg sessions, and on actual high-DPI/fractional-scale displays. Check compositor behavior and rendering.
8. Run the adversarial fixture and confirm no script or remote image loads. Verify source fixture hashes are unchanged after reading.
9. Uninstall and confirm source documents remain. Repeat installation on Ubuntu 22.04 and Debian 12 using the older-host CI package before declaring those systems supported.

## Roadmap

### Desktop

| Phase | Implementation                     | Validation status                                                                                        |
| ----- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 0     | Project initialization and tooling | Implemented; builds and initial Linux development launch checked                                         |
| 1     | Native foundation and file access  | Implemented; native picker/drop and validation checked                                                   |
| 2     | Markdown engine                    | Implemented; frontend and native rendering checked                                                       |
| 3     | Reading experience, themes and RTL | Implemented; automation and actual screenshots checked; human accessibility/long-session review pending  |
| 4     | Linux integration and refresh      | Implemented; CLI, watcher and isolated package launch checked; installed file-manager acceptance pending |
| 5     | Security and robustness            | Implemented; adversarial frontend/Rust/native checks passed; decoder/DoS limits documented               |
| 6     | Tests, QA and performance          | Automated checks and reproducible benchmark tooling implemented; current evidence in validation report   |
| 7     | Linux packages and release CI      | Packaging/workflows implemented; artifact evidence and remaining release gates in validation report      |

Proposals, not commitments: v0.2 Mermaid and mathematical notation; v0.3 optional document outline; v0.4 multiple document tabs; future Windows/macOS builds. These need scope and security review before implementation.

### Firefox

Integration phases (inspection/parity, source import, code review/regressions,
deterministic build/CI, combined documentation, final verification) are recorded
in [firefox/docs/integration.md](firefox/docs/integration.md). The submitted 0.1.0
runtime is preserved; AMO review is pending. Browser automation passed on 155.0.1;
minimum-version/ESR/Android and human acceptance remain unverified.

Next-version priorities: image-selection generations/aggregate budgets, complete
vendor provenance and runtime license text, existing highlight-token colors,
small-screen image selection and search cap reporting. Anchors are a proposal;
no broader permissions or desktop dependency is planned. These are follow-up
proposals, not changes to the historical release or guaranteed release dates.

## Contributing

Small improvements to reading quality, security, accessibility, Linux reliability and Firefox behavior are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, issue/PR expectations and review guidelines, and [AGENTS.md](AGENTS.md) for repository instructions.

## Security

Please report vulnerabilities through [SECURITY.md](SECURITY.md). Never attach private documents to a public issue. Desktop uses a selected-folder capability; Firefox uses explicit browser File selections and zero API/host permissions. Both disable active Markdown and automatic remote loads. Resource/decoder limits and historical dependency gaps are documented; neither promises complete isolation from browser, WebKit or operating-system vulnerabilities.

## License

[MIT](LICENSE). Copyright 2026 Amin Bahrabadi. The existing license is preserved.
