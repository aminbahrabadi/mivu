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

export const parser = new MarkdownIt({
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

export function* markdownChunks(source: string): Generator<string> {
  const env = {};
  const tokens = parser.parse(source, env);
  let start = 0;
  let html = '';
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (token.level !== 0 || token.nesting === 1) continue;
    html += parser.renderer.render(
      tokens.slice(start, index + 1),
      parser.options,
      env,
    );
    start = index + 1;
    if (html.length >= 48_000) {
      yield html;
      html = '';
    }
  }
  if (html) yield html;
}
