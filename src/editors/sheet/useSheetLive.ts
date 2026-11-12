import { useCallback, useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { createElement } from 'react';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import type { createUniver } from '@univerjs/presets';
import type { CellStyle, CellValue, WorkbookData } from '../../lib/sheetTypes';
import type { SheetContent } from '../../lib/storage';
import { parseJson, readFlat, writeFlat } from '../../lib/live/flatSync';
import { flattenWorkbook, onlyCellChanges, SHEET_MAP, unflattenWorkbook, type CellChange } from '../../lib/live/sheetSync';
import { readRemotePresence, useLocalUser, type LiveUser } from '../../lib/live/presence';

type UniverApi = ReturnType<typeof createUniver>['univerAPI'];
type Disposable = { dispose: () => void };

export type SheetLiveBinding = {
  ydoc: Y.Doc;
  awareness: Awareness;
  user: LiveUser;
  readOnly: boolean;
  bar: ReactNode;
};

type CellPresence = { sheetId: string; r0: number; c0: number; r1: number; c1: number };

const LOCAL_ORIGIN = 'sheet-local';
const WRITE_DELAY_MS = 150;
const RELOAD_RETRY_MS = 400;
const MUTATION = 2;
const PEER_TAG = 'mso-live-peer-tag';
const SET_RANGE_VALUES = 'sheet.mutation.set-range-values';

function PeerTag(props: { name?: string; color?: string; popup?: { extraProps?: { name?: string; color?: string } } }) {
  const extra = props.popup?.extraProps ?? props;
  return createElement('span', { className: 'sh-live-peer-tag', style: { background: extra.color } }, extra.name);
}

function applyCells(api: UniverApi, map: Y.Map<unknown>, cells: CellChange[]) {
  const workbook = api.getActiveWorkbook();
  if (!workbook) return false;
  const unitId = workbook.getId();
  const bySheet = new Map<string, CellChange[]>();
  for (const cell of cells) {
    if (!workbook.getSheetBySheetId(cell.sheetId)) return false;
    if (!bySheet.has(cell.sheetId)) bySheet.set(cell.sheetId, []);
    bySheet.get(cell.sheetId)!.push(cell);
  }
  bySheet.forEach((list, subUnitId) => {
    const clear: Record<number, Record<number, null>> = {};
    const fill: Record<number, Record<number, CellValue>> = {};
    let filled = false;
    for (const { row, column } of list) {
      (clear[row] ??= {})[column] = null;
      const cell = parseJson<CellValue>(map.get(`c:${subUnitId}:${row}:${column}`) as string | undefined);
      if (!cell) continue;
      if (typeof cell.s === 'string') {
        const style = parseJson<CellStyle>(map.get(`st:${cell.s}`) as string | undefined);
        if (style) cell.s = style;
      }
      (fill[row] ??= {})[column] = cell;
      filled = true;
    }
    api.syncExecuteCommand(SET_RANGE_VALUES, { unitId, subUnitId, cellValue: clear }, { onlyLocal: true });
    if (filled) api.syncExecuteCommand(SET_RANGE_VALUES, { unitId, subUnitId, cellValue: fill, isOverrideStyle: true }, { onlyLocal: true });
  });
  return true;
}

export function useSheetLive(options: {
  live: SheetLiveBinding | undefined;
  apiRef: MutableRefObject<UniverApi | null>;
  epoch: number;
  editingRef: MutableRefObject<boolean>;
  onReloaded: (api: UniverApi) => void;
}) {
  const { live, apiRef, epoch, editingRef } = options;
  const ydoc = live?.ydoc;
  const awareness = live?.awareness;
  const readOnly = live?.readOnly ?? true;
  const uid = live?.user.uid ?? '';
  const reloadedRef = useRef(options.onReloaded);
  reloadedRef.current = options.onReloaded;
  const applying = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const api = apiRef.current;
    if (!ydoc || readOnly || !api) return;
    const workbook = api.getActiveWorkbook();
    if (!workbook) return;
    const map = ydoc.getMap(SHEET_MAP);
    const extras = parseJson<Omit<SheetContent, 'kind' | 'workbook'>>(map.get('x') as string | undefined) ?? {};
    writeFlat(map, flattenWorkbook(workbook.save() as unknown as WorkbookData, extras), LOCAL_ORIGIN);
  }, [ydoc, readOnly, apiRef]);

  useLocalUser(awareness ?? null, live?.user ?? null);

  useEffect(() => {
    const api = apiRef.current;
    if (!awareness || !api) return;
    const publishSelection = () => {
      const sheet = api.getActiveWorkbook()?.getActiveSheet();
      const range = sheet?.getSelection()?.getActiveRange()?.getRange();
      if (!sheet || !range) return;
      const next: CellPresence = { sheetId: sheet.getSheetId(), r0: range.startRow, c0: range.startColumn, r1: range.endRow, c1: range.endColumn };
      const current = (awareness.getLocalState() as { cell?: CellPresence } | null)?.cell;
      if (JSON.stringify(current) !== JSON.stringify(next)) awareness.setLocalStateField('cell', next);
    };
    const sub = api.addEvent(api.Event.CommandExecuted, (event) => {
      if (event.id.includes('selection') || event.id.includes('set-worksheet-activ')) publishSelection();
      if (applying.current || readOnly || event.type !== MUTATION || event.options?.onlyLocal) return;
      if (!timer.current) timer.current = setTimeout(flush, WRITE_DELAY_MS);
    });
    publishSelection();
    return () => { sub.dispose(); flush(); };
  }, [awareness, readOnly, apiRef, epoch, flush]);

  useEffect(() => {
    const api = apiRef.current;
    if (!ydoc || !api) return;
    const map = ydoc.getMap(SHEET_MAP);
    const pending = new Set<string>();
    let retry: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      retry = null;
      if (editingRef.current) { retry = setTimeout(reload, RELOAD_RETRY_MS); return; }
      const content = unflattenWorkbook(readFlat(map));
      const current = api.getActiveWorkbook();
      if (!content) return;
      const activeSheet = current?.getActiveSheet()?.getSheetId();
      applying.current = true;
      try {
        if (current) api.disposeUnit(current.getId());
        api.createWorkbook(content.workbook as never);
        if (activeSheet && content.workbook.sheets[activeSheet]) api.getActiveWorkbook()?.getSheetBySheetId(activeSheet)?.activate();
      } finally { applying.current = false; }
      reloadedRef.current(api);
    };
    const pull = (event: Y.YMapEvent<unknown>, transaction: Y.Transaction) => {
      if (transaction.origin === LOCAL_ORIGIN) return;
      if (timer.current) flush();
      event.keysChanged.forEach((key) => pending.add(key));
      const cells = onlyCellChanges(pending);
      if (retry) return;
      if (cells) {
        pending.clear();
        if (!cells.length) return;
        applying.current = true;
        let done = false;
        try { done = applyCells(api, map, cells); } finally { applying.current = false; }
        if (!done) reload();
        return;
      }
      pending.clear();
      reload();
    };
    map.observe(pull);
    return () => { map.unobserve(pull); if (retry) clearTimeout(retry); };
  }, [ydoc, apiRef, epoch, editingRef, flush]);

  useEffect(() => {
    const api = apiRef.current;
    if (!awareness || !api) return;
    const registration = api.registerComponent(PEER_TAG, PeerTag as never);
    let marks: Disposable[] = [];
    let queued = false;
    let alive = true;
    const clear = () => { marks.forEach((mark) => { try { mark.dispose(); } catch { void 0; } }); marks = []; };
    const draw = () => {
      queued = false;
      clear();
      if (!alive) return;
      const sheet = api.getActiveWorkbook()?.getActiveSheet();
      if (!sheet) return;
      for (const peer of readRemotePresence<CellPresence>(awareness, 'cell', uid)) {
        const at = peer.value;
        if (at.sheetId !== sheet.getSheetId()) continue;
        try {
          const range = sheet.getRange(at.r0, at.c0, at.r1 - at.r0 + 1, at.c1 - at.c0 + 1);
          marks.push(range.highlight({ stroke: peer.color, strokeWidth: 2, fill: `${peer.color}1f` }));
          const tag = sheet.getRange(at.r0, at.c0).attachRangePopup({ componentKey: PEER_TAG, direction: 'top', extraProps: { name: peer.name, color: peer.color } } as never);
          if (tag) marks.push(tag);
        } catch { continue; }
      }
    };
    const schedule = () => { if (!queued) { queued = true; queueMicrotask(draw); } };
    awareness.on('change', schedule);
    const sub = api.addEvent(api.Event.CommandExecuted, (event) => { if (event.id.includes('set-worksheet-activ')) schedule(); });
    schedule();
    return () => { alive = false; awareness.off('change', schedule); sub.dispose(); clear(); registration.dispose(); };
  }, [awareness, uid, apiRef, epoch]);
}
