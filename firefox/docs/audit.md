# Firefox v0.1.0 implementation review

Reviewed on 2026-10-08, against the supplied security-fixed source and exact AMO
submission. Runtime files are unchanged. This is a code review with focused
regression and browser checks, not a guarantee against vulnerabilities.

## Trust boundaries and rendering pipeline

1. `background.js` registers the action click and creates a tab for its own
   bundled reader. It does not query existing tabs. Firefox permits
   [tab creation without the tabs permission](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Working_with_the_Tabs_API).
   Manifest V3 [background scripts are supported in Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background).
2. Reader file input/drop supplies a browser `File`, not a filesystem path.
   `readMarkdown` checks `.md`/`.markdown` and 8 MiB before allocating, rejects
   invalid UTF-8 with a fatal decoder, and strips a BOM. There is no write or
   network API. A busy flag ignores additional opens during a pending read; failed reads retain the
   previous view. No directory scanning or content script exists.
3. Marked's raw-HTML renderer returns an empty string. Links are emitted only
   for HTTP(S)/mailto classifications, with escaped attributes; local/anchor/
   unsafe links become visible spans. Images always become inert placeholders.
   Highlighting uses a validated language name and `highlight()`, with escaped
   fallback; code is never executed. Task checkboxes are disabled.
4. `DOMParser` parses the generated string in an inert document. A recursive
   allowlist removes scripts, styles, frames, SVG, MathML, objects, embeds,
   forms, media and templates. Unknown wrappers are flattened after cleaning.
   Attributes are allowlisted per element; handler/style/id/name attributes
   cannot survive, preventing DOM clobbering. Links are checked again and
   receive `_blank`, `noopener noreferrer` and `no-referrer`.
5. The reader imports the cleaned DOM nodes directly, without serializing and
   reparsing. There are no `innerHTML`/`outerHTML` assignments in the submitted
   application or bundled libraries. Avoiding those sinks alone is not the
   security model: raw-HTML removal, allowlisting, URL policy and CSP work together.
6. Selected images require matching PNG/JPEG/GIF/WebP signatures and extensions,
   at most 12 MiB each and 30 files per selection. Relative references are decoded
   once and reduced to case-insensitive basenames. Absolute paths, schemes,
   backslashes, empty segments, malformed escapes and `..` segments are rejected.
   Duplicate selected filenames are rejected. An image can only reference a
   user-selected blob; directory paths grant no filesystem access. Remote/SVG
   references stay placeholders. Browser decoding still handles untrusted bytes.
7. CSP denies all default resources and connections, allows only bundled scripts,
   styles/fonts, and self/blob/data images, and denies objects, forms and base
   changes. Markdown cannot supply image `src` values. HTTP(S)/mailto links
   navigate only after a click; CSP does not act as a general navigation filter.
   The extension never requests visited-page, host, clipboard or native access.
8. Replacing successful image selections, switching documents, failed partial
   selections and pagehide revoke blob URLs. Theme preference is the only
   application value persisted in localStorage; documents/images are not saved.

`classifyLink` calls encoded pseudo-protocols “local”, rather than “blocked”.
They still become spans, never navigable URLs. Tests check the final rendered
DOM, including HTML-entity protocols that are decoded during parsing. External
URLs can contain credentials and unsupported host syntax; Firefox handles their
navigation, but the next version should tighten classification and explain errors.

## Findings and remaining risks

No critical script-execution or arbitrary-file-access issue was demonstrated by
this review and its regression cases. This statement has the limits below.

| Finding                                                                    | Impact and evidence                                                                                                                                                                                                                   | Disposition                                                                                                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Main-thread parsing/sanitization and raster decoding are not a DoS sandbox | 8 MiB of dense/nested Markdown can block the reader or overflow recursive parsing. Selected compressed rasters lack decoded-dimension limits; 30 × 12 MiB permits 360 MiB of compressed input.                                        | Historical limits preserved; use smaller documents and trusted images. Add worker/time budgets, an aggregate image budget and dimension limits in a new release.                     |
| Asynchronous image selection has no document generation check              | `addImages` awaits each read and later unconditionally replaces the map. Opening another Markdown while image reads are pending can attach the earlier selection to the new document; overlapping selections can finish out of order. | Noncritical correctness/cleanup issue; avoid switching until the image status appears. Serialize/cancel obsolete selections in the next version.                                     |
| Vendor origin cannot be fully rebuilt                                      | Marked matches official 4.0.19 bytes. The custom highlight.js 11.0.1-declared bundle differs from the official distribution beyond its sink modification; the original minifier/assembly instructions are absent.                     | Full license and readable derived copy supplied. Exact upstream regeneration remains a reviewer-source requirement; see [provenance](../third-party/README.md).                      |
| highlight.js notice omits full BSD text                                    | Submitted runtime contains a copyright/license link, not the full conditions and disclaimer.                                                                                                                                          | Full release license added to source materials; include it in the next runtime package. Historical AMO bytes preserved.                                                              |
| Firefox compatibility warnings                                             | Desktop data declarations start at 140, Android at 142; the submitted minimum is 128.                                                                                                                                                 | Lint reports 0 errors, these 2 warnings. Older browsers do not show the newer declaration; no data is transmitted regardless. Revisit compatibility intentionally for a new version. |
| Rendering/reading differences                                              | Anchor/local links are inactive, search is per text node and stops at 500 without an explicit cap notice, and code token classes lack coloring rules. At narrow widths Add images is hidden.                                          | Documented, not silently redesigned during historical integration. Address small usability issues in subsequent versions.                                                            |

## Executed checks

- Node unit/regression tests execute the actual vendored parser, highlighter and
  reader body in jsdom. Only the ESM import is injected and module scope is
  isolated by the harness; production sources are not modified or mocked.
- Tests cover filename/encoding/size rules, GFM, raw/active markup, URL entities
  and encodings, clobbering/namespace attributes, selected image signatures and
  blob cleanup, themes, literal search/cap, keyboard handlers and direction attributes.
- Python tests verify permission/data/CSP drift fails, missing/unexpected assets,
  symlinks, submitted byte inventory and deterministic ZIP output. Runtime changes
  at version 0.1.0 are rejected even with Python optimizations enabled.
- Headless Firefox 155.0.1 with geckodriver 0.37.1 installed the actual ZIP in a
  fresh temporary profile. File input, Unicode paths, GFM/tasks, raster decoding,
  computed Persian/code directions, themes, search/zoom, simulated DOM file drop,
  invalid UTF-8, switching, adversarial rendering and CSP checks passed.
- A loopback HTTP fixture observed no document/image request before clicking an
  external link. The explicit click opened its URL. CSP blocked a connection and
  inline script creation. These test probes are trusted automation, not extension
  APIs or changes to its permissions.
- `web-ext@10.7.0 lint` reported **0 errors, 2 compatibility warnings**, with no
  unsafe-HTML-assignment warning. Validation is not Mozilla approval.

Browser logs, real headless screenshots and JSON live in ignored
`test-results/firefox/`. Tests use a temporary profile and synthetic documents,
not the user's Firefox profile. Gecko UI access is enabled only for that driver
so it can navigate to the extension origin; the extension still has no permissions.

## Unexecuted acceptance checks

Use the [manual checklist](../README.md#manual-smoke-checklist): native OS drag,
Firefox toolbar activation, trusted keyboard routing, human mixed-direction
reading, assistive technology, fractional scaling, actual system-theme changes,
and Firefox 128/ESR/Android. This integration neither certifies those platforms
nor changes the pending Mozilla submission. Recheck dependency advisories before
any next release and do not infer vulnerability freedom from passing tests.
