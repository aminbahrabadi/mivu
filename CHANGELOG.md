# Changelog

All notable user-facing changes will be recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semantic versioning.

## [Unreleased]

### Firefox integration

- Imported submitted Firefox 0.1.0 sources unchanged, with complete source/runtime
  inventories and submitted archive hashes.
- Added deterministic, offline AMO/source packaging with zero-permission/CSP/data
  policy checks and a v0.1.0 runtime-content guard.
- Added reader/security/package regressions, headless packaged Firefox smoke tests
  and a separate path-filtered artifact/validation workflow.
- Documented both application architectures, platform limitations, vendor sources,
  full supplemental BSD license, readable bundle and remaining provenance gap.
- Recorded pending-image selection, resource-budget and reading limitations for
  correction in a subsequent Firefox version; no submitted runtime change.

### Desktop 0.1.0 candidate — Added

- Linux-first Tauri 2 Markdown reader with a native file picker, file drops, and UTF-8/Unicode path support.
- Sanitized GFM rendering, common-language syntax highlighting, inert task lists, tables, constrained local images and Markdown links.
- Light, dark, and system appearance, per-block Persian/English direction, keyboard reading zoom, and document search.
- Startup/second-instance file opening and debounced external-file refresh with scroll preservation.
- Read-only capability-based native access, navigation/CSP protections, bounded resources, and adversarial tests.
- Debian/AppImage packaging configuration, Linux desktop/MIME entries, pinned CI, native integration tests, and contributor documentation.

Desktop 0.1.0 has not been published as a release. Firefox 0.1.0 is submitted and awaiting Mozilla review according to the input record. Consult README.md for independent artifact and validation status.
