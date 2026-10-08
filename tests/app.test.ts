import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp } from '../src/app';
import type { DocumentSnapshot } from '../src/core/document';

const native = vi.hoisted(() => ({
  invoke: vi.fn(),
  listeners: new Map<string, (event: { payload: unknown }) => void>(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(
    (name: string, callback: (event: { payload: unknown }) => void) => {
      native.listeners.set(name, callback);
      return Promise.resolve(() => {
        native.listeners.delete(name);
      });
    },
  ),
}));

let dispose: (() => void) | undefined;
let root: HTMLElement;
const doc: DocumentSnapshot = {
  id: 1,
  name: 'readme.md',
  path: '/selected/readme.md',
  content: '# Hello\n\nA quiet place.',
};
beforeEach(() => {
  root = document.createElement('div');
  document.body.append(root);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    value: vi.fn(),
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    configurable: true,
  });
  native.invoke.mockReset();
  native.invoke.mockResolvedValue({ document: doc, error: null });
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
  vi.restoreAllMocks();
  native.listeners.clear();
});

describe('application document lifecycle', () => {
  it('ignores stale snapshots, switches documents, and keeps the old content on errors', async () => {
    dispose = await startApp(root);
    native.listeners.get('document-changed')!({
      payload: {
        ...doc,
        id: 3,
        name: 'other.md',
        path: '/selected/other.md',
        content: '# Other',
      },
    });
    native.listeners.get('document-changed')!({ payload: { ...doc, id: 2 } });
    expect(root.querySelector('h1')?.textContent).toBe('Other');
    native.invoke.mockRejectedValueOnce('Could not open this file.');
    root.querySelector<HTMLButtonElement>('[data-action=open]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelector('#error-message')?.textContent).toContain(
        'Could not open',
      );
    });
    expect(root.querySelector('h1')?.textContent).toBe('Other');
  });
  it('supports keyboard search/escape/zoom and refreshing without moving focus', async () => {
    dispose = await startApp(root);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }),
    );
    const input = root.querySelector<HTMLInputElement>('#search-input')!;
    input.value = 'quiet';
    input.dispatchEvent(new Event('input'));
    expect(root.querySelector('mark')?.textContent).toBe('quiet');
    native.listeners.get('document-changed')!({
      payload: { ...doc, id: 2, content: '# Hello\n\nA quiet place again.' },
    });
    expect(document.activeElement).toBe(input);
    expect(root.querySelector('mark')?.textContent).toBe('quiet');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(root.querySelector<HTMLElement>('#search-bar')?.hidden).toBe(true);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '+', metaKey: true }),
    );
    expect(root.querySelector('#zoom-status')?.textContent).toBe('110%');
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '0', ctrlKey: true }),
    );
    expect(root.querySelector('#zoom-status')?.textContent).toBe('100%');
  });
});
