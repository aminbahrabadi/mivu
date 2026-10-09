import { expect, it } from 'vitest';
import { embeddedImageSource } from '../src/core/images';
import { renderMarkdown } from '../src/core/markdown';
import { sanitizeHtml } from '../src/core/security';
import { classifyReference } from '../src/core/links';
import { loadImages } from '../src/ui/reader';

const pngHeader = '\x89PNG\r\n\x1a\n';
const png = `data:image/png;base64,${btoa(pngHeader)}`;

it.each([
  ['png', pngHeader],
  ['jpeg', '\xff\xd8\xff'],
  ['gif', 'GIF87a'],
  ['gif', 'GIF89a'],
  ['webp', 'RIFF\x00\x00\x00\x00WEBP'],
])(
  'accepts a matching %s signature and normalizes the MIME prefix',
  (type, header) => {
    const payload = btoa(header);
    expect(
      embeddedImageSource(`DATA:image/${type.toUpperCase()};BASE64,${payload}`),
    ).toBe(`data:image/${type};base64,${payload}`);
  },
);

it.each([
  'data:image/svg+xml;base64,' + btoa('<svg onload="alert(1)"></svg>'),
  'data:text/html;base64,' + btoa('<script>alert(1)</script>'),
  'javascript:alert(1)',
  'data:image/png;base64,' + btoa('<svg onload="alert(1)"></svg>'),
  'data:image/jpeg;base64,' + btoa(pngHeader),
  'data:image/webp;base64,' + btoa('RIFF1234HTML'),
  'data:image/png;base64,',
  'data:image/png;base64,AA===',
  'data:image/png;base64,====',
  'data:image/png;base64,iVBO Rw0KGgo=',
  'data:image/png;base64,iVBORw0KGgoAAAA\n',
  'data:image/png;base64,iVBORw0KGgoAAAA\r',
  'data:image/png;base64,iVBORw0KGgo%3D',
  'data:image/png;name=x;base64,' + btoa(pngHeader),
  'data:image/png,' + encodeURIComponent(pngHeader),
])('rejects unsafe, malformed or mismatched embedded input: %s', (source) => {
  expect(embeddedImageSource(source)).toBeNull();
  expect(
    renderMarkdown(`![untrusted](<${source}>)`).querySelector('img'),
  ).toBeNull();
  expect(classifyReference(source).kind).toBe('blocked');
});

it('enforces the decoded four-MiB limit before scanning or decoding oversized images', () => {
  const bytes = pngHeader + 'A'.repeat(4 * 1024 * 1024 - pngHeader.length);
  expect(
    embeddedImageSource('data:image/png;base64,' + btoa(bytes)),
  ).not.toBeNull();
  expect(
    embeddedImageSource('data:image/png;base64,' + btoa(bytes + 'A')),
  ).toBeNull();
});

it('keeps untrusted embedded sources inert until they pass image validation', async () => {
  const article = document.createElement('article');
  article.append(
    sanitizeHtml(
      `<img src="${png}" data-image-ref="data:image/svg+xml;base64,${btoa('<svg onload="alert(1)"></svg>')}" onerror="alert(1)">`,
    ),
  );
  document.body.append(article);
  try {
    expect(article.querySelector('img')?.hasAttribute('src')).toBe(false);
    expect(article.querySelector('img')?.hasAttribute('onerror')).toBe(false);
    const reads: string[] = [];
    await loadImages(article, async (path) => {
      reads.push(path);
      throw new Error('No filesystem access');
    });
    expect(reads).toEqual([]);
    expect(article.querySelector('img')).toBeNull();
    expect(article.textContent).toContain('Image unavailable');
  } finally {
    article.remove();
  }
});

it('applies the image-count cap to embedded sources and handles decoder errors', async () => {
  const article = document.createElement('article');
  article.append(renderMarkdown(`![embedded](<${png}>)\n\n`.repeat(129)));
  document.body.append(article);
  try {
    await loadImages(article, async () => {
      throw new Error('No local reads');
    });
    expect(article.querySelectorAll('img[src]')).toHaveLength(128);
    expect(article.querySelectorAll('.image-placeholder')).toHaveLength(1);
    article.querySelector('img')!.dispatchEvent(new Event('error'));
    expect(article.querySelectorAll('img[src]')).toHaveLength(127);
    expect(article.textContent).toContain('Image could not be decoded');
  } finally {
    article.remove();
  }
});

it('shares the encoded-byte budget between local and embedded images', async () => {
  const large =
    'data:image/png;base64,' +
    btoa(pngHeader + 'A'.repeat(4 * 1024 * 1024 - pngHeader.length));
  const article = document.createElement('article');
  article.append(
    renderMarkdown(
      '![embedded][large]\n\n' +
        '![local](local.png)\n\n'.repeat(5) +
        `[large]: <${large}>`,
    ),
  );
  document.body.append(article);
  try {
    await loadImages(article, async () => large);
    expect(article.querySelectorAll('img[src]')).toHaveLength(5);
    expect(article.querySelectorAll('.image-placeholder')).toHaveLength(1);
  } finally {
    article.remove();
  }
});
