import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { DocumentSnapshot, InitialState } from './core/document';
import { errorMessage } from './core/document';
import { renderMarkdown } from './core/markdown';
import { classifyReference } from './core/links';
import { loadImages, scrollToFragment } from './ui/reader';

export async function startApp(root: HTMLElement): Promise<void> {
  root.innerHTML = `
    <header class="toolbar"><span class="brand">Mivu</span><span id="document-title">Just read Markdown.</span><button id="open" type="button">Open file</button></header>
    <div id="error" role="alert" hidden></div>
    <main id="reader" tabindex="0" aria-label="Document reader"><div class="empty"><h1>A little room to read.</h1><p>Open or drop a Markdown document.</p><button id="empty-open" type="button">Open Markdown file</button><p class="hint">Ctrl+O · .md / .markdown</p></div></main>`;
  const reader = root.querySelector<HTMLElement>('#reader')!;
  const alert = root.querySelector<HTMLElement>('#error')!;
  let currentId = 0;
  function showError(error: unknown): void {
    alert.textContent = errorMessage(error);
    alert.hidden = false;
  }
  function display(doc: DocumentSnapshot): void {
    if (doc.id <= currentId) return;
    currentId = doc.id;
    alert.hidden = true;
    root.querySelector<HTMLElement>('#document-title')!.textContent = doc.name;
    const article = document.createElement('article');
    article.className = 'markdown';
    article.append(renderMarkdown(doc.content));
    reader.replaceChildren(article);
    void loadImages(article, (reference) =>
      invoke<string>('read_image', { id: doc.id, reference }),
    );
    reader.scrollTop = 0;
    reader.focus();
  }
  async function open(): Promise<void> {
    try {
      const doc = await invoke<DocumentSnapshot | null>('pick_document');
      if (doc) display(doc);
    } catch (error) {
      showError(error);
    }
  }
  root.querySelector('#open')!.addEventListener('click', () => {
    void open();
  });
  root.querySelector('#empty-open')!.addEventListener('click', () => {
    void open();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      void open();
    }
  });
  async function followLink(event: MouseEvent): Promise<void> {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a');
    if (!link) return;
    event.preventDefault();
    const reference = classifyReference(link.getAttribute('href') ?? '');
    try {
      if (reference.kind === 'fragment')
        scrollToFragment(reader, reference.fragment);
      else if (reference.kind === 'local') {
        const doc = await invoke<DocumentSnapshot>('open_relative', {
          id: currentId,
          reference: reference.path,
        });
        display(doc);
        if (reference.fragment) scrollToFragment(reader, reference.fragment);
      } else if (reference.kind === 'external' && event.isTrusted)
        await invoke('open_external', { url: reference.url });
      else if (reference.kind === 'blocked') showError(reference.reason);
    } catch (error) {
      showError(error);
    }
  }
  reader.addEventListener('click', (event) => {
    void followLink(event);
  });
  reader.addEventListener('auxclick', (event) => {
    void followLink(event);
  });
  await listen<DocumentSnapshot>('document-changed', (event) => {
    display(event.payload);
  });
  await listen<string>('document-error', (event) => {
    showError(event.payload);
  });
  const initial = await invoke<InitialState>('current_document');
  if (initial.document) display(initial.document);
  if (initial.error) showError(initial.error);
}
