import { test, expect } from 'vitest';
import fixture from './fixtures/reading.md?raw';
import { renderMarkdown } from '../src/core/markdown';

for (const size of [8, 64, 512]) {
  const source = fixture.repeat(
    Math.ceil((size * 1024) / new TextEncoder().encode(fixture).length),
  );
  test(
    `${size} KiB GFM → sanitized fragment (jsdom)`,
    { timeout: 60_000 },
    async ({ bench }) => {
      expect(renderMarkdown(source).querySelector('h1')?.textContent).toBe(
        'Reading, without the noise',
      );
      await bench(
        `render-${size}`,
        {
          writeResult: `test-results/render-${size}.json`,
        },
        () => {
          renderMarkdown(source);
        },
      ).run({ time: 500, iterations: 3, warmupTime: 100, warmupIterations: 1 });
    },
  );
}
