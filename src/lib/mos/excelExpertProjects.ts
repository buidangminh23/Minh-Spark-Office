import type { SheetContent } from '../storage';
import { emptySheet, emptyWorkbook, uid } from '../workbookBasics';
import { cellAt, findSheet, formulaOf, primarySheet, resolveStyle } from './excelHelpers';
import type { MosExcelProject } from './types';

function buildExpertKpiStarter(): SheetContent {
  const wb = emptyWorkbook('PhanTich_KPI_Expert');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'KPI_2026';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#1E293B' } },
    head: { bl: 1, bg: { rgb: '#0F172A' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    money: { n: { pattern: '#,##0' } },
    sumHead: { bl: 1, bg: { rgb: '#DCFCE7' }, cl: { rgb: '#166534' } },
  };
  sheet.cellData[0] = { 0: { v: 'PHÂN TÍCH CHỈ TIÊU KPI & THƯỞNG KINH DOANH', t: 1, s: 'title' } };
  const headers = ['Nhân viên', 'Khu vực', 'Trạng thái', 'Điểm KPI', 'Doanh số', 'Xếp hạng thưởng'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });
  const rows: [string, string, string, number, number][] = [
    ['Nguyễn Minh Khôi', 'Miền Bắc', 'Đạt', 95, 145000000],
    ['Trần Bảo Ngọc', 'Miền Nam', 'Đạt', 92, 162000000],
    ['Lê Hoàng Nam', 'Miền Bắc', 'Chưa đạt', 78, 84000000],
    ['Phạm Thu Hà', 'Miền Nam', 'Đạt', 88, 118000000],
    ['Đặng Quang Vinh', 'Miền Bắc', 'Đạt', 91, 130000000],
    ['Vũ Thanh Tâm', 'Miền Nam', 'Chưa đạt', 81, 95000000],
    ['Hoàng Gia Bảo', 'Miền Trung', 'Đạt', 94, 128000000],
    ['Bùi Thảo Vy', 'Miền Nam', 'Đạt', 96, 175000000],
  ];
  rows.forEach((row, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = { 0: { v: row[0], t: 1 }, 1: { v: row[1], t: 1 }, 2: { v: row[2], t: 1 }, 3: { v: row[3], t: 2 }, 4: { v: row[4], t: 2, s: 'money' } };
  });
  sheet.cellData[1][7] = { v: 'Báo cáo tổng hợp Expert', t: 1, s: 'sumHead' };
  sheet.cellData[2][6] = { v: 'Tổng DS Miền Bắc (Đạt)', t: 1 };
  sheet.cellData[3][6] = { v: 'Số NV Miền Nam >= 100tr', t: 1 };
  sheet.cellData[4][6] = { v: 'Nhân viên DS cao nhất', t: 1 };
  sheet.columnData = { 0: { w: 170 }, 1: { w: 110 }, 2: { w: 105 }, 3: { w: 95 }, 4: { w: 135 }, 5: { w: 145 }, 6: { w: 190 }, 7: { w: 165 } };
  wb.id = uid('mos-xle-1');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true, scaleMode: 'actual' } };
}

function buildExpertLookupStarter(): SheetContent {
  const wb = emptyWorkbook('TraCuu_DaBang_Expert');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'BanHang';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#14532D' } },
    head: { bl: 1, bg: { rgb: '#15803D' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    money: { n: { pattern: '#,##0' } },
  };
  sheet.cellData[0] = { 0: { v: 'TRA CỨU GIÁ & XỬ LÝ LỖI IFERROR (EXPERT)', t: 1, s: 'title' } };
  const headers = ['Mã SKU', 'Mã loại', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Ghi chú'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });
  const rows: [string, number][] = [
    ['VN-A1-2026', 12],
    ['VN-B2-2026', 8],
    ['VN-C3-2026', 15],
    ['VN-X9-2026', 4],
  ];
  rows.forEach((row, idx) => {
    sheet.cellData[idx + 2] = { 0: { v: row[0], t: 1 }, 2: { v: row[1], t: 2 } };
  });
  sheet.columnData = { 0: { w: 130 }, 1: { w: 95 }, 2: { w: 95 }, 3: { w: 130 }, 4: { w: 135 }, 5: { w: 140 } };
  const refSheet = emptySheet('DanhMuc');
  refSheet.cellData[0] = { 0: { v: 'Mã loại', t: 1, s: 'head' }, 1: { v: 'Đơn giá', t: 1, s: 'head' } };
  [['A1', 1200000], ['B2', 2400000], ['C3', 850000]].forEach((item, idx) => {
    refSheet.cellData[idx + 1] = { 0: { v: item[0] as string, t: 1 }, 1: { v: item[1] as number, t: 2, s: 'money' } };
  });
  wb.sheetOrder.push(refSheet.id);
  wb.sheets[refSheet.id] = refSheet;
  wb.id = uid('mos-xle-2');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
}

function buildExpertFinanceStarter(): SheetContent {
  const wb = emptyWorkbook('DuBao_TaiChinh_Expert');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'TaiChinh';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#1E3A8A' } },
    head: { bl: 1, bg: { rgb: '#1E40AF' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    money: { n: { pattern: '#,##0' } },
  };
  sheet.cellData[0] = { 0: { v: 'MÔ HÌNH LỢI NHUẬN & PHÂN HẠNG CHI NHÁNH', t: 1, s: 'title' } };
  const headers = ['Chi nhánh', 'Doanh thu', 'Chi phí', 'Lợi nhuận', 'Biên LN', 'Xếp hạng'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });
  const branches: [string, number, number][] = [
    ['Hà Nội', 850000000, 620000000],
    ['TP.HCM', 1120000000, 790000000],
    ['Đà Nẵng', 430000000, 340000000],
    ['Hải Phòng', 390000000, 295000000],
    ['Cần Thơ', 310000000, 255000000],
  ];
  branches.forEach((row, idx) => {
    sheet.cellData[idx + 2] = { 0: { v: row[0], t: 1 }, 1: { v: row[1], t: 2, s: 'money' }, 2: { v: row[2], t: 2, s: 'money' } };
  });
  sheet.cellData[8] = { 0: { v: 'TB LN chi nhánh > 100tr', t: 1 } };
  sheet.columnData = { 0: { w: 140 }, 1: { w: 135 }, 2: { w: 135 }, 3: { w: 135 }, 4: { w: 105 }, 5: { w: 105 } };
  wb.id = uid('mos-xle-3');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
}

function buildExpertHrStarter(): SheetContent {
  const wb = emptyWorkbook('NhanSu_DanhGia_Expert');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'DanhGia';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#3B0764' } },
    head: { bl: 1, bg: { rgb: '#6D28D9' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
  };
  sheet.cellData[0] = { 0: { v: 'ĐÁNH GIÁ NĂNG LỰC & PHÊ DUYỆT ĐÀO TẠO', t: 1, s: 'title' } };
  const headers = ['Mã NV', 'Phòng ban', 'Chuyên môn', 'Ngoại ngữ', 'Xét duyệt', 'Điểm làm tròn'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });
  const rows: [string, string, number, number][] = [
    ['HR01', 'Kỹ thuật', 8.64, 7.25],
    ['HR02', 'Kinh doanh', 7.12, 8.85],
    ['HR03', 'Vận hành', 6.45, 6.10],
    ['HR04', 'Kỹ thuật', 9.18, 8.42],
  ];
  rows.forEach((row, idx) => {
    sheet.cellData[idx + 2] = { 0: { v: row[0], t: 1 }, 1: { v: row[1], t: 1 }, 2: { v: row[2], t: 2 }, 3: { v: row[3], t: 2 } };
  });
  sheet.cellData[7] = { 0: { v: 'Số NV thiếu điểm', t: 1 } };
  sheet.columnData = { 0: { w: 90 }, 1: { w: 130 }, 2: { w: 115 }, 3: { w: 115 }, 4: { w: 140 }, 5: { w: 125 } };
  wb.id = uid('mos-xle-4');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
}

function buildExpertConsolidateStarter(): SheetContent {
  const wb = emptyWorkbook('TongHop_LienSheet_Expert');
  const q1 = wb.sheets[wb.sheetOrder[0]];
  q1.name = 'Quy1';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#0F172A' } },
    head: { bl: 1, bg: { rgb: '#0369A1' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    money: { n: { pattern: '#,##0' } },
  };
  q1.cellData[0] = { 0: { v: 'DOANH THU QUÝ 1', t: 1, s: 'title' } };
  q1.cellData[1] = { 0: { v: 'Sản phẩm', t: 1, s: 'head' }, 1: { v: 'Doanh thu Q1', t: 1, s: 'head' } };
  [['Gói Cơ bản', 120000000], ['Gói Doanh nghiệp', 280000000], ['Gói Giáo dục', 95000000]].forEach((r, i) => {
    q1.cellData[i + 2] = { 0: { v: r[0] as string, t: 1 }, 1: { v: r[1] as number, t: 2, s: 'money' } };
  });

  const q2 = emptySheet('Quy2');
  q2.cellData[0] = { 0: { v: 'DOANH THU QUÝ 2', t: 1, s: 'title' } };
  q2.cellData[1] = { 0: { v: 'Sản phẩm', t: 1, s: 'head' }, 1: { v: 'Doanh thu Q2', t: 1, s: 'head' } };
  [['Gói Cơ bản', 145000000], ['Gói Doanh nghiệp', 320000000], ['Gói Giáo dục', 110000000]].forEach((r, i) => {
    q2.cellData[i + 2] = { 0: { v: r[0] as string, t: 1 }, 1: { v: r[1] as number, t: 2, s: 'money' } };
  });
  wb.sheetOrder.push(q2.id);
  wb.sheets[q2.id] = q2;

  const summary = emptySheet('TongHop6Thang');
  summary.cellData[0] = { 0: { v: 'TỔNG HỢP 6 THÁNG ĐẦU NĂM', t: 1, s: 'title' } };
  summary.cellData[1] = { 0: { v: 'Sản phẩm', t: 1, s: 'head' }, 1: { v: 'Quý 1', t: 1, s: 'head' }, 2: { v: 'Quý 2', t: 1, s: 'head' }, 3: { v: 'Tổng 6 tháng', t: 1, s: 'head' }, 4: { v: 'Tăng trưởng', t: 1, s: 'head' } };
  ['Gói Cơ bản', 'Gói Doanh nghiệp', 'Gói Giáo dục'].forEach((name, i) => {
    summary.cellData[i + 2] = { 0: { v: name, t: 1 } };
  });
  summary.columnData = { 0: { w: 170 }, 1: { w: 130 }, 2: { w: 130 }, 3: { w: 140 }, 4: { w: 120 } };
  wb.sheetOrder.push(summary.id);
  wb.sheets[summary.id] = summary;
  wb.id = uid('mos-xle-5');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
}

export const MOS_EXCEL_EXPERT_PROJECTS: MosExcelProject[] = [
  {
    id: 'excel-expert-kpi',
    track: 'excel',
    level: 'expert',
    kind: 'sheet',
    order: 1,
    title: 'Phân tích KPI & Hàm nâng cao (Expert)',
    titleEn: 'KPI Analytics & Multi-Criteria Formulas (Expert)',
    fileName: 'PhanTich_KPI_Expert.xlsx',
    scenario: 'Ứng dụng hàm nhiều điều kiện SUMIFS, COUNTIFS, tra cứu động INDEX/MATCH, logic lồng IF+AND và thiết lập in vừa một trang.',
    scenarioEn: 'Apply SUMIFS, COUNTIFS, INDEX/MATCH with MAX, nested IF(AND(...)), and landscape Fit-to-Page printing.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: buildExpertKpiStarter,
    tasks: [
      {
        id: 'ee1-t1',
        domainId: 'excel-formulas',
        title: 'Tổng doanh số đa điều kiện bằng SUMIFS',
        titleEn: 'Multi-criteria sum with SUMIFS',
        instruction: 'Tại ô H3, dùng SUMIFS tính tổng Doanh số (E3:E10) của nhân viên “Miền Bắc” (B3:B10) có trạng thái “Đạt” (C3:C10).',
        instructionEn: 'In H3, use “=SUMIFS(E3:E10,B3:B10,"Miền Bắc",C3:C10,"Đạt")”.',
        copyTokens: ['=SUMIFS(E3:E10,B3:B10,"Miền Bắc",C3:C10,"Đạt")'],
        ribbonPath: 'Ô H3 → =SUMIFS(E3:E10,B3:B10,"Miền Bắc",C3:C10,"Đạt")',
        hint: 'Chọn H3, gõ =SUMIFS(E3:E10,B3:B10,"Miền Bắc",C3:C10,"Đạt") rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'KPI_2026') ?? primarySheet(content.workbook);
          const f = formulaOf(cellAt(sheet, 2, 7));
          return f.includes('SUMIFS(') && f.includes('E3:E10') && f.includes('B3:B10') && f.includes('C3:C10')
            ? { passed: true, detail: 'Ô H3 đã sử dụng hàm SUMIFS đúng 2 tiêu chí.' }
            : { passed: false, detail: 'Ô H3 chưa có công thức SUMIFS theo vùng E3:E10, B3:B10 và C3:C10.' };
        },
      },
      {
        id: 'ee1-t2',
        domainId: 'excel-formulas',
        title: 'Đếm đa điều kiện bằng COUNTIFS',
        titleEn: 'Multi-criteria count with COUNTIFS',
        instruction: 'Tại ô H4, dùng COUNTIFS đếm số nhân viên “Miền Nam” (B3:B10) có Doanh số >= 100000000 (E3:E10).',
        instructionEn: 'In H4, use “=COUNTIFS(B3:B10,"Miền Nam",E3:E10,">=100000000")”.',
        copyTokens: ['=COUNTIFS(B3:B10,"Miền Nam",E3:E10,">=100000000")'],
        ribbonPath: 'Ô H4 → =COUNTIFS(B3:B10,"Miền Nam",E3:E10,">=100000000")',
        hint: 'Chọn H4, nhập =COUNTIFS(B3:B10,"Miền Nam",E3:E10,">=100000000") rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'KPI_2026') ?? primarySheet(content.workbook);
          const f = formulaOf(cellAt(sheet, 3, 7));
          return f.includes('COUNTIFS(') && f.includes('B3:B10') && f.includes('E3:E10') && f.includes('100000000')
            ? { passed: true, detail: 'Ô H4 đã áp dụng hàm COUNTIFS chính xác.' }
            : { passed: false, detail: 'Ô H4 chưa có công thức COUNTIFS cho Miền Nam và >= 100000000.' };
        },
      },
      {
        id: 'ee1-t3',
        domainId: 'excel-lookup',
        title: 'Tra cứu nhân viên xuất sắc bằng INDEX + MATCH',
        titleEn: 'Find top performer with INDEX + MATCH',
        instruction: 'Tại ô H5, kết hợp INDEX, MATCH và MAX để tìm tên nhân viên (A3:A10) có Doanh số (E3:E10) cao nhất.',
        instructionEn: 'In H5, enter “=INDEX(A3:A10,MATCH(MAX(E3:E10),E3:E10,0))”.',
        copyTokens: ['=INDEX(A3:A10,MATCH(MAX(E3:E10),E3:E10,0))'],
        ribbonPath: 'Ô H5 → =INDEX(A3:A10,MATCH(MAX(E3:E10),E3:E10,0))',
        hint: 'Chọn H5, nhập =INDEX(A3:A10,MATCH(MAX(E3:E10),E3:E10,0)) rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'KPI_2026') ?? primarySheet(content.workbook);
          const f = formulaOf(cellAt(sheet, 4, 7));
          return f.includes('INDEX(') && f.includes('MATCH(') && f.includes('MAX(') && f.includes('A3:A10') && f.includes('E3:E10')
            ? { passed: true, detail: 'Ô H5 đã kết hợp INDEX + MATCH + MAX chính xác.' }
            : { passed: false, detail: 'Ô H5 chưa có công thức INDEX/MATCH/MAX tìm nhân viên doanh số cao nhất.' };
        },
      },
      {
        id: 'ee1-t4',
        domainId: 'excel-lookup',
        title: 'Xếp hạng thưởng bằng IF kết hợp AND',
        titleEn: 'Assign bonus tier with IF + AND',
        instruction: 'Tại F3:F10, dùng IF kết hợp AND: nếu Điểm KPI >= 90 VÀ Doanh số >= 100000000 thì “Thưởng cao”, ngược lại “Tiêu chuẩn”.',
        instructionEn: 'In F3:F10, enter “=IF(AND(D3>=90,E3>=100000000),"Thưởng cao","Tiêu chuẩn")”.',
        copyTokens: ['=IF(AND(D3>=90,E3>=100000000),"Thưởng cao","Tiêu chuẩn")'],
        ribbonPath: 'Ô F3 → =IF(AND(D3>=90,E3>=100000000),"Thưởng cao","Tiêu chuẩn")',
        hint: 'Chọn F3, nhập =IF(AND(D3>=90,E3>=100000000),"Thưởng cao","Tiêu chuẩn") rồi sao chép xuống F10.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'KPI_2026') ?? primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 8; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 5));
            if (f.includes('IF(') && f.includes('AND(') && f.includes(`D${i + 3}`) && f.includes(`E${i + 3}`)) matched++;
          }
          return matched === 8 ? { passed: true, detail: 'Cả 8 ô F3:F10 đều dùng IF(AND(...)) chính xác.' } : { passed: false, detail: `Mới đúng ${matched}/8 ô tại F3:F10.` };
        },
      },
      {
        id: 'ee1-t5',
        domainId: 'excel-format',
        title: 'Thu gọn in vừa 1 trang khổ ngang',
        titleEn: 'Landscape Fit-to-Page setup',
        instruction: 'Thiết lập hướng in Ngang (Landscape) và bật thu gọn vừa 1 trang (Fit to Page).',
        instructionEn: 'Set print orientation to Landscape and enable Fit to Page.',
        ribbonPath: 'Page Layout → Hướng trang: Ngang · Vừa 1 trang',
        hint: 'Mở thẻ Page Layout (hoặc In / PDF), chọn hướng Ngang và bật Vừa 1 trang.',
        points: 20,
        check: (content) => {
          const ps = content.printSettings;
          const ok = ps?.orientation === 'landscape' && Boolean(ps?.fitToPage || ps?.scaleMode === 'fit-page' || ps?.scaleMode === 'fit-width');
          return ok ? { passed: true, detail: 'Đã thiết lập hướng Ngang và thu gọn vừa trang in.' } : { passed: false, detail: 'Cần bật đồng thời hướng Ngang và Fit to Page.' };
        },
      },
    ],
  },
  {
    id: 'excel-expert-iferror',
    track: 'excel',
    level: 'expert',
    kind: 'sheet',
    order: 2,
    title: 'Tra cứu Đa bảng & Bẫy lỗi IFERROR (Expert)',
    titleEn: 'MID Extraction & IFERROR VLOOKUP (Expert)',
    fileName: 'TraCuu_DaBang_Expert.xlsx',
    scenario: 'Tách mã loại sản phẩm bằng MID, bọc tra cứu VLOOKUP trong IFERROR để xử lý mã không tồn tại, tính thành tiền và gắn cảnh báo kiểm tra.',
    scenarioEn: 'Extract SKU codes with MID, wrap VLOOKUP in IFERROR, compute totals, flag missing catalog codes, and format currency.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: buildExpertLookupStarter,
    tasks: [
      {
        id: 'ee2-t1',
        domainId: 'excel-lookup',
        title: 'Tách mã loại bằng hàm MID tại B3:B6',
        titleEn: 'Extract product code with MID',
        instruction: 'Tại B3:B6, dùng hàm MID trích 2 ký tự bắt đầu từ vị trí thứ 4 của Mã SKU ở cột A (“=MID(A3,4,2)”).',
        instructionEn: 'In B3:B6, enter “=MID(A3,4,2)” to extract the 2-character code starting at position 4.',
        copyTokens: ['=MID(A3,4,2)'],
        ribbonPath: 'Ô B3 → =MID(A3,4,2) rồi kéo xuống B6',
        hint: 'Chọn B3, gõ =MID(A3,4,2) rồi kéo xuống B6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 4; i++) {
            if (formulaOf(cellAt(sheet, i + 2, 1)).includes(`MID(A${i + 3},4,2)`)) matched++;
          }
          return matched === 4 ? { passed: true, detail: 'Đã tách đúng mã loại bằng hàm MID.' } : { passed: false, detail: `Mới đúng ${matched}/4 ô dùng MID tại B3:B6.` };
        },
      },
      {
        id: 'ee2-t2',
        domainId: 'excel-lookup',
        title: 'Bọc VLOOKUP trong IFERROR tại D3:D6',
        titleEn: 'Wrap VLOOKUP in IFERROR',
        instruction: 'Tại D3:D6, dùng IFERROR bọc VLOOKUP tra cứu B3 trong DanhMuc!$A$2:$B$4 (cột 2, FALSE), trả về 0 nếu lỗi.',
        instructionEn: 'In D3:D6, enter “=IFERROR(VLOOKUP(B3,DanhMuc!$A$2:$B$4,2,FALSE),0)”.',
        copyTokens: ['=IFERROR(VLOOKUP(B3,DanhMuc!$A$2:$B$4,2,FALSE),0)'],
        ribbonPath: 'Ô D3 → =IFERROR(VLOOKUP(B3,DanhMuc!$A$2:$B$4,2,FALSE),0)',
        hint: 'Chọn D3, nhập =IFERROR(VLOOKUP(B3,DanhMuc!$A$2:$B$4,2,FALSE),0) rồi kéo xuống D6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 4; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 3));
            if (f.includes('IFERROR(') && f.includes('VLOOKUP(') && f.includes('DANHMUC!')) matched++;
          }
          return matched === 4 ? { passed: true, detail: 'Cả 4 ô D3:D6 đã bọc VLOOKUP trong IFERROR.' } : { passed: false, detail: `Mới đúng ${matched}/4 ô dùng IFERROR(VLOOKUP(...)).` };
        },
      },
      {
        id: 'ee2-t3',
        domainId: 'excel-formulas',
        title: 'Tính Thành tiền tại E3:E6',
        titleEn: 'Calculate Line Totals in E3:E6',
        instruction: 'Tại E3:E6, tính Thành tiền bằng Số lượng (C) nhân Đơn giá (D), ví dụ “=C3*D3”.',
        instructionEn: 'In E3:E6, enter “=C3*D3” to calculate line totals.',
        copyTokens: ['=C3*D3'],
        ribbonPath: 'Ô E3 → =C3*D3 rồi kéo xuống E6',
        hint: 'Chọn E3, nhập =C3*D3 rồi kéo xuống E6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 4; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 4));
            if (f.includes(`C${i + 3}*D${i + 3}`) || f.includes(`D${i + 3}*C${i + 3}`)) matched++;
          }
          return matched === 4 ? { passed: true, detail: 'Đã tính thành tiền E3:E6.' } : { passed: false, detail: `Mới đúng ${matched}/4 ô tại E3:E6.` };
        },
      },
      {
        id: 'ee2-t4',
        domainId: 'excel-lookup',
        title: 'Ghi chú kiểm tra mã thiếu tại F3:F6',
        titleEn: 'Flag missing catalog price with IF',
        instruction: 'Tại F3:F6, dùng IF: nếu Đơn giá (D) = 0 thì hiện “Thiếu giá”, ngược lại “Hợp lệ”.',
        instructionEn: 'In F3:F6, enter “=IF(D3=0,"Thiếu giá","Hợp lệ")”.',
        copyTokens: ['=IF(D3=0,"Thiếu giá","Hợp lệ")'],
        ribbonPath: 'Ô F3 → =IF(D3=0,"Thiếu giá","Hợp lệ")',
        hint: 'Chọn F3, gõ =IF(D3=0,"Thiếu giá","Hợp lệ") rồi kéo xuống F6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 4; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 5));
            if (f.includes('IF(') && f.includes(`D${i + 3}`) && f.includes('0')) matched++;
          }
          return matched === 4 ? { passed: true, detail: 'Đã gắn hàm IF kiểm tra mã thiếu giá.' } : { passed: false, detail: `Mới đúng ${matched}/4 ô tại F3:F6.` };
        },
      },
      {
        id: 'ee2-t5',
        domainId: 'excel-format',
        title: 'Định dạng số hàng nghìn cho D3:E6',
        titleEn: 'Format D3:E6 with thousands separators',
        instruction: 'Áp dụng định dạng số phân tách hàng nghìn (#,##0) cho vùng D3:E6.',
        instructionEn: 'Apply #,##0 number formatting to cells D3:E6.',
        ribbonPath: 'Home → Định dạng số (#,##0)',
        hint: 'Bôi chọn D3:E6 rồi bấm định dạng số dấu phẩy trên thẻ Home.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let ok = 0;
          for (let r = 2; r < 6; r++) {
            for (const c of [3, 4]) {
              const p = resolveStyle(content.workbook, cellAt(sheet, r, c))?.n?.pattern ?? '';
              if (p.includes('#') || p.includes(',0') || p.includes('₫')) ok++;
            }
          }
          return ok >= 8 ? { passed: true, detail: 'Đã định dạng số tiền toàn vùng D3:E6.' } : { passed: false, detail: `Mới định dạng số ${ok}/8 ô ở D3:E6.` };
        },
      },
    ],
  },
  {
    id: 'excel-expert-profit-rank',
    track: 'excel',
    level: 'expert',
    kind: 'sheet',
    order: 3,
    title: 'Mô hình Lợi nhuận & Xếp hạng RANK (Expert)',
    titleEn: 'Branch Profit Margin & RANK Model (Expert)',
    fileName: 'DuBao_TaiChinh_Expert.xlsx',
    scenario: 'Tính lợi nhuận, biên lợi nhuận phần trăm, xếp hạng chi nhánh bằng hàm RANK, tính trung bình có điều kiện AVERAGEIF và gộp tiêu đề.',
    scenarioEn: 'Compute profit, profit margin %, branch ranking using RANK, conditional average with AVERAGEIF, and merge headers.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: buildExpertFinanceStarter,
    tasks: [
      {
        id: 'ee3-t1',
        domainId: 'excel-formulas',
        title: 'Tính Lợi nhuận tại D3:D7',
        titleEn: 'Calculate Profit in D3:D7',
        instruction: 'Tại D3:D7, tính Lợi nhuận bằng Doanh thu (B) trừ Chi phí (C), ví dụ “=B3-C3”.',
        instructionEn: 'In D3:D7, calculate Profit using “=B3-C3”.',
        copyTokens: ['=B3-C3'],
        ribbonPath: 'Ô D3 → =B3-C3 rồi kéo xuống D7',
        hint: 'Chọn D3, nhập =B3-C3 rồi kéo xuống D7.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let m = 0;
          for (let i = 0; i < 5; i++) if (formulaOf(cellAt(sheet, i + 2, 3)).includes(`B${i + 3}-C${i + 3}`)) m++;
          return m === 5 ? { passed: true, detail: 'Đã tính Lợi nhuận cho 5 chi nhánh.' } : { passed: false, detail: `Mới đúng ${m}/5 ô tại D3:D7.` };
        },
      },
      {
        id: 'ee3-t2',
        domainId: 'excel-formulas',
        title: 'Tính Biên lợi nhuận tại E3:E7',
        titleEn: 'Calculate Profit Margin in E3:E7',
        instruction: 'Tại E3:E7, tính Biên lợi nhuận bằng Lợi nhuận (D) chia Doanh thu (B), ví dụ “=D3/B3”.',
        instructionEn: 'In E3:E7, calculate Margin using “=D3/B3”.',
        copyTokens: ['=D3/B3'],
        ribbonPath: 'Ô E3 → =D3/B3 rồi kéo xuống E7',
        hint: 'Chọn E3, nhập =D3/B3 rồi sao chép xuống E7.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let m = 0;
          for (let i = 0; i < 5; i++) if (formulaOf(cellAt(sheet, i + 2, 4)).includes(`D${i + 3}/B${i + 3}`)) m++;
          return m === 5 ? { passed: true, detail: 'Đã tính Biên lợi nhuận cho 5 chi nhánh.' } : { passed: false, detail: `Mới đúng ${m}/5 ô tại E3:E7.` };
        },
      },
      {
        id: 'ee3-t3',
        domainId: 'excel-lookup',
        title: 'Xếp hạng chi nhánh bằng hàm RANK',
        titleEn: 'Rank branches with RANK',
        instruction: 'Tại F3:F7, dùng hàm RANK (hoặc RANK.EQ) xếp hạng Lợi nhuận (D) trong vùng $D$3:$D$7 (“=RANK(D3,$D$3:$D$7)”).',
        instructionEn: 'In F3:F7, use “=RANK(D3,$D$3:$D$7)” to rank branch profit.',
        copyTokens: ['=RANK(D3,$D$3:$D$7)'],
        ribbonPath: 'Ô F3 → =RANK(D3,$D$3:$D$7)',
        hint: 'Chọn F3, nhập =RANK(D3,$D$3:$D$7) rồi kéo xuống F7.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let m = 0;
          for (let i = 0; i < 5; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 5));
            if (f.includes('RANK') && f.includes(`D${i + 3}`) && f.includes('D') && f.includes('7')) m++;
          }
          return m === 5 ? { passed: true, detail: 'Cả 5 chi nhánh đã xếp hạng bằng hàm RANK.' } : { passed: false, detail: `Mới đúng ${m}/5 ô dùng hàm RANK.` };
        },
      },
      {
        id: 'ee3-t4',
        domainId: 'excel-formulas',
        title: 'Trung bình có điều kiện bằng AVERAGEIF',
        titleEn: 'Conditional average with AVERAGEIF',
        instruction: 'Tại B9, dùng hàm AVERAGEIF tính lợi nhuận trung bình của các chi nhánh có Lợi nhuận > 100000000 (“=AVERAGEIF(D3:D7,">100000000")”).',
        instructionEn: 'In B9, enter “=AVERAGEIF(D3:D7,">100000000")”.',
        copyTokens: ['=AVERAGEIF(D3:D7,">100000000")'],
        ribbonPath: 'Ô B9 → =AVERAGEIF(D3:D7,">100000000")',
        hint: 'Chọn B9, nhập =AVERAGEIF(D3:D7,">100000000") rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const f = formulaOf(cellAt(primarySheet(content.workbook), 8, 1));
          return f.includes('AVERAGEIF(') && f.includes('D3:D7') && f.includes('100000000')
            ? { passed: true, detail: 'Ô B9 đã dùng hàm AVERAGEIF chính xác.' }
            : { passed: false, detail: 'Ô B9 chưa có công thức AVERAGEIF(D3:D7,">100000000").' };
        },
      },
      {
        id: 'ee3-t5',
        domainId: 'excel-format',
        title: 'Định dạng % cho E3:E7 và gộp A1:F1',
        titleEn: 'Apply % format to E3:E7 and merge A1:F1',
        instruction: 'Áp dụng định dạng Phần trăm (%) cho vùng E3:E7 và gộp tiêu đề A1:F1.',
        instructionEn: 'Format E3:E7 as Percentage and merge A1:F1.',
        ribbonPath: 'Home → % (E3:E7) · Home → Gộp ô (A1:F1)',
        hint: 'Bôi chọn E3:E7 bấm %; bôi chọn A1:F1 bấm Gộp ô.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let pct = 0;
          for (let i = 0; i < 5; i++) if ((resolveStyle(content.workbook, cellAt(sheet, i + 2, 4))?.n?.pattern ?? '').includes('%')) pct++;
          const merged = (sheet?.mergeData ?? []).some((m) => m.startRow === 0 && m.endRow === 0 && m.startColumn === 0 && m.endColumn === 5);
          return pct === 5 && merged ? { passed: true, detail: 'Đã định dạng % cho E3:E7 và gộp A1:F1.' } : { passed: false, detail: 'Chưa hoàn tất cả định dạng % (E3:E7) và gộp A1:F1.' };
        },
      },
    ],
  },
  {
    id: 'excel-expert-hr-logic',
    track: 'excel',
    level: 'expert',
    kind: 'sheet',
    order: 4,
    title: 'Đánh giá Năng lực IF+OR & Làm tròn ROUND (Expert)',
    titleEn: 'HR Evaluation IF+OR & ROUND (Expert)',
    fileName: 'NhanSu_DanhGia_Expert.xlsx',
    scenario: 'Xét duyệt đào tạo bằng hàm logic IF kết hợp OR, làm tròn điểm trung bình bằng ROUND, đếm ô trống bằng COUNTBLANK và tạo trang tính phụ lục.',
    scenarioEn: 'Approve training via IF(OR(...)), compute rounded averages with ROUND, check blanks with COUNTBLANK, freeze headers, and add a new sheet.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: buildExpertHrStarter,
    tasks: [
      {
        id: 'ee4-t1',
        domainId: 'excel-lookup',
        title: 'Xét duyệt bằng hàm IF kết hợp OR tại E3:E6',
        titleEn: 'Evaluate approval with IF + OR',
        instruction: 'Tại E3:E6, dùng IF kết hợp OR: nếu Chuyên môn >= 8.5 HOẶC Ngoại ngữ >= 8.5 thì “Ưu tiên”, ngược lại “Tiêu chuẩn”.',
        instructionEn: 'In E3:E6, enter “=IF(OR(C3>=8.5,D3>=8.5),"Ưu tiên","Tiêu chuẩn")”.',
        copyTokens: ['=IF(OR(C3>=8.5,D3>=8.5),"Ưu tiên","Tiêu chuẩn")'],
        ribbonPath: 'Ô E3 → =IF(OR(C3>=8.5,D3>=8.5),"Ưu tiên","Tiêu chuẩn")',
        hint: 'Chọn E3, nhập =IF(OR(C3>=8.5,D3>=8.5),"Ưu tiên","Tiêu chuẩn") rồi kéo xuống E6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let m = 0;
          for (let i = 0; i < 4; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 4));
            if (f.includes('IF(') && f.includes('OR(') && f.includes(`C${i + 3}`) && f.includes(`D${i + 3}`)) m++;
          }
          return m === 4 ? { passed: true, detail: 'Cả 4 ô E3:E6 đã dùng hàm IF(OR(...)).' } : { passed: false, detail: `Mới đúng ${m}/4 ô tại E3:E6.` };
        },
      },
      {
        id: 'ee4-t2',
        domainId: 'excel-formulas',
        title: 'Làm tròn điểm TB bằng ROUND tại F3:F6',
        titleEn: 'Round average score to 1 decimal using ROUND',
        instruction: 'Tại F3:F6, tính điểm trung bình của C và D làm tròn 1 chữ số thập phân (“=ROUND(AVERAGE(C3:D3),1)”).',
        instructionEn: 'In F3:F6, enter “=ROUND(AVERAGE(C3:D3),1)”.',
        copyTokens: ['=ROUND(AVERAGE(C3:D3),1)'],
        ribbonPath: 'Ô F3 → =ROUND(AVERAGE(C3:D3),1)',
        hint: 'Chọn F3, nhập =ROUND(AVERAGE(C3:D3),1) rồi kéo xuống F6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let m = 0;
          for (let i = 0; i < 4; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 5));
            if (f.includes('ROUND(') && f.includes(`C${i + 3}`) && f.includes(`D${i + 3}`)) m++;
          }
          return m === 4 ? { passed: true, detail: 'Cả 4 ô F3:F6 đã dùng ROUND làm tròn điểm TB.' } : { passed: false, detail: `Mới đúng ${m}/4 ô tại F3:F6.` };
        },
      },
      {
        id: 'ee4-t3',
        domainId: 'excel-formulas',
        title: 'Kiểm tra ô thiếu điểm bằng COUNTBLANK',
        titleEn: 'Count missing scores with COUNTBLANK',
        instruction: 'Tại B8, dùng hàm COUNTBLANK kiểm tra số ô trống trong vùng C3:D6 (“=COUNTBLANK(C3:D6)”).',
        instructionEn: 'In B8, enter “=COUNTBLANK(C3:D6)”.',
        copyTokens: ['=COUNTBLANK(C3:D6)'],
        ribbonPath: 'Ô B8 → =COUNTBLANK(C3:D6)',
        hint: 'Chọn B8, nhập =COUNTBLANK(C3:D6) rồi Enter.',
        points: 20,
        check: (content) => {
          const f = formulaOf(cellAt(primarySheet(content.workbook), 7, 1));
          return f.includes('COUNTBLANK(') && f.includes('C3:D6')
            ? { passed: true, detail: 'Ô B8 đã dùng COUNTBLANK(C3:D6).' }
            : { passed: false, detail: 'Ô B8 chưa có công thức =COUNTBLANK(C3:D6).' };
        },
      },
      {
        id: 'ee4-t4',
        domainId: 'excel-manage',
        title: 'Thêm trang tính mới tên GhiChuHR',
        titleEn: 'Add worksheet named GhiChuHR',
        instruction: 'Thêm một trang tính mới trong sổ tính và đặt tên là “GhiChuHR”.',
        instructionEn: 'Add a new worksheet named “GhiChuHR”.',
        copyTokens: ['GhiChuHR'],
        ribbonPath: 'Nút + ở thanh trang tính → đổi tên thành GhiChuHR',
        hint: 'Bấm dấu + thêm trang tính mới và đổi tên thành GhiChuHR.',
        points: 20,
        check: (content) =>
          findSheet(content.workbook, 'GhiChuHR')
            ? { passed: true, detail: 'Đã thêm trang tính GhiChuHR.' }
            : { passed: false, detail: 'Chưa thấy trang tính tên GhiChuHR.' },
      },
      {
        id: 'ee4-t5',
        domainId: 'excel-manage',
        title: 'Cố định đồng thời dòng 2 và cột A',
        titleEn: 'Freeze both top 2 rows and column A',
        instruction: 'Cố định khung (Freeze Panes) giữ cố định ít nhất 2 dòng đầu và 1 cột đầu (đặt con trỏ tại B3 rồi bấm Cố định tại ô đang chọn).',
        instructionEn: 'Freeze panes at B3 so both rows 1–2 and column A stay frozen.',
        ribbonPath: 'Chọn B3 → View → Cố định khung → Cố định tại ô đang chọn',
        hint: 'Chọn ô B3, mở thẻ View → Cố định khung → chọn Cố định tại ô đang chọn.',
        points: 20,
        check: (content) => {
          const frz = primarySheet(content.workbook)?.freeze;
          return (frz?.ySplit ?? 0) >= 2 && (frz?.xSplit ?? 0) >= 1
            ? { passed: true, detail: 'Đã cố định đồng thời dòng tiêu đề và cột Mã NV.' }
            : { passed: false, detail: 'Cần cố định ít nhất 2 dòng đầu và 1 cột đầu (tại B3).' };
        },
      },
    ],
  },
  {
    id: 'excel-expert-cross-sheet',
    track: 'excel',
    level: 'expert',
    kind: 'sheet',
    order: 5,
    title: 'Tổng hợp Công thức Liên trang 3D (Expert)',
    titleEn: 'Cross-Sheet 6-Month Consolidation (Expert)',
    fileName: 'TongHop_LienSheet_Expert.xlsx',
    scenario: 'Liên kết số liệu từ trang Quy1 và Quy2 sang trang TongHop6Thang bằng công thức tham chiếu liên trang, tính tổng 6 tháng và tỷ lệ tăng trưởng.',
    scenarioEn: 'Link Q1 and Q2 revenue sheets into TongHop6Thang via cross-sheet references, compute 6-month totals, growth rates, and landscape setup.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: buildExpertConsolidateStarter,
    tasks: [
      {
        id: 'ee5-t1',
        domainId: 'excel-lookup',
        title: 'Liên kết doanh thu Quý 1 sang B3:B5',
        titleEn: 'Link Quy1 values into B3:B5',
        instruction: 'Trên trang TongHop6Thang, tại B3:B5 nhập công thức liên kết sang cột B của trang Quy1 (ví dụ “=Quy1!B3”).',
        instructionEn: 'On TongHop6Thang, link B3:B5 to Quy1 using “=Quy1!B3”.',
        copyTokens: ['=Quy1!B3'],
        ribbonPath: 'Trang TongHop6Thang → Ô B3 → =Quy1!B3',
        hint: 'Chọn trang TongHop6Thang, tại B3 nhập =Quy1!B3 rồi kéo xuống B5.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TongHop6Thang');
          let m = 0;
          for (let i = 0; i < 3; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 1));
            if (f.includes('QUY1!') && f.includes(`B${i + 3}`)) m++;
          }
          return m === 3 ? { passed: true, detail: 'Đã liên kết đủ 3 dòng Quý 1.' } : { passed: false, detail: `Mới đúng ${m}/3 ô liên kết Quy1!` };
        },
      },
      {
        id: 'ee5-t2',
        domainId: 'excel-lookup',
        title: 'Liên kết doanh thu Quý 2 sang C3:C5',
        titleEn: 'Link Quy2 values into C3:C5',
        instruction: 'Trên trang TongHop6Thang, tại C3:C5 nhập công thức liên kết sang cột B của trang Quy2 (ví dụ “=Quy2!B3”).',
        instructionEn: 'On TongHop6Thang, link C3:C5 to Quy2 using “=Quy2!B3”.',
        copyTokens: ['=Quy2!B3'],
        ribbonPath: 'Trang TongHop6Thang → Ô C3 → =Quy2!B3',
        hint: 'Tại C3 trang TongHop6Thang, nhập =Quy2!B3 rồi kéo xuống C5.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TongHop6Thang');
          let m = 0;
          for (let i = 0; i < 3; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 2));
            if (f.includes('QUY2!') && f.includes(`B${i + 3}`)) m++;
          }
          return m === 3 ? { passed: true, detail: 'Đã liên kết đủ 3 dòng Quý 2.' } : { passed: false, detail: `Mới đúng ${m}/3 ô liên kết Quy2!` };
        },
      },
      {
        id: 'ee5-t3',
        domainId: 'excel-formulas',
        title: 'Tính Tổng 6 tháng tại D3:D5',
        titleEn: 'Calculate 6-month Total in D3:D5',
        instruction: 'Tại D3:D5 trên TongHop6Thang, cộng Quý 1 (B) và Quý 2 (C) bằng “=SUM(B3:C3)” hoặc “=B3+C3”.',
        instructionEn: 'In D3:D5, enter “=SUM(B3:C3)” or “=B3+C3”.',
        copyTokens: ['=SUM(B3:C3)'],
        ribbonPath: 'Ô D3 → =SUM(B3:C3) rồi kéo xuống D5',
        hint: 'Tại D3, nhập =SUM(B3:C3) rồi kéo xuống D5.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TongHop6Thang');
          let m = 0;
          for (let i = 0; i < 3; i++) {
            const r = i + 3;
            const f = formulaOf(cellAt(sheet, i + 2, 3));
            if (f.includes(`SUM(B${r}:C${r})`) || f.includes(`B${r}+C${r}`) || f.includes(`C${r}+B${r}`)) m++;
          }
          return m === 3 ? { passed: true, detail: 'Đã tính Tổng 6 tháng tại D3:D5.' } : { passed: false, detail: `Mới đúng ${m}/3 ô tại D3:D5.` };
        },
      },
      {
        id: 'ee5-t4',
        domainId: 'excel-formulas',
        title: 'Tính Tăng trưởng Q2 so với Q1 tại E3:E5',
        titleEn: 'Calculate Q2 vs Q1 Growth in E3:E5',
        instruction: 'Tại E3:E5, tính tỷ lệ tăng trưởng bằng công thức “=(C3-B3)/B3”.',
        instructionEn: 'In E3:E5, enter “=(C3-B3)/B3” to compute quarter-over-quarter growth.',
        copyTokens: ['=(C3-B3)/B3'],
        ribbonPath: 'Ô E3 → =(C3-B3)/B3 rồi kéo xuống E5',
        hint: 'Chọn E3, nhập =(C3-B3)/B3 rồi sao chép xuống E5.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TongHop6Thang');
          let m = 0;
          for (let i = 0; i < 3; i++) {
            const r = i + 3;
            const f = formulaOf(cellAt(sheet, i + 2, 4));
            if (f.includes(`C${r}`) && f.includes(`B${r}`) && f.includes('/')) m++;
          }
          return m === 3 ? { passed: true, detail: 'Đã tính đúng tỷ lệ tăng trưởng tại E3:E5.' } : { passed: false, detail: `Mới đúng ${m}/3 ô tăng trưởng tại E3:E5.` };
        },
      },
      {
        id: 'ee5-t5',
        domainId: 'excel-format',
        title: 'Gộp tiêu đề A1:E1 và hướng in Ngang',
        titleEn: 'Merge A1:E1 and set Landscape print',
        instruction: 'Trên trang TongHop6Thang, gộp tiêu đề A1:E1 và thiết lập hướng trang in là Ngang (Landscape).',
        instructionEn: 'Merge A1:E1 on TongHop6Thang and set print orientation to Landscape.',
        ribbonPath: 'Home → Gộp ô (A1:E1) · Page Layout → Hướng trang → Ngang',
        hint: 'Bôi chọn A1:E1 bấm Gộp ô; vào Page Layout đổi Hướng trang sang Ngang.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TongHop6Thang');
          const merged = (sheet?.mergeData ?? []).some((m) => m.startRow === 0 && m.endRow === 0 && m.startColumn === 0 && m.endColumn === 4);
          return merged && content.printSettings?.orientation === 'landscape'
            ? { passed: true, detail: 'Đã gộp A1:E1 và chuyển hướng in Ngang.' }
            : { passed: false, detail: !merged ? 'Vùng A1:E1 trên TongHop6Thang chưa được gộp.' : 'Chưa đổi hướng in sang Ngang.' };
        },
      },
    ],
  },
];
