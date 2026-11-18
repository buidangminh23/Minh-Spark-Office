import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const methods = [
  ['calculateAutoHeightForCell(row, col)', 'cell', 2],
  ['_getMeasuredWidthByCell(cell, row, column, currColWidth)', 'cell', 1],
  ['_applyShrinkToFit(row, col, fontCache, style)', 'fontCache.cellData', 1],
  ['_setFontStylesCache(row, col, cellData, style, hasMergeData = true)', 'cellData', 1],
  ['_renderText(ctx, renderFontCtx)', 'cellData', 1],
];

function patchModule(file) {
  const source = readFileSync(file, 'utf8');
  let result = source;
  for (const [signature, cell, expected] of methods) {
    const start = result.indexOf('\n\t' + signature + ' {');
    const end = result.indexOf('\n\t}', start + 1);
    const original = signature === '_renderText(ctx, renderFontCtx)' ? 'renderFontCtx.spreadsheetSkeleton.textLineGap' : 'this.textLineGap';
    const replacement = `(${cell}?.fontRenderExtension?.lineGap ?? ${original})`;
    const body = result.slice(start, end);
    if (start < 0 || end < 0 || body.split(original).length !== expected + 1) {
      throw new Error(`Review Univer sheet spacing compatibility for ${signature} in ${file}`);
    }
    if (body.split(replacement).length === expected + 1) continue;
    result = result.slice(0, start) + body.replaceAll(original, replacement) + result.slice(end);
  }
  if (result !== source) writeFileSync(file, result);
}

for (const format of ['es', 'cjs']) {
  patchModule(require.resolve(`@univerjs/engine-render/lib/${format}/index.js`));
}
