import type { CellStyle, CellValue, SheetData, WorkbookData } from '../sheetTypes';
import type { SheetContent } from '../storage';
import { emptySheet, emptyWorkbook, uid } from '../workbookBasics';
import type { MosExcelProject } from './types';

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function findSheet(workbook: WorkbookData, targetName: string): SheetData | undefined {
  const needle = fold(targetName);
  return Object.values(workbook.sheets).find((sheet) => fold(sheet.name) === needle);
}

function primarySheet(workbook: WorkbookData): SheetData | undefined {
  const firstId = workbook.sheetOrder[0];
  return (firstId ? workbook.sheets[firstId] : undefined) ?? Object.values(workbook.sheets)[0];
}

function cellAt(sheet: SheetData | undefined, row: number, col: number): CellValue | undefined {
  return sheet?.cellData?.[row]?.[col];
}

function formulaOf(cell: CellValue | undefined): string {
  return (cell?.f ?? '').replace(/\s+/g, '').toUpperCase();
}

function numericOf(cell: CellValue | undefined): number | null {
  if (typeof cell?.v === 'number' && Number.isFinite(cell.v)) return cell.v;
  if (typeof cell?.v === 'string' && cell.v.trim() !== '' && Number.isFinite(Number(cell.v))) return Number(cell.v);
  return null;
}

function resolveStyle(workbook: WorkbookData, cell: CellValue | undefined): CellStyle | undefined {
  if (!cell?.s) return undefined;
  if (typeof cell.s === 'string') return workbook.styles?.[cell.s];
  return cell.s;
}

function isNear(value: number | null, expected: number, tolerance = 0.05): boolean {
  return value !== null && Math.abs(value - expected) <= tolerance;
}

function buildSalesStarter(): SheetContent {
  const wb = emptyWorkbook('DoanhThu_BanLe_Q3');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'Sheet1';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#0F172A' }, ht: 1, vt: 2 },
    head: { bl: 1, bg: { rgb: '#166534' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    num: { n: { pattern: '#,##0' } },
    bold: { bl: 1, bg: { rgb: '#ECFDF5' } },
  };
  sheet.cellData[0] = { 0: { v: 'BÁO CÁO DOANH THU BÁN LẺ QUÝ III/2026', t: 1, s: 'title' } };
  const headers = ['Mã SP', 'Sản phẩm', 'Khu vực', 'Số lượng', 'Đơn giá', 'Thành tiền'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });

  const items: [string, string, string, number, number][] = [
    ['SP01', 'Bàn phím cơ K8', 'Hà Nội', 18, 1250000],
    ['SP02', 'Chuột không dây M3', 'TP.HCM', 32, 480000],
    ['SP03', 'Màn hình 27 inch 4K', 'Đà Nẵng', 9, 6400000],
    ['SP04', 'Tai nghe chống ồn H5', 'Hà Nội', 14, 1850000],
    ['SP05', 'Hub chuyển đổi USB-C', 'TP.HCM', 25, 620000],
    ['SP06', 'Đèn bàn bảo vệ mắt', 'Cần Thơ', 20, 390000],
  ];
  items.forEach((row, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = {
      0: { v: row[0], t: 1 },
      1: { v: row[1], t: 1 },
      2: { v: row[2], t: 1 },
      3: { v: row[3], t: 2, s: 'num' },
      4: { v: row[4], t: 2, s: 'num' },
    };
  });
  sheet.cellData[8] = { 0: { v: 'Tổng cộng', t: 1, s: 'bold' } };
  sheet.cellData[10] = { 0: { v: 'Doanh thu trung bình', t: 1 } };
  sheet.cellData[11] = { 0: { v: 'Đơn hàng cao nhất', t: 1 } };
  sheet.columnData = { 0: { w: 110 }, 1: { w: 220 }, 2: { w: 120 }, 3: { w: 110 }, 4: { w: 130 }, 5: { w: 150 } };
  sheet.rowData = { 0: { h: 34 }, 1: { h: 28 } };
  sheet.mergeData = [];
  sheet.freeze = { xSplit: 0, ySplit: 0, startRow: 0, startColumn: 0 };
  wb.id = uid('mos-xl-1');
  return {
    kind: 'sheet',
    workbook: wb,
    printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true },
  };
}

function buildScoresStarter(): SheetContent {
  const wb = emptyWorkbook('BangDiem_HocVien');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'HocVien';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#1E3A8A' } },
    head: { bl: 1, bg: { rgb: '#1D4ED8' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    sumHead: { bl: 1, bg: { rgb: '#E0F2FE' }, cl: { rgb: '#0C4A6E' } },
  };
  sheet.cellData[0] = { 0: { v: 'BẢNG ĐIỂM THI THỬ MOS HỌC VIÊN', t: 1, s: 'title' } };
  const headers = ['Mã HV', 'Họ và tên', 'Lớp', 'Lý thuyết', 'Thực hành', 'Điểm TB', 'Kết quả'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });

  const students: [string, string, string, number, number][] = [
    ['HV01', 'Nguyễn Minh Anh', 'MOS-A', 820, 880],
    ['HV02', 'Trần Quốc Bảo', 'MOS-B', 640, 680],
    ['HV03', 'Lê Thuỳ Dung', 'MOS-A', 900, 940],
    ['HV04', 'Phạm Gia Huy', 'MOS-A', 720, 760],
    ['HV05', 'Võ Ngọc Linh', 'MOS-B', 610, 650],
    ['HV06', 'Đỗ Khánh Nam', 'MOS-B', 780, 820],
  ];
  students.forEach((row, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = {
      0: { v: row[0], t: 1 },
      1: { v: row[1], t: 1 },
      2: { v: row[2], t: 1 },
      3: { v: row[3], t: 2 },
      4: { v: row[4], t: 2 },
    };
  });
  sheet.cellData[1][8] = { v: 'Thống kê nhanh', t: 1, s: 'sumHead' };
  sheet.cellData[2][7] = { v: 'Số HV đạt (>=700)', t: 1 };
  sheet.cellData[3][7] = { v: 'Tổng điểm TB lớp MOS-A', t: 1 };
  sheet.columnData = { 0: { w: 90 }, 1: { w: 190 }, 2: { w: 95 }, 3: { w: 100 }, 4: { w: 105 }, 5: { w: 100 }, 6: { w: 115 }, 7: { w: 185 }, 8: { w: 125 } };
  sheet.rowData = { 0: { h: 32 }, 1: { h: 28 } };
  wb.id = uid('mos-xl-2');
  return {
    kind: 'sheet',
    workbook: wb,
    printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true },
  };
}

function buildInventoryStarter(): SheetContent {
  const wb = emptyWorkbook('KhoHang_TonKho');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'TonKho';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#14532D' } },
    head: { bl: 1, bg: { rgb: '#0F766E' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    money: { n: { pattern: '#,##0' } },
  };
  sheet.cellData[0] = { 0: { v: 'QUẢN LÝ TỒN KHO & PHỤ PHÍ VẬN CHUYỂN', t: 1, s: 'title' } };
  const headers = ['Mã hàng', 'Mã vùng', 'Tên sản phẩm', 'Tồn đầu', 'Xuất kho', 'Tồn cuối', 'Cảnh báo', 'Phụ phí'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });

  const stock: [string, string, number, number][] = [
    ['HN-LAP-01', 'Laptop văn phòng 14"', 45, 30],
    ['SG-MON-02', 'Màn hình IPS 24"', 60, 22],
    ['DN-KEY-03', 'Bàn phím không dây', 30, 18],
    ['HN-MOU-04', 'Chuột công thái học', 50, 12],
    ['SG-CAM-05', 'Webcam hội nghị HD', 24, 15],
  ];
  stock.forEach((row, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = {
      0: { v: row[0], t: 1 },
      2: { v: row[1], t: 1 },
      3: { v: row[2], t: 2 },
      4: { v: row[3], t: 2 },
    };
  });
  sheet.columnData = { 0: { w: 120 }, 1: { w: 95 }, 2: { w: 200 }, 3: { w: 95 }, 4: { w: 95 }, 5: { w: 95 }, 6: { w: 120 }, 7: { w: 125 } };

  const rateSheet = emptySheet('BangGia');
  rateSheet.cellData[0] = { 0: { v: 'Mã vùng', t: 1, s: 'head' }, 1: { v: 'Phụ phí (VNĐ)', t: 1, s: 'head' } };
  const rates: [string, number][] = [
    ['HN', 35000],
    ['SG', 45000],
    ['DN', 40000],
    ['CT', 55000],
  ];
  rates.forEach((item, idx) => {
    rateSheet.cellData[idx + 1] = { 0: { v: item[0], t: 1 }, 1: { v: item[1], t: 2, s: 'money' } };
  });
  rateSheet.columnData = { 0: { w: 120 }, 1: { w: 150 } };
  wb.sheetOrder.push(rateSheet.id);
  wb.sheets[rateSheet.id] = rateSheet;
  wb.id = uid('mos-xl-3');
  return {
    kind: 'sheet',
    workbook: wb,
    printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true },
  };
}

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
    sheet.cellData[r] = {
      0: { v: row[0], t: 1 },
      1: { v: row[1], t: 1 },
      2: { v: row[2], t: 1 },
      3: { v: row[3], t: 2 },
      4: { v: row[4], t: 2, s: 'money' },
    };
  });
  sheet.cellData[1][7] = { v: 'Báo cáo tổng hợp Expert', t: 1, s: 'sumHead' };
  sheet.cellData[2][6] = { v: 'Tổng DS Miền Bắc (Đạt)', t: 1 };
  sheet.cellData[3][6] = { v: 'Số NV Miền Nam >= 100tr', t: 1 };
  sheet.cellData[4][6] = { v: 'Nhân viên DS cao nhất', t: 1 };
  sheet.columnData = { 0: { w: 170 }, 1: { w: 110 }, 2: { w: 105 }, 3: { w: 95 }, 4: { w: 135 }, 5: { w: 145 }, 6: { w: 190 }, 7: { w: 165 } };
  wb.id = uid('mos-xl-4');
  return {
    kind: 'sheet',
    workbook: wb,
    printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true, scaleMode: 'actual' },
  };
}

export const MOS_EXCEL_PROJECTS: MosExcelProject[] = [
  {
    id: 'excel-retail-sales',
    track: 'excel',
    level: 'associate',
    kind: 'sheet',
    order: 1,
    title: 'Doanh thu Bán lẻ Quý III',
    fileName: 'DoanhThu_BanLe_Q3.xlsx',
    scenario: 'Bộ phận Kinh doanh gửi dữ liệu bán hàng thô. Bạn cần chuẩn hoá trang tính, tính toán doanh thu bằng công thức động và cố định tiêu đề bảng.',
    minutes: 15,
    difficulty: 'Cơ bản',
    createStarter: buildSalesStarter,
    tasks: [
      {
        id: 'e1-t1',
        domainId: 'excel-manage',
        title: 'Đổi tên trang tính thành DoanhThu',
        instruction: 'Đổi tên trang tính “Sheet1” thành “DoanhThu”.',
        ribbonPath: 'Nhấp đúp thẻ Sheet1 ở thanh dưới cùng (hoặc Home → Đổi tên Sheet)',
        hint: 'Nhấp đúp vào tên thẻ trang tính “Sheet1” ở góc dưới bên trái bảng tính, gõ DoanhThu rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const found = findSheet(content.workbook, 'DoanhThu');
          return found
            ? { passed: true, detail: `Đã đổi tên trang tính thành “${found.name}”.` }
            : { passed: false, detail: `Chưa thấy trang tính tên “DoanhThu” (hiện có: ${Object.values(content.workbook.sheets).map((s) => s.name).join(', ')}).` };
        },
      },
      {
        id: 'e1-t2',
        domainId: 'excel-format',
        title: 'Gộp ô tiêu đề A1:F1',
        instruction: 'Gộp (Merge) vùng ô từ A1 đến F1 thành một ô tiêu đề duy nhất cho bảng báo cáo.',
        ribbonPath: 'Home (Trang đầu) → Gộp ô (Merge)',
        hint: 'Bôi chọn vùng A1:F1, sau đó bấm nút Gộp ô (Merge) trên thanh công cụ Home.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'DoanhThu') ?? primarySheet(content.workbook);
          const merged = (sheet?.mergeData ?? []).some((m) => m.startRow === 0 && m.endRow === 0 && m.startColumn === 0 && m.endColumn === 5);
          return merged
            ? { passed: true, detail: 'Đã gộp đúng vùng tiêu đề A1:F1.' }
            : { passed: false, detail: 'Vùng A1:F1 chưa được gộp thành một ô.' };
        },
      },
      {
        id: 'e1-t3',
        domainId: 'excel-formulas',
        title: 'Tính Thành tiền cho vùng F3:F8',
        instruction: 'Tại cột Thành tiền (F3:F8), nhập công thức nhân Số lượng (cột D) với Đơn giá (cột E), ví dụ tại F3 là =D3*E3.',
        ribbonPath: 'Thanh công thức → nhập =D3*E3 rồi sao chép xuống F8',
        hint: 'Chọn ô F3, gõ =D3*E3 và nhấn Enter. Kéo góc dưới bên phải ô F3 xuống đến ô F8.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'DoanhThu') ?? primarySheet(content.workbook);
          const expected = [22500000, 15360000, 57600000, 25900000, 15500000, 7800000];
          let matched = 0;
          for (let i = 0; i < 6; i++) {
            const r = i + 2;
            const rowNum = r + 1;
            const cell = cellAt(sheet, r, 5);
            const f = formulaOf(cell);
            const hasMul = f.includes(`D${rowNum}*E${rowNum}`) || f.includes(`E${rowNum}*D${rowNum}`) || f.includes(`PRODUCT(D${rowNum},E${rowNum})`) || f.includes(`PRODUCT(D${rowNum}:E${rowNum})`);
            const valOk = isNear(numericOf(cell), expected[i], 1);
            if (hasMul || (f.startsWith('=') && valOk)) matched++;
          }
          return matched === 6
            ? { passed: true, detail: 'Cả 6 ô từ F3 đến F8 đều có công thức Thành tiền chính xác.' }
            : { passed: false, detail: `Mới đúng ${matched}/6 ô công thức trong vùng F3:F8.` };
        },
      },
      {
        id: 'e1-t4',
        domainId: 'excel-formulas',
        title: 'Dùng hàm SUM, AVERAGE và MAX',
        instruction: 'Tại F9 nhập =SUM(F3:F8), tại F11 nhập =AVERAGE(F3:F8) và tại F12 nhập =MAX(F3:F8).',
        ribbonPath: 'Formulas (Công thức) → AutoSum / nhập trực tiếp tại F9, F11, F12',
        hint: 'Chọn lần lượt F9 (=SUM(F3:F8)), F11 (=AVERAGE(F3:F8)) và F12 (=MAX(F3:F8)).',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'DoanhThu') ?? primarySheet(content.workbook);
          const cSum = cellAt(sheet, 8, 5);
          const cAvg = cellAt(sheet, 10, 5);
          const cMax = cellAt(sheet, 11, 5);
          const okSum = formulaOf(cSum).includes('SUM(') && (formulaOf(cSum).includes('F3:F8') || isNear(numericOf(cSum), 144660000, 1));
          const okAvg = formulaOf(cAvg).includes('AVERAGE(') && (formulaOf(cAvg).includes('F3:F8') || isNear(numericOf(cAvg), 24110000, 1));
          const okMax = formulaOf(cMax).includes('MAX(') && (formulaOf(cMax).includes('F3:F8') || isNear(numericOf(cMax), 57600000, 1));
          if (okSum && okAvg && okMax) return { passed: true, detail: 'Cả 3 hàm SUM (F9), AVERAGE (F11) và MAX (F12) đều chính xác.' };
          const missing: string[] = [];
          if (!okSum) missing.push('F9 (SUM)');
          if (!okAvg) missing.push('F11 (AVERAGE)');
          if (!okMax) missing.push('F12 (MAX)');
          return { passed: false, detail: `Chưa đúng công thức tại: ${missing.join(', ')}.` };
        },
      },
      {
        id: 'e1-t5',
        domainId: 'excel-manage',
        title: 'Cố định 2 dòng tiêu đề đầu tiên',
        instruction: 'Cố định ít nhất 2 dòng đầu tiên (Freeze Panes) để dòng tiêu đề bảng luôn hiển thị khi cuộn xuống.',
        ribbonPath: 'View (Xem) → Cố định khung (Freeze Panes)',
        hint: 'Mở thẻ View (Xem) → bấm Cố định khung → chọn Cố định 2 dòng đầu (hoặc đặt con trỏ tại A3 rồi chọn Cố định tại ô đang chọn).',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'DoanhThu') ?? primarySheet(content.workbook);
          const ySplit = sheet?.freeze?.ySplit ?? 0;
          return ySplit >= 2
            ? { passed: true, detail: `Đã cố định ${ySplit} dòng đầu tiên.` }
            : { passed: false, detail: ySplit > 0 ? `Mới cố định ${ySplit} dòng, cần cố định ít nhất 2 dòng đầu.` : 'Trang tính chưa bật Cố định khung.' };
        },
      },
    ],
  },
  {
    id: 'excel-student-grades',
    track: 'excel',
    level: 'associate',
    kind: 'sheet',
    order: 2,
    title: 'Bảng Điểm & Xếp Loại Học Viên',
    fileName: 'BangDiem_HocVien.xlsx',
    scenario: 'Trung tâm đào tạo cần tự động hoá việc tính điểm trung bình, xếp loại Đạt/Chưa đạt theo chuẩn MOS 700 điểm và tổng hợp theo lớp.',
    minutes: 18,
    difficulty: 'Trung bình',
    createStarter: buildScoresStarter,
    tasks: [
      {
        id: 'e2-t1',
        domainId: 'excel-formulas',
        title: 'Tính Điểm TB tại F3:F8',
        instruction: 'Tại vùng F3:F8, dùng hàm AVERAGE tính điểm trung bình của Lý thuyết (cột D) và Thực hành (cột E), ví dụ =AVERAGE(D3:E3).',
        ribbonPath: 'Nhập =AVERAGE(D3:E3) tại F3 và sao chép xuống F8',
        hint: 'Chọn ô F3, gõ =AVERAGE(D3:E3) rồi kéo công thức xuống hết ô F8.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'HocVien') ?? primarySheet(content.workbook);
          const expected = [850, 660, 920, 740, 630, 800];
          let matched = 0;
          for (let i = 0; i < 6; i++) {
            const r = i + 2;
            const rowNum = r + 1;
            const cell = cellAt(sheet, r, 5);
            const f = formulaOf(cell);
            const hasAvg = f.includes('AVERAGE(') && (f.includes(`D${rowNum}:E${rowNum}`) || f.includes(`D${rowNum},E${rowNum}`));
            if (hasAvg || (f.startsWith('=') && isNear(numericOf(cell), expected[i], 0.5))) matched++;
          }
          return matched === 6
            ? { passed: true, detail: 'Đã tính đúng Điểm TB bằng công thức cho cả 6 học viên.' }
            : { passed: false, detail: `Mới đúng ${matched}/6 ô công thức tại vùng F3:F8.` };
        },
      },
      {
        id: 'e2-t2',
        domainId: 'excel-lookup',
        title: 'Xếp loại Đạt / Chưa đạt bằng hàm IF',
        instruction: 'Tại vùng G3:G8, dùng hàm IF kiểm tra nếu Điểm TB >= 700 thì trả về “Đạt”, ngược lại trả về “Chưa đạt”.',
        ribbonPath: 'Nhập =IF(F3>=700,"Đạt","Chưa đạt") tại G3 và sao chép xuống G8',
        hint: 'Chọn G3, nhập =IF(F3>=700,"Đạt","Chưa đạt") rồi nhấn Enter và kéo xuống G8.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'HocVien') ?? primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 6; i++) {
            const r = i + 2;
            const rowNum = r + 1;
            const cell = cellAt(sheet, r, 6);
            const f = formulaOf(cell);
            const hasIf = f.includes('IF(') && f.includes(`F${rowNum}`) && f.includes('700');
            if (hasIf) matched++;
          }
          return matched === 6
            ? { passed: true, detail: 'Cả 6 ô G3:G8 đều sử dụng hàm IF kiểm tra ngưỡng 700 điểm.' }
            : { passed: false, detail: `Mới có ${matched}/6 ô trong vùng G3:G8 dùng công thức IF theo ngưỡng 700.` };
        },
      },
      {
        id: 'e2-t3',
        domainId: 'excel-formulas',
        title: 'Đếm học viên đạt bằng COUNTIF',
        instruction: 'Tại ô I3, dùng hàm COUNTIF để đếm số học viên đạt (Điểm TB >= 700 ở vùng F3:F8 hoặc “Đạt” ở vùng G3:G8).',
        ribbonPath: 'Ô I3 → =COUNTIF(F3:F8,">=700") hoặc =COUNTIF(G3:G8,"Đạt")',
        hint: 'Chọn ô I3, gõ =COUNTIF(F3:F8,">=700") rồi nhấn Enter (kết quả là 4).',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'HocVien') ?? primarySheet(content.workbook);
          const cell = cellAt(sheet, 2, 8);
          const f = formulaOf(cell);
          const ok = f.includes('COUNTIF(') && (f.includes('F3:F8') || f.includes('G3:G8') || isNear(numericOf(cell), 4, 0.1));
          return ok
            ? { passed: true, detail: 'Ô I3 đã dùng hàm COUNTIF chính xác.' }
            : { passed: false, detail: 'Ô I3 chưa có công thức COUNTIF đếm số học viên đạt (vùng F3:F8 hoặc G3:G8).' };
        },
      },
      {
        id: 'e2-t4',
        domainId: 'excel-formulas',
        title: 'Tính tổng điểm lớp MOS-A bằng SUMIF',
        instruction: 'Tại ô I4, dùng hàm SUMIF để tính tổng Điểm TB (F3:F8) của các học viên thuộc lớp “MOS-A” (cột C3:C8).',
        ribbonPath: 'Ô I4 → =SUMIF(C3:C8,"MOS-A",F3:F8)',
        hint: 'Chọn ô I4, nhập =SUMIF(C3:C8,"MOS-A",F3:F8) rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'HocVien') ?? primarySheet(content.workbook);
          const cell = cellAt(sheet, 3, 8);
          const f = formulaOf(cell);
          const ok = f.includes('SUMIF(') && f.includes('C3:C8') && f.includes('MOS-A') && f.includes('F3:F8');
          return ok
            ? { passed: true, detail: 'Ô I4 đã áp dụng hàm SUMIF theo lớp MOS-A chính xác.' }
            : { passed: false, detail: 'Ô I4 chưa có công thức SUMIF đúng cú pháp cho lớp “MOS-A” trên vùng C3:C8 và F3:F8.' };
        },
      },
      {
        id: 'e2-t5',
        domainId: 'excel-manage',
        title: 'Thêm trang tính mới tên TongHop',
        instruction: 'Tạo thêm một trang tính mới trong sổ tính và đặt tên là “TongHop”.',
        ribbonPath: 'Nút dấu + cạnh thanh tên Sheet ở dưới cùng → đổi tên thành TongHop',
        hint: 'Bấm nút + trên thanh trang tính phía dưới để thêm trang mới, sau đó nhấp đúp đổi tên thành TongHop.',
        points: 20,
        check: (content) => {
          const found = findSheet(content.workbook, 'TongHop');
          return found
            ? { passed: true, detail: `Đã tạo trang tính “${found.name}”.` }
            : { passed: false, detail: 'Chưa thấy trang tính mới có tên “TongHop”.' };
        },
      },
    ],
  },
  {
    id: 'excel-warehouse-lookup',
    track: 'excel',
    level: 'associate',
    kind: 'sheet',
    order: 3,
    title: 'Quản lý Kho Hàng & Tra cứu VLOOKUP',
    fileName: 'KhoHang_TonKho.xlsx',
    scenario: 'Bạn cần tách mã vùng từ mã hàng hoá, tính tồn kho cuối kỳ, tự động cảnh báo thiếu hàng và tra cứu phụ phí vận chuyển từ bảng giá.',
    minutes: 18,
    difficulty: 'Nâng cao',
    createStarter: buildInventoryStarter,
    tasks: [
      {
        id: 'e3-t1',
        domainId: 'excel-lookup',
        title: 'Trích mã vùng bằng hàm LEFT',
        instruction: 'Tại vùng B3:B7 trên trang TonKho, dùng hàm LEFT lấy 2 ký tự đầu của Mã hàng ở cột A (ví dụ =LEFT(A3,2)).',
        ribbonPath: 'Ô B3 → =LEFT(A3,2) rồi sao chép xuống B7',
        hint: 'Chọn ô B3, gõ =LEFT(A3,2) và nhấn Enter, sau đó sao chép công thức xuống đến B7.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TonKho') ?? primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const r = i + 2;
            const rowNum = r + 1;
            const f = formulaOf(cellAt(sheet, r, 1));
            if (f.includes(`LEFT(A${rowNum},2)`)) matched++;
          }
          return matched === 5
            ? { passed: true, detail: 'Đã dùng hàm LEFT(A...,2) đúng cho cả 5 mã hàng.' }
            : { passed: false, detail: `Mới đúng ${matched}/5 ô dùng hàm LEFT tại vùng B3:B7.` };
        },
      },
      {
        id: 'e3-t2',
        domainId: 'excel-formulas',
        title: 'Tính Tồn cuối tại F3:F7',
        instruction: 'Tại vùng F3:F7, nhập công thức tính Tồn cuối bằng Tồn đầu (cột D) trừ Xuất kho (cột E), ví dụ =D3-E3.',
        ribbonPath: 'Ô F3 → =D3-E3 rồi sao chép xuống F7',
        hint: 'Chọn ô F3, gõ =D3-E3 rồi sao chép công thức xuống đến ô F7.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TonKho') ?? primarySheet(content.workbook);
          const expected = [15, 38, 12, 38, 9];
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const r = i + 2;
            const rowNum = r + 1;
            const cell = cellAt(sheet, r, 5);
            const f = formulaOf(cell);
            if (f.includes(`D${rowNum}-E${rowNum}`) || (f.startsWith('=') && isNear(numericOf(cell), expected[i], 0.1))) matched++;
          }
          return matched === 5
            ? { passed: true, detail: 'Cả 5 ô F3:F7 đã tính Tồn cuối chính xác.' }
            : { passed: false, detail: `Mới đúng ${matched}/5 ô Tồn cuối tại F3:F7.` };
        },
      },
      {
        id: 'e3-t3',
        domainId: 'excel-lookup',
        title: 'Cảnh báo tồn kho bằng hàm IF',
        instruction: 'Tại G3:G7, dùng hàm IF kiểm tra nếu Tồn cuối < 20 thì hiện “Nhập thêm”, ngược lại hiện “Ổn định”.',
        ribbonPath: 'Ô G3 → =IF(F3<20,"Nhập thêm","Ổn định")',
        hint: 'Chọn G3, nhập =IF(F3<20,"Nhập thêm","Ổn định") rồi sao chép xuống G7.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TonKho') ?? primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const r = i + 2;
            const rowNum = r + 1;
            const f = formulaOf(cellAt(sheet, r, 6));
            if (f.includes('IF(') && f.includes(`F${rowNum}`) && f.includes('20')) matched++;
          }
          return matched === 5
            ? { passed: true, detail: 'Cả 5 ô cảnh báo G3:G7 đã cài đặt hàm IF đúng ngưỡng 20.' }
            : { passed: false, detail: `Mới đúng ${matched}/5 ô dùng hàm IF cảnh báo tồn kho.` };
        },
      },
      {
        id: 'e3-t4',
        domainId: 'excel-lookup',
        title: 'Tra cứu phụ phí bằng VLOOKUP',
        instruction: 'Tại H3:H7, dùng hàm VLOOKUP tra cứu Mã vùng (cột B) trong bảng BangGia!$A$2:$B$5, trả về cột 2 (tìm chính xác FALSE hoặc 0).',
        ribbonPath: 'Ô H3 → =VLOOKUP(B3,BangGia!$A$2:$B$5,2,FALSE)',
        hint: 'Chọn H3, nhập =VLOOKUP(B3,BangGia!$A$2:$B$5,2,FALSE) (hoặc dùng 0 thay cho FALSE) rồi kéo xuống H7.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TonKho') ?? primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const r = i + 2;
            const rowNum = r + 1;
            const f = formulaOf(cellAt(sheet, r, 7));
            const ok = f.includes('VLOOKUP(') && f.includes(`B${rowNum}`) && f.includes('BANGGIA!') && f.includes(',2,');
            if (ok) matched++;
          }
          return matched === 5
            ? { passed: true, detail: 'Cả 5 ô H3:H7 đã dùng VLOOKUP tra cứu từ trang BangGia chính xác.' }
            : { passed: false, detail: `Mới đúng ${matched}/5 ô công thức VLOOKUP tại H3:H7.` };
        },
      },
      {
        id: 'e3-t5',
        domainId: 'excel-format',
        title: 'Định dạng số tiền và hướng in ngang',
        instruction: 'Áp dụng định dạng số có dấu phân tách hàng nghìn (ví dụ #,##0) cho vùng H3:H7 và thiết lập hướng trang in là Ngang (Landscape).',
        ribbonPath: 'Home → Định dạng số (#,##0) · Page Layout → Hướng trang → Ngang',
        hint: 'Bôi chọn H3:H7 rồi bấm nút dấu phẩy / định dạng số trên thẻ Home. Sau đó mở thẻ Page Layout (Bố cục trang) → chọn Hướng trang → Ngang.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TonKho') ?? primarySheet(content.workbook);
          let formatted = 0;
          for (let i = 0; i < 5; i++) {
            const style = resolveStyle(content.workbook, cellAt(sheet, i + 2, 7));
            const pattern = style?.n?.pattern ?? '';
            if (pattern.includes('#') || pattern.includes('0,0') || pattern.includes(',0') || pattern.includes('₫') || pattern.includes('$')) formatted++;
          }
          const landscape = content.printSettings?.orientation === 'landscape';
          if (formatted >= 5 && landscape) return { passed: true, detail: 'Đã định dạng số tiền vùng H3:H7 và chuyển hướng in Ngang.' };
          const issues: string[] = [];
          if (formatted < 5) issues.push(`mới định dạng số ${formatted}/5 ô ở H3:H7`);
          if (!landscape) issues.push('hướng in vẫn đang là Dọc');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
    ],
  },
  {
    id: 'excel-expert-kpi',
    track: 'excel',
    level: 'expert',
    kind: 'sheet',
    order: 4,
    title: 'Phân tích KPI & Hàm nâng cao (Expert)',
    fileName: 'PhanTich_KPI_Expert.xlsx',
    scenario: 'Dự án cấp độ MOS Excel Expert: ứng dụng hàm nhiều điều kiện SUMIFS, COUNTIFS, tra cứu động INDEX/MATCH, logic lồng IF+AND và thiết lập in vừa một trang.',
    minutes: 20,
    difficulty: 'Nâng cao',
    createStarter: buildExpertKpiStarter,
    tasks: [
      {
        id: 'e4-t1',
        domainId: 'excel-formulas',
        title: 'Tổng doanh số đa điều kiện bằng SUMIFS',
        instruction: 'Tại ô H3, dùng hàm SUMIFS tính tổng Doanh số (E3:E10) của nhân viên khu vực “Miền Bắc” (B3:B10) có trạng thái “Đạt” (C3:C10).',
        ribbonPath: 'Ô H3 → =SUMIFS(E3:E10,B3:B10,"Miền Bắc",C3:C10,"Đạt")',
        hint: 'Chọn H3, gõ =SUMIFS(E3:E10,B3:B10,"Miền Bắc",C3:C10,"Đạt") rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'KPI_2026') ?? primarySheet(content.workbook);
          const cell = cellAt(sheet, 2, 7);
          const f = formulaOf(cell);
          const ok = f.includes('SUMIFS(') && f.includes('E3:E10') && f.includes('B3:B10') && f.includes('C3:C10');
          return ok
            ? { passed: true, detail: 'Ô H3 đã sử dụng hàm SUMIFS đúng 2 tiêu chí Khu vực và Trạng thái.' }
            : { passed: false, detail: 'Ô H3 chưa có công thức SUMIFS theo vùng E3:E10, B3:B10 và C3:C10.' };
        },
      },
      {
        id: 'e4-t2',
        domainId: 'excel-formulas',
        title: 'Đếm đa điều kiện bằng COUNTIFS',
        instruction: 'Tại ô H4, dùng hàm COUNTIFS đếm số nhân viên khu vực “Miền Nam” (B3:B10) có Doanh số >= 100000000 (E3:E10).',
        ribbonPath: 'Ô H4 → =COUNTIFS(B3:B10,"Miền Nam",E3:E10,">=100000000")',
        hint: 'Chọn H4, nhập =COUNTIFS(B3:B10,"Miền Nam",E3:E10,">=100000000") rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'KPI_2026') ?? primarySheet(content.workbook);
          const cell = cellAt(sheet, 3, 7);
          const f = formulaOf(cell);
          const ok = f.includes('COUNTIFS(') && f.includes('B3:B10') && f.includes('E3:E10') && f.includes('100000000');
          return ok
            ? { passed: true, detail: 'Ô H4 đã áp dụng hàm COUNTIFS chính xác.' }
            : { passed: false, detail: 'Ô H4 chưa có công thức COUNTIFS cho Miền Nam và doanh số >= 100000000.' };
        },
      },
      {
        id: 'e4-t3',
        domainId: 'excel-lookup',
        title: 'Tra cứu nhân viên xuất sắc bằng INDEX + MATCH',
        instruction: 'Tại ô H5, kết hợp hàm INDEX và MATCH cùng MAX để tìm tên nhân viên (A3:A10) có Doanh số (E3:E10) cao nhất.',
        ribbonPath: 'Ô H5 → =INDEX(A3:A10,MATCH(MAX(E3:E10),E3:E10,0))',
        hint: 'Chọn H5, nhập =INDEX(A3:A10,MATCH(MAX(E3:E10),E3:E10,0)) rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'KPI_2026') ?? primarySheet(content.workbook);
          const cell = cellAt(sheet, 4, 7);
          const f = formulaOf(cell);
          const ok = f.includes('INDEX(') && f.includes('MATCH(') && f.includes('MAX(') && f.includes('A3:A10') && f.includes('E3:E10');
          return ok
            ? { passed: true, detail: 'Ô H5 đã kết hợp INDEX + MATCH + MAX chính xác.' }
            : { passed: false, detail: 'Ô H5 chưa có công thức INDEX/MATCH/MAX tìm nhân viên doanh số cao nhất.' };
        },
      },
      {
        id: 'e4-t4',
        domainId: 'excel-lookup',
        title: 'Xếp hạng thưởng bằng hàm IF kết hợp AND',
        instruction: 'Tại vùng F3:F10, dùng hàm IF kết hợp AND: nếu Điểm KPI >= 90 VÀ Doanh số >= 100000000 thì “Thưởng cao”, ngược lại “Tiêu chuẩn”.',
        ribbonPath: 'Ô F3 → =IF(AND(D3>=90,E3>=100000000),"Thưởng cao","Tiêu chuẩn")',
        hint: 'Chọn F3, nhập =IF(AND(D3>=90,E3>=100000000),"Thưởng cao","Tiêu chuẩn") rồi sao chép xuống F10.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'KPI_2026') ?? primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 8; i++) {
            const r = i + 2;
            const rowNum = r + 1;
            const f = formulaOf(cellAt(sheet, r, 5));
            if (f.includes('IF(') && f.includes('AND(') && f.includes(`D${rowNum}`) && f.includes(`E${rowNum}`)) matched++;
          }
          return matched === 8
            ? { passed: true, detail: 'Cả 8 ô F3:F10 đều dùng hàm IF(AND(...)) chính xác.' }
            : { passed: false, detail: `Mới đúng ${matched}/8 ô dùng công thức IF + AND tại vùng F3:F10.` };
        },
      },
      {
        id: 'e4-t5',
        domainId: 'excel-format',
        title: 'Thu gọn in vừa 1 trang khổ ngang',
        instruction: 'Thiết lập hướng in Ngang (Landscape) và bật chế độ thu gọn vừa trang in (Fit to Page / Vừa 1 trang).',
        ribbonPath: 'Page Layout (Bố cục trang) → Hướng trang: Ngang · Tỷ lệ: Vừa 1 trang',
        hint: 'Mở thẻ Page Layout (hoặc hộp thoại In / PDF), chọn hướng trang Ngang và bật chế độ thu gọn vừa 1 trang (Fit to Page).',
        points: 20,
        check: (content) => {
          const ps = content.printSettings;
          const landscape = ps?.orientation === 'landscape';
          const fit = Boolean(ps?.fitToPage) || ps?.scaleMode === 'fit-page' || ps?.scaleMode === 'fit-width';
          if (landscape && fit) return { passed: true, detail: 'Đã thiết lập hướng Ngang và thu gọn vừa trang in.' };
          const issues: string[] = [];
          if (!landscape) issues.push('chưa đổi hướng in sang Ngang');
          if (!fit) issues.push('chưa bật thu gọn vừa trang in');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
    ],
  },
];
