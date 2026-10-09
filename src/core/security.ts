import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): DocumentFragment {
  const fragment = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'strong',
      'em',
      's',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'hr',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'span',
      'input',
    ],
    ALLOWED_ATTR: [
      'href',
      'alt',
      'title',
      'class',
      'start',
      'align',
      'type',
      'checked',
      'disabled',
      'data-image-ref',
    ],
    ALLOW_DATA_ATTR: false,
    // This inert field is revalidated by loadImages before becoming an img source.
    ADD_URI_SAFE_ATTR: ['data-image-ref'],
  });
  for (const input of fragment.querySelectorAll('input')) {
    if (input.type !== 'checkbox') {
      input.remove();
      continue;
    }
    input.disabled = true;
    input.tabIndex = -1;
    input.setAttribute(
      'aria-label',
      input.checked ? 'Completed task' : 'Incomplete task',
    );
  }
  return fragment;
}
