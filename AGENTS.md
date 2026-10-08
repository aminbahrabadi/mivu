# Mivu contributor and agent instructions

README.md is canonical for product scope and architecture. Keep it accurate with every milestone.

- Preserve the read-only guarantee: never write source documents, execute code blocks, or add editing/saving APIs.
- Rust owns native selection, document state, bounded UTF-8 reads, constrained local resources, browser opening, and watching. TypeScript owns sanitized rendering and reader UI.
- Never expose unrestricted filesystem, shell, network, or save capabilities. Treat Markdown and every relative reference as untrusted. No remote image/font/CDN loads.
- Raw Markdown HTML stays disabled. Sanitize generated HTML and validate URLs at both boundaries. Relative resource access must stay inside a directory capability even during symlink races.
- Use strict TypeScript, small functions, plain CSS, idiomatic Rust errors, pnpm and committed lockfiles. Reuse installed dependencies. No frontend framework, telemetry, database, editing, or speculative abstractions.
- For desktop changes run pnpm check and pnpm check:rust; add focused tests for nontrivial behavior. Follow the desktop manual checklist. Documentation/Firefox changes do not require rebuilding unchanged Rust. Never claim GUI checks that were not run.
- Keep dependencies minimal; explain security-sensitive additions. Keep Linux integration isolated and cross-platform assumptions explicit.
- Preserve user files and LICENSE. Use feature branches and small Conventional Commits. Never force-push. Push only when the user explicitly requests it in the current conversation.
- System package installation needs authorization. No system upgrades or GPU/kernel/bootloader changes. Prefer isolated package extraction for smoke tests.
- Prefer available codebase-memory-mcp graph tools for code discovery; index first if needed. Use rg when tools are unavailable or for literals/config/docs.
- Use rtk for supported shell operations when compact output preserves necessary detail. Use exact commands or rtk proxy for diagnostic output. See /home/amin/.codex/RTK.md on configured hosts.

## Firefox

- `firefox/app/` is the submitted 0.1.0 runtime. Every file is hash-guarded against `firefox/releases/v0.1.0-submitted.json`. Never alter submitted archives or evidence to make changed runtime appear identical. Runtime changes require a new Firefox manifest version and intentional release notes; Desktop versions are independent.
- Preserve `permissions: []`, `host_permissions: []` and Gecko `data_collection_permissions.required: ["none"]`. No optional grants, content scripts, remote code, visited-page access or native messaging. Any unavoidable host-access proposal needs explicit approval; defer features that need broader access by default.
- Browser `File` selection is the extension's authority. Never simulate native filesystem traversal, watchers or desktop associations. Images come only from explicit selection; preserve raster type/signature/size checks and blob cleanup.
- Markdown is untrusted. Keep raw HTML disabled, generated nodes sanitized and code inert. Do not introduce HTML assignment sinks, active SVG/MathML, uncontrolled URLs or remote resource loads. Do not call the modified highlighter's legacy DOM APIs.
- Keep existing source modules and zero-dependency Python packaging. No npm dependency merely to build, monorepo framework or speculative shared runtime. Shared product standards do not imply identical platform security models.
- Run Node syntax and `node --test firefox/tests/*.test.mjs`, Python packaging tests and `python3 firefox/tools/build_amo.py`. Run pinned web-ext lint and browser smoke when available. Preserve visible warnings and distinguish automation from manual/platform checks.
- Root formatting/lint intentionally excludes historical runtime and derived vendor material. Never run a formatter over `firefox/app/`. Preserve all third-party notices and explain local modifications, exact provenance and remaining regeneration gaps.
- Update the root README, firefox/README.md and relevant audit/release records after architecture or security changes. Do not claim AMO approval, upstream reproducibility, executed tests or vulnerability freedom without evidence.
- Browser smoke uses only a fresh throwaway Firefox profile and localhost driver. Its Gecko UI privilege is for testing extension URLs, never an extension permission or a change to the user's profile.
