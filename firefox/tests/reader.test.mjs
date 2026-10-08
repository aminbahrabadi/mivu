import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import * as safety from '../app/safety.mjs';

const app = new URL('../app/', import.meta.url);
function harness() {
  const dom = new JSDOM(readFileSync(new URL('reader.html', app), 'utf8'), {
    url: 'https://mivu.test/reader.html',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  w.__safety = safety;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.Uint8Array = Uint8Array; // The imported safety module and reader share a realm in Firefox.
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  const active = new Set();
  const revoked = [];
  w.URL.createObjectURL = () => {
    const url = `blob:mivu/${active.size}-${revoked.length}`;
    active.add(url);
    return url;
  };
  w.URL.revokeObjectURL = (url) => {
    active.delete(url);
    revoked.push(url);
  };
  for (const name of ['vendor/marked.js', 'vendor/highlight.min.js'])
    vm.runInContext(
      readFileSync(new URL(name, app), 'utf8'),
      dom.getInternalVMContext(),
    );
  // Execute the exact reader body; only replace its ESM import with the real module exports.
  const source = readFileSync(new URL('reader.js', app), 'utf8').replace(
    /^import (\{[^\n]+\}) from '\.\/safety\.mjs';/,
    'const $1 = globalThis.__safety;',
  );
  Object.assign(
    w,
    vm.runInContext(
      `(() => { ${source}\nreturn {
    openFile, addImages, sanitizeHtml, applyTheme, openSearch, closeSearch,
    updateSearch, navigateMatch, readMarkdown
  }; })()`,
      dom.getInternalVMContext(),
    ),
  );
  return {
    dom,
    w,
    active,
    revoked,
    article: w.document.getElementById('document'),
  };
}
const file = (text, name = 'README.md') => {
  const bytes =
    typeof text === 'string' ? new TextEncoder().encode(text) : text;
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
};

test('full rendering pipeline supports GFM, inert tasks, highlighting and per-block RTL', async () => {
  const { dom, w, article } = harness();
  try {
    await w.openFile(
      file(
        '# راهنمای Mivu\n\nEnglish **bold** and ~~old~~.\n\nمتن فارسی با `npm install` و English.\n\n- parent\n  - nested\n- [x] done\n\n> quote\n\n| فارسی | English |\n| --- | --- |\n| عدد ۱۲ | 42 |\n\n```js\nconst value = 1;\n```\n\n```unknown\n<unsafe>\n```',
      ),
    );
    assert.equal(article.querySelector('h1').textContent, 'راهنمای Mivu');
    assert.ok(article.querySelector('strong'));
    assert.ok(article.querySelector('del'));
    assert.ok(article.querySelector('li li'));
    assert.ok(article.querySelector('table'));
    assert.ok(article.querySelector('blockquote'));
    assert.equal(article.querySelector('input').disabled, true);
    assert.equal(article.querySelector('input').checked, true);
    assert.ok(article.querySelector('code .hljs-keyword'));
    assert.equal(
      article.querySelectorAll('pre code')[1].textContent,
      '<unsafe>',
    );
    for (const node of article.querySelectorAll('h1,p,li,th,td'))
      assert.equal(node.dir, 'auto');
    for (const node of article.querySelectorAll('pre,code'))
      assert.equal(node.dir, 'ltr');
  } finally {
    dom.window.close();
  }
});

test('adversarial Markdown cannot supply active nodes, arbitrary images or navigation', async () => {
  const { dom, w, article } = harness();
  try {
    await w.openFile(
      file(
        [
          '<script>globalThis.pwned=1</script>',
          '<img src="https://evil.test/a" onerror="pwned=1">',
          '<svg><a href="javascript:x">SVG</a></svg>',
          '<math><mtext><img src=x onerror=x></mtext></math>',
          '<iframe src="https://evil.test"></iframe>',
          '<form id="document"><input name="__proto__"></form>',
          '[bad](javascript:alert%281%29)',
          '[encoded](%6aavascript%3Aalert%281%29)',
          '[entity](javascript&#58;alert%281%29)',
          '[relative](../secret.md)',
          '[anchor](#heading)',
          '[good](https://example.org/)',
          '![remote](https://evil.test/image.png)',
          '![escape](../private.png)',
          '![local](images/photo.png)',
          '```html\n<img onerror=x>\n```',
        ].join('\n\n'),
      ),
    );
    assert.equal(w.pwned, undefined);
    assert.equal(
      article.querySelector('script,svg,math,iframe,object,embed,form,img'),
      null,
    );
    assert.equal(article.querySelectorAll('a').length, 1);
    assert.equal(
      article.querySelector('a').getAttribute('href'),
      'https://example.org/',
    );
    assert.equal(article.querySelector('a').rel, 'noopener noreferrer');
    for (const element of article.querySelectorAll('*'))
      for (const attribute of element.attributes)
        assert.ok(
          !/^on|^(?:src|id|name|style)$/i.test(attribute.name),
          attribute.name,
        );
    assert.equal(article.querySelectorAll('[data-md-image]').length, 3);
  } finally {
    dom.window.close();
  }
});

test('sanitizer independently strips handlers, namespace payloads and clobbering attributes', () => {
  const { dom, w } = harness();
  try {
    const fragment = w.sanitizeHtml(
      '<p id="document" name="x" style="color:red" onclick="x">text</p><!-- x --><svg><foreignObject><p>bad</p></foreignObject></svg><math><mi>x</mi></math><a href="JaVaScRiPt:x">x</a><input type="text" onfocus="x"><img src="https://evil.test"><object data="file:///etc/passwd"></object><div><p>safe</p></div>',
    );
    const holder = w.document.createElement('section');
    holder.append(fragment);
    assert.equal(
      holder.querySelector(
        '[id],[name],[style],[onclick],[onfocus],[href],svg,math,img,object',
      ),
      null,
    );
    assert.equal(holder.querySelector('input').type, 'checkbox');
    assert.equal(holder.querySelector('input').disabled, true);
    assert.ok(holder.textContent.includes('safe'));
  } finally {
    dom.window.close();
  }
});

test('file validation handles UTF-8, BOM, empty, oversized and failed replacement', async () => {
  const { dom, w, article } = harness();
  try {
    await w.openFile(file('\uFEFF# First', 'راهنما.markdown'));
    assert.equal(w.document.title, 'راهنما.markdown — Mivu');
    await w.openFile(file('wrong', 'no.txt'));
    assert.ok(
      w.document.getElementById('error').textContent.includes('.markdown'),
    );
    assert.equal(article.querySelector('h1').textContent, 'First');
    await w.openFile(file(new Uint8Array([255])));
    assert.ok(w.document.getElementById('error').textContent.includes('UTF-8'));
    let read = false;
    await w.openFile({
      name: 'huge.md',
      size: safety.MAX_MARKDOWN_BYTES + 1,
      arrayBuffer: () => {
        read = true;
      },
    });
    assert.equal(read, false);
    assert.ok(w.document.getElementById('error').textContent.includes('8 MiB'));
    await w.openFile(file(''));
    assert.equal(article.textContent, '');
    assert.equal(w.document.getElementById('error').hidden, true);
    assert.equal(article.hidden, false);
  } finally {
    dom.window.close();
  }
});

test('selected images are bounded and object URLs are released on errors, switching and pagehide', async () => {
  const { dom, w, article, active, revoked } = harness();
  try {
    await w.openFile(file('![photo](images/photo.png)'));
    const png = file(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      'photo.png',
    );
    await w.addImages([png]);
    assert.equal(
      article.querySelector('img').getAttribute('src').startsWith('blob:'),
      true,
    );
    assert.equal(active.size, 1);
    await w.addImages([png, file('not a PNG', 'bad.png')]);
    assert.equal(active.size, 1); // Failed selection retains existing authorized images.
    assert.equal(revoked.length, 1);
    await w.addImages([png, { ...png, name: 'PHOTO.PNG' }]);
    assert.ok(
      w.document.getElementById('error').textContent.includes('Ambiguous'),
    );
    await w.addImages(Array.from({ length: 31 }, () => png));
    assert.ok(w.document.getElementById('error').textContent.includes('30'));
    await w.addImages([{ ...png, size: safety.MAX_IMAGE_BYTES + 1 }]);
    assert.ok(
      w.document.getElementById('error').textContent.includes('12 MiB'),
    );
    await w.openFile(file('# Another'));
    assert.equal(active.size, 0);
    await w.addImages([png]);
    w.dispatchEvent(new w.Event('pagehide'));
    assert.equal(active.size, 0);
  } finally {
    dom.window.close();
  }
});

test('theme fallback, persistent selection, literal search, cap and keyboard zoom', async () => {
  const { dom, w, article } = harness();
  try {
    w.applyTheme('dark');
    assert.equal(w.document.documentElement.dataset.theme, 'dark');
    assert.equal(w.localStorage.getItem('mivu-theme'), 'dark');
    w.applyTheme('invalid');
    assert.equal(w.document.documentElement.hasAttribute('data-theme'), false);
    w.applyTheme('light');
    await w.openFile(
      file('A **formatted** word. Plain word.\n\n' + 'needle '.repeat(600)),
    );
    w.openSearch();
    const search = w.document.getElementById('search-input');
    search.value = 'word';
    w.updateSearch();
    assert.equal(article.querySelectorAll('mark').length, 2);
    assert.equal(
      w.document.getElementById('search-count').textContent,
      '1 of 2',
    );
    w.navigateMatch(-1);
    assert.equal(
      w.document.getElementById('search-count').textContent,
      '2 of 2',
    );
    search.value = 'needle';
    w.updateSearch();
    assert.equal(article.querySelectorAll('mark').length, 500);
    w.closeSearch();
    assert.equal(article.querySelectorAll('mark').length, 0);
    assert.ok(article.textContent.includes('formatted'));
    const key = (value) =>
      w.dispatchEvent(
        new w.KeyboardEvent('keydown', { key: value, ctrlKey: true }),
      );
    key('+');
    assert.equal(w.document.getElementById('zoom-status').textContent, '110%');
    key('0');
    assert.equal(w.document.getElementById('zoom-status').textContent, '100%');
    key('f');
    assert.equal(w.document.getElementById('searchbar').hidden, false);
    key('Escape');
    assert.equal(w.document.getElementById('searchbar').hidden, true);
  } finally {
    dom.window.close();
  }
});

test('toolbar background opens only its own page without reading a tab', () => {
  let onClick, opened;
  vm.runInNewContext(readFileSync(new URL('background.js', app), 'utf8'), {
    browser: {
      action: {
        onClicked: {
          addListener: (callback) => {
            onClick = callback;
          },
        },
      },
      runtime: { getURL: (path) => `moz-extension://test/${path}` },
      tabs: {
        create: (options) => {
          opened = options.url;
        },
      },
    },
  });
  onClick();
  assert.equal(opened, 'moz-extension://test/reader.html');
});

test('accepts the maximum bounded UTF-8 read and rejects broken reads', async () => {
  const { dom, w } = harness();
  try {
    const bytes = new Uint8Array(safety.MAX_MARKDOWN_BYTES).fill(120);
    assert.equal(
      (await w.readMarkdown(file(bytes))).length,
      safety.MAX_MARKDOWN_BYTES,
    );
    await assert.rejects(
      w.readMarkdown({
        name: 'gone.md',
        size: 1,
        arrayBuffer: async () => {
          throw new Error('file unavailable');
        },
      }),
    );
  } finally {
    dom.window.close();
  }
});

test('readable reviewer copy agrees with the submitted highlighter across registered grammars', () => {
  const bundled = {},
    readable = {};
  vm.runInNewContext(
    readFileSync(new URL('vendor/highlight.min.js', app), 'utf8'),
    bundled,
  );
  vm.runInNewContext(
    readFileSync(new URL('../third-party/highlight.readable.js', app), 'utf8'),
    readable,
  );
  assert.equal(bundled.hljs.versionString, '11.0.1');
  assert.deepEqual(
    Array.from(bundled.hljs.listLanguages()),
    Array.from(readable.hljs.listLanguages()),
  );
  for (const language of bundled.hljs.listLanguages()) {
    const source =
      'const value = "دنیا <script>";\n// comment\nif (value) return 42;';
    const options = { language, ignoreIllegals: true };
    assert.equal(
      bundled.hljs.highlight(source, options).value,
      readable.hljs.highlight(source, options).value,
      language,
    );
  }
});
