import { PRINT_ROOT_ID, PRINTING_CLASS, openSystemPrint, type NativePrintRequest, type PrintResult } from './printRun';

const STYLE_SELECTOR = 'link[rel="stylesheet"], style';
const COPY_MARK = 'data-tab-print';
const STYLE_TIMEOUT_MS = 5000;

const ELEMENT_NODE = 1;

function hostSheet(sheet: CSSStyleSheet, view: Window & typeof globalThis): CSSStyleSheet {
  const copy = new view.CSSStyleSheet();
  copy.replaceSync(Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n'));
  return copy;
}

function copyCanvas(source: Element, target: Element) {
  if (source.localName !== 'canvas') return;
  const from = source as HTMLCanvasElement;
  const to = target as HTMLCanvasElement;
  to.width = from.width;
  to.height = from.height;
  to.getContext('2d')?.drawImage(from, 0, 0);
}

function copyShadow(source: Element, target: Element, host: Document, view: Window & typeof globalThis) {
  const shadow = source.shadowRoot;
  if (!shadow) return;
  const root = target.attachShadow({ mode: 'open' });
  root.adoptedStyleSheets = shadow.adoptedStyleSheets.map((sheet) => hostSheet(sheet, view));
  shadow.childNodes.forEach((child) => root.appendChild(cloneNode(child, host, view)));
}

function cloneNode(source: Node, host: Document, view: Window & typeof globalThis): Node {
  const copy = host.importNode(source, false);
  if (source.nodeType === ELEMENT_NODE) {
    copyCanvas(source as Element, copy as Element);
    copyShadow(source as Element, copy as Element, host, view);
  }
  source.childNodes.forEach((child) => copy.appendChild(cloneNode(child, host, view)));
  return copy;
}

function stylesLoaded(nodes: Element[]): Promise<void> {
  const pending = nodes.filter((node): node is HTMLLinkElement => node instanceof HTMLLinkElement && !node.sheet);
  const loads = pending.map((link) => new Promise<void>((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  }));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, STYLE_TIMEOUT_MS));
  return Promise.race([Promise.all(loads).then(() => undefined), timeout]);
}

export async function printFrameDocument(request: NativePrintRequest, frame: Window, host: Document = document): Promise<PrintResult> {
  const source = frame.document.getElementById(PRINT_ROOT_ID);
  if (!source) throw new Error('PRINT_ROOT_MISSING');
  const view = host.defaultView ?? window;
  const styles = Array.from(frame.document.querySelectorAll(STYLE_SELECTOR), (node) => {
    const copy = host.importNode(node, true) as Element;
    copy.setAttribute(COPY_MARK, '');
    return host.head.appendChild(copy);
  });
  const root = cloneNode(source, host, view as Window & typeof globalThis) as HTMLElement;
  host.getElementById(PRINT_ROOT_ID)?.remove();
  host.body.appendChild(root);
  host.body.classList.add(PRINTING_CLASS);
  let cleaned = false;
  const observer = new MutationObserver(() => { if (!frame.document.body.classList.contains(PRINTING_CLASS)) cleanup(); });
  const forward = () => {
    cleanup();
    frame.dispatchEvent(new (frame as Window & typeof globalThis).Event('afterprint'));
  };
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    observer.disconnect();
    view.removeEventListener('afterprint', forward);
    root.remove();
    for (const style of styles) style.remove();
    host.body.classList.remove(PRINTING_CLASS);
  }
  view.addEventListener('afterprint', forward);
  observer.observe(frame.document.body, { attributes: true, attributeFilter: ['class'] });
  try {
    await stylesLoaded(styles);
    const result = await openSystemPrint(request);
    if (result.mode === 'done') cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}
