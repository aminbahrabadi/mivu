# Bundled dependencies and reviewer sources

These notices and readable materials accompany the source distribution. They do
not change the submitted extension runtime. Never update a library inside
`app/` while keeping Firefox version 0.1.0.

## Marked 4.0.19 — MIT

`app/vendor/marked.js` is byte-identical to `lib/marked.umd.js` in the official
[Marked 4.0.19 npm tarball](https://registry.npmjs.org/marked/-/marked-4.0.19.tgz).
The tarball SHA-256 is
`bc942e1b88a498030cfe6e253a4e6347f1d533dfe859e71e3e9da774e456ce16`;
its published npm integrity is
`sha512-rgQF/OxOiLcvgUAj1Q1tAf4Bgxn5h5JZTp04Fx4XUkVhs7B+7YA9JEWJhJpoO8eJt8MkZMwqLCNeNqj1bCREZQ==`.
The bundled file SHA-256 is
`91e90d63828ffe48d7ab281a4005f512e6b069b01a9e3b18aa69a0b2a4f2f317`.
It is already readable generated UMD source, with no local changes.

Readable author sources are at
[release v4.0.19](https://github.com/markedjs/marked/tree/v4.0.19/src),
commit `95f37bd23bd9794e145c37046d3546783ffba007`. The full MIT notice and
upstream Markdown notice remain in `app/vendor/LICENSE-marked.txt`.
To restore the exact bundled asset, retrieve that tarball and copy
`package/lib/marked.umd.js` to `app/vendor/marked.js`, then verify the hash.
No transpilation is needed to package the existing release.

## highlight.js — declared 11.0.1, BSD 3-Clause

The bundle header and runtime API declare 11.0.1, upstream commit
`1cf31f015dfb67e94fa5edbf436ddcf141281877`. The bundle contains 34 registered
grammars. Its SHA-256 is
`a55fbc92ce29f59e8129fdb3cf97634a6e18363d8d344ec5bded08c9a76d931d`.
Readable upstream author sources are at
[release 11.0.1](https://github.com/highlightjs/highlight.js/tree/11.0.1/src).
The complete, unmodified release license is in `LICENSE-highlight.txt`,
SHA-256 `6c081431591d9df696c82dc598fe1423765b8a299b200ed00b281afd0f64c490`.
The historical notice in `app/vendor/` only names and links to this license;
it remains unchanged as release evidence. Include the full license text in the
next runtime package as well.

The submitted bundle's `highlightElement` method assigns original source text
with `e.textContent=i`, rather than assigning highlighted HTML. This disables
that legacy HTML sink; Mivu uses `highlight()` and sanitizes its output instead.
Do not call `highlightAll`, `highlightElement`, or restore an HTML assignment.

`highlight.readable.js` is a readable **formatting of the submitted bundle**,
not a claim that it is pristine upstream author source. Generate it with the
repository's existing Prettier 3.9.9 (development only):

```sh
node --input-type=module - <<'JS'
import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
const source = await readFile('firefox/app/vendor/highlight.min.js', 'utf8');
await writeFile('firefox/third-party/highlight.readable.js',
  await format(source, { parser: 'babel', singleQuote: true }));
JS
```

The readable file SHA-256 is
`cd67a7ccad587b912ae62a86dd8cd1760d3f8ec570d0fc3e039410e0bda3e3ee`.
The original uploaded minified file remains the packaging input. The readable
copy is supplied for inspection, with a test checking behavioral agreement.

**Remaining provenance requirement:** the submitted 132,023-byte bundle is not
identical to the official 108,898-byte
[CDN-release 11.0.1 distribution](https://github.com/highlightjs/cdn-release/blob/11.0.1/build/highlight.min.js)
or the equivalent official `@highlightjs/cdn-assets@11.0.1` npm file, whose
SHA-256 is `76a081f13bd654afad6930d5d1db880c954020d6eec1f95022c725309def29bd`.
Grammar layout and minification differ as well as the documented safety change.
The supplied source archive does not contain the original assembly/minifier
command. Regenerating that exact bundle from upstream author sources is **not
proven**. Do not describe the whole vendor build as reproducible from upstream.
Provide these details to Mozilla reviewers; obtain the original generator or use
a documented, reproducible upstream dependency build in a new Firefox version.
Do not replace v0.1.0 to conceal this gap.

Mozilla requires [third-party source links and exact release provenance](https://extensionworkshop.com/documentation/publish/third-party-library-usage/)
and [matching readable sources/build instructions when code is transformed](https://extensionworkshop.com/documentation/publish/source-code-submission/).
Passing lint does not confirm that the reviewer-source requirement is satisfied.

## Advisory review — 2026-10-08

The official npm bulk-advisory endpoint returned no advisories for the declared
versions on this date. Maintainer advisories were also reviewed:

- Marked [block.def ReDoS](https://github.com/markedjs/marked/security/advisories/GHSA-rrrm-qjm4-v8hf)
  and [reflinkSearch ReDoS](https://github.com/markedjs/marked/security/advisories/GHSA-5v2h-r2cx-5xgj)
  describe versions before 4.0.9; both were patched by 4.0.10.
- Marked [2026 tokenizer OOM](https://github.com/markedjs/marked/security/advisories/GHSA-6v9c-7cg6-27q7)
  affects 18.0.0 and 18.0.1, not 4.0.19.
- highlight.js [grammar ReDoS](https://github.com/highlightjs/highlight.js/security/advisories/GHSA-7wwv-vh3v-89cq)
  covers 9.x and versions through 10.4.0; [prototype pollution](https://github.com/highlightjs/highlight.js/security/advisories/GHSA-vfrc-7r7c-w9mx)
  covers older 7–10 releases, with fixes in 9.18.2/10.1.2.

This is a dated check, not proof that these legacy dependencies are safe or still
supported. The custom highlight.js bundle's upstream regeneration gap limits
provenance confidence. Recheck advisories and upgrade deliberately for the next
Firefox release, with rendering and security regressions before submission.
