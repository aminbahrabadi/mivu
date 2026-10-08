import MarkdownIt from 'markdown-it';
import tasks from 'markdown-it-task-lists';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import { sanitizeHtml } from './security';
import { classifyReference } from './links';

for (const [name, grammar] of Object.entries({
  bash,
  css,
  javascript,
  json,
  python,
  rust,
  typescript,
  xml,
}))
  hljs.registerLanguage(name, grammar);

const parser = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, language) {
    if (language && hljs.getLanguage(language) && code.length <= 100_000) {
      try {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value;
      } catch {
        /* Plain code remains readable. */
      }
    }
    return '';
  },
}).use(tasks, { enabled: false });

parser.validateLink = (value) =>
  typeof value === 'string' && classifyReference(value).kind !== 'blocked';
parser.renderer.rules.image = (tokens, index) => {
  const token = tokens[index]!;
  const source = token.attrGet('src');
  const alt = parser.utils.escapeHtml(token.content);
  return `<img data-image-ref="${parser.utils.escapeHtml(typeof source === 'string' ? source : '')}" alt="${alt}">`;
};

export function renderMarkdown(source: string): DocumentFragment {
  const fragment = sanitizeHtml(parser.render(source));
  const headings = new Map<string, number>();
  for (const block of fragment.querySelectorAll(
    'h1,h2,h3,h4,h5,h6,p,li,blockquote,th,td',
  ))
    block.setAttribute('dir', 'auto');
  for (const code of fragment.querySelectorAll('code,pre'))
    code.setAttribute('dir', 'ltr');
  for (const heading of fragment.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const slug = (heading.textContent ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const count = headings.get(slug) ?? 0;
    headings.set(slug, count + 1);
    heading.id = count === 0 ? slug : `${slug}-${count}`;
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
