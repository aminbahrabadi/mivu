# Firefox integration record

The root README is canonical for Mivu's architecture. This record tracks the
integration of the supplied Firefox sources, without changing submitted runtime
files. The integration branch starts at completed Desktop commit `2a9849b` and
will target `feat/linux-v0.1` until the Desktop PR is merged.

| Phase | Status | Evidence |
| --- | --- | --- |
| 1. Inspection and source verification | Complete | Both ZIP inventories checked for unsafe paths, symlinks and duplicates. Original Python build reproduces all 11 submitted file paths and bytes. |
| 2. Repository integration | Complete | Original `firefox/app/` and build script imported; runtime hashes recorded in `releases/v0.1.0-submitted.json`. Separate worktree preserves ongoing Desktop work. |
| 3. Security and functional audit | In progress | Complete reader pipeline inspected; regression tests and dependency review follow. |
| 4. Build and CI | Pending | Deterministic packaging, validation and Firefox workflow. |
| 5. Documentation and design | Pending | Combined root architecture and platform-specific documentation. |
| 6. Final verification | Pending | Automated checks, archive preservation and review PR. |

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
