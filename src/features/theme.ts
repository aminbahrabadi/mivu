export type Theme = 'system' | 'light' | 'dark';

export function setupTheme(select: HTMLSelectElement): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let selected: Theme = 'system';
  try {
    const stored = localStorage.getItem('mivu-theme');
    if (stored === 'light' || stored === 'dark') selected = stored;
  } catch {
    /* Reading still works when preference storage is unavailable. */
  }
  select.value = selected;
  function apply(): void {
    document.documentElement.dataset.theme =
      selected === 'system' ? (media.matches ? 'dark' : 'light') : selected;
  }
  function change(): void {
    if (
      select.value === 'light' ||
      select.value === 'dark' ||
      select.value === 'system'
    )
      selected = select.value;
    try {
      localStorage.setItem('mivu-theme', selected);
    } catch {
      /* Session preference remains active. */
    }
    apply();
  }
  select.addEventListener('change', change);
  media.addEventListener('change', apply);
  apply();
  return () => {
    select.removeEventListener('change', change);
    media.removeEventListener('change', apply);
  };
}
