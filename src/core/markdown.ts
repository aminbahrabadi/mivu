import { parser } from './parser';
import { sanitizeHtml } from './security';
import { classifyReference } from './links';

export function renderMarkdown(source: string): DocumentFragment {
  return renderHtml(parser.render(source));
}

export function renderHtml(
  html: string,
  headings = new Set<string>(),
): DocumentFragment {
  const fragment = sanitizeHtml(html);
  for (const block of fragment.querySelectorAll(
    'h1,h2,h3,h4,h5,h6,p,li,ul,ol,blockquote,th,td',
  ))
    block.setAttribute('dir', readingDirection(block));
  for (const code of fragment.querySelectorAll('code,pre'))
    code.setAttribute('dir', 'ltr');
  for (const pre of fragment.querySelectorAll('pre')) {
    pre.tabIndex = 0;
    pre.setAttribute('role', 'region');
    pre.setAttribute('aria-label', 'Scrollable code block');
  }
  for (const heading of fragment.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const slug = (heading.textContent ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
      .replace(/\s/g, '-');
    let id = slug || 'section';
    let suffix = 0;
    while (headings.has(id)) id = `${slug || 'section'}-${++suffix}`;
    headings.add(id);
    heading.id = id;
  }
  for (const link of fragment.querySelectorAll('a')) {
    if (classifyReference(link.getAttribute('href') ?? '').kind === 'blocked')
      link.removeAttribute('href');
    link.setAttribute('dir', 'auto');
  }
  for (const table of fragment.querySelectorAll('table')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Scrollable table');
    table.replaceWith(wrapper);
    wrapper.append(table);
  }
  return fragment;
}

function readingDirection(block: Element): 'rtl' | 'ltr' | 'auto' {
  const walker = block.ownerDocument.createTreeWalker(
    block,
    NodeFilter.SHOW_TEXT,
  );
  const parts: string[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const excluded = node.parentElement?.closest('code,pre,ul,ol');
    parts.push(
      excluded && excluded !== block && block.contains(excluded)
        ? ' '
        : (node.textContent ?? ''),
    );
  }
  const words =
    parts
      .join('')
      .replace(/\b(?:https?:\/\/|mailto:)\S+/giu, '')
      .match(/\p{L}[\p{L}\p{M}\u200c\u200d]*/gu) ?? [];
  let rtl = 0;
  let ltr = 0;
  for (const word of words) {
    if (/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(word)) rtl++;
    else if (/\p{Script=Latin}/u.test(word)) ltr++;
  }
  if (!rtl && !ltr) return 'auto';
  // Persian technical prose often starts with an English acronym or product name.
  return rtl / (rtl + ltr) >= 0.4 ? 'rtl' : 'ltr';
}
