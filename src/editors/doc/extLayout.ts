import { Extension, type AnyExtension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { FLATTEN_EXTRA } from './docFlattenExtra';

const objectKey = new PluginKey<DecorationSet>('objectLayout');
const DEFAULT_GAP: Record<string, number> = { square: 12, tight: 4, through: 0, topBottom: 8 };
const DRAG_THRESHOLD = 3;
const NO_PAGE_BREAK_KINDS = new Set(['continuous', 'wrap']);

const numberAttr = (name: string) => ({
  default: 0,
  parseHTML: (element: HTMLElement) => Number(element.getAttribute(`data-${name}`)) || 0,
  renderHTML: (attributes: Record<string, unknown>) => {
    const key = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    return attributes[key] ? { [`data-${name}`]: attributes[key] } : {};
  },
});

const textAttr = (name: string) => ({
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`),
  renderHTML: (attributes: Record<string, unknown>) => {
    const key = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    return attributes[key] ? { [`data-${name}`]: attributes[key] } : {};
  },
});

const flagAttr = (name: string, html: string) => ({
  default: false,
  parseHTML: (element: HTMLElement) => element.hasAttribute(html),
  renderHTML: (attributes: Record<string, unknown>) => (attributes[name] ? { [html]: 'true' } : {}),
});

export const imageTransform = (attrs: Record<string, unknown>) => {
  const rotate = Number(attrs.rotate) || 0;
  const parts = [rotate ? `rotate(${rotate}deg)` : '', attrs.flipH ? 'scaleX(-1)' : '', attrs.flipV ? 'scaleY(-1)' : ''].filter(Boolean);
  return parts.join(' ');
};

export const zIndexFor = (wrap: string, z: number) => (wrap === 'behind' ? Math.min(-1, z - 5) : Math.max(1, z + 5));

function wrapStyle(attrs: Record<string, unknown>) {
  const wrap = String(attrs.wrap);
  const x = Number(attrs.offsetX) || 0;
  const y = Number(attrs.offsetY) || 0;
  const z = zIndexFor(wrap, Number(attrs.zIndex) || 0);
  const gap = attrs.wrapGap === null || attrs.wrapGap === undefined || attrs.wrapGap === 0 ? DEFAULT_GAP[wrap] ?? 0 : Number(attrs.wrapGap);
  if (wrap === 'behind' || wrap === 'front') return `position: absolute; float: none; margin: ${y}px 0 0 ${x}px; z-index: ${z}`;
  if (wrap === 'topBottom') {
    const justify = attrs.align === 'left' ? 'flex-start' : attrs.align === 'right' ? 'flex-end' : 'center';
    return `position: relative; float: none; clear: both; display: flex; justify-content: ${justify}; margin: ${gap + y}px 0 ${gap}px ${x}px; z-index: ${z}`;
  }
  const side = attrs.align === 'right' ? 'right' : 'left';
  const margins = side === 'left' ? `${y}px ${gap}px ${gap}px ${x}px` : `${y}px ${-x}px ${gap}px ${gap}px`;
  return `position: relative; float: ${side}; margin: ${margins}; z-index: ${z}`;
}

function objectDecoration(node: PMNode, pos: number) {
  const hidden = Boolean(node.attrs.hidden);
  const wrap = node.type.name === 'image' ? node.attrs.wrap : null;
  if (!hidden && !wrap) return null;
  const attrs: Record<string, string> = {};
  if (wrap) {
    attrs['data-object-wrap'] = String(wrap);
    attrs.style = wrapStyle(node.attrs);
  }
  if (hidden) attrs.style = `${attrs.style ?? ''}; display: none`;
  return Decoration.node(pos, pos + node.nodeSize, attrs);
}

const buildObjects = (doc: PMNode) => {
  const items: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'image' && node.type.name !== 'textBox') return true;
    const deco = objectDecoration(node, pos);
    if (deco) items.push(deco);
    return node.type.name === 'textBox';
  });
  return DecorationSet.create(doc, items);
};

const imagePosFrom = (view: EditorView, host: HTMLElement) => {
  const start = view.posAtDOM(host, 0);
  for (const pos of [start, start - 1]) {
    if (pos >= 0 && view.state.doc.nodeAt(pos)?.type.name === 'image') return pos;
  }
  return null;
};

function startDrag(view: EditorView, host: HTMLElement, pos: number, event: MouseEvent) {
  const zoomHost = host.closest<HTMLElement>('.paper-zoom');
  const zoom = parseFloat(zoomHost?.style.zoom ?? '') || 1;
  let dx = 0;
  let dy = 0;
  let moved = false;
  const onMove = (move: MouseEvent) => {
    dx = (move.clientX - event.clientX) / zoom;
    dy = (move.clientY - event.clientY) / zoom;
    moved = moved || Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD;
    if (moved) host.style.translate = `${dx}px ${dy}px`;
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    host.style.translate = '';
    if (!moved) return;
    const node = view.state.doc.nodeAt(pos);
    if (node?.type.name !== 'image') return;
    const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, offsetX: Math.round((Number(node.attrs.offsetX) || 0) + dx), offsetY: Math.round((Number(node.attrs.offsetY) || 0) + dy) });
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    view.dispatch(tr);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

export const ObjectLayout = Extension.create({
  name: 'objectLayout',
  addGlobalAttributes() {
    return [
      {
        types: ['image'],
        attributes: {
          wrap: textAttr('wrap'),
          position: textAttr('position'),
          offsetX: numberAttr('offset-x'),
          offsetY: numberAttr('offset-y'),
          zIndex: numberAttr('z-index'),
          wrapGap: numberAttr('wrap-gap'),
          flipH: flagAttr('flipH', 'data-flip-h'),
          flipV: flagAttr('flipV', 'data-flip-v'),
          rotate: {
            default: 0,
            parseHTML: (element: HTMLElement) => Number(element.getAttribute('data-rotate')) || 0,
            renderHTML: (attributes: Record<string, unknown>) => {
              const transform = imageTransform(attributes);
              return { ...(attributes.rotate ? { 'data-rotate': attributes.rotate } : {}), ...(transform ? { style: `transform: ${transform}` } : {}) };
            },
          },
          groupItems: { default: null, rendered: false },
        },
      },
      {
        types: ['image', 'textBox'],
        attributes: {
          hidden: flagAttr('hidden', 'data-object-hidden'),
          name: textAttr('object-name'),
        },
      },
      {
        types: ['paragraph', 'heading'],
        attributes: { noLineNumbers: flagAttr('noLineNumbers', 'data-no-line-numbers') },
      },
      {
        types: ['pageBreak'],
        attributes: {
          kind: {
            default: 'page',
            parseHTML: (element: HTMLElement) => element.getAttribute('data-break-kind') ?? 'page',
            renderHTML: (attributes: Record<string, unknown>) => (attributes.kind && attributes.kind !== 'page' ? { 'data-break-kind': attributes.kind } : {}),
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [new Plugin<DecorationSet>({
      key: objectKey,
      state: {
        init: (_config, state) => buildObjects(state.doc),
        apply: (tr, value) => (tr.docChanged ? buildObjects(tr.doc) : value),
      },
      props: {
        decorations(state) {
          return objectKey.getState(state) ?? null;
        },
        handleDOMEvents: {
          mousedown(view, event) {
            if (event.button !== 0 || !view.editable) return false;
            const target = event.target as HTMLElement;
            if (target.closest('[data-resize-handle]')) return false;
            const host = target.closest<HTMLElement>('[data-object-wrap]');
            if (!host) return false;
            const pos = imagePosFrom(view, host);
            if (pos === null) return false;
            event.preventDefault();
            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
            view.focus();
            startDrag(view, host, pos, event);
            return true;
          },
        },
      },
    })];
  },
});

FLATTEN_EXTRA.pageBreak = (node) => (NO_PAGE_BREAK_KINDS.has(String(node.attrs?.kind)) ? [] : [node]);

export const LAYOUT_EXTENSIONS: AnyExtension[] = [ObjectLayout];
