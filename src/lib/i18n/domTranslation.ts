import { translateMultiline, type Translate } from './uiTranslator';

const ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'alt', 'data-tooltip'] as const;
const SKIP_SELECTOR = [
  '[data-no-translate]',
  '.ProseMirror',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  'textarea',
  'script',
  'style',
  'code',
  'pre',
  '.textLayer',
  '.ppt-text-box',
  '.ppt-shape-text-overlay',
  '.ppt-table',
  '.ppt-smartart-container',
  '.ppt-chart-box',
  '.ppt-code-container',
  '.ws-file-name',
].join(', ');
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);

const isSkipped = (element: Element | null) => !!element && (SKIP_TAGS.has(element.tagName) || !!element.closest(SKIP_SELECTOR));

function translateTextNode(node: Text, translate: Translate) {
  if (isSkipped(node.parentElement)) return;
  const next = translate(node.nodeValue ?? '');
  if (next !== null && next !== node.nodeValue) node.nodeValue = next;
}

const FIELD_TAGS = new Set(['TEXTAREA', 'INPUT']);

function translateAttributes(element: Element, translate: Translate) {
  if (isSkipped(FIELD_TAGS.has(element.tagName) ? element.parentElement : element)) return;
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (!value) continue;
    const next = translate(value);
    if (next !== null && next !== value) element.setAttribute(name, next);
  }
  if (element instanceof HTMLInputElement && (element.type === 'button' || element.type === 'submit') && element.value) {
    const next = translate(element.value);
    if (next !== null) element.value = next;
  }
}

function translateTree(root: Node, translate: Translate) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, translate);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    translateAttributes(root as Element, translate);
    if (isSkipped(root as Element)) return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (node.nodeType === Node.ELEMENT_NODE && isSkipped(node as Element)) {
        if (FIELD_TAGS.has((node as Element).tagName)) translateAttributes(node as Element, translate);
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, translate);
    else translateAttributes(node as Element, translate);
  }
}

function patchDialogs(translate: Translate) {
  const nativeAlert = window.alert.bind(window);
  const nativeConfirm = window.confirm.bind(window);
  const nativePrompt = window.prompt.bind(window);
  window.alert = (message?: unknown) => nativeAlert(typeof message === 'string' ? translateMultiline(translate, message) : message);
  window.confirm = (message?: string) => nativeConfirm(typeof message === 'string' ? translateMultiline(translate, message) : message);
  window.prompt = (message?: string, defaultValue?: string) => nativePrompt(typeof message === 'string' ? translateMultiline(translate, message) : message, defaultValue);
}

export function startDomTranslation(translate: Translate) {
  translateTree(document.documentElement, translate);
  patchDialogs(translate);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') translateTextNode(record.target as Text, translate);
      else if (record.type === 'attributes') translateAttributes(record.target as Element, translate);
      else record.addedNodes.forEach((node) => translateTree(node, translate));
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES, 'value'] });
  return () => observer.disconnect();
}
