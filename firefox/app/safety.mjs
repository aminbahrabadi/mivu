export const MAX_MARKDOWN_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_IMAGE_COUNT = 30;

export function isMarkdownFile(name) {
  return typeof name === 'string' && /\.(md|markdown)$/i.test(name);
}

export function classifyLink(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return 'blocked';
  const value = raw.trim();
  if (/^[\u0000-\u0020\u007f]/.test(value) || /[\u0000-\u001f\u007f]/.test(value)) return 'blocked';
  if (value.startsWith('#')) return 'anchor';
  if (/^https?:\/\//i.test(value)) return 'external';
  if (/^mailto:/i.test(value)) return 'external';
  if (/^(?:\/\/|\\\\)/.test(value)) return 'blocked';
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return 'blocked';
  if (value.startsWith('/') || value.includes('\\')) return 'blocked';
  return 'local';
}

export function imageBasename(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  let path;
  try { path = decodeURIComponent(raw.split(/[?#]/, 1)[0]); }
  catch { return null; }
  if (!path || /[\u0000-\u001f\u007f\\]/.test(path) || path.startsWith('/') || path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)) return null;
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '..')) return null;
  const name = parts.at(-1);
  return /\.(png|jpe?g|gif|webp)$/i.test(name) ? name.toLowerCase() : null;
}

export function rasterMime(name, bytes) {
  if (!name || !(bytes instanceof Uint8Array)) return null;
  const b = bytes;
  const ext = String(name).split('.').at(-1).toLowerCase();
  if (ext === 'png' && b.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v)) return 'image/png';
  if ((ext === 'jpg' || ext === 'jpeg') && b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (ext === 'gif' && b.length >= 6 && [71,73,70,56].every((v,i) => b[i] === v) && (b[4] === 55 || b[4] === 57) && b[5] === 97) return 'image/gif';
  if (ext === 'webp' && b.length >= 12 && String.fromCharCode(...b.subarray(0,4)) === 'RIFF' && String.fromCharCode(...b.subarray(8,12)) === 'WEBP') return 'image/webp';
  return null;
}
