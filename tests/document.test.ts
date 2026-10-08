import { describe, expect, it } from 'vitest';
import { errorMessage } from '../src/core/document';
import { renderMarkdown } from '../src/core/markdown';

describe('native document presentation', () => {
  it('renders headings and UTF-8 without interpreting source HTML', () => {
    const rendered = renderMarkdown('# سلام\n\n<script>alert(1)</script>');
    expect(rendered.querySelector('h1')?.textContent).toBe('سلام');
    expect(rendered.querySelector('script')).toBeNull();
  });
  it('presents native and JavaScript failures without assuming their type', () => {
    expect(errorMessage('Missing file')).toBe('Missing file');
    expect(errorMessage(new Error('Failed'))).toBe('Failed');
    expect(errorMessage(null)).toContain('Please try again');
  });
});
