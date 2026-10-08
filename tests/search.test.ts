import { describe, expect, it } from 'vitest';
import { clearMatches, highlightMatches } from '../src/features/search';
import { renderMarkdown } from '../src/core/markdown';

describe('document search', () => {
  it('matches phrases across inline formatting while preserving document structure', () => {
    const root = document.createElement('article');
    root.append(
      renderMarkdown(
        'A **quiet** place.\n\nA quiet place.\n\n`A quiet` place.',
      ),
    );
    expect(highlightMatches(root, 'a quiet place').groups).toHaveLength(3);
    expect(root.querySelector('strong mark')?.textContent).toBe('quiet');
    clearMatches(root);
    expect(root.querySelector('mark')).toBeNull();
    expect(root.querySelector('strong')?.textContent).toBe('quiet');
  });
  it('handles Persian, literal regex characters, and empty queries', () => {
    const root = document.createElement('article');
    root.textContent = 'سلام سلام [x] 1.0';
    expect(highlightMatches(root, 'سلام').groups).toHaveLength(2);
    expect(highlightMatches(root, '[x]').groups).toHaveLength(1);
    expect(highlightMatches(root, '1.0').groups).toHaveLength(1);
    expect(highlightMatches(root, '').groups).toHaveLength(0);
    expect(root.textContent).toBe('سلام سلام [x] 1.0');
  });
  it('preserves mixed-prose direction and text across formatted English matches', () => {
    const root = document.createElement('article');
    root.append(
      renderMarkdown('Event **Service** بین برنامه و سرویس قرار دارد.'),
    );
    const text = root.textContent;
    expect(highlightMatches(root, 'Event Service').groups).toHaveLength(1);
    expect(root.querySelector('p')?.getAttribute('dir')).toBe('rtl');
    clearMatches(root);
    expect(root.textContent).toBe(text);
    expect(root.querySelector('p')?.getAttribute('dir')).toBe('rtl');
    expect(root.querySelector('strong')?.textContent).toBe('Service');
  });
  it('does not join separate blocks and reports the highlighting limit honestly', () => {
    const root = document.createElement('article');
    root.innerHTML = '<p>hello</p><p>world</p>';
    expect(highlightMatches(root, 'helloworld').groups).toHaveLength(0);
    root.textContent = 'x '.repeat(2100);
    const matches = highlightMatches(root, 'x');
    expect(matches.groups).toHaveLength(2000);
    expect(matches.truncated).toBe(true);
  });
});
