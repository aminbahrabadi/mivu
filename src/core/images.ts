export function embeddedImageSource(reference: string): string | null {
  const match = /^data:image\/(png|jpeg|gif|webp);base64,/i.exec(reference);
  if (!match) return null;
  const payload = reference.slice(match[0].length);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  if (
    payload.length % 4 !== 0 ||
    (payload.length / 4) * 3 - padding > 4 * 1024 * 1024 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)
  )
    return null;
  // shortcut: Decoded dimensions are unbounded, add dimension checks for stronger image memory limits.
  const header = atob(payload.slice(0, 16));
  const type = match[1]!.toLowerCase();
  const valid =
    (type === 'png' && header.startsWith('\x89PNG\r\n\x1a\n')) ||
    (type === 'jpeg' && header.startsWith('\xff\xd8\xff')) ||
    (type === 'gif' &&
      (header.startsWith('GIF87a') || header.startsWith('GIF89a'))) ||
    (type === 'webp' &&
      header.startsWith('RIFF') &&
      header.slice(8, 12) === 'WEBP');
  return valid ? `data:image/${type};base64,${payload}` : null;
}
