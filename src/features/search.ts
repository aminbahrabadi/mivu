export interface SearchMatches {
  groups: HTMLElement[][];
  truncated: boolean;
}

export function clearMatches(root: HTMLElement): void {
  for (const mark of root.querySelectorAll('mark[data-search]'))
    mark.replaceWith(...mark.childNodes);
  root.normalize();
}

export function highlightMatches(
  root: HTMLElement,
  query: string,
): SearchMatches {
  clearMatches(root);
  if (!query) return { groups: [], truncated: false };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number; end: number }[] = [];
  const parts: string[] = [];
  let length = 0;
  let lastBlock: Element | null = null;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const block =
      node.parentElement?.closest(
        'p,h1,h2,h3,h4,h5,h6,li,td,th,pre,blockquote',
      ) ?? root;
    if (lastBlock && block !== lastBlock) {
      parts.push('\n');
      length++;
    }
    lastBlock = block;
    nodes.push({ node, start: length, end: length + node.length });
    parts.push(node.data);
    length += node.length;
  }
  const text = parts.join('');
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  const ranges: { start: number; end: number }[] = [];
  let truncated = false;
  for (const match of text.matchAll(regex)) {
    if (ranges.length === 2000) {
      truncated = true;
      break;
    }
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  const groups: HTMLElement[][] = ranges.map(() => []);
  let first = 0;
  for (const { node, start, end } of nodes) {
    while (ranges[first] && ranges[first]!.end <= start) first++;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (
      let index = first;
      ranges[index] && ranges[index]!.start < end;
      index++
    ) {
      const range = ranges[index]!;
      const from = Math.max(0, range.start - start);
      const to = Math.min(node.length, range.end - start);
      fragment.append(node.data.slice(cursor, from));
      const mark = document.createElement('mark');
      mark.dataset.search = String(index);
      mark.textContent = node.data.slice(from, to);
      groups[index]!.push(mark);
      fragment.append(mark);
      cursor = to;
    }
    if (cursor) {
      fragment.append(node.data.slice(cursor));
      node.replaceWith(fragment);
    }
  }
  return { groups, truncated };
}

export class DocumentSearch {
  private matches: SearchMatches = { groups: [], truncated: false };
  private index = -1;
  readonly input: HTMLInputElement;
  private readonly status: HTMLElement;

  constructor(
    private readonly reader: HTMLElement,
    private readonly bar: HTMLElement,
  ) {
    this.input = bar.querySelector<HTMLInputElement>('input')!;
    this.status = bar.querySelector<HTMLElement>('[role=status]')!;
    this.input.addEventListener('input', () => {
      this.update();
    });
    bar.querySelector('[data-action=next]')!.addEventListener('click', () => {
      this.move(1);
    });
    bar
      .querySelector('[data-action=previous]')!
      .addEventListener('click', () => {
        this.move(-1);
      });
    bar
      .querySelector('[data-action=close-search]')!
      .addEventListener('click', () => {
        this.close();
      });
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.move(event.shiftKey ? -1 : 1);
      }
    });
  }

  open(): void {
    this.bar.hidden = false;
    this.input.focus();
    this.input.select();
  }
  close(): void {
    this.bar.hidden = true;
    clearMatches(this.reader);
    this.matches = { groups: [], truncated: false };
    this.reader.focus();
  }
  update(scroll = true): void {
    if (this.bar.hidden) return;
    this.matches = highlightMatches(this.reader, this.input.value);
    this.index = -1;
    this.move(1, scroll);
  }
  move(delta: number, scroll = true): void {
    for (const mark of this.matches.groups[this.index] ?? [])
      mark.classList.remove('current-match');
    const count = this.matches.groups.length;
    this.index = count ? (this.index + delta + count) % count : -1;
    const current = this.matches.groups[this.index] ?? [];
    for (const mark of current) mark.classList.add('current-match');
    if (scroll) current[0]?.scrollIntoView({ block: 'center' });
    this.status.textContent = count
      ? `${this.index + 1} of ${count}${this.matches.truncated ? '+' : ''}`
      : '0 results';
    for (const button of this.bar.querySelectorAll<HTMLButtonElement>(
      '[data-action=next],[data-action=previous]',
    ))
      button.disabled = !count;
  }
}
