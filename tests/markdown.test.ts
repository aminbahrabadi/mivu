import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/core/markdown';
import { sanitizeHtml } from '../src/core/security';
import { classifyReference } from '../src/core/links';
import { loadImages } from '../src/ui/reader';
import embeddedFixture from './fixtures/embedded-images.md?raw';
import incompleteFixture from './fixtures/incomplete-export.md?raw';

describe('Markdown reading pipeline', () => {
  it('folds leaked diagram styles without inventing connections or changing code', () => {
    const html = renderMarkdown(incompleteFixture);
    const notice = html.querySelector('.incomplete-diagram');
    expect(notice?.querySelector('p')?.textContent).toContain(
      'Diagram unavailable',
    );
    expect(notice?.querySelectorAll('p')[1]?.textContent).toBe(
      'Django APIPostgreSQLRabbitMQWorker 1Worker 2',
    );
    expect(notice?.querySelector('details')?.open).toBe(false);
    expect(notice?.querySelector('pre code')?.textContent).toContain(
      '@keyframes',
    );
    expect(html.querySelector('pre code')?.textContent).toBe(
      'from django.db import transactionwith transaction.atomic():    order = Order.objects.create(user=user)    Payment.objects.create(order=order, amount=100)\n',
    );
    expect(html.querySelector('code.language-python')?.textContent).toBe(
      'with transaction.atomic():\n    order = Order.objects.create(user=user)\n    Payment.objects.create(order=order, amount=100)\n',
    );
    expect(html.querySelector('h2:last-of-type')?.textContent).toBe(
      'Following prose',
    );
  });

  it('keeps ordinary prose, incomplete style fragments and fenced CSS intact', () => {
    const css = '#chatgpt-mermaid-example{font-family:system-ui;}';
    const html = renderMarkdown(
      `Text ${css}\n\n\\${css}\n\n\`\`\`css\n${css}\n\`\`\``,
    );
    expect(html.querySelector('details')).toBeNull();
    expect(html.querySelector('pre code')?.textContent).toBe(css + '\n');
    expect(html.querySelectorAll('p')).toHaveLength(2);
  });

  it('keeps exported diagram CSS and markup inert', () => {
    const css =
      '#chatgpt-mermaid-example{font-family:system-ui;background:url(https://evil.test/pixel);}#chatgpt-mermaid-example :root{--mermaid-font-family:system-ui;}';
    const html = renderMarkdown(
      `\\${css}<img src="https://evil.test/pixel" onerror="alert(1)">`,
    );
    expect(html.querySelector('details code')?.textContent).toBe(css);
    expect(html.querySelector('.incomplete-diagram')?.textContent).toContain(
      '<img',
    );
    expect(html.querySelector('img,script,style,svg')).toBeNull();
    expect(html.querySelector('[style],[onerror]')).toBeNull();
  });

  it('renders embedded reference and inline images without filesystem or network access', async () => {
    const article = document.createElement('article');
    article.append(renderMarkdown(embeddedFixture));
    document.body.append(article);
    try {
      expect(article.querySelectorAll('img')).toHaveLength(5);
      const requested: string[] = [];
      await loadImages(article, async (path) => {
        requested.push(path);
        throw new Error('Embedded images must not request local files');
      });
      expect(requested).toEqual([]);
      expect(
        article.querySelectorAll('img[src^="data:image/png;base64,"]'),
      ).toHaveLength(4);
      expect(article.textContent).toContain('Remote image blocked');
      expect(article.textContent).not.toContain('![][image');
      expect(article.querySelector('a')?.hasAttribute('href')).toBe(false);
    } finally {
      article.remove();
    }
  });

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
    expect(html.querySelectorAll('p[dir=rtl]')).toHaveLength(1);
    expect(html.querySelectorAll('p[dir=ltr]')).toHaveLength(1);
    expect(html.querySelector('td')?.getAttribute('dir')).toBe('rtl');
    expect(html.querySelector('pre')?.getAttribute('dir')).toBe('ltr');
    expect(html.querySelector('code')?.getAttribute('dir')).toBe('ltr');
    expect(html.querySelector('h1')?.id).toBe('راهنما');
  });
  it('keeps English-prefixed Persian prose and list items right-to-left', () => {
    const html = renderMarkdown(
      'Event Service بین برنامه و سرویس قرار دارد.\n\n- DLQ نداریم.\n- malformed eventها skip و commit می‌شوند.\n\n1. HTTP پاسخ مناسب را برمی‌گرداند.',
    );
    expect(html.querySelector('p')?.getAttribute('dir')).toBe('rtl');
    expect(html.querySelector('ul')?.getAttribute('dir')).toBe('rtl');
    expect(html.querySelector('ol')?.getAttribute('dir')).toBe('rtl');
    for (const item of html.querySelectorAll('li'))
      expect(item.getAttribute('dir')).toBe('rtl');
  });
  it('keeps English prose with a short Persian quotation left-to-right', () => {
    const html = renderMarkdown(
      'This English paragraph includes «فقط بخوانید» and then continues in English.\n\nسلام is the Persian word for hello in this English sentence.',
    );
    for (const paragraph of html.querySelectorAll('p'))
      expect(paragraph.getAttribute('dir')).toBe('ltr');
  });
  it('does not let code, URLs or nested lists choose the surrounding prose direction', () => {
    const html = renderMarkdown(
      '`one two three four five six seven eight` توضیح فارسی است.\n\nhttps://example.org/one/two/three/four/five/six راهنمای فارسی است.\n\n- English parent.\n  - API برای خواندن در دسترس است.\n  - توضیح کامل به فارسی نوشته شده است.',
    );
    for (const paragraph of html.querySelectorAll('p'))
      expect(paragraph.getAttribute('dir')).toBe('rtl');
    expect(html.querySelector('ul')?.getAttribute('dir')).toBe('ltr');
    expect(html.querySelector('li')?.getAttribute('dir')).toBe('ltr');
    expect(html.querySelector('ul ul')?.getAttribute('dir')).toBe('rtl');
    expect(html.querySelector('code')?.getAttribute('dir')).toBe('ltr');
  });
  it('preserves mixed-script text and leaves digit-only blocks to the browser', () => {
    const source = 'API برای خواندن **providerهای** مختلف در دسترس است.';
    const html = renderMarkdown(source + '\n\n2026 ۰٫۱٫۰');
    expect(html.querySelector('p')?.getAttribute('dir')).toBe('rtl');
    expect(html.querySelector('p')?.textContent).toBe(
      'API برای خواندن providerهای مختلف در دسترس است.',
    );
    expect(html.querySelectorAll('p')[1]?.getAttribute('dir')).toBe('auto');
  });
  it.each([
    ['HTTP يرسل الرسائل إلى الخادم ويستقبل الردود.', 'rtl'],
    ['English prose، with a comma and digits ۱۲۳.', 'ltr'],
  ])(
    'handles script letters without treating punctuation as prose: %s',
    (source, direction) => {
      expect(
        renderMarkdown(source).querySelector('p')?.getAttribute('dir'),
      ).toBe(direction);
    },
  );
  it('creates stable unique heading anchors', () => {
    expect(
      Array.from(
        renderMarkdown('# Hello\n\n# Hello\n\n# Hello').querySelectorAll('h1'),
      ).map((h) => h.id),
    ).toEqual(['hello', 'hello-1', 'hello-2']);
    const ids = Array.from(
      renderMarkdown(
        '# Hello\n\n# Hello\n\n# Hello-1\n\n# !!!',
      ).querySelectorAll('h1'),
      (h) => h.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(Boolean)).toBe(true);
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
