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
    'h1,h2,h3,h4,h5,h6,p,li,blockquote,th,td',
  ))
    block.setAttribute('dir', 'auto');
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
