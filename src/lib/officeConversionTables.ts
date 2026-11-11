import type { JSONContent } from '@tiptap/react';
import type { CellObject, Range, WorkSheet } from 'xlsx';
import { conversionNodeText } from './officeConversionDocument';

export type ConversionTable = { rows: string[][]; merges: Range[] };

export function conversionTableGrid(table: JSONContent): ConversionTable {
  const rows: string[][] = [];
  const merges: Range[] = [];
  const occupied = new Set<string>();
  let cells = 0;
  for (const [r, row] of (table.content ?? []).entries()) {
    rows[r] ??= [];
    let c = 0;
    for (const cell of row.content ?? []) {
      while (occupied.has(`${r}:${c}`)) c += 1;
      const width = Math.max(1, Math.min(100, Math.floor(Number(cell.attrs?.colspan) || 1)));
      const height = Math.max(1, Math.min(1000, Math.floor(Number(cell.attrs?.rowspan) || 1)));
      cells += width * height;
      if (cells > 250_000 || c + width > 512 || r + height > 50_000) throw new Error('Bảng quá lớn để chuyển đổi an toàn.');
      for (let rr = r; rr < r + height; rr += 1) {
        rows[rr] ??= [];
        for (let cc = c; cc < c + width; cc += 1) {
          if (occupied.has(`${rr}:${cc}`)) throw new Error('Bảng có vùng ô gộp chồng lấn.');
          occupied.add(`${rr}:${cc}`);
          rows[rr][cc] = '';
        }
      }
      rows[r][c] = conversionNodeText(cell).trim();
      if (width > 1 || height > 1) merges.push({ s: { r, c }, e: { r: r + height - 1, c: c + width - 1 } });
      c += width;
    }
  }
  const width = Math.max(0, ...rows.map((row) => row.length));
  return { rows: rows.map((row) => Array.from({ length: width }, (_, c) => row[c] ?? '')), merges };
}

export function conversionTables(json: JSONContent): ConversionTable[] {
  if (json.type === 'table') return [conversionTableGrid(json)];
  return (json.content ?? []).flatMap(conversionTables);
}

export function spreadsheetDocumentTable(sheet: WorkSheet, rows: number, columns: number, encode: (cell: { r: number; c: number }) => string, display: (cell: CellObject) => string): JSONContent {
  const anchors = new Map<string, Range>();
  const covered = new Set<string>();
  for (const merge of sheet['!merges'] ?? []) {
    anchors.set(encode(merge.s), merge);
    for (let r = merge.s.r; r <= merge.e.r; r += 1) {
      for (let c = merge.s.c; c <= merge.e.c; c += 1) if (r !== merge.s.r || c !== merge.s.c) covered.add(encode({ r, c }));
    }
  }
  return { type: 'table', content: Array.from({ length: rows }, (_, r) => ({
    type: 'tableRow', content: Array.from({ length: columns }, (_, c): JSONContent | null => {
      const address = encode({ r, c });
      if (covered.has(address)) return null;
      const cell = sheet[address] as CellObject | undefined;
      const merge = anchors.get(address);
      const colspan = merge ? merge.e.c - merge.s.c + 1 : 1;
      const rowspan = merge ? merge.e.r - merge.s.r + 1 : 1;
      const widths = Array.from({ length: colspan }, (_, offset) => {
        const column = sheet['!cols']?.[c + offset];
        return Math.max(16, Math.min(2000, column?.wpx ?? (column?.wch === undefined ? 96 : column.wch * 7 + 5)));
      });
      const value = cell ? cell.f && cell.v == null ? `=${cell.f}` : display(cell) : '';
      return { type: 'tableCell', attrs: { colspan, rowspan, colwidth: widths }, content: [{ type: 'paragraph', content: value ? [{ type: 'text', text: value }] : [] }] };
    }).filter((cell): cell is JSONContent => cell !== null),
  })) };
}
