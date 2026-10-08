import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const parser = new MarkdownIt({ html: false, linkify: true });

export function renderMarkdown(source: string): DocumentFragment {
  return DOMPurify.sanitize(parser.render(source), {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ['img'],
  });
}
