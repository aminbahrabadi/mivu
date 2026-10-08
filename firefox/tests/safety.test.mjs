import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MARKDOWN_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  isMarkdownFile,
  classifyLink,
  imageBasename,
  rasterMime,
} from '../app/safety.mjs';

test('accepts Markdown filenames without granting filesystem access', () => {
  for (const name of ['README.md', 'notes.MARKDOWN', 'راهنما with spaces.md'])
    assert.equal(isMarkdownFile(name), true);
  for (const name of ['', 'notes.md.exe', 'notes.txt', null, {}, 'readme.md\n'])
    assert.equal(isMarkdownFile(name), false);
});

test('classifies explicit external links and blocks active or filesystem schemes', () => {
  for (const url of [
    'https://example.org/a',
    'HTTP://example.org',
    'mailto:you@example.org',
  ])
    assert.equal(classifyLink(url), 'external');
  for (const url of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,hi',
    'vbscript:foo',
    'file:///etc/passwd',
    'blob:x',
    '//example.org',
    '\\\\host\\file',
    '/etc/passwd',
    'https://ex\u0000ample.org',
    'java\nscript:x',
    '',
    null,
  ])
    assert.equal(classifyLink(url), 'blocked', String(url));
  assert.equal(classifyLink('#heading'), 'anchor');
  for (const url of [
    'next.md',
    '../next.md',
    '%6aavascript%3Aalert(1)',
    'javascript&#58;x',
  ])
    assert.equal(classifyLink(url), 'local'); // Local classifications never become navigable links.
});

test('resolves only basenames of explicitly selected raster images', () => {
  assert.equal(imageBasename('images/Photo.PNG?size=2#caption'), 'photo.png');
  assert.equal(imageBasename('images/%D8%B9%DA%A9%D8%B3.png'), 'عکس.png');
  for (const path of [
    '../secret.png',
    'a/%2e%2e/secret.png',
    '%2fetc%2fsecret.png',
    'file:///secret.png',
    'https://example.org/a.png',
    'data:image/png,x',
    'a\\b.png',
    'a//b.png',
    'a/%00b.png',
    '%ZZ.png',
    'photo.svg',
    'a'.repeat(2049),
  ])
    assert.equal(imageBasename(path), null, path);
});

test('validates matching raster extensions and magic bytes, never SVG', () => {
  const vectors = [
    ['a.png', [137, 80, 78, 71, 13, 10, 26, 10], 'image/png'],
    ['a.jpeg', [255, 216, 255], 'image/jpeg'],
    ['a.gif', [...Buffer.from('GIF89a')], 'image/gif'],
    ['a.webp', [...Buffer.from('RIFFxxxxWEBP')], 'image/webp'],
  ];
  for (const [name, bytes, mime] of vectors) {
    assert.equal(rasterMime(name, new Uint8Array(bytes)), mime);
    assert.equal(rasterMime(name, new Uint8Array(bytes.slice(0, 2))), null);
    assert.equal(rasterMime('a.svg', new Uint8Array(bytes)), null);
  }
  assert.equal(
    rasterMime('a.png', new Uint8Array(Buffer.from('<svg onload="x"/>'))),
    null,
  );
  assert.equal(rasterMime('a.jpg', new Uint8Array(vectors[0][1])), null);
  assert.equal(MAX_MARKDOWN_BYTES, 8 * 1024 * 1024);
  assert.equal(MAX_IMAGE_BYTES, 12 * 1024 * 1024);
  assert.equal(MAX_IMAGE_COUNT, 30);
});
