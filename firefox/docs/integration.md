# Firefox integration record

The root README is canonical for Mivu's architecture. This record tracks the
integration of the supplied Firefox sources, without changing submitted runtime
files. The integration branch starts at completed Desktop commit `2a9849b` and
will target `feat/linux-v0.1` until the Desktop PR is merged.

| Phase                                 | Status                               | Evidence                                                                                                                                                                |
| ------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Inspection and source verification | Complete                             | Both ZIP inventories checked for unsafe paths, symlinks and duplicates. Original Python build reproduces all 11 submitted file paths and bytes.                         |
| 2. Repository integration             | Complete                             | Original `firefox/app/` and build script imported; runtime hashes recorded in `releases/v0.1.0-submitted.json`. Separate worktree preserves ongoing Desktop work.       |
| 3. Security and functional audit      | Complete with documented limitations | Reader pipeline/dependencies reviewed; adversarial Node/jsdom tests and actual Firefox smoke passed. Historical race/resource/provenance gaps are recorded in audit.md. |
| 4. Build and CI                       | Complete locally                     | Offline deterministic packages and Python regressions pass; source ZIP rebuild verified; workflow passes actionlint. Remote CI will run on the PR.                      |
| 5. Documentation and design           | Complete                             | Root/Firefox READMEs, contributor/security/agent rules and platform differences documented; real screenshots supplied.                                                  |
| 6. Final verification                 | Pending                              | Automated checks, archive preservation and review PR.                                                                                                                   |

The source archive SHA-256 is
`42ef4f1601668ea4553aaad1aa27af30e9dd6883c3862f8168014af2cd333a63`.
The submitted archive SHA-256 is
`fee0deba3cbf26b14e1f88c18095817b06c4126420836f60049b6587143a3888`.
The original-script rebuild SHA-256 was
`b5873c979503aa61d2b0530f77e67af3c6847f79da5ad3be4c9bf0e5f7e62095`.
The ZIP metadata differs, while decompressed content is identical. Original
archives remain outside Git, unchanged. The JSON records the complete submitted
runtime inventory, byte sizes and content hashes. No AMO upload is authorized by
this integration, and the submitted package must never be replaced silently.

## Validation environment and outcomes

Zorin OS 18.1 / Ubuntu 24.04, Python 3.12.3, Node 24.12.0, Firefox 155.0.1,
geckodriver 0.37.1. Existing root dependencies installed with
`pnpm@12.10.1 install --frozen-lockfile --offline` (180 reused, no downloads).

- 13 Node extension tests and 7 Python packaging tests passed.
- Real packaged Firefox smoke passed; minimum-version/ESR/Android and manual UI
  acceptance remain unexecuted, as recorded in audit.md.
- Desktop `pnpm check` passed: TypeScript, ESLint, 33 Vitest tests and production
  build. Desktop source/native configuration, original Linux workflow, lockfiles,
  fixtures/scripts/assets and MIT license have no changes from the base commit.
  Unchanged Rust/native packaging checks were not repeated.
- Both workflows passed actionlint 1.7.12 locally. Mozilla web-ext 10.7.0 reported
  0 errors and 2 minimum-version/data-declaration compatibility warnings.
- `python3 tools/build_amo.py --verify-submitted <original archive>` passed.
  Optimized Python (`python3 -O`) retains policy checks. Repeated builds produce
  the same runtime ZIP SHA-256, `e311a2a9437ef6cded0c3d661075608f503b4df1065795e9d934ada5bc70c328`.
- The source ZIP was safely extracted into an isolated test directory; its
  Python-only rebuild produces the same deterministic runtime ZIP. This proves
  runtime packaging, not regeneration of the custom highlighter from author
  source. The remaining vendor-source requirement is explicit in third-party/README.md.

No AMO publication, public release, main merge, permission expansion or desktop
runtime change is part of this integration. Source/AMO originals remain unchanged.
