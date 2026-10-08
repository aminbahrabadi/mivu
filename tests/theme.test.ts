import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupTheme } from '../src/features/theme';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
describe('appearance', () => {
  it('follows system changes until the user chooses an override, which persists', () => {
    const media = new EventTarget() as MediaQueryList;
    Object.defineProperty(media, 'matches', { value: false, writable: true });
    vi.stubGlobal('matchMedia', () => media);
    const select = document.createElement('select');
    select.innerHTML =
      '<option>system</option><option>light</option><option>dark</option>';
    const dispose = setupTheme(select);
    expect(document.documentElement.dataset.theme).toBe('light');
    Object.defineProperty(media, 'matches', { value: true });
    media.dispatchEvent(new Event('change'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    select.value = 'light';
    select.dispatchEvent(new Event('change'));
    media.dispatchEvent(new Event('change'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('mivu-theme')).toBe('light');
    dispose();
  });
  it('ignores corrupt preferences and still works without storage access', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    localStorage.setItem('mivu-theme', 'untrusted-value');
    const select = document.createElement('select');
    select.innerHTML = '<option>system</option><option>dark</option>';
    const dispose = setupTheme(select);
    expect(select.value).toBe('system');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    select.value = 'dark';
    select.dispatchEvent(new Event('change'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    dispose();
  });
});
