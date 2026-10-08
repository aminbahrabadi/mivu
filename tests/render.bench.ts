import { bench, describe } from 'vitest';
import fixture from './fixtures/reading.md?raw';
import { renderMarkdown } from '../src/core/markdown';

describe('Markdown → sanitized document fragment (jsdom)', () => {
  for (const size of [8, 64, 512]) {
    const source = fixture.repeat(Math.ceil((size * 1024) / fixture.length));
    bench(
      `${size} KiB representative GFM`,
      () => {
        renderMarkdown(source);
      },
      { time: 500, iterations: 3 },
    );
  }
});
