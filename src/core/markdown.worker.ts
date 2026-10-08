import { markdownChunks } from './parser';

let pending: Generator<string> | undefined;
addEventListener('message', (event: MessageEvent<string | null>) => {
  try {
    if (typeof event.data === 'string') pending = markdownChunks(event.data);
    const next = pending?.next();
    postMessage({ html: next?.value ?? '', done: next?.done ?? true });
    if (next?.done) pending = undefined;
  } catch {
    pending = undefined;
    postMessage({ error: 'Could not render this document.' });
  }
});
