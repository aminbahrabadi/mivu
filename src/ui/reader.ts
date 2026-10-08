import { classifyReference } from '../core/links';

export function scrollToFragment(reader: HTMLElement, fragment: string): void {
  const heading = Array.from(reader.querySelectorAll('[id]')).find(
    (node) => node.id === fragment,
  );
  heading?.scrollIntoView({ block: 'start' });
}

export async function loadImages(
  article: HTMLElement,
  readImage: (path: string) => Promise<string>,
): Promise<void> {
  const images = Array.from(
    article.querySelectorAll<HTMLImageElement>('img[data-image-ref]'),
  );
  let cursor = 0;
  let total = 0;
  async function next(): Promise<void> {
    while (cursor < images.length) {
      const index = cursor++;
      const image = images[index]!;
      if (!article.isConnected) return;
      const ref = classifyReference(image.dataset.imageRef ?? '');
      let reason = 'Image unavailable';
      if (ref.kind === 'external') reason = 'Remote image blocked';
      else if (ref.kind === 'local' && index < 128) {
        try {
          const source = await readImage(ref.path);
          total += source.length;
          if (total > 32 * 1024 * 1024)
            throw new Error('Image budget exceeded');
          if (!article.isConnected) return;
          image.loading = 'lazy';
          image.decoding = 'async';
          image.src = source;
          image.removeAttribute('data-image-ref');
          image.addEventListener(
            'error',
            () => {
              image.replaceWith(
                imagePlaceholder(image.alt, 'Image could not be decoded'),
              );
            },
            { once: true },
          );
          continue;
        } catch {
          reason = 'Local image unavailable';
        }
      }
      image.replaceWith(imagePlaceholder(image.alt, reason));
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, images.length) }, next));
}

function imagePlaceholder(alt: string, reason: string): HTMLSpanElement {
  const placeholder = document.createElement('span');
  placeholder.className = 'image-placeholder';
  placeholder.textContent = alt ? `${alt} · ${reason}` : reason;
  return placeholder;
}
