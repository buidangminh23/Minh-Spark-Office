import { Extension, type Editor, type ResizableNodeView } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { TableMap } from '@tiptap/pm/tables';
import type { EditorView } from '@tiptap/pm/view';

export const HANDLE_HIT = 24;
export const ALL_DIRECTIONS = ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'] as const;
export type HandleDirection = (typeof ALL_DIRECTIONS)[number];

const MIN_ROW_HEIGHT = 16;
const MIN_COLUMN_WIDTH = 24;
const EDGE_ZONE = 4;
const DRAG_THRESHOLD = 4;

export const isCornerHandle = (direction: string) => direction.includes('-');

export function handleInsets(width: number, height: number) {
  return {
    padX: Math.max(0, (HANDLE_HIT - width) / 2),
    padY: Math.max(0, (HANDLE_HIT - height) / 2),
    narrow: width < HANDLE_HIT * 2,
    short: height < HANDLE_HIT * 2,
  };
}

export function fitHandles(box: HTMLElement, width: number, height: number) {
  const { padX, padY, narrow, short } = handleInsets(width, height);
  box.style.setProperty('--rh-pad-x', `${padX}px`);
  box.style.setProperty('--rh-pad-y', `${padY}px`);
  box.toggleAttribute('data-rh-narrow', narrow);
  box.toggleAttribute('data-rh-short', short);
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function scaledWidth(start: number, delta: number, direction: string, centered: boolean) {
  const sign = direction.includes('left') ? -1 : 1;
  return start + sign * delta * (centered ? 2 : 1);
}

export function scaleColumns(widths: number[], targetWidth: number, minWidth = MIN_COLUMN_WIDTH) {
  const total = widths.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return widths.slice();
  const factor = Math.max(targetWidth, minWidth * widths.length) / total;
  return widths.map((value) => Math.max(minWidth, Math.round(value * factor)));
}

const zoomOf = (element: HTMLElement) => {
  const measured = element.getBoundingClientRect().width;
  return element.offsetWidth > 0 && measured > 0 ? measured / element.offsetWidth : 1;
};

const setResizing = (on: boolean, cursor?: string) => {
  document.body.classList.toggle('doc-object-resizing', on);
  document.body.style.cursor = on && cursor ? cursor : '';
};

const pointOf = (event: MouseEvent | TouchEvent) => ('touches' in event ? event.touches[0] ?? event.changedTouches[0] : event);

function trackPointer(start: MouseEvent | TouchEvent, cursor: string, onMove: (dx: number, dy: number, event: MouseEvent | TouchEvent) => void, onEnd: (moved: boolean) => void) {
  const origin = pointOf(start);
  let moved = false;
  setResizing(true, cursor);
  const move = (event: MouseEvent | TouchEvent) => {
    const point = pointOf(event);
    const dx = point.clientX - origin.clientX;
    const dy = point.clientY - origin.clientY;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    moved = true;
    if (event.cancelable) event.preventDefault();
    onMove(dx, dy, event);
  };
  const end = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('mouseup', end);
    document.removeEventListener('touchend', end);
    setResizing(false);
    onEnd(moved);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('mouseup', end);
  document.addEventListener('touchend', end);
}

const CURSORS: Record<HandleDirection, string> = {
  'top-left': 'nwse-resize',
  'bottom-right': 'nwse-resize',
  'top-right': 'nesw-resize',
  'bottom-left': 'nesw-resize',
  top: 'ns-resize',
  bottom: 'ns-resize',
  left: 'ew-resize',
  right: 'ew-resize',
};

export const HANDLE_LABELS: Record<HandleDirection, string> = {
  'top-left': 'Kéo góc trên trái để phóng to, thu nhỏ',
  top: 'Kéo cạnh trên để giãn chiều cao',
  'top-right': 'Kéo góc trên phải để phóng to, thu nhỏ',
  right: 'Kéo cạnh phải để giãn chiều ngang',
  'bottom-right': 'Kéo góc dưới phải để phóng to, thu nhỏ',
  bottom: 'Kéo cạnh dưới để giãn chiều cao',
  'bottom-left': 'Kéo góc dưới trái để phóng to, thu nhỏ',
  left: 'Kéo cạnh trái để giãn chiều ngang',
};

export function enhanceImageView(view: ResizableNodeView) {
  const container = view.dom as HTMLElement;
  const wrapper = container.querySelector<HTMLElement>('[data-resize-wrapper]') ?? container;
  wrapper.querySelectorAll<HTMLElement>('[data-resize-handle]').forEach((handle) => {
    const direction = handle.dataset.resizeHandle as HandleDirection;
    handle.title = HANDLE_LABELS[direction] ?? '';
    handle.setAttribute('aria-hidden', 'true');
  });
  let refit = () => {};
  const pick = (event: Event) => {
    const handle = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-resize-handle]');
    if (!handle) return;
    const direction = handle.dataset.resizeHandle ?? '';
    if (container.hasAttribute('data-percent-width')) {
      const width = view.element.offsetWidth;
      const height = view.element.offsetHeight;
      container.removeAttribute('data-percent-width');
      container.style.width = '';
      view.element.style.width = `${width}px`;
      view.element.style.height = `${height}px`;
    }
    view.preserveAspectRatio = isCornerHandle(direction);
    setResizing(true, CURSORS[direction as HandleDirection]);
    const done = () => {
      setResizing(false);
      queueMicrotask(refit);
      document.removeEventListener('mouseup', done);
      document.removeEventListener('touchend', done);
    };
    document.addEventListener('mouseup', done);
    document.addEventListener('touchend', done);
  };
  container.addEventListener('mousedown', pick, true);
  container.addEventListener('touchstart', pick, true);
  const element = view.element;
  refit = () => {
    const width = element.offsetWidth || Number(view.node.attrs.width) || 0;
    const height = element.offsetHeight || Number(view.node.attrs.height) || 0;
    if (width > 0 && height > 0) fitHandles(wrapper, width, height);
  };
  const syncPercent = () => {
    const width = String(view.node.attrs.width ?? '').trim();
    const percent = width.endsWith('%') ? width : '';
    container.toggleAttribute('data-percent-width', !!percent);
    container.style.width = percent;
  };
  syncPercent();
  refit();
  const update = view.update.bind(view);
  view.update = (...args: Parameters<typeof view.update>) => {
    const kept = update(...args);
    syncPercent();
    refit();
    return kept;
  };
  element.addEventListener('load', refit);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refit);
  observer?.observe(element);
  const destroy = view.destroy.bind(view);
  view.destroy = () => {
    observer?.disconnect();
    element.removeEventListener('load', refit);
    container.removeEventListener('mousedown', pick, true);
    container.removeEventListener('touchstart', pick, true);
    destroy();
  };
  return view;
}

type WidthHandleOptions = {
  editor: Editor;
  dom: HTMLElement;
  getPos: () => number | undefined;
  directions: readonly HandleDirection[];
  minPercent: number;
  isCentered: () => boolean;
  commit: (node: PMNode, percent: number) => Record<string, unknown>;
};

const contentWidthOf = (element: HTMLElement | null) => {
  if (!element) return 0;
  const style = getComputedStyle(element);
  return element.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0');
};

export function attachWidthHandles(options: WidthHandleOptions) {
  const { editor, dom, getPos, directions } = options;
  const handles = directions.map((direction) => {
    const handle = document.createElement('div');
    handle.className = 'doc-object-handle';
    handle.dataset.objectHandle = direction;
    handle.contentEditable = 'false';
    handle.title = HANDLE_LABELS[direction].replace('phóng to, thu nhỏ', 'đổi độ rộng');
    handle.setAttribute('aria-hidden', 'true');
    handle.addEventListener('mousedown', (event) => start(event, direction));
    handle.addEventListener('touchstart', (event) => start(event, direction), { passive: false });
    dom.appendChild(handle);
    return handle;
  });
  function start(event: MouseEvent | TouchEvent, direction: HandleDirection) {
    if (!editor.isEditable) return;
    event.preventDefault();
    event.stopPropagation();
    const pos = getPos();
    if (pos === undefined) return;
    const parentWidth = contentWidthOf(dom.parentElement);
    if (parentWidth <= 0) return;
    const zoom = zoomOf(dom);
    const startWidth = dom.offsetWidth;
    const centered = options.isCentered();
    const minWidth = (parentWidth * options.minPercent) / 100;
    let width = startWidth;
    dom.dataset.resizeState = 'true';
    trackPointer(event, CURSORS[direction], (dx) => {
      width = clamp(scaledWidth(startWidth, dx / zoom, direction, centered), minWidth, parentWidth);
      dom.style.width = `${(width / parentWidth) * 100}%`;
    }, (moved) => {
      dom.dataset.resizeState = 'false';
      const current = getPos();
      const node = current === undefined ? null : editor.state.doc.nodeAt(current);
      if (!node || current === undefined) return;
      if (!moved) {
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, current)));
        return;
      }
      const percent = clamp(Math.round((width / parentWidth) * 100), options.minPercent, 100);
      const tr = editor.state.tr.setNodeMarkup(current, undefined, { ...node.attrs, ...options.commit(node, percent) });
      tr.setSelection(NodeSelection.create(tr.doc, current));
      editor.view.dispatch(tr);
      editor.view.focus();
    });
  }
  return () => handles.forEach((handle) => handle.remove());
}

export const isObjectHandleEvent = (event: Event) => !!(event.target as HTMLElement | null)?.closest?.('[data-object-handle]');

const tableKey = new PluginKey('docTableTools');

function tablePosOf(view: EditorView, table: HTMLElement) {
  try {
    const $pos = view.state.doc.resolve(view.posAtDOM(table, 0));
    for (let depth = $pos.depth; depth > 0; depth--) {
      if ($pos.node(depth).type.name === 'table') return $pos.before(depth);
    }
  } catch {
    return null;
  }
  return null;
}

function rowPosOf(view: EditorView, cell: HTMLElement) {
  try {
    const $pos = view.state.doc.resolve(view.posAtDOM(cell, 0));
    for (let depth = $pos.depth; depth > 0; depth--) {
      if ($pos.node(depth).type.name === 'tableRow') return $pos.before(depth);
    }
  } catch {
    return null;
  }
  return null;
}

function columnWidths(view: EditorView, tablePos: number, table: PMNode) {
  const map = TableMap.get(table);
  const widths = new Array<number>(map.width).fill(0);
  const seen = new Set<number>();
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const cellPos = map.map[row * map.width + col];
      if (seen.has(cellPos) || widths[col] > 0) continue;
      seen.add(cellPos);
      const cell = table.nodeAt(cellPos);
      const colspan = Number(cell?.attrs.colspan ?? 1);
      const stored = cell?.attrs.colwidth as number[] | null | undefined;
      const dom = view.nodeDOM(tablePos + 1 + cellPos) as HTMLElement | null;
      for (let i = 0; i < colspan && col + i < map.width; i++) {
        if (widths[col + i] > 0) continue;
        widths[col + i] = stored?.[i] || (dom ? dom.offsetWidth / colspan : 0);
      }
    }
  }
  const known = widths.filter((value) => value > 0);
  const fallback = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 100;
  return widths.map((value) => value || fallback);
}

export function applyColumnWidths(tr: import('@tiptap/pm/state').Transaction, tablePos: number, table: PMNode, widths: number[]) {
  const map = TableMap.get(table);
  const seen = new Set<number>();
  map.map.forEach((cellPos) => {
    if (seen.has(cellPos)) return;
    seen.add(cellPos);
    const cell = table.nodeAt(cellPos);
    if (!cell) return;
    const col = map.colCount(cellPos);
    const colspan = Number(cell.attrs.colspan ?? 1);
    const colwidth = Array.from({ length: colspan }, (_, i) => widths[col + i] ?? MIN_COLUMN_WIDTH);
    tr.setNodeMarkup(tablePos + 1 + cellPos, undefined, { ...cell.attrs, colwidth });
  });
  return tr;
}

class TableToolsView {
  private readonly bar: HTMLDivElement;
  private readonly mover: HTMLButtonElement;
  private readonly sizer: HTMLDivElement;
  private readonly marker: HTMLDivElement;
  private table: HTMLTableElement | null = null;
  private hideTimer = 0;
  private rowTarget: HTMLElement | null = null;
  private busy = false;
  private readonly view: EditorView;

  constructor(view: EditorView) {
    this.view = view;
    this.bar = document.createElement('div');
    this.bar.className = 'doc-table-tools';
    this.bar.hidden = true;
    this.mover = document.createElement('button');
    this.mover.type = 'button';
    this.mover.className = 'doc-table-move';
    this.mover.title = 'Bấm để chọn cả bảng, kéo để di chuyển bảng';
    this.mover.setAttribute('aria-label', 'Chọn hoặc di chuyển bảng');
    this.sizer = document.createElement('div');
    this.sizer.className = 'doc-table-size';
    this.sizer.title = 'Kéo để đổi độ rộng cả bảng';
    this.sizer.setAttribute('aria-hidden', 'true');
    this.marker = document.createElement('div');
    this.marker.className = 'doc-table-drop';
    this.marker.hidden = true;
    this.bar.append(this.mover, this.sizer);
    document.body.append(this.bar, this.marker);
    this.mover.addEventListener('mousedown', this.startMove);
    this.mover.addEventListener('touchstart', this.startMove, { passive: false });
    this.sizer.addEventListener('mousedown', this.startSize);
    this.sizer.addEventListener('touchstart', this.startSize, { passive: false });
    this.bar.addEventListener('mouseenter', () => window.clearTimeout(this.hideTimer));
    this.bar.addEventListener('mouseleave', () => this.scheduleHide());
    window.addEventListener('scroll', this.place, true);
    window.addEventListener('resize', this.place);
  }

  update() {
    if (this.table && !this.table.isConnected) this.hide();
    else this.place();
  }

  destroy() {
    window.clearTimeout(this.hideTimer);
    window.removeEventListener('scroll', this.place, true);
    window.removeEventListener('resize', this.place);
    this.bar.remove();
    this.marker.remove();
  }

  hover(target: HTMLElement | null) {
    if (this.busy) return;
    const table = target?.closest('table') ?? null;
    if (table && this.view.dom.contains(table) && this.view.editable) {
      window.clearTimeout(this.hideTimer);
      this.table = table as HTMLTableElement;
      this.bar.hidden = false;
      this.place();
    } else if (this.table) {
      this.scheduleHide();
    }
  }

  scheduleHide() {
    if (this.busy) return;
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hide(), 400);
  }

  hide() {
    this.table = null;
    this.bar.hidden = true;
  }

  place = () => {
    if (!this.table || this.bar.hidden) return;
    const rect = this.table.getBoundingClientRect();
    this.bar.style.left = `${rect.left}px`;
    this.bar.style.top = `${rect.top}px`;
    this.bar.style.width = `${rect.width}px`;
    this.bar.style.height = `${rect.height}px`;
  };

  rowEdge(event: MouseEvent) {
    const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>('td, th');
    if (!cell || !this.view.dom.contains(cell) || !this.view.editable) return null;
    if (this.view.dom.classList.contains('resize-cursor')) return null;
    const row = cell.closest('tr');
    if (!row) return null;
    const rect = row.getBoundingClientRect();
    return Math.abs(event.clientY - rect.bottom) <= EDGE_ZONE ? cell : null;
  }

  trackRow(event: MouseEvent) {
    if (this.busy) return;
    this.rowTarget = this.rowEdge(event);
    this.view.dom.classList.toggle('row-resize-cursor', !!this.rowTarget);
  }

  startRow(event: MouseEvent) {
    const cell = this.rowTarget;
    if (!cell || event.button !== 0) return false;
    const rowPos = rowPosOf(this.view, cell);
    const row = cell.closest('tr');
    if (rowPos === null || !row) return false;
    event.preventDefault();
    const zoom = zoomOf(row);
    const startHeight = row.offsetHeight;
    let height = startHeight;
    this.busy = true;
    trackPointer(event, 'row-resize', (_dx, dy) => {
      height = Math.max(MIN_ROW_HEIGHT, Math.round(startHeight + dy / zoom));
      row.style.height = `${height}px`;
    }, (moved) => {
      this.busy = false;
      this.view.dom.classList.remove('row-resize-cursor');
      const node = this.view.state.doc.nodeAt(rowPos);
      if (!moved || !node) return;
      this.view.dispatch(this.view.state.tr.setNodeMarkup(rowPos, undefined, { ...node.attrs, rowHeight: height }));
    });
    return true;
  };

  private startSize = (event: MouseEvent | TouchEvent) => {
    const table = this.table;
    if (!table) return;
    event.preventDefault();
    event.stopPropagation();
    const tablePos = tablePosOf(this.view, table);
    const node = tablePos === null ? null : this.view.state.doc.nodeAt(tablePos);
    if (tablePos === null || !node) return;
    const base = columnWidths(this.view, tablePos, node);
    const startWidth = base.reduce((sum, value) => sum + value, 0);
    const zoom = zoomOf(table);
    const cols = Array.from(table.querySelectorAll<HTMLTableColElement>('colgroup > col'));
    let widths = base;
    this.busy = true;
    trackPointer(event, 'ew-resize', (dx) => {
      widths = scaleColumns(base, startWidth + dx / zoom);
      cols.forEach((col, index) => { col.style.width = `${widths[index] ?? MIN_COLUMN_WIDTH}px`; });
      const total = widths.reduce((sum, value) => sum + value, 0);
      table.style.width = `${total}px`;
      table.style.minWidth = '';
      this.place();
    }, (moved) => {
      this.busy = false;
      const current = this.view.state.doc.nodeAt(tablePos);
      if (!moved || !current || current.type.name !== 'table') return;
      this.view.dispatch(applyColumnWidths(this.view.state.tr, tablePos, current, widths));
    });
  };

  private startMove = (event: MouseEvent | TouchEvent) => {
    const table = this.table;
    if (!table) return;
    event.preventDefault();
    event.stopPropagation();
    const tablePos = tablePosOf(this.view, table);
    if (tablePos === null) return;
    let target: number | null = null;
    this.busy = true;
    trackPointer(event, 'grabbing', (_dx, _dy, moveEvent) => {
      const point = pointOf(moveEvent);
      target = this.dropTarget(point.clientX, point.clientY, tablePos);
    }, (moved) => {
      this.busy = false;
      this.marker.hidden = true;
      const { state } = this.view;
      const node = state.doc.nodeAt(tablePos);
      if (!node) return;
      if (!moved || target === null) {
        this.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, tablePos)));
        this.view.focus();
        return;
      }
      const tr = state.tr.delete(tablePos, tablePos + node.nodeSize);
      const insertAt = tr.mapping.map(target);
      tr.insert(insertAt, node);
      tr.setSelection(NodeSelection.create(tr.doc, insertAt)).scrollIntoView();
      this.view.dispatch(tr);
      this.view.focus();
      this.hide();
    });
  };

  private dropTarget(x: number, y: number, tablePos: number) {
    const hit = this.view.posAtCoords({ left: x, top: y });
    const { doc } = this.view.state;
    const table = doc.nodeAt(tablePos);
    if (!hit || !table) {
      this.marker.hidden = true;
      return null;
    }
    const $pos = doc.resolve(hit.pos);
    if ($pos.depth < 1) {
      this.marker.hidden = true;
      return null;
    }
    const blockPos = $pos.before(1);
    const block = doc.nodeAt(blockPos);
    const dom = this.view.nodeDOM(blockPos) as HTMLElement | null;
    if (!block || !dom || blockPos === tablePos) {
      this.marker.hidden = true;
      return null;
    }
    const rect = dom.getBoundingClientRect();
    const after = y > rect.top + rect.height / 2;
    const insertAt = after ? blockPos + block.nodeSize : blockPos;
    if (insertAt === tablePos || insertAt === tablePos + table.nodeSize) {
      this.marker.hidden = true;
      return null;
    }
    const editorRect = this.view.dom.getBoundingClientRect();
    this.marker.hidden = false;
    this.marker.style.left = `${editorRect.left}px`;
    this.marker.style.width = `${editorRect.width}px`;
    this.marker.style.top = `${after ? rect.bottom : rect.top}px`;
    return insertAt;
  }
}

export const TableTools = Extension.create({
  name: 'tableTools',
  addGlobalAttributes() {
    return [{
      types: ['tableRow'],
      attributes: {
        rowHeight: {
          default: null,
          parseHTML: (element: HTMLElement) => {
            const value = parseFloat(element.style.height || element.getAttribute('data-row-height') || '');
            return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
          },
          renderHTML: (attributes: Record<string, unknown>) => (attributes.rowHeight ? { style: `height: ${attributes.rowHeight}px`, 'data-row-height': attributes.rowHeight } : {}),
        },
      },
    }];
  },
  addProseMirrorPlugins() {
    let tools: TableToolsView | null = null;
    return [new Plugin({
      key: tableKey,
      view: (view) => {
        tools = new TableToolsView(view);
        return { update: () => tools?.update(), destroy: () => { tools?.destroy(); tools = null; } };
      },
      props: {
        handleDOMEvents: {
          mousemove: (_view, event) => {
            tools?.hover(event.target as HTMLElement);
            tools?.trackRow(event);
            return false;
          },
          mouseleave: (view) => {
            tools?.scheduleHide();
            view.dom.classList.remove('row-resize-cursor');
            return false;
          },
          mousedown: (_view, event) => tools?.startRow(event) ?? false,
        },
      },
    })];
  },
});
