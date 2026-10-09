import { afterEach, expect, it, vi } from 'vitest';
import { markdownChunks, parser } from '../src/core/parser';
import { renderDocument } from '../src/core/render-document';
import fixture from './fixtures/reading.md?raw';
import embeddedFixture from './fixtures/embedded-images.md?raw';

afterEach(() => vi.unstubAllGlobals());

it('batches complete Markdown blocks without losing reference links or nested structures', () => {
  const source =
    (fixture + '\n[reference][target]\n\n').repeat(80) +
    '\n[target]: second.md\n';
  const parts = Array.from(markdownChunks(source));
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.join('')).toBe(parser.render(source));
});

it('retains embedded reference definitions across worker batches', () => {
  const parts = Array.from(markdownChunks(embeddedFixture.repeat(100)));
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.join('')).toBe(parser.render(embeddedFixture.repeat(100)));
  expect(
    (
      parts.join('').match(/<img data-image-ref="data:image\/png;base64,/gi) ??
      []
    ).length,
  ).toBe(400);
});

it('sanitizes worker output and terminates obsolete rendering', async () => {
  class TestWorker {
    static instance: TestWorker;
    onmessage?: (event: MessageEvent) => void;
    onerror?: () => void;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() {
      TestWorker.instance = this;
    }
  }
  vi.stubGlobal('Worker', TestWorker);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    callback(0),
  );
  const abort = new AbortController();
  const article = document.createElement('article');
  const rendering = renderDocument(
    '# Hello',
    (part) => article.append(part),
    abort.signal,
  );
  const worker = TestWorker.instance;
  worker.onmessage?.(
    new MessageEvent('message', {
      data: { html: '<h1>Hello</h1><script>evil()</script>', done: false },
    }),
  );
  expect(article.querySelector('h1')?.textContent).toBe('Hello');
  expect(article.querySelector('script')).toBeNull();
  abort.abort();
  expect(await rendering).toBe(false);
  expect(worker.terminate).toHaveBeenCalledOnce();
  worker.onmessage?.(
    new MessageEvent('message', { data: { html: '<p>Stale</p>', done: true } }),
  );
  expect(article.querySelector('p')).toBeNull();
});
