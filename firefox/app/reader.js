import { MAX_MARKDOWN_BYTES, MAX_IMAGE_BYTES, MAX_IMAGE_COUNT, isMarkdownFile, classifyLink, imageBasename, rasterMime } from './safety.mjs';

// The reader never asks for Firefox permissions, reads tabs, or fetches URLs.
const $ = (id) => document.getElementById(id);
const viewer = $('document');
const welcome = $('welcome');
const errorBox = $('error');
const input = $('file-input');
const imagesInput = $('image-input');
const fileName = $('docname');
const status = $('status');
const searchbar = $('searchbar');
const searchInput = $('search-input');
const searchCount = $('search-count');
let currentFile = null;
let currentSource = '';
let assetUrls = new Map();
let matches = [];
let selectedMatch = -1;
let zoom = 1;
let busy = false;

// Standalone AMO build: vendored Marked + highlight.js, no remote scripts or runtime dependencies.
// Raw HTML is never rendered. A restrictive local sanitizer enforces element/attribute rules.
const markedApi = globalThis.marked?.marked;
const hljs = globalThis.hljs;
if (!markedApi || !hljs) throw new Error('Bundled Markdown libraries did not load');
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const renderer = new markedApi.Renderer();
renderer.html = () => '';
renderer.heading = (text, level) => `<h${level}>${text}</h${level}>`;
renderer.link = (href, title, text) => {
  const kind = classifyLink(href);
  if (kind !== 'external') return `<span>${text}</span>`;
  const safeHref = escapeHtml(href);
  const safeTitle = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"${safeTitle}>${text}</a>`;
};
renderer.image = (href, title, text) => {
  const reference = escapeHtml(href ?? '');
  const alt = escapeHtml(text || 'Image');
  return `<span class="md-image-placeholder" data-md-image="${reference}" data-md-alt="${alt}">🖼 ${alt}</span>`;
};
renderer.code = (source, language) => {
  const lang = String(language || '').split(/\s/,1)[0];
  let code = escapeHtml(source);
  if (lang && /^[a-z0-9_+.#-]{1,36}$/i.test(lang) && hljs.getLanguage(lang)) {
    try { code = hljs.highlight(source,{language:lang,ignoreIllegals:true}).value; }
    catch { code = escapeHtml(source); }
  }
  return `<pre><code class="hljs">${code}</code></pre>`;
};
renderer.checkbox = (checked) => `<input type="checkbox" disabled${checked ? ' checked' : ''}>`;
markedApi.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false, renderer });

const ALLOWED_TAGS = new Set([
  'p','h1','h2','h3','h4','h5','h6','strong','em','s','del','br','hr','ul','ol','li','blockquote',
  'pre','code','span','a','table','thead','tbody','tr','th','td','input','label','div','sup','sub'
]);
const DROP_TAGS = new Set(['script','style','iframe','svg','math','object','embed','form','video','audio','template']);
const ATTRIBUTES = {
  a: new Set(['href','title','target','rel','referrerpolicy']),
  span: new Set(['class','data-md-image','data-md-alt']),
  code: new Set(['class']), pre: new Set(['class']),
  input: new Set(['type','checked','disabled']),
  th: new Set(['align']), td: new Set(['align']),
};
function sanitizeHtml(inputHtml) {
  const doc = new DOMParser().parseFromString(inputHtml, 'text/html');
  function clean(parent) {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === Node.COMMENT_NODE) { node.remove(); continue; }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = node.localName;
      if (DROP_TAGS.has(tag)) { node.remove(); continue; }
      if (!ALLOWED_TAGS.has(tag)) {
        clean(node);
        node.replaceWith(...node.childNodes);
        continue;
      }
      const allowed = ATTRIBUTES[tag] || new Set();
      for (const attr of [...node.attributes]) {
        if (!allowed.has(attr.name)) { node.removeAttribute(attr.name); continue; }
        if (attr.name === 'href' && classifyLink(attr.value) !== 'external') node.removeAttribute(attr.name);
        if (attr.name === 'class' && !/^[a-zA-Z0-9_ -]{1,150}$/.test(attr.value)) node.removeAttribute(attr.name);
        if (attr.name === 'type' && (tag !== 'input' || attr.value !== 'checkbox')) node.removeAttribute(attr.name);
        if (attr.name === 'align' && !['left','right','center'].includes(attr.value)) node.removeAttribute(attr.name);
        if (attr.name.startsWith('data-md-') && attr.value.length > 2048) node.removeAttribute(attr.name);
      }
      if (tag === 'input') {node.setAttribute('disabled',''); node.setAttribute('type','checkbox');}
      if (tag === 'a') {node.setAttribute('rel','noopener noreferrer');node.setAttribute('referrerpolicy','no-referrer');node.setAttribute('target','_blank');}
      clean(node);
    }
  }
  clean(doc.body);
  // Return a sanitized inert DOM tree; never serialize and reparse user content.
  // The caller imports only the validated nodes into the extension document.
  const fragment = document.createDocumentFragment();
  for (const node of [...doc.body.childNodes]) {
    fragment.appendChild(document.importNode(node, true));
  }
  return fragment;
}

function report(message) { status.textContent = message; }
function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  report('Unable to open document');
}
function hideError() { errorBox.hidden = true; errorBox.textContent = ''; }
function releaseAssets() {
  for (const item of assetUrls.values()) if (item?.url) URL.revokeObjectURL(item.url);
  assetUrls.clear();
}
function applyDirection(root) {
  for (const element of root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,th,td')) element.setAttribute('dir', 'auto');
  for (const element of root.querySelectorAll('pre,code')) element.setAttribute('dir', 'ltr');
}
function linkPolicy(root) {
  for (const link of root.querySelectorAll('a')) {
    const href = link.getAttribute('href');
    const type = classifyLink(href);
    if (type === 'external') {
      link.setAttribute('rel', 'noopener noreferrer');
      link.setAttribute('target', '_blank');
      link.setAttribute('referrerpolicy', 'no-referrer');
    } else if (type === 'anchor') {
      // In-document anchors are not generated by the baseline parser.
      // Keep visible text but do not navigate to arbitrary extension fragments.
      link.removeAttribute('href');
      link.setAttribute('title', 'Anchors are not yet supported');
    } else {
      link.removeAttribute('href');
      link.setAttribute('title', type === 'local' ? 'Open linked Markdown separately in Mivu' : 'Unsafe link blocked');
    }
  }
}
function attachSelectedImages(root) {
  for (const node of root.querySelectorAll('[data-md-image]')) {
    const name = imageBasename(node.getAttribute('data-md-image'));
    const asset = name && assetUrls.get(name);
    if (!asset || !asset.url) {
      node.title = 'To display local images, click Add images and choose them explicitly';
      continue;
    }
    const image = document.createElement('img');
    image.className = 'md-image';
    image.alt = node.getAttribute('data-md-alt') || 'Local image';
    image.src = asset.url;
    image.loading = 'lazy';
    image.decoding = 'async';
    node.replaceWith(image);
  }
}
function render() {
  if (!currentFile) return;
  // Raw HTML and active content are disabled in markdown-it, then the
  // generated HTML is reduced again to a conservative HTML allowlist.
  const rendered = markedApi.parse(currentSource);
  // Marked HTML is untrusted. Parse inertly, then apply a strict DOM allowlist.
  // Do not use HTML assignment sinks in privileged extension pages.
  const fragment = sanitizeHtml(rendered);
  linkPolicy(fragment);
  attachSelectedImages(fragment);
  applyDirection(fragment);
  viewer.replaceChildren(fragment);
  viewer.hidden = false;
  welcome.hidden = true;
  hideError();
  clearSearch();
  updateSearch();
}
async function readMarkdown(file) {
  if (!file || !isMarkdownFile(file.name)) throw new Error('Please choose a .md or .markdown file.');
  if (file.size > MAX_MARKDOWN_BYTES) throw new Error('This document is larger than the 8 MiB safety limit.');
  if (!file.size) return '';
  const content = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(content).replace(/^\uFEFF/, ''); }
  catch { throw new Error('This document is not valid UTF-8.'); }
}
async function openFile(file) {
  if (busy) return;
  busy = true;
  try {
    const source = await readMarkdown(file);
    releaseAssets();
    currentFile = file;
    currentSource = source;
    fileName.textContent = file.name;
    fileName.title = file.name;
    document.title = `${file.name} — Mivu`;
    viewer.style.setProperty('--reader-zoom', String(zoom));
    render();
    window.scrollTo(0, 0);
    report(`Read-only · ${new TextEncoder().encode(source).length.toLocaleString()} bytes · Offline`);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Could not open document.');
  } finally { busy = false; }
}
async function addImages(files) {
  if (!currentFile) { showError('Open a Markdown document first.'); return; }
  const next = new Map();
  try {
    const list = [...files];
    if (list.length > MAX_IMAGE_COUNT) throw new Error(`Select no more than ${MAX_IMAGE_COUNT} images.`);
    for (const file of list) {
      if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}: image exceeds the 12 MiB limit.`);
      const name = file.name.toLowerCase();
      // Ambiguous filenames are rejected, never guessed.
      if (next.has(name)) throw new Error(`Ambiguous image filename: ${file.name}`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = rasterMime(name, bytes);
      if (!mime) throw new Error(`${file.name}: only PNG, JPEG, GIF, and WebP files are supported.`);
      next.set(name, { url: URL.createObjectURL(new Blob([bytes], { type: mime })) });
    }
    releaseAssets();
    assetUrls = next;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    report(`${list.length} explicitly selected image${list.length === 1 ? '' : 's'} available`);
  } catch (error) {
    for (const item of next.values()) URL.revokeObjectURL(item.url);
    showError(error instanceof Error ? error.message : 'Could not load image files.');
  }
}
function clearSearch() {
  for (const mark of matches) {
    if (!mark.isConnected) continue;
    const parent = mark.parentNode;
    mark.replaceWith(document.createTextNode(mark.textContent));
    parent?.normalize();
  }
  matches = [];
  selectedMatch = -1;
}
function navigateMatch(index) {
  if (!matches.length) { searchCount.textContent = '0 matches'; return; }
  selectedMatch = ((index % matches.length) + matches.length) % matches.length;
  for (const [i, mark] of matches.entries()) mark.classList.toggle('current', i === selectedMatch);
  matches[selectedMatch].scrollIntoView({ behavior: 'auto', block: 'center' });
  searchCount.textContent = `${selectedMatch + 1} of ${matches.length}`;
}
function updateSearch() {
  clearSearch();
  const term = searchInput.value.trim().toLocaleLowerCase();
  if (!term || !currentFile) { searchCount.textContent = '0 matches'; return; }
  const iterator = document.createTreeWalker(viewer, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (iterator.nextNode()) {
    const node = iterator.currentNode;
    if (!node.parentElement?.closest('script,style,mark')) nodes.push(node);
  }
  for (const node of nodes) {
    const original = node.textContent || '';
    const lower = original.toLocaleLowerCase();
    let start = 0;
    const container = document.createDocumentFragment();
    let changed = false;
    while (start < original.length && matches.length < 500) {
      const at = lower.indexOf(term, start);
      if (at === -1) break;
      changed = true;
      container.append(document.createTextNode(original.slice(start, at)));
      const mark = document.createElement('mark');
      mark.textContent = original.slice(at, at + term.length);
      container.append(mark);
      matches.push(mark);
      start = at + term.length;
    }
    if (changed) {
      container.append(document.createTextNode(original.slice(start)));
      node.replaceWith(container);
    }
    if (matches.length >= 500) break;
  }
  if (matches.length) navigateMatch(0);
  else searchCount.textContent = '0 matches';
}
function openSearch() { searchbar.hidden = false; searchInput.focus(); searchInput.select(); }
function closeSearch() { searchbar.hidden = true; clearSearch(); searchInput.value = ''; searchCount.textContent = '0 matches'; }
function setZoom(next) {
  zoom = Math.max(.75, Math.min(1.75, Math.round(next * 10) / 10));
  viewer.style.setProperty('--reader-zoom', String(zoom));
  $('zoom-status').textContent = `${Math.round(zoom * 100)}%`;
}
function applyTheme(value) {
  const next = ['light', 'dark', 'system'].includes(value) ? value : 'system';
  if (next === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = next;
  $('theme').value = next;
  try { localStorage.setItem('mivu-theme', next); } catch { /* disabled storage */ }
}

$('open-btn').addEventListener('click', () => input.click());
$('welcome-open').addEventListener('click', () => input.click());
$('images-btn').addEventListener('click', () => imagesInput.click());
input.addEventListener('change', () => { if (input.files?.[0]) void openFile(input.files[0]); input.value = ''; });
imagesInput.addEventListener('change', () => { if (imagesInput.files?.length) void addImages(imagesInput.files); imagesInput.value = ''; });
$('search-btn').addEventListener('click', openSearch);
$('search-close').addEventListener('click', closeSearch);
$('search-prev').addEventListener('click', () => navigateMatch(selectedMatch - 1));
$('search-next').addEventListener('click', () => navigateMatch(selectedMatch + 1));
searchInput.addEventListener('input', updateSearch);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); navigateMatch(selectedMatch + (event.shiftKey ? -1 : 1)); }
});
$('theme').addEventListener('change', (event) => applyTheme(event.target.value));
window.addEventListener('keydown', (event) => {
  const modifier = event.ctrlKey || event.metaKey;
  if (event.key === 'Escape' && !searchbar.hidden) { closeSearch(); return; }
  if (!modifier) return;
  if (event.key.toLowerCase() === 'o') { event.preventDefault(); input.click(); }
  else if (event.key.toLowerCase() === 'f') { event.preventDefault(); openSearch(); }
  else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom + .1); }
  else if (event.key === '-') { event.preventDefault(); setZoom(zoom - .1); }
  else if (event.key === '0') { event.preventDefault(); setZoom(1); }
});
let dragDepth = 0;
const zone = $('dropzone');
zone.addEventListener('dragenter', (event) => { event.preventDefault(); dragDepth += 1; zone.classList.add('dragover'); });
zone.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
zone.addEventListener('dragleave', (event) => { event.preventDefault(); dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) zone.classList.remove('dragover'); });
zone.addEventListener('drop', async (event) => {
  event.preventDefault(); dragDepth = 0; zone.classList.remove('dragover');
  const files = [...(event.dataTransfer?.files || [])];
  const markdown = files.find((file) => isMarkdownFile(file.name));
  if (!markdown) { showError('Drop a .md or .markdown file to open it.'); return; }
  await openFile(markdown);
  const others = files.filter((file) => file !== markdown);
  if (others.length && currentFile === markdown) await addImages(others);
});
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => { if (!zone.contains(event.target)) event.preventDefault(); });
window.addEventListener('pagehide', releaseAssets);
try { applyTheme(localStorage.getItem('mivu-theme') || 'system'); }
catch { applyTheme('system'); }
