/* eslint-disable no-control-regex -- URL validation must reject control characters. */
export type Reference =
  | { kind: 'fragment'; fragment: string }
  | { kind: 'external'; url: string }
  | { kind: 'local'; path: string; fragment: string }
  | { kind: 'blocked'; reason: string };

export function classifyReference(value: string): Reference {
  const blocked = {
    kind: 'blocked',
    reason: 'This reference is not supported.',
  } as const;
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) return blocked;
  if (/^(https?:|mailto:)/i.test(value)) {
    try {
      const url = new URL(value);
      if (url.username || url.password) return blocked;
      return { kind: 'external', url: url.href };
    } catch {
      return blocked;
    }
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return blocked;
  }
  if (/[\u0000-\u001f\u007f\\]/.test(decoded)) return blocked;
  if (decoded.startsWith('#'))
    return { kind: 'fragment', fragment: decoded.slice(1) };
  if (decoded.startsWith('/') || decoded.includes(':') || decoded.includes('?'))
    return blocked;
  const hash = decoded.indexOf('#');
  const path = hash < 0 ? decoded : decoded.slice(0, hash);
  if (!path) return blocked;
  return {
    kind: 'local',
    path,
    fragment: hash < 0 ? '' : decoded.slice(hash + 1),
  };
}
