import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/core/markdown';
import { sanitizeHtml } from '../src/core/security';
import { classifyReference } from '../src/core/links';
import { loadImages } from '../src/ui/reader';

describe('Markdown reading pipeline', () => {
  it('does not attach stale image replies or lose the reason for missing images', async () => {
    const article = document.createElement('article');
    article.append(renderMarkdown('![missing](missing.png)'));
    document.body.append(article);
    await loadImages(article, async () => {
      throw new Error('missing');
    });
    expect(article.textContent).toContain('Local image unavailable');
    article.remove();
    const detached = document.createElement('article');
    detached.append(renderMarkdown('![old](old.png)'));
    document.body.append(detached);
    let resolve!: (value: string) => void;
    const loading = loadImages(
      detached,
      () =>
        new Promise((value) => {
          resolve = value;
        }),
    );
    detached.remove();
    resolve('data:image/png;base64,AA==');
    await loading;
    expect(detached.querySelector('img')?.hasAttribute('src')).toBe(false);
  });
  it('renders GFM tables, nested lists, task lists, strikeout and highlighting', () => {
    const html = renderMarkdown(
      '# Title\n\n~~old~~ **bold** *soft*\n\n- [x] done\n- [ ] next\n  - child\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```rust\nfn main() {}\n```\n\nhttps://example.org',
    );
    expect(html.querySelectorAll('table td')).toHaveLength(2);
    expect(html.querySelector('ul ul')).not.toBeNull();
    expect(html.querySelector('s')?.textContent).toBe('old');
    expect(html.querySelector('.hljs-keyword')).not.toBeNull();
    expect(html.querySelectorAll('input:disabled')).toHaveLength(2);
    expect(html.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.org',
    );
  });
  it('escapes unsupported code languages and malformed Markdown', () => {
    const html = renderMarkdown(
      '```unknown\n<script>alert(1)</script>\n```\n\n[broken',
    );
    expect(html.querySelector('script')).toBeNull();
    expect(html.querySelector('code')?.textContent).toContain('<script>');
  });
  it('removes active HTML, event handlers, dangerous URLs and untrusted image sources', () => {
    const html = sanitizeHtml(
      '<script>x</script><iframe src="https://evil.test"></iframe><object></object><embed><img src="https://evil.test/pixel" onerror="x"><a href="javascript:alert(1)">x</a><input type="text"><input type="checkbox">',
    );
    expect(
      html.querySelector('script,iframe,object,embed,input[type=text]'),
    ).toBeNull();
    expect(html.querySelector('img')?.hasAttribute('src')).toBe(false);
    expect(html.querySelector('img')?.hasAttribute('onerror')).toBe(false);
    expect(html.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(html.querySelector<HTMLInputElement>('input')?.disabled).toBe(true);
    expect(
      renderMarkdown('[x](javascript:alert(1))').querySelector('a'),
    ).toBeNull();
  });
  it('creates inert local-image references and blocks remote images without reading them', async () => {
    const article = document.createElement('article');
    article.append(
      renderMarkdown(
        '![local](images/a.png)\n\n![tracking](https://evil.test/pixel.png)',
      ),
    );
    document.body.append(article);
    expect(article.querySelector('img')?.getAttribute('src')).toBeNull();
    const requested: string[] = [];
    await loadImages(article, async (path) => {
      requested.push(path);
      return 'data:image/png;base64,AA==';
    });
    expect(requested).toEqual(['images/a.png']);
    expect(article.textContent).toContain('Remote image blocked');
    article.remove();
  });
  it('gives each block its own direction and keeps code left-to-right', () => {
    const html = renderMarkdown(
      '# راهنما\n\nسلام با `pnpm build` کار کنید.\n\nEnglish paragraph.\n\n| فارسی | English |\n| - | - |\n| متن | text |\n\n```bash\npnpm build\n```',
    );
    expect(html.querySelectorAll('p[dir=auto]')).toHaveLength(2);
    expect(html.querySelector('td')?.getAttribute('dir')).toBe('auto');
    expect(html.querySelector('pre')?.getAttribute('dir')).toBe('ltr');
    expect(html.querySelector('code')?.getAttribute('dir')).toBe('ltr');
    expect(html.querySelector('h1')?.id).toBe('راهنما');
  });
  it('creates stable unique heading anchors', () => {
    expect(
      Array.from(
        renderMarkdown('# Hello\n\n# Hello\n\n# Hello').querySelectorAll('h1'),
      ).map((h) => h.id),
    ).toEqual(['hello', 'hello-1', 'hello-2']);
  });
});

describe('reference classification', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///etc/passwd',
    '//evil.test',
    '/etc/passwd',
    'C:\\secret.md',
    'a%00.md',
    '%2fetc/passwd',
    'a%5cb.md',
    'a%ZZ',
    'vbscript:x',
    'https://user:secret@evil.test',
  ])('rejects %s', (value) => {
    expect(classifyReference(value).kind).toBe('blocked');
  });
  it('decodes Unicode and spaces once, retaining a document-relative path', () => {
    expect(
      classifyReference('docs/%D8%B3%D9%84%D8%A7%D9%85%20world.md#intro'),
    ).toEqual({ kind: 'local', path: 'docs/سلام world.md', fragment: 'intro' });
    expect(classifyReference('../other.md').kind).toBe('local');
    expect(classifyReference('#راهنما')).toEqual({
      kind: 'fragment',
      fragment: 'راهنما',
    });
  });
});
