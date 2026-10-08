# Mivu contributor and agent instructions

README.md is canonical for product scope and architecture. Keep it accurate with every milestone.

- Preserve the read-only guarantee: never write source documents, execute code blocks, or add editing/saving APIs.
- Rust owns native selection, document state, bounded UTF-8 reads, constrained local resources, browser opening, and watching. TypeScript owns sanitized rendering and reader UI.
- Never expose unrestricted filesystem, shell, network, or save capabilities. Treat Markdown and every relative reference as untrusted. No remote image/font/CDN loads.
- Raw Markdown HTML stays disabled. Sanitize generated HTML and validate URLs at both boundaries. Relative resource access must stay inside a directory capability even during symlink races.
- Use strict TypeScript, small functions, plain CSS, idiomatic Rust errors, pnpm and committed lockfiles. Reuse installed dependencies. No frontend framework, telemetry, database, editing, or speculative abstractions.
- Run pnpm check and pnpm check:rust for changes; add focused tests for nontrivial behavior. Follow the manual checklist for desktop changes. Never claim GUI checks that were not run.
- Keep dependencies minimal; explain security-sensitive additions. Keep Linux integration isolated and cross-platform assumptions explicit.
- Preserve user files and LICENSE. Use feature branches and small Conventional Commits. Never force-push. Push only when the user explicitly requests it in the current conversation.
- System package installation needs authorization. No system upgrades or GPU/kernel/bootloader changes. Prefer isolated package extraction for smoke tests.
- Prefer available codebase-memory-mcp graph tools for code discovery; index first if needed. Use rg when tools are unavailable or for literals/config/docs.
- Use rtk for supported shell operations when compact output preserves necessary detail. Use exact commands or rtk proxy for diagnostic output. See /home/amin/.codex/RTK.md on configured hosts.
