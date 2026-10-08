import icon from '../../assets/mivu.svg';

export const emptyState = `
  <div class="empty">
    <img class="empty-icon" src="${icon}" alt="" width="72" height="72" />
    <p class="eyebrow">JUST READ MARKDOWN</p>
    <h1>A little room to read.</h1>
    <p class="empty-description">Your words, beautifully at home.<br>Open a Markdown file or drop one here.</p>
    <button class="primary" data-action="open" type="button">Open Markdown file <span aria-hidden="true">↗</span></button>
    <p class="hint"><kbd>Ctrl</kbd> + <kbd>O</kbd> <span aria-hidden="true">·</span> .md / .markdown</p>
  </div>`;
