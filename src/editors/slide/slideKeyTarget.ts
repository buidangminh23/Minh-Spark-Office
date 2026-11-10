const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

interface KeyTargetLike {
  tagName?: unknown;
  isContentEditable?: unknown;
  closest?: unknown;
}

export function isEditableKeyTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof target !== 'object') return false;
  const node = target as KeyTargetLike;
  if (typeof node.tagName === 'string' && EDITABLE_TAGS.has(node.tagName.toUpperCase())) return true;
  if (node.isContentEditable === true) return true;
  if (typeof node.closest === 'function') {
    const host = (node.closest as (selector: string) => unknown).call(node, '[contenteditable]:not([contenteditable="false"])');
    if (host) return true;
  }
  return false;
}
