import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { DocumentSnapshot, InitialState } from './core/document';
import { errorMessage } from './core/document';
import { renderMarkdown } from './core/markdown';
import { classifyReference } from './core/links';
import { loadImages, scrollToFragment } from './ui/reader';
import { emptyState } from './ui/empty-state';
import { setupTheme } from './features/theme';
import { DocumentSearch } from './features/search';
import icon from '../assets/mivu.svg';

export async function startApp(root: HTMLElement): Promise<() => void> {
  root.innerHTML = `
    <header class="toolbar">
      <div class="brand"><img src="${icon}" alt="" /><span>Mivu</span></div>
      <div class="document-label"><span id="document-title">Just read Markdown.</span></div>
      <div class="toolbar-actions">
        <button data-action="open" type="button" title="Open Markdown (Ctrl+O)">Open file</button>
        <button id="find" type="button" title="Find in document (Ctrl+F)" aria-label="Find in document" disabled>Find</button>
        <label class="visually-hidden" for="theme">Appearance</label>
        <select id="theme" aria-label="Appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
      </div>
    </header>
    <div id="search-bar" role="search" hidden>
      <label class="visually-hidden" for="search-input">Find in document</label>
      <input id="search-input" type="search" placeholder="Find in document…" autocomplete="off" spellcheck="false" dir="auto" />
      <span id="search-status" role="status" aria-live="polite">0 results</span>
      <button data-action="previous" aria-label="Previous match" title="Previous (Shift+Enter)">↑</button>
      <button data-action="next" aria-label="Next match" title="Next (Enter)">↓</button>
      <button data-action="close-search" aria-label="Close search" title="Close (Escape)">×</button>
    </div>
    <div id="error" role="alert" hidden><span id="error-message"></span><button id="dismiss-error" aria-label="Dismiss error">×</button></div>
    <main id="reader" tabindex="0" aria-label="Document reader">${emptyState}</main>
    <footer id="reading-status"><span id="document-status">A quiet place for your Markdown.</span><span id="zoom-status" aria-label="Reading zoom">100%</span></footer>`;
  const events = new AbortController();
  const reader = root.querySelector<HTMLElement>('#reader')!;
  const alert = root.querySelector<HTMLElement>('#error')!;
  const title = root.querySelector<HTMLElement>('#document-title')!;
  const search = new DocumentSearch(
    reader,
    root.querySelector<HTMLElement>('#search-bar')!,
  );
  const disposeTheme = setupTheme(
    root.querySelector<HTMLSelectElement>('#theme')!,
  );
  let current: DocumentSnapshot | null = null;
  let zoom = 100;
  let picking = false;
  function showError(error: unknown): void {
    root.querySelector<HTMLElement>('#error-message')!.textContent =
      errorMessage(error);
    alert.hidden = false;
  }
  function display(doc: DocumentSnapshot): void {
    if (current && doc.id <= current.id) return;
    const refresh = current?.path === doc.path;
    const scroll = reader.scrollTop;
    current = doc;
    alert.hidden = true;
    title.textContent = doc.name;
    title.title = doc.path;
    root.querySelector<HTMLButtonElement>('#find')!.disabled = false;
    root.querySelector<HTMLElement>('#document-status')!.textContent =
      'Read-only';
    const article = document.createElement('article');
    article.className = 'markdown';
    if (doc.content.trim()) article.append(renderMarkdown(doc.content));
    else {
      const empty = document.createElement('p');
      empty.className = 'empty-document';
      empty.textContent = 'This document is empty.';
      article.append(empty);
    }
    reader.replaceChildren(article);
    search.update(false);
    reader.scrollTo({ top: refresh ? scroll : 0, behavior: 'instant' });
    if (!refresh) reader.focus();
    void loadImages(article, (reference) =>
      invoke<string>('read_image', { id: doc.id, reference }),
    );
  }
  async function open(): Promise<void> {
    if (picking) return;
    picking = true;
    for (const button of root.querySelectorAll<HTMLButtonElement>(
      '[data-action=open]',
    ))
      button.disabled = true;
    try {
      const doc = await invoke<DocumentSnapshot | null>('pick_document');
      if (doc) display(doc);
    } catch (error) {
      showError(error);
    } finally {
      picking = false;
      for (const button of root.querySelectorAll<HTMLButtonElement>(
        '[data-action=open]',
      ))
        button.disabled = false;
    }
  }
  for (const button of root.querySelectorAll('[data-action=open]'))
    button.addEventListener(
      'click',
      () => {
        void open();
      },
      { signal: events.signal },
    );
  root.querySelector('#find')!.addEventListener(
    'click',
    () => {
      search.open();
    },
    { signal: events.signal },
  );
  root.querySelector('#dismiss-error')!.addEventListener(
    'click',
    () => {
      alert.hidden = true;
    },
    { signal: events.signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        search.close();
        return;
      }
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === 'o') {
        event.preventDefault();
        void open();
      } else if (key === 'f') {
        event.preventDefault();
        search.open();
      } else if (key === '+' || key === '=' || key === '-' || key === '0') {
        event.preventDefault();
        zoom =
          key === '0'
            ? 100
            : Math.max(60, Math.min(180, zoom + (key === '-' ? -10 : 10)));
        root.style.setProperty('--reader-size', `${(17 * zoom) / 100}px`);
        root.querySelector<HTMLElement>('#zoom-status')!.textContent =
          `${zoom}%`;
      }
    },
    { signal: events.signal },
  );
  async function followLink(event: MouseEvent): Promise<void> {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a');
    if (!link) return;
    event.preventDefault();
    const reference = classifyReference(link.getAttribute('href') ?? '');
    try {
      if (reference.kind === 'fragment')
        scrollToFragment(reader, reference.fragment);
      else if (reference.kind === 'local' && current) {
        const doc = await invoke<DocumentSnapshot>('open_relative', {
          id: current.id,
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
  reader.addEventListener(
    'click',
    (event) => {
      void followLink(event);
    },
    { signal: events.signal },
  );
  reader.addEventListener(
    'auxclick',
    (event) => {
      void followLink(event);
    },
    { signal: events.signal },
  );
  const unlistenDocument = await listen<DocumentSnapshot>(
    'document-changed',
    (event) => {
      display(event.payload);
    },
  );
  const unlistenError = await listen<{ id: number; message: string }>(
    'document-error',
    (event) => {
      if (!current || event.payload.id >= current.id)
        showError(event.payload.message);
    },
  );
  const initial = await invoke<InitialState>('current_document');
  const unlistenDrag = await listen<boolean>('drag-active', (event) => {
    root.classList.toggle('drag-over', event.payload);
  });
  if (initial.document) display(initial.document);
  if (initial.error) showError(initial.error);
  return () => {
    events.abort();
    disposeTheme();
    unlistenDocument();
    unlistenError();
    unlistenDrag();
  };
}
