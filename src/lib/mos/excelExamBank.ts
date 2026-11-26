import catalog from './catalog-v1.json';
import type { SheetContent } from '../storage';
import { emptySheet, emptyWorkbook, uid } from '../workbookBasics';
import { cellAt, findSheet, formulaOf, primarySheet, resolveStyle } from './excelHelpers';
import type { MosExamNumber, MosExcelProject, MosVersion } from './types';

type ExcelDatasetSeed = {
  slug: string;
  fileName: string;
  title: string;
  titleEn: string;
  scenario: string;
  scenarioEn: string;
  banner: string;
  rawSheetName: string;
  targetSheetName: string;
  extraSheetName: string;
  refSheetName: string;
  headers: [string, string, string, string, string, string, string, string];
  rows: Array<[string, string, string, number, number]>;
  refRows: Array<[string, number]>;
  targetGroup: string;
  passThreshold: number;
  passLabel: string;
  failLabel: string;
  accentBg: string;
};

export const EXCEL_SEEDS: ExcelDatasetSeed[] = catalog.seeds.excel as ExcelDatasetSeed[];

function buildStarterSheet(seed: ExcelDatasetSeed, idTag: string): SheetContent {
  const wb = emptyWorkbook(seed.fileName.replace(/\.xlsx$/i, ''));
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = seed.rawSheetName;
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#0F172A' }, ht: 1, vt: 2 },
    head: { bl: 1, bg: { rgb: seed.accentBg }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    num: { n: { pattern: '#,##0' } },
    kpiHead: { bl: 1, bg: { rgb: '#EFF6FF' }, cl: { rgb: '#1E3A8A' } },
  };

  sheet.cellData[0] = { 0: { v: seed.banner, t: 1, s: 'title' } };
  sheet.cellData[1] = {};
  seed.headers.forEach((h, c) => {
    sheet.cellData[1][c] = { v: h, t: 1, s: 'head' };
  });

  seed.rows.forEach((row, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = {
      0: { v: row[0], t: 1 },
      1: { v: row[1], t: 1 },
      2: { v: row[2], t: 1 },
      3: { v: row[3], t: 2, s: 'num' },
      4: { v: row[4], t: 2, s: 'num' },
    };
  });

  sheet.cellData[9] = { 0: { v: 'Tổng cộng (F3:F8)', t: 1, s: 'kpiHead' } };
  sheet.cellData[10] = { 0: { v: `Thống kê nhóm ${seed.targetGroup}`, t: 1 } };
  sheet.cellData[11] = { 0: { v: 'Chỉ số kiểm định nâng cao', t: 1 } };

  sheet.columnData = {
    0: { w: 115 },
    1: { w: 215 },
    2: { w: 135 },
    3: { w: 115 },
    4: { w: 130 },
    5: { w: 145 },
    6: { w: 140 },
    7: { w: 140 },
  };
  sheet.rowData = { 0: { h: 32 }, 1: { h: 26 } };
  sheet.mergeData = [];
  sheet.freeze = { xSplit: 0, ySplit: 0, startRow: 0, startColumn: 0 };

  const ref = emptySheet(seed.refSheetName);
  ref.cellData[0] = {
    0: { v: 'Mã vùng', t: 1, s: 'head' },
    1: { v: 'Định mức phí', t: 1, s: 'head' },
  };
  seed.refRows.forEach((pair, idx) => {
    ref.cellData[idx + 1] = {
      0: { v: pair[0], t: 1 },
      1: { v: pair[1], t: 2, s: 'num' },
    };
  });
  ref.columnData = { 0: { w: 110 }, 1: { w: 145 } };
  wb.sheetOrder.push(ref.id);
  wb.sheets[ref.id] = ref;
  wb.id = uid(`mos-xl-${idTag}`);

  return {
    kind: 'sheet',
    workbook: wb,
    printSettings: {
      orientation: 'portrait',
      paperSize: 'A4',
      margins: 'normal',
      fitToPage: false,
      showGridlines: true,
    },
  };
}

function cleanFormula(cellFormula: string): string {
  return cellFormula.replace(/\$/g, '');
}

function makeExcelAssocTasks(prefix: string, version: MosVersion, variant: number, seed: ExcelDatasetSeed): MosExcelProject['tasks'] {
  const manageMode = variant % 3;
  const t1: MosExcelProject['tasks'][number] = manageMode === 0
    ? {
        id: `${prefix}-t1`,
        domainId: 'excel-manage',
        title: `Đổi tên trang tính thành “${seed.targetSheetName}” và cố định 2 dòng đầu`,
        titleEn: `Rename worksheet to “${seed.targetSheetName}” and Freeze Top 2 Rows`,
        instruction: `Đổi tên trang tính đầu tiên từ “${seed.rawSheetName}” thành “${seed.targetSheetName}” và cố định 2 dòng tiêu đề đầu tiên (Freeze Panes tại ô A3).`,
        instructionEn: `Rename the first worksheet to “${seed.targetSheetName}” and freeze the top 2 rows.`,
        copyTokens: [seed.targetSheetName],
        ribbonPath: 'Nhấp đúp tab Sheet · Xem (View) → Cố định vùng (Freeze Panes)',
        hint: `Đổi tên tab đầu thành “${seed.targetSheetName}”, sau đó chọn ô A3 rồi bật Cố định vùng (Freeze Panes).`,
        points: 20,
        solution: {
          steps: [
            `Nhấp đúp vào tên trang tính “${seed.rawSheetName}” ở thanh tab dưới đáy, nhập “${seed.targetSheetName}” rồi nhấn Enter.`,
            'Chọn ô A3 (ngay dưới hàng tiêu đề cột dòng 2).',
            'Mở thẻ Xem (View) → bấm Cố định vùng (Freeze Panes) để giữ cố định 2 dòng đầu.',
          ],
          formulaOrValue: seed.targetSheetName,
          examTrap: 'Nếu bấm Freeze Top Row chỉ cố định dòng 1; muốn giữ cả dòng 1 và 2 phải chọn A3 rồi bấm Freeze Panes.',
          verifyTip: `Tab trang tính mang tên “${seed.targetSheetName}” và cuộn xuống vẫn thấy nguyên dòng 1–2.`,
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (sh) {
            sh.name = seed.targetSheetName;
            sh.freeze = { xSplit: 0, ySplit: 2, startRow: 2, startColumn: 0 };
          }
        },
        check: (sc) => {
          const sh = findSheet(sc.workbook, seed.targetSheetName);
          const frz = (sh?.freeze?.ySplit ?? 0) >= 1 || (sh?.freeze?.startRow ?? 0) >= 1;
          return sh && frz
            ? { passed: true, detail: `Đã đổi tên trang tính “${sh.name}” và cố định dòng tiêu đề.` }
            : { passed: false, detail: `Cần đổi tên trang đầu thành “${seed.targetSheetName}” và bật Freeze Panes.` };
        },
      }
    : manageMode === 1
      ? {
          id: `${prefix}-t1`,
          domainId: 'excel-manage',
          title: `Thêm trang tính “${seed.extraSheetName}” và gộp tiêu đề A1:H1`,
          titleEn: `Insert worksheet “${seed.extraSheetName}” and merge title A1:H1`,
          instruction: `Thêm một trang tính mới đặt tên là “${seed.extraSheetName}” và trên trang dữ liệu chính gộp & căn giữa vùng tiêu đề A1:H1.`,
          instructionEn: `Add a new worksheet named “${seed.extraSheetName}” and merge A1:H1 on the main data sheet.`,
          copyTokens: [seed.extraSheetName, 'A1:H1'],
          ribbonPath: 'Nút + thêm Sheet · Trang chủ → Gộp & Căn giữa (Merge & Center)',
          hint: `Bấm dấu + dưới đáy để tạo trang tính “${seed.extraSheetName}”, sau đó quay lại trang đầu quét chọn A1:H1 và bấm Gộp ô.`,
          points: 20,
          solution: {
            steps: [
              `Bấm nút (+) cạnh danh sách tab dưới cùng để thêm trang mới và đổi tên thành “${seed.extraSheetName}”.`,
              'Quay về trang dữ liệu đầu tiên, quét chọn vùng A1:H1.',
              'Trên thẻ Trang chủ (Home), bấm nút Gộp & Căn giữa (Merge & Center).',
            ],
            formulaOrValue: seed.extraSheetName,
            examTrap: 'Quét đủ tới cột H (A1:H1) bao trùm toàn bộ 8 cột của bảng.',
            verifyTip: `Sổ tính có thêm tab “${seed.extraSheetName}” và dòng 1 trang chính trải đều qua A1:H1.`,
          },
          applySampleSolution: (sc) => {
            const added = emptySheet(seed.extraSheetName);
            sc.workbook.sheetOrder.push(added.id);
            sc.workbook.sheets[added.id] = added;
            const sh = primarySheet(sc.workbook);
            if (sh) sh.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 7 }];
          },
          check: (sc) => {
            const hasExtra = Boolean(findSheet(sc.workbook, seed.extraSheetName));
            const sh = primarySheet(sc.workbook);
            const merged = (sh?.mergeData ?? []).some((m) => m.startRow === 0 && m.endRow === 0 && m.startColumn === 0 && m.endColumn === 7);
            return hasExtra && merged
              ? { passed: true, detail: `Đã thêm trang “${seed.extraSheetName}” và gộp tiêu đề A1:H1.` }
              : { passed: false, detail: `Cần tạo đủ trang tính “${seed.extraSheetName}” và gộp ô vùng A1:H1.` };
          },
        }
      : {
          id: `${prefix}-t1`,
          domainId: 'excel-format',
          title: 'Gộp tiêu đề A1:H1 và thiết lập trang in Ngang vừa 1 trang',
          titleEn: 'Merge A1:H1 and configure Landscape Fit-to-Page printing',
          instruction: 'Trên trang dữ liệu chính, gộp vùng tiêu đề A1:H1, đồng thời thiết lập in ấn Hướng giấy Ngang (Landscape) và Co vừa trang (Fit to Page).',
          instructionEn: 'Merge A1:H1 on the primary sheet, and set Print Orientation to Landscape with Fit to Page enabled.',
          copyTokens: ['A1:H1'],
          ribbonPath: 'Trang chủ → Gộp ô · Bố cục trang / Tệp → In → Khổ ngang & Co vừa trang',
          hint: 'Quét A1:H1 bấm Gộp ô, sau đó vào Bố cục trang (hoặc hộp thoại In) chọn Hướng Ngang và bật Fit to Page.',
          points: 20,
          solution: {
            steps: [
              'Quét chọn vùng ô A1:H1 trên trang dữ liệu chính → bấm Gộp & Căn giữa (Merge & Center).',
              'Mở thẻ Bố cục trang (Page Layout) hoặc nhấn Ctrl + P mở hộp thoại Thiết lập in.',
              'Chọn Hướng giấy Ngang (Landscape) và bật tuỳ chọn Co vừa 1 trang (Fit to Page).',
            ],
            shortcut: 'Ctrl + P',
            examTrap: 'Kiểm tra đủ cả hai thiết lập in: Hướng Ngang và chế độ Co vừa trang.',
            verifyTip: 'Tiêu đề gộp gọn A1:H1 và bản xem trước khi in nằm trọn trên 1 trang ngang.',
          },
          applySampleSolution: (sc) => {
            const sh = primarySheet(sc.workbook);
            if (sh) sh.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 7 }];
            sc.printSettings = {
              paperSize: 'A4',
              margins: 'normal',
              showGridlines: true,
              ...(sc.printSettings ?? {}),
              orientation: 'landscape',
              fitToPage: true,
            };
          },
          check: (sc) => {
            const sh = primarySheet(sc.workbook);
            const merged = (sh?.mergeData ?? []).some((m) => m.startRow === 0 && m.endRow === 0 && m.startColumn === 0 && m.endColumn === 7);
            const prtOk = sc.printSettings?.orientation === 'landscape' && Boolean(sc.printSettings?.fitToPage || sc.printSettings?.scaleMode === 'fit-page' || sc.printSettings?.scaleMode === 'fit-width');
            return merged && prtOk
              ? { passed: true, detail: 'Đã gộp A1:H1 và cấu hình in ngang vừa một trang.' }
              : { passed: false, detail: 'Cần gộp A1:H1 và đặt thiết lập in Landscape + Fit to Page.' };
          },
        };

  const t2: MosExcelProject['tasks'][number] = {
    id: `${prefix}-t2`,
    domainId: 'excel-formulas',
    title: 'Tính cột Thành tiền (F3:F8) và Tổng cộng tại F10',
    titleEn: 'Calculate row totals in F3:F8 and grand total in F10',
    instruction: `Tại F3:F8, lập công thức nhân ${seed.headers[3]} (cột D) với ${seed.headers[4]} (cột E), sau đó dùng hàm SUM tính tổng F3:F8 tại ô F10.`,
    instructionEn: 'In F3:F8 multiply column D by column E (=D3*E3), then calculate =SUM(F3:F8) in cell F10.',
    copyTokens: ['=D3*E3', '=SUM(F3:F8)'],
    ribbonPath: 'Ô F3: =D3*E3 · Ô F10: =SUM(F3:F8)',
    hint: 'Nhập =D3*E3 vào F3 rồi kéo xuống F8; tiếp theo tại F10 nhập =SUM(F3:F8).',
    points: 20,
    solution: {
      steps: [
        'Chọn ô F3, nhập công thức =D3*E3 rồi nhấn Enter.',
        'Kéo nút điền tự động (Fill Handle) từ F3 xuống hết F8.',
        'Chọn ô F10 (dòng Tổng cộng), nhập =SUM(F3:F8) rồi nhấn Enter.',
      ],
      formulaOrValue: '=SUM(F3:F8)',
      shortcut: 'Alt + =',
      examTrap: 'Bắt buộc dùng công thức nhân và hàm SUM, không nhập tay kết quả tính nhẩm.',
      verifyTip: 'Cả 6 ô F3:F8 đều chứa công thức D*E và F10 hiển thị tổng cộng bằng hàm SUM.',
    },
    applySampleSolution: (sc) => {
      const sh = primarySheet(sc.workbook);
      if (!sh) return;
      for (let i = 0; i < 6; i++) {
        sh.cellData[i + 2][5] = { f: `=D${i + 3}*E${i + 3}`, s: { n: { pattern: '#,##0' } } };
      }
      sh.cellData[9] = { ...(sh.cellData[9] ?? {}), 5: { f: '=SUM(F3:F8)', s: { n: { pattern: '#,##0' } } } };
    },
    check: (sc) => {
      const sh = primarySheet(sc.workbook);
      const rowsOk = [0, 1, 2, 3, 4, 5].every((i) => {
        const r = i + 3;
        const f = cleanFormula(formulaOf(cellAt(sh, i + 2, 5)));
        return (f.includes(`D${r}*E${r}`) || f.includes(`E${r}*D${r}`) || f.includes(`PRODUCT(D${r}:E${r})`));
      });
      const sumF = cleanFormula(formulaOf(cellAt(sh, 9, 5)));
      const sumOk = sumF.includes('SUM(F3:F8)');
      return rowsOk && sumOk
        ? { passed: true, detail: 'Đã tính đầy đủ cột F3:F8 và tổng cộng SUM(F3:F8) tại F10.' }
        : { passed: false, detail: 'Cần điền đủ công thức =D*E cho F3:F8 và =SUM(F3:F8) tại F10.' };
    },
  };

  const t3: MosExcelProject['tasks'][number] = {
    id: `${prefix}-t3`,
    domainId: 'excel-lookup',
    title: `Phân loại tự động cột G3:G8 bằng hàm IF (>= ${seed.passThreshold.toLocaleString('vi-VN')})`,
    titleEn: `Classify rows in G3:G8 with IF (>= ${seed.passThreshold})`,
    instruction: `Tại vùng G3:G8, dùng hàm IF kiểm tra nếu Thành tiền (F3) >= ${seed.passThreshold} thì trả về “${seed.passLabel}”, ngược lại trả về “${seed.failLabel}”.`,
    instructionEn: `In G3:G8, use =IF(F3>=${seed.passThreshold},"${seed.passLabel}","${seed.failLabel}") and fill down.`,
    copyTokens: [`=IF(F3>=${seed.passThreshold},"${seed.passLabel}","${seed.failLabel}")`, seed.passLabel, seed.failLabel],
    ribbonPath: 'Công thức (Formulas) → Logic → IF',
    hint: `Tại G3 nhập =IF(F3>=${seed.passThreshold},"${seed.passLabel}","${seed.failLabel}") rồi sao chép xuống G8.`,
    points: 20,
    solution: {
      steps: [
        'Chọn ô G3 trên bảng dữ liệu chính.',
        `Dán công thức =IF(F3>=${seed.passThreshold},"${seed.passLabel}","${seed.failLabel}") bằng nút Click-to-Copy.`,
        'Sao chép công thức từ G3 xuống hết G8.',
      ],
      formulaOrValue: `=IF(F3>=${seed.passThreshold},"${seed.passLabel}","${seed.failLabel}")`,
      examTrap: `Chú ý dấu >= ${seed.passThreshold} (không dùng dấu > đơn thuần làm sai trường hợp bằng ngưỡng).`,
      verifyTip: `Các dòng đạt ngưỡng hiện “${seed.passLabel}” và các dòng còn lại hiện “${seed.failLabel}”.`,
    },
    applySampleSolution: (sc) => {
      const sh = primarySheet(sc.workbook);
      if (!sh) return;
      for (let i = 0; i < 6; i++) {
        sh.cellData[i + 2][6] = { f: `=IF(F${i + 3}>=${seed.passThreshold},"${seed.passLabel}","${seed.failLabel}")` };
      }
    },
    check: (sc) => {
      const sh = primarySheet(sc.workbook);
      const ok = [0, 1, 2, 3, 4, 5].every((i) => {
        const f = cleanFormula(formulaOf(cellAt(sh, i + 2, 6)));
        return f.includes('IF(') && f.includes(`F${i + 3}`) && f.includes(String(seed.passThreshold));
      });
      return ok
        ? { passed: true, detail: 'Đã thiết lập công thức phân loại IF cho toàn bộ vùng G3:G8.' }
        : { passed: false, detail: `Vùng G3:G8 chưa có đủ công thức IF so sánh cột F với ${seed.passThreshold}.` };
    },
  };

  const t4: MosExcelProject['tasks'][number] = version === '365'
    ? {
        id: `${prefix}-t4`,
        domainId: 'excel-lookup',
        title: `Tra cứu định mức phí (H3:H8) từ bảng “${seed.refSheetName}” bằng XLOOKUP`,
        titleEn: `Lookup fee in H3:H8 from “${seed.refSheetName}” using XLOOKUP`,
        instruction: `Tại H3:H8, kết hợp LEFT(A3,2) và hàm XLOOKUP tra mã 2 ký tự đầu của cột A trong vùng ${seed.refSheetName}!$A$2:$A$${seed.refRows.length + 1} để lấy định mức phí tại ${seed.refSheetName}!$B$2:$B$${seed.refRows.length + 1}.`,
        instructionEn: `In H3:H8, use =XLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${seed.refRows.length + 1},${seed.refSheetName}!$B$2:$B$${seed.refRows.length + 1}) and fill down.`,
        copyTokens: [`=XLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${seed.refRows.length + 1},${seed.refSheetName}!$B$2:$B$${seed.refRows.length + 1})`],
        ribbonPath: 'Công thức → Tra cứu & Tham chiếu → XLOOKUP',
        hint: `Nhập =XLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${seed.refRows.length + 1},${seed.refSheetName}!$B$2:$B$${seed.refRows.length + 1}) vào H3 rồi kéo xuống H8.`,
        points: 20,
        solution: {
          steps: [
            'Chọn ô H3 trên trang dữ liệu chính.',
            `Sử dụng LEFT(A3,2) tách mã vùng, lồng vào XLOOKUP tra sang trang “${seed.refSheetName}”.`,
            'Khoá tuyệt đối vùng tra cứu bằng dấu $ và sao chép công thức xuống hết H8.',
          ],
          formulaOrValue: `=XLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${seed.refRows.length + 1},${seed.refSheetName}!$B$2:$B$${seed.refRows.length + 1})`,
          examTrap: 'Nhớ cố định địa chỉ vùng bảng tra ($) trước khi kéo công thức xuống các dòng dưới.',
          verifyTip: 'Cả 6 dòng H3:H8 hiển thị đúng mức phí tương ứng mã vùng 2 ký tự đầu.',
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (!sh) return;
          const endR = seed.refRows.length + 1;
          for (let i = 0; i < 6; i++) {
            sh.cellData[i + 2][7] = { f: `=XLOOKUP(LEFT(A${i + 3},2),${seed.refSheetName}!$A$2:$A$${endR},${seed.refSheetName}!$B$2:$B$${endR})` };
          }
        },
        check: (sc) => {
          const sh = primarySheet(sc.workbook);
          const refUpper = seed.refSheetName.toUpperCase();
          const ok = [0, 1, 2, 3, 4, 5].every((i) => {
            const f = cleanFormula(formulaOf(cellAt(sh, i + 2, 7)));
            return f.includes('XLOOKUP(') && f.includes(`A${i + 3}`) && f.includes(refUpper);
          });
          return ok
            ? { passed: true, detail: 'Đã tra cứu thành công H3:H8 bằng hàm hiện đại XLOOKUP.' }
            : { passed: false, detail: `Vùng H3:H8 chưa áp dụng đúng hàm XLOOKUP tham chiếu trang ${seed.refSheetName}.` };
        },
      }
    : {
        id: `${prefix}-t4`,
        domainId: 'excel-lookup',
        title: `Tra cứu định mức phí (H3:H8) từ “${seed.refSheetName}” bằng VLOOKUP`,
        titleEn: `Lookup fee in H3:H8 from “${seed.refSheetName}” using VLOOKUP`,
        instruction: `Tại H3:H8, dùng hàm VLOOKUP kết hợp LEFT(A3,2) tra chính xác (FALSE) trên bảng ${seed.refSheetName}!$A$2:$B$${seed.refRows.length + 1} để lấy cột thứ 2.`,
        instructionEn: `In H3:H8, enter =VLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$B$${seed.refRows.length + 1},2,FALSE) and copy down.`,
        copyTokens: [`=VLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$B$${seed.refRows.length + 1},2,FALSE)`],
        ribbonPath: 'Công thức → Tra cứu & Tham chiếu → VLOOKUP',
        hint: `Tại H3 nhập =VLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$B$${seed.refRows.length + 1},2,FALSE) rồi kéo xuống H8.`,
        points: 20,
        solution: {
          steps: [
            'Đặt con trỏ tại ô H3.',
            `Nhập công thức =VLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$B$${seed.refRows.length + 1},2,FALSE).`,
            'Sao chép công thức xuống toàn bộ dải ô H3:H8.',
          ],
          formulaOrValue: `=VLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$B$${seed.refRows.length + 1},2,FALSE)`,
          examTrap: 'Tham số thứ 4 bắt buộc là FALSE (hoặc 0) để dò chính xác mã vùng không cần sắp xếp.',
          verifyTip: 'Toàn bộ cột H3:H8 hiển thị đúng mức phí mà không phát sinh lỗi #N/A.',
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (!sh) return;
          const endR = seed.refRows.length + 1;
          for (let i = 0; i < 6; i++) {
            sh.cellData[i + 2][7] = { f: `=VLOOKUP(LEFT(A${i + 3},2),${seed.refSheetName}!$A$2:$B$${endR},2,FALSE)` };
          }
        },
        check: (sc) => {
          const sh = primarySheet(sc.workbook);
          const refUpper = seed.refSheetName.toUpperCase();
          const ok = [0, 1, 2, 3, 4, 5].every((i) => {
            const f = cleanFormula(formulaOf(cellAt(sh, i + 2, 7)));
            return f.includes('VLOOKUP(') && f.includes(`A${i + 3}`) && f.includes(refUpper) && (f.includes('FALSE') || f.includes(',0)') || f.includes(';0)'));
          });
          return ok
            ? { passed: true, detail: 'Đã tra cứu chính xác cột H3:H8 bằng VLOOKUP + LEFT.' }
            : { passed: false, detail: `Vùng H3:H8 cần dùng VLOOKUP khớp chính xác (FALSE/0) sang trang ${seed.refSheetName}.` };
        },
      };

  const t5: MosExcelProject['tasks'][number] = version === '2016'
    ? {
        id: `${prefix}-t5`,
        domainId: 'excel-formulas',
        title: `Tính tổng có điều kiện SUMIF (F11) và đếm COUNTIF (F12) cho “${seed.targetGroup}”`,
        titleEn: `Conditional SUMIF in F11 and COUNTIF in F12 for “${seed.targetGroup}”`,
        instruction: `Tại F11 dùng SUMIF tính tổng Thành tiền (F3:F8) của nhóm “${seed.targetGroup}” (cột C3:C8); tại F12 dùng COUNTIF đếm số dòng thuộc nhóm “${seed.targetGroup}”.`,
        instructionEn: `In F11 enter =SUMIF(C3:C8,"${seed.targetGroup}",F3:F8) and in F12 enter =COUNTIF(C3:C8,"${seed.targetGroup}").`,
        copyTokens: [`=SUMIF(C3:C8,"${seed.targetGroup}",F3:F8)`, `=COUNTIF(C3:C8,"${seed.targetGroup}")`],
        ribbonPath: 'Ô F11: SUMIF · Ô F12: COUNTIF',
        hint: `Nhập =SUMIF(C3:C8,"${seed.targetGroup}",F3:F8) tại F11 và =COUNTIF(C3:C8,"${seed.targetGroup}") tại F12.`,
        points: 20,
        solution: {
          steps: [
            `Chọn ô F11, nhập =SUMIF(C3:C8,"${seed.targetGroup}",F3:F8) rồi nhấn Enter.`,
            `Chọn ô F12 ngay bên dưới, nhập =COUNTIF(C3:C8,"${seed.targetGroup}") rồi nhấn Enter.`,
            'Kiểm tra đối số vùng điều kiện C3:C8 đứng đầu trong cả hai công thức.',
          ],
          formulaOrValue: `=SUMIF(C3:C8,"${seed.targetGroup}",F3:F8)`,
          examTrap: 'Trong SUMIF vùng điều kiện C3:C8 đứng trước, vùng tính tổng F3:F8 đứng cuối.',
          verifyTip: `Ô F11 hiện tổng doanh thu và F12 hiện số lượng bản ghi của riêng nhóm “${seed.targetGroup}”.`,
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (!sh) return;
          sh.cellData[10] = { ...(sh.cellData[10] ?? {}), 5: { f: `=SUMIF(C3:C8,"${seed.targetGroup}",F3:F8)` } };
          sh.cellData[11] = { ...(sh.cellData[11] ?? {}), 5: { f: `=COUNTIF(C3:C8,"${seed.targetGroup}")` } };
        },
        check: (sc) => {
          const sh = primarySheet(sc.workbook);
          const f11 = cleanFormula(formulaOf(cellAt(sh, 10, 5)));
          const f12 = cleanFormula(formulaOf(cellAt(sh, 11, 5)));
          const ok11 = f11.includes('SUMIF(') && f11.includes('C3:C8') && f11.includes('F3:F8');
          const ok12 = f12.includes('COUNTIF(') && f12.includes('C3:C8');
          return ok11 && ok12
            ? { passed: true, detail: 'Đã hoàn thành cặp công thức thống kê điều kiện SUMIF & COUNTIF.' }
            : { passed: false, detail: 'Cần nhập đủ SUMIF tại F11 và COUNTIF tại F12 theo vùng C3:C8.' };
        },
      }
    : {
        id: `${prefix}-t5`,
        domainId: 'excel-formulas',
        title: `Tìm giá trị cao nhất theo nhóm bằng MAXIFS (F11) và ghép nhãn TEXTJOIN (F12)`,
        titleEn: `Conditional maximum with MAXIFS (F11) and TEXTJOIN label (F12)`,
        instruction: `Tại F11 dùng hàm MAXIFS tìm Thành tiền (F3:F8) lớn nhất của nhóm “${seed.targetGroup}” (C3:C8); tại F12 dùng TEXTJOIN(" - ",TRUE,A3,C3) ghép mã và nhóm của dòng đầu.`,
        instructionEn: `In F11 use =MAXIFS(F3:F8,C3:C8,"${seed.targetGroup}") and in F12 use =TEXTJOIN(" - ",TRUE,A3,C3).`,
        copyTokens: [`=MAXIFS(F3:F8,C3:C8,"${seed.targetGroup}")`, '=TEXTJOIN(" - ",TRUE,A3,C3)'],
        ribbonPath: `Ô F11: MAXIFS · Ô F12: TEXTJOIN (${version === '2019' ? 'Chuẩn MO-200' : 'Chuẩn MO-210'})`,
        hint: `Nhập =MAXIFS(F3:F8,C3:C8,"${seed.targetGroup}") tại F11 và =TEXTJOIN(" - ",TRUE,A3,C3) tại F12.`,
        points: 20,
        solution: {
          steps: [
            `Chọn ô F11, nhập =MAXIFS(F3:F8,C3:C8,"${seed.targetGroup}") để lọc giá trị cực đại của nhóm mục tiêu.`,
            'Chọn ô F12, nhập =TEXTJOIN(" - ",TRUE,A3,C3) để nối mã và phân nhóm có bỏ qua ô rỗng.',
            'Nhấn Enter xác nhận cả hai ô tổng hợp.',
          ],
          formulaOrValue: `=MAXIFS(F3:F8,C3:C8,"${seed.targetGroup}")`,
          examTrap: 'MAXIFS và TEXTJOIN là hai hàm trọng tâm phân biệt kỳ thi MOS 2019/365 so với MOS 2016.',
          verifyTip: 'Ô F11 trả về giá trị lớn nhất của nhóm mục tiêu và F12 trả về chuỗi ghép gọn gàng.',
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (!sh) return;
          sh.cellData[10] = { ...(sh.cellData[10] ?? {}), 5: { f: `=MAXIFS(F3:F8,C3:C8,"${seed.targetGroup}")` } };
          sh.cellData[11] = { ...(sh.cellData[11] ?? {}), 5: { f: '=TEXTJOIN(" - ",TRUE,A3,C3)' } };
        },
        check: (sc) => {
          const sh = primarySheet(sc.workbook);
          const f11 = cleanFormula(formulaOf(cellAt(sh, 10, 5)));
          const f12 = cleanFormula(formulaOf(cellAt(sh, 11, 5)));
          const ok11 = f11.includes('MAXIFS(') && f11.includes('F3:F8') && f11.includes('C3:C8');
          const ok12 = (f12.includes('TEXTJOIN(') || f12.includes('CONCAT(')) && f12.includes('A3') && f12.includes('C3');
          return ok11 && ok12
            ? { passed: true, detail: 'Đã áp dụng chính xác bộ hàm MAXIFS và TEXTJOIN.' }
            : { passed: false, detail: 'Cần dùng MAXIFS(F3:F8,C3:C8,...) tại F11 và TEXTJOIN(...,A3,C3) tại F12.' };
        },
      };

  return [t1, t2, t3, t4, t5];
}

function expertAnalysisTask(prefix: string, examNumber: number, seed: ExcelDatasetSeed): MosExcelProject['tasks'][number] {
  const group = '"' + seed.targetGroup.replaceAll('"', '""') + '"';
  const analyses = [
    {
      title: 'Tính trung bình theo nhóm và tìm mục có giá trị thấp nhất',
      titleEn: 'Calculate the group average and find the lowest-value item',
      description: `Tại F11, dùng AVERAGEIF tính trung bình thành tiền cho nhóm “${seed.targetGroup}”. Tại F12, dùng INDEX, MATCH và MIN để tìm tên mục có thành tiền thấp nhất.`,
      descriptionEn: `In F11, use AVERAGEIF to find the average amount for the “${seed.targetGroup}” group. In F12, use INDEX, MATCH and MIN to return the lowest-value item name.`,
      f11: `=AVERAGEIF(C3:C8,${group},F3:F8)`,
      f12: '=INDEX(B3:B8,MATCH(MIN(F3:F8),F3:F8,0))',
    },
    {
      title: 'Đếm các dòng đạt chỉ tiêu và tìm giá trị lớn thứ hai',
      titleEn: 'Count entries meeting the target and find the second-largest amount',
      description: `Tại F11, dùng COUNTIFS đếm số dòng thuộc nhóm “${seed.targetGroup}” có thành tiền từ ${seed.passThreshold} trở lên. Tại F12, dùng LARGE tìm thành tiền lớn thứ hai trong cả bảng.`,
      descriptionEn: `In F11, use COUNTIFS to count entries in the “${seed.targetGroup}” group with amounts of at least ${seed.passThreshold}. In F12, use LARGE to find the second-largest amount across all entries.`,
      f11: `=COUNTIFS(C3:C8,${group},F3:F8,">=${seed.passThreshold}")`,
      alternateF11: `=COUNTIFS(F3:F8,">=${seed.passThreshold}",C3:C8,${group})`,
      f12: '=LARGE(F3:F8,2)',
    },
    {
      title: 'Cộng số lượng theo nhóm và xác định trung vị thành tiền',
      titleEn: 'Sum quantities for the target group and calculate the median amount',
      description: `Tại F11, dùng SUMIF cộng các giá trị cột D cho nhóm “${seed.targetGroup}” ở cột C. Tại F12, dùng MEDIAN xác định trung vị của sáu giá trị thành tiền.`,
      descriptionEn: `In F11, use SUMIF to add column D for the “${seed.targetGroup}” group in column C. In F12, use MEDIAN to calculate the median of the six amounts.`,
      f11: `=SUMIF(C3:C8,${group},D3:D8)`,
      f12: '=MEDIAN(F3:F8)',
    },
  ];
  const analysis = analyses[(examNumber - 3) % analyses.length];
  const canonical = (formula: string) => formula.toUpperCase()
    .replace(/"(?:[^"]|"")*"|[\s$]|;/g, token => token.startsWith('"') ? token : token === ';' ? ',' : '');

  return {
    id: `${prefix}-t4`,
    domainId: 'excel-formulas',
    title: analysis.title,
    titleEn: analysis.titleEn,
    instruction: analysis.description,
    instructionEn: analysis.descriptionEn,
    copyTokens: [analysis.f11, analysis.f12],
    ribbonPath: 'Công thức → Chèn hàm',
    hint: `F11: ${analysis.f11} · F12: ${analysis.f12}`,
    points: 20,
    solution: {
      steps: [
        'Hoàn thành công thức thành tiền ở F3:F8.',
        `Tại F11, nhập ${analysis.f11} rồi nhấn Enter.`,
        `Tại F12, nhập ${analysis.f12} rồi nhấn Enter.`,
      ],
      formulaOrValue: `${analysis.f11} · ${analysis.f12}`,
      verifyTip: `Kiểm tra F11 dùng nhóm “${seed.targetGroup}” và F12 tham chiếu đủ sáu dòng từ 3 đến 8.`,
    },
    applySampleSolution: sc => {
      const sheet = primarySheet(sc.workbook);
      if (!sheet) return;
      sheet.cellData[10][5] = { ...sheet.cellData[10][5], f: analysis.f11 };
      sheet.cellData[11][5] = { ...sheet.cellData[11][5], f: analysis.f12 };
    },
    check: sc => {
      const sheet = primarySheet(sc.workbook);
      const f11 = canonical(cellAt(sheet, 10, 5)?.f ?? '');
      const passed = [analysis.f11, analysis.alternateF11].some(allowed => allowed && f11 === canonical(allowed))
        && canonical(cellAt(sheet, 11, 5)?.f ?? '') === canonical(analysis.f12);
      return { passed, detail: passed ? 'Công thức ở F11 và F12 chính xác.' : analysis.description };
    },
  };
}

function makeExcelExpertTasks(prefix: string, version: MosVersion, examNumber: MosExamNumber, orderIdx: number, seed: ExcelDatasetSeed): MosExcelProject['tasks'] {
  const minQty = Math.min(...seed.rows.map((r) => r[3])) + 2;

  const t1: MosExcelProject['tasks'][number] = {
    id: `${prefix}-t1`,
    domainId: 'excel-formulas',
    title: 'Tính Thành tiền F3:F8 kèm định dạng #,##0 và tổng đa điều kiện SUMIFS (F10)',
    titleEn: 'Compute F3:F8 with #,##0 format and multi-criteria SUMIFS in F10',
    instruction: `Tính Thành tiền =D3*E3 cho F3:F8, sau đó tại F10 dùng hàm SUMIFS cộng vùng F3:F8 cho các dòng thuộc “${seed.targetGroup}” (C3:C8) và có cột D >= ${minQty} (D3:D8).`,
    instructionEn: `Calculate =D3*E3 in F3:F8, then in F10 enter =SUMIFS(F3:F8,C3:C8,"${seed.targetGroup}",D3:D8,">=${minQty}").`,
    copyTokens: ['=D3*E3', `=SUMIFS(F3:F8,C3:C8,"${seed.targetGroup}",D3:D8,">=${minQty}")`],
    ribbonPath: 'F3:F8 (=D3*E3) · F10 (=SUMIFS(...))',
    hint: `Điền =D3*E3 cho F3:F8, rồi tại F10 nhập =SUMIFS(F3:F8,C3:C8,"${seed.targetGroup}",D3:D8,">=${minQty}").`,
    points: 20,
    solution: {
      steps: [
        'Nhập =D3*E3 vào F3 và sao chép xuống hết F8.',
        `Chọn ô F10, nhập =SUMIFS(F3:F8,C3:C8,"${seed.targetGroup}",D3:D8,">=${minQty}").`,
        'Đảm bảo sum_range (F3:F8) đặt ở đối số đầu tiên của hàm SUMIFS.',
      ],
      formulaOrValue: `=SUMIFS(F3:F8,C3:C8,"${seed.targetGroup}",D3:D8,">=${minQty}")`,
      examTrap: 'Đừng nhầm thứ tự đối số của SUMIFS (sum_range đứng đầu) với SUMIF (sum_range đứng cuối).',
      verifyTip: 'F3:F8 có giá trị thành tiền và F10 hiển thị tổng lọc đồng thời theo 2 tiêu chí.',
    },
    applySampleSolution: (sc) => {
      const sh = primarySheet(sc.workbook);
      if (!sh) return;
      for (let i = 0; i < 6; i++) sh.cellData[i + 2][5] = { f: `=D${i + 3}*E${i + 3}`, s: { n: { pattern: '#,##0' } } };
      sh.cellData[9] = { ...(sh.cellData[9] ?? {}), 5: { f: `=SUMIFS(F3:F8,C3:C8,"${seed.targetGroup}",D3:D8,">=${minQty}")` } };
    },
    check: (sc) => {
      const sh = primarySheet(sc.workbook);
      const colOk = [0, 1, 2, 3, 4, 5].every((i) => cleanFormula(formulaOf(cellAt(sh, i + 2, 5))).includes(`D${i + 3}`));
      const f10 = cleanFormula(formulaOf(cellAt(sh, 9, 5)));
      const sumifsOk = f10.includes('SUMIFS(') && f10.includes('F3:F8') && f10.includes('C3:C8') && f10.includes('D3:D8');
      return colOk && sumifsOk
        ? { passed: true, detail: 'Đã hoàn thành F3:F8 và công thức đa điều kiện SUMIFS tại F10.' }
        : { passed: false, detail: 'Cần lập đủ công thức nhân tại F3:F8 và SUMIFS(F3:F8,C3:C8,...,D3:D8,...) tại F10.' };
    },
  };

  const t2: MosExcelProject['tasks'][number] = version === '2016'
    ? {
        id: `${prefix}-t2`,
        domainId: 'excel-lookup',
        title: 'Phân loại đa điều kiện bằng IF kết hợp AND (G3:G8)',
        titleEn: 'Nested IF with AND classification in G3:G8',
        instruction: `Tại G3:G8, dùng hàm IF kết hợp AND: nếu cột D >= ${minQty} VÀ Thành tiền (F3) >= ${seed.passThreshold} thì trả về “${seed.passLabel}”, ngược lại trả về “${seed.failLabel}”.`,
        instructionEn: `In G3:G8, use =IF(AND(D3>=${minQty},F3>=${seed.passThreshold}),"${seed.passLabel}","${seed.failLabel}").`,
        copyTokens: [`=IF(AND(D3>=${minQty},F3>=${seed.passThreshold}),"${seed.passLabel}","${seed.failLabel}")`],
        ribbonPath: 'Công thức → Logic → IF + AND',
        hint: `Nhập =IF(AND(D3>=${minQty},F3>=${seed.passThreshold}),"${seed.passLabel}","${seed.failLabel}") tại G3 rồi kéo xuống G8.`,
        points: 20,
        solution: {
          steps: [
            'Chọn ô G3 trên bảng chính.',
            `Nhập hàm lồng =IF(AND(D3>=${minQty},F3>=${seed.passThreshold}),"${seed.passLabel}","${seed.failLabel}").`,
            'Kéo sao chép công thức xuống tới ô G8.',
          ],
          formulaOrValue: `=IF(AND(D3>=${minQty},F3>=${seed.passThreshold}),"${seed.passLabel}","${seed.failLabel}")`,
          examTrap: 'Đóng ngoặc hàm AND(...) trước dấu phẩy chuyển sang đối số value_if_true của IF.',
          verifyTip: 'Chỉ những dòng thoả đồng thời cả hai ngưỡng mới nhận nhãn ưu tiên.',
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (!sh) return;
          for (let i = 0; i < 6; i++) {
            const r = i + 3;
            sh.cellData[i + 2][6] = { f: `=IF(AND(D${r}>=${minQty},F${r}>=${seed.passThreshold}),"${seed.passLabel}","${seed.failLabel}")` };
          }
        },
        check: (sc) => {
          const sh = primarySheet(sc.workbook);
          const ok = [0, 1, 2, 3, 4, 5].every((i) => {
            const f = cleanFormula(formulaOf(cellAt(sh, i + 2, 6)));
            return f.includes('IF(') && f.includes('AND(') && f.includes(`D${i + 3}`) && f.includes(`F${i + 3}`);
          });
          return ok
            ? { passed: true, detail: 'Đã áp dụng chuẩn xác hàm lồng IF(AND(...)) trên G3:G8.' }
            : { passed: false, detail: 'Vùng G3:G8 cần dùng hàm IF kết hợp AND kiểm tra cả cột D và cột F.' };
        },
      }
    : {
        id: `${prefix}-t2`,
        domainId: 'excel-lookup',
        title: 'Phân bậc 3 mức bằng hàm IFS (G3:G8)',
        titleEn: 'Three-tier classification using IFS in G3:G8',
        instruction: `Tại G3:G8, dùng hàm IFS phân 3 mức theo Thành tiền (F3): nếu F3 >= ${seed.passThreshold} là “${seed.passLabel}”, nếu F3 >= ${Math.round(seed.passThreshold * 0.6)} là “Trung bình”, còn lại (TRUE) là “${seed.failLabel}”.`,
        instructionEn: `In G3:G8, use =IFS(F3>=${seed.passThreshold},"${seed.passLabel}",F3>=${Math.round(seed.passThreshold * 0.6)},"Trung bình",TRUE,"${seed.failLabel}").`,
        copyTokens: [`=IFS(F3>=${seed.passThreshold},"${seed.passLabel}",F3>=${Math.round(seed.passThreshold * 0.6)},"Trung bình",TRUE,"${seed.failLabel}")`],
        ribbonPath: `Công thức → Logic → IFS (${version === '2019' ? 'MO-201' : 'MO-211'})`,
        hint: 'Sử dụng hàm IFS với cặp cuối cùng TRUE để bắt mọi trường hợp còn lại, sao chép từ G3 xuống G8.',
        points: 20,
        solution: {
          steps: [
            'Đặt con trỏ tại ô G3.',
            `Dán công thức =IFS(F3>=${seed.passThreshold},"${seed.passLabel}",F3>=${Math.round(seed.passThreshold * 0.6)},"Trung bình",TRUE,"${seed.failLabel}").`,
            'Sao chép công thức xuống dải G3:G8.',
          ],
          formulaOrValue: `=IFS(F3>=${seed.passThreshold},"${seed.passLabel}",F3>=${Math.round(seed.passThreshold * 0.6)},"Trung bình",TRUE,"${seed.failLabel}")`,
          examTrap: 'Trong IFS phải xếp ngưỡng cao trước ngưỡng thấp và kết thúc bằng điều kiện TRUE để tránh lỗi #N/A.',
          verifyTip: 'Cột G3:G8 tự động phân chia chính xác thành 3 bậc mà không cần lồng nhiều hàm IF.',
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (!sh) return;
          const mid = Math.round(seed.passThreshold * 0.6);
          for (let i = 0; i < 6; i++) {
            const r = i + 3;
            sh.cellData[i + 2][6] = { f: `=IFS(F${r}>=${seed.passThreshold},"${seed.passLabel}",F${r}>=${mid},"Trung bình",TRUE,"${seed.failLabel}")` };
          }
        },
        check: (sc) => {
          const sh = primarySheet(sc.workbook);
          const ok = [0, 1, 2, 3, 4, 5].every((i) => {
            const f = cleanFormula(formulaOf(cellAt(sh, i + 2, 6)));
            return f.includes('IFS(') && f.includes(`F${i + 3}`) && f.includes('TRUE');
          });
          return ok
            ? { passed: true, detail: 'Đã phân bậc 3 mức thành công bằng hàm IFS.' }
            : { passed: false, detail: 'Vùng G3:G8 cần sử dụng hàm IFS có nhánh mặc định TRUE.' };
        },
      };

  const endR = seed.refRows.length + 1;
  const t3: MosExcelProject['tasks'][number] = version === '365'
    ? {
        id: `${prefix}-t3`,
        domainId: 'excel-lookup',
        title: 'Tra cứu an toàn bằng XLOOKUP có giá trị dự phòng 0 (H3:H8)',
        titleEn: 'Fault-tolerant lookup with XLOOKUP fallback in H3:H8',
        instruction: `Tại H3:H8, dùng XLOOKUP tra LEFT(A3,2) trên ${seed.refSheetName}!$A$2:$A$${endR}, trả về ${seed.refSheetName}!$B$2:$B$${endR} và truyền tham số thứ 4 (if_not_found) bằng 0.`,
        instructionEn: `In H3:H8, enter =XLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${endR},${seed.refSheetName}!$B$2:$B$${endR},0).`,
        copyTokens: [`=XLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${endR},${seed.refSheetName}!$B$2:$B$${endR},0)`],
        ribbonPath: 'Công thức → Tra cứu → XLOOKUP (kèm đối số if_not_found)',
        hint: `Nhập =XLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${endR},${seed.refSheetName}!$B$2:$B$${endR},0) tại H3 rồi kéo xuống H8.`,
        points: 20,
        solution: {
          steps: [
            'Chọn ô H3 trên trang tính chính.',
            `Dán công thức =XLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${endR},${seed.refSheetName}!$B$2:$B$${endR},0).`,
            'Sao chép công thức xuống hết H8.',
          ],
          formulaOrValue: `=XLOOKUP(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${endR},${seed.refSheetName}!$B$2:$B$${endR},0)`,
          examTrap: 'Điểm ăn tiền của MO-211 là dùng trực tiếp đối số thứ 4 if_not_found của XLOOKUP thay vì phải bọc IFERROR bên ngoài.',
          verifyTip: 'Toàn bộ H3:H8 trả về mức phí chuẩn và tự động trả 0 nếu gặp mã lạ.',
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (!sh) return;
          for (let i = 0; i < 6; i++) {
            sh.cellData[i + 2][7] = { f: `=XLOOKUP(LEFT(A${i + 3},2),${seed.refSheetName}!$A$2:$A$${endR},${seed.refSheetName}!$B$2:$B$${endR},0)` };
          }
        },
        check: (sc) => {
          const sh = primarySheet(sc.workbook);
          const refU = seed.refSheetName.toUpperCase();
          const ok = [0, 1, 2, 3, 4, 5].every((i) => {
            const f = cleanFormula(formulaOf(cellAt(sh, i + 2, 7)));
            return f.includes('XLOOKUP(') && f.includes(refU) && (f.includes(',0)') || f.includes(';0)') || f.includes(',0,'));
          });
          return ok
            ? { passed: true, detail: 'Đã sử dụng XLOOKUP kèm đối số bẫy lỗi if_not_found = 0.' }
            : { passed: false, detail: 'Cần dùng XLOOKUP có đối số thứ 4 bằng 0 trên vùng H3:H8.' };
        },
      }
    : {
        id: `${prefix}-t3`,
        domainId: 'excel-lookup',
        title: 'Tra cứu hai chiều INDEX + MATCH bọc IFERROR (H3:H8)',
        titleEn: 'Fault-tolerant INDEX/MATCH wrapped in IFERROR (H3:H8)',
        instruction: `Tại H3:H8, kết hợp IFERROR với INDEX và MATCH để tra mã LEFT(A3,2) sang bảng ${seed.refSheetName}!$A$2:$B$${endR} (trả về 0 nếu không khớp).`,
        instructionEn: `In H3:H8, use =IFERROR(INDEX(${seed.refSheetName}!$B$2:$B$${endR},MATCH(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${endR},0)),0).`,
        copyTokens: [`=IFERROR(INDEX(${seed.refSheetName}!$B$2:$B$${endR},MATCH(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${endR},0)),0)`],
        ribbonPath: 'Công thức → IFERROR + INDEX + MATCH',
        hint: `Nhập =IFERROR(INDEX(${seed.refSheetName}!$B$2:$B$${endR},MATCH(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${endR},0)),0) tại H3 và kéo xuống H8.`,
        points: 20,
        solution: {
          steps: [
            'Đặt con trỏ vào ô H3.',
            `Dùng MATCH(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${endR},0) tìm vị trí dòng, lồng vào INDEX lấy cột B.`,
            'Bọc toàn bộ biểu thức trong IFERROR(...,0) rồi kéo công thức xuống H8.',
          ],
          formulaOrValue: `=IFERROR(INDEX(${seed.refSheetName}!$B$2:$B$${endR},MATCH(LEFT(A3,2),${seed.refSheetName}!$A$2:$A$${endR},0)),0)`,
          examTrap: 'Đừng quên đối số 0 cuối hàm MATCH để bắt buộc dò chính xác.',
          verifyTip: 'H3:H8 hiển thị mức phí bằng tổ hợp IFERROR + INDEX + MATCH chuẩn Expert.',
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (!sh) return;
          for (let i = 0; i < 6; i++) {
            sh.cellData[i + 2][7] = {
              f: `=IFERROR(INDEX(${seed.refSheetName}!$B$2:$B$${endR},MATCH(LEFT(A${i + 3},2),${seed.refSheetName}!$A$2:$A$${endR},0)),0)`,
            };
          }
        },
        check: (sc) => {
          const sh = primarySheet(sc.workbook);
          const refU = seed.refSheetName.toUpperCase();
          const ok = [0, 1, 2, 3, 4, 5].every((i) => {
            const f = cleanFormula(formulaOf(cellAt(sh, i + 2, 7)));
            return f.includes('IFERROR(') && f.includes('INDEX(') && f.includes('MATCH(') && f.includes(refU);
          });
          return ok
            ? { passed: true, detail: 'Đã triển khai chuẩn xác công thức IFERROR + INDEX + MATCH.' }
            : { passed: false, detail: 'Vùng H3:H8 cần kết hợp đủ IFERROR, INDEX và MATCH.' };
        },
      };

  const t4: MosExcelProject['tasks'][number] = examNumber >= (version === '365' ? 4 : 3) ? expertAnalysisTask(prefix, examNumber, seed) : {
    id: `${prefix}-t4`,
    domainId: 'excel-formulas',
    title: 'Đếm đa điều kiện COUNTIFS (F11) và tìm tên mục dẫn đầu bằng INDEX/MATCH (F12)',
    titleEn: 'COUNTIFS in F11 and top-item lookup with INDEX/MATCH/MAX in F12',
    instruction: `Tại F11 dùng COUNTIFS đếm số dòng thuộc “${seed.targetGroup}” (C3:C8) có cột D >= ${minQty}; tại F12 dùng INDEX(B3:B8,MATCH(MAX(F3:F8),F3:F8,0)) trả về tên mục có Thành tiền cao nhất.`,
    instructionEn: `In F11 use =COUNTIFS(C3:C8,"${seed.targetGroup}",D3:D8,">=${minQty}") and in F12 use =INDEX(B3:B8,MATCH(MAX(F3:F8),F3:F8,0)).`,
    copyTokens: [`=COUNTIFS(C3:C8,"${seed.targetGroup}",D3:D8,">=${minQty}")`, '=INDEX(B3:B8,MATCH(MAX(F3:F8),F3:F8,0))'],
    ribbonPath: 'Ô F11: COUNTIFS · Ô F12: INDEX + MATCH + MAX',
    hint: 'Dán công thức COUNTIFS vào F11 và công thức INDEX(...,MATCH(MAX(F3:F8),F3:F8,0)) vào F12.',
    points: 20,
    solution: {
      steps: [
        `Chọn F11, nhập =COUNTIFS(C3:C8,"${seed.targetGroup}",D3:D8,">=${minQty}").`,
        'Chọn F12, nhập =INDEX(B3:B8,MATCH(MAX(F3:F8),F3:F8,0)) để tra ngược sang cột B nằm bên trái cột F.',
        'Nhấn Enter kiểm tra kết quả trả về đúng tên mục dẫn đầu doanh số.',
      ],
      formulaOrValue: '=INDEX(B3:B8,MATCH(MAX(F3:F8),F3:F8,0))',
      examTrap: 'VLOOKUP không thể tra ngược từ cột F về cột B bên trái — đây là bài toán kinh điển bắt buộc dùng INDEX/MATCH (hoặc XLOOKUP).',
      verifyTip: 'F11 trả về số lượng dòng thoả 2 điều kiện và F12 trả về tên hạng mục cao nhất.',
    },
    applySampleSolution: (sc) => {
      const sh = primarySheet(sc.workbook);
      if (!sh) return;
      sh.cellData[10] = { ...(sh.cellData[10] ?? {}), 5: { f: `=COUNTIFS(C3:C8,"${seed.targetGroup}",D3:D8,">=${minQty}")` } };
      sh.cellData[11] = { ...(sh.cellData[11] ?? {}), 5: { f: '=INDEX(B3:B8,MATCH(MAX(F3:F8),F3:F8,0))' } };
    },
    check: (sc) => {
      const sh = primarySheet(sc.workbook);
      const f11 = cleanFormula(formulaOf(cellAt(sh, 10, 5)));
      const f12 = cleanFormula(formulaOf(cellAt(sh, 11, 5)));
      const ok11 = f11.includes('COUNTIFS(') && f11.includes('C3:C8') && f11.includes('D3:D8');
      const ok12 = (f12.includes('INDEX(') && f12.includes('MATCH(') && f12.includes('MAX(')) || (f12.includes('XLOOKUP(') && f12.includes('MAX('));
      return ok11 && ok12
        ? { passed: true, detail: 'Đã hoàn thành COUNTIFS và tra cứu ngược hạng mục dẫn đầu.' }
        : { passed: false, detail: 'Cần lập COUNTIFS tại F11 và INDEX/MATCH(MAX(...)) tại F12.' };
    },
  };

  const t5: MosExcelProject['tasks'][number] = orderIdx % 2 === 0
    ? {
        id: `${prefix}-t5`,
        domainId: 'excel-manage',
        title: `Đổi tên trang “${seed.targetSheetName}”, cố định hàng cột (B3) và in Ngang Fit-to-Page`,
        titleEn: `Rename to “${seed.targetSheetName}”, Freeze at B3 & Landscape Fit-to-Page`,
        instruction: `Đổi tên trang chính thành “${seed.targetSheetName}”, cố định đồng thời 2 dòng đầu + cột A (chọn B3 bấm Freeze Panes) và bật in Ngang vừa 1 trang.`,
        instructionEn: `Rename main sheet to “${seed.targetSheetName}”, freeze panes at B3, and set Landscape + Fit to Page.`,
        copyTokens: [seed.targetSheetName],
        ribbonPath: 'Đổi tên tab · Xem → Freeze Panes (tại B3) · Thiết lập in Ngang + Co vừa trang',
        hint: `Đổi tên tab thành “${seed.targetSheetName}”, đặt ô chọn tại B3 bấm Freeze Panes và bật Landscape + Fit to Page.`,
        points: 20,
        solution: {
          steps: [
            `Đổi tên tab đầu tiên sang “${seed.targetSheetName}”.`,
            'Đặt con trỏ ô tại B3 rồi vào thẻ Xem → Cố định vùng (Freeze Panes) để khoá cả dòng 1–2 và cột A.',
            'Mở Thiết lập in (Ctrl + P) → chọn Hướng Ngang (Landscape) và bật Co vừa trang (Fit to Page).',
          ],
          formulaOrValue: seed.targetSheetName,
          examTrap: 'Chọn A3 chỉ khoá dòng mà không khoá cột A; muốn khoá cả cột A lẫn 2 dòng đầu phải chọn đúng ô B3.',
          verifyTip: 'Cả cột mã bên trái và 2 dòng đầu đứng yên khi cuộn ngang/dọc, trang in nằm ngang gọn 1 trang.',
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (sh) {
            sh.name = seed.targetSheetName;
            sh.freeze = { xSplit: 1, ySplit: 2, startRow: 2, startColumn: 1 };
          }
          sc.printSettings = {
            paperSize: 'A4',
            margins: 'normal',
            showGridlines: true,
            ...(sc.printSettings ?? {}),
            orientation: 'landscape',
            fitToPage: true,
          };
        },
        check: (sc) => {
          const sh = findSheet(sc.workbook, seed.targetSheetName);
          const frzOk = Boolean(sh && (sh.freeze?.xSplit ?? 0) >= 1 && (sh.freeze?.ySplit ?? 0) >= 2);
          const prtOk = sc.printSettings?.orientation === 'landscape' && Boolean(sc.printSettings?.fitToPage || sc.printSettings?.scaleMode === 'fit-page');
          return frzOk && prtOk
            ? { passed: true, detail: 'Đã hoàn tất đổi tên sheet, cố định hai chiều tại B3 và chuẩn hoá trang in.' }
            : { passed: false, detail: `Cần đủ 3 ý: tên sheet “${seed.targetSheetName}”, Freeze Panes tại B3 và in Landscape + Fit to Page.` };
        },
      }
    : {
        id: `${prefix}-t5`,
        domainId: 'excel-format',
        title: `Gộp tiêu đề A1:H1, định dạng số #,##0 cho F3:F8 và thêm trang “${seed.extraSheetName}”`,
        titleEn: `Merge A1:H1, format F3:F8 as #,##0 & add sheet “${seed.extraSheetName}”`,
        instruction: `Gộp vùng tiêu đề A1:H1, áp dụng định dạng phân tách hàng nghìn (#,##0) cho dải F3:F8 và thêm trang tính tổng hợp “${seed.extraSheetName}”.`,
        instructionEn: `Merge A1:H1, format F3:F8 with thousands separators (#,##0), and insert a sheet named “${seed.extraSheetName}”.`,
        copyTokens: [seed.extraSheetName, 'A1:H1'],
        ribbonPath: 'Trang chủ → Gộp ô · Định dạng số #,##0 · Thêm Sheet mới',
        hint: `Gộp A1:H1, định dạng số có dấu phân cách nghìn cho F3:F8 và thêm trang tính tên “${seed.extraSheetName}”.`,
        points: 20,
        solution: {
          steps: [
            'Quét chọn A1:H1 trên trang chính → bấm Gộp & Căn giữa.',
            'Quét vùng F3:F8 → chọn định dạng Số có dấu phân tách hàng nghìn (#,##0).',
            `Bấm nút (+) dưới thanh tab để tạo trang mới và đặt tên “${seed.extraSheetName}”.`,
          ],
          formulaOrValue: seed.extraSheetName,
          examTrap: 'Đừng quên kiểm tra chính tả tên trang tính mới bằng nút Click-to-Copy.',
          verifyTip: `A1:H1 đã gộp, số tiền F3:F8 tách nhóm 3 chữ số và có mặt tab “${seed.extraSheetName}”.`,
        },
        applySampleSolution: (sc) => {
          const sh = primarySheet(sc.workbook);
          if (sh) {
            sh.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 7 }];
            for (let i = 0; i < 6; i++) {
              sh.cellData[i + 2][5] = { ...(sh.cellData[i + 2][5] ?? {}), s: { n: { pattern: '#,##0' } } };
            }
          }
          const added = emptySheet(seed.extraSheetName);
          sc.workbook.sheetOrder.push(added.id);
          sc.workbook.sheets[added.id] = added;
        },
        check: (sc) => {
          const sh = findSheet(sc.workbook, seed.rawSheetName) ?? primarySheet(sc.workbook);
          const merged = sh?.mergeData?.some(m => m.startRow === 0 && m.endRow === 0 && m.startColumn === 0 && m.endColumn === 7);
          const fmtOk = [2, 3, 4, 5, 6, 7].every(row => resolveStyle(sc.workbook, cellAt(sh, row, 5))?.n?.pattern === '#,##0');
          const addedSheet = sc.workbook.sheetOrder.map(id => sc.workbook.sheets[id])
            .find(sheet => sheet?.name.toUpperCase() === seed.extraSheetName.toUpperCase());
          const sheetOk = Boolean(addedSheet && addedSheet !== sh && sc.workbook.sheetOrder.length >= 3 && findSheet(sc.workbook, seed.refSheetName));
          return merged && fmtOk && sheetOk
            ? { passed: true, detail: `Đã gộp tiêu đề, định dạng số #,##0 và thêm trang “${seed.extraSheetName}”.` }
            : { passed: false, detail: `Cần gộp A1:H1, định dạng #,##0 cho F3:F8 và thêm trang “${seed.extraSheetName}”.` };
        },
      };

  return [t1, t2, t3, t4, t5];
}

export function buildGeneratedExcelBank(seeds = EXCEL_SEEDS, exams: readonly MosExamNumber[] = catalog.exams, assignments: Record<string, string> = {}): MosExcelProject[] {
  const out: MosExcelProject[] = [];
  const bySlug = new Map(seeds.map(seed => [seed.slug, seed]));
  const versions: MosVersion[] = ['2016', '2019', '365'];

  for (let vIdx = 0; vIdx < versions.length; vIdx++) {
    const version = versions[vIdx];
    for (const examNumber of exams) {
      if (version === '365' && examNumber === 1) continue;
      const examSlot = examNumber <= 5 ? vIdx * 5 + examNumber - 1 : 15 + (examNumber - 6) * 3 + vIdx;
      const assocStart = (examSlot * 3) % seeds.length;
      const expStart = (examSlot * 5 + 2) % seeds.length;

      for (let order = 1; order <= 7; order++) {
        const projId = `excel-${version}-e${examNumber}-p${order}`;
        const seed = bySlug.get(assignments[projId]) ?? seeds[(assocStart + order - 1) % seeds.length];
        const variant = examSlot * 7 + (order - 1);
        const difficulties = ['Cơ bản', 'Cơ bản', 'Trung bình', 'Trung bình', 'Trung bình', 'Nâng cao', 'Nâng cao'] as const;

        out.push({
          id: projId,
          track: 'excel',
          version,
          examNumber,
          level: 'associate',
          kind: 'sheet',
          order,
          title: seed.title,
          titleEn: seed.titleEn,
          fileName: seed.fileName,
          scenario: seed.scenario,
          scenarioEn: seed.scenarioEn,
          minutes: 7,
          difficulty: difficulties[order - 1],
          createStarter: () => buildStarterSheet(seed, projId),
          tasks: makeExcelAssocTasks(projId, version, variant, seed),
        });
      }

      for (let order = 1; order <= 5; order++) {
        const projId = `excel-exp-${version}-e${examNumber}-p${order}`;
        const seed = bySlug.get(assignments[projId]) ?? seeds[(expStart + order - 1) % seeds.length];

        const stem = seed.fileName.replace(/\.xlsx$/i, '');

        out.push({
          id: projId,
          track: 'excel',
          version,
          examNumber,
          level: 'expert',
          kind: 'sheet',
          order,
          title: `${seed.title} (Expert)`,
          titleEn: `${seed.titleEn} (Expert)`,
          fileName: `${stem}_Expert.xlsx`,
          scenario: seed.scenario,
          scenarioEn: seed.scenarioEn,
          minutes: 10,
          difficulty: 'Nâng cao',
          createStarter: () => buildStarterSheet(seed, projId),
          tasks: makeExcelExpertTasks(projId, version, examNumber, examSlot + order - 1, seed),
        });
      }
    }
  }
  return out;
}
