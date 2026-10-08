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
  vi.unstubAllGlobals();
  native.listeners.clear();
});

describe('application document lifecycle', () => {
  it('waits for an event-started render before following a linked heading', async () => {
    native.invoke.mockResolvedValueOnce({
      document: { ...doc, content: '[Section](second.md#target)' },
      error: null,
    });
    dispose = await startApp(root);
    class TestWorker {
      static instance: TestWorker;
      onmessage?: (event: MessageEvent) => void;
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor() {
        TestWorker.instance = this;
      }
    }
    vi.stubGlobal('Worker', TestWorker);
    const next = {
      ...doc,
      id: 2,
      name: 'second.md',
      path: '/selected/second.md',
      content: '# Target',
    };
    native.invoke.mockImplementationOnce(() => {
      native.listeners.get('document-changed')!({ payload: next });
      return Promise.resolve(next);
    });
    root.querySelector<HTMLAnchorElement>('a')!.click();
    await Promise.resolve();
    expect(root.querySelector('#target')).toBeNull();
    TestWorker.instance.onmessage?.(
      new MessageEvent('message', {
        data: { html: '<h1>Target</h1>', done: true },
      }),
    );
    await vi.waitFor(() =>
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: 'start',
      }),
    );
    expect(root.querySelector('#target')?.textContent).toBe('Target');
  });
  it('does not display stale startup or watcher errors after switching documents', async () => {
    let resolve!: (value: {
      document: DocumentSnapshot;
      error: string;
    }) => void;
    native.invoke.mockReturnValueOnce(
      new Promise((value) => {
        resolve = value;
      }),
    );
    const starting = startApp(root);
    await vi.waitFor(() => {
      expect(native.listeners.has('document-error')).toBe(true);
    });
    native.listeners.get('document-changed')!({
      payload: { ...doc, id: 5, content: '# New' },
    });
    native.listeners.get('document-error')!({
      payload: { id: 1, message: 'Stale' },
    });
    resolve({ document: doc, error: 'Old startup failure' });
    dispose = await starting;
    expect(root.querySelector('h1')?.textContent).toBe('New');
    expect(root.querySelector<HTMLElement>('#error')?.hidden).toBe(true);
  });
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
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input);
      expect(root.querySelector('mark')?.textContent).toBe('quiet');
    });
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
