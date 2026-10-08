import { renderHtml, renderMarkdown } from './markdown';

export function renderDocument(
  source: string,
  append: (fragment: DocumentFragment) => void,
  signal: AbortSignal,
): Promise<boolean> {
  // The synchronous path keeps DOM-only tests and unsupported runtimes usable.
  if (typeof Worker === 'undefined') {
    append(renderMarkdown(source));
    return Promise.resolve(true);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./markdown.worker.ts', import.meta.url),
      { type: 'module' },
    );
    const headings = new Set<string>();
    const stop = (): void => {
      worker.terminate();
      signal.removeEventListener('abort', abort);
    };
    const abort = (): void => {
      stop();
      resolve(false);
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.onerror = () => {
      stop();
      reject(new Error('Could not render this document.'));
    };
    worker.onmessage = (
      event: MessageEvent<{ html?: string; done?: boolean; error?: string }>,
    ) => {
      if (signal.aborted) return;
      try {
        if (event.data.error) throw new Error(event.data.error);
        if (event.data.html) append(renderHtml(event.data.html, headings));
        if (event.data.done) {
          stop();
          resolve(true);
        } else
          requestAnimationFrame(() => {
            if (!signal.aborted) worker.postMessage(null);
          });
      } catch (error) {
        stop();
        reject(error);
      }
    };
    worker.postMessage(source);
  });
}
