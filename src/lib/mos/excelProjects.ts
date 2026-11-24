import type { SheetContent } from '../storage';
import { emptySheet, emptyWorkbook, uid } from '../workbookBasics';
import { cellAt, findSheet, formulaOf, isNear, numericOf, primarySheet, resolveStyle } from './excelHelpers';
import type { MosExcelProject } from './types';

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
    sheet.cellData[r] = { 0: { v: row[0], t: 1 }, 1: { v: row[1], t: 1 }, 2: { v: row[2], t: 1 }, 3: { v: row[3], t: 2, s: 'num' }, 4: { v: row[4], t: 2, s: 'num' } };
  });
  sheet.cellData[8] = { 0: { v: 'Tổng cộng', t: 1, s: 'bold' } };
  sheet.cellData[10] = { 0: { v: 'Doanh thu trung bình', t: 1 } };
  sheet.cellData[11] = { 0: { v: 'Đơn hàng cao nhất', t: 1 } };
  sheet.columnData = { 0: { w: 110 }, 1: { w: 220 }, 2: { w: 120 }, 3: { w: 110 }, 4: { w: 130 }, 5: { w: 150 } };
  sheet.rowData = { 0: { h: 34 }, 1: { h: 28 } };
  sheet.mergeData = [];
  sheet.freeze = { xSplit: 0, ySplit: 0, startRow: 0, startColumn: 0 };
  wb.id = uid('mos-xl-1');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
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
    sheet.cellData[r] = { 0: { v: row[0], t: 1 }, 1: { v: row[1], t: 1 }, 2: { v: row[2], t: 1 }, 3: { v: row[3], t: 2 }, 4: { v: row[4], t: 2 } };
  });
  sheet.cellData[1][8] = { v: 'Thống kê nhanh', t: 1, s: 'sumHead' };
  sheet.cellData[2][7] = { v: 'Số HV đạt (>=700)', t: 1 };
  sheet.cellData[3][7] = { v: 'Tổng điểm TB lớp MOS-A', t: 1 };
  sheet.columnData = { 0: { w: 90 }, 1: { w: 190 }, 2: { w: 95 }, 3: { w: 100 }, 4: { w: 105 }, 5: { w: 100 }, 6: { w: 115 }, 7: { w: 185 }, 8: { w: 125 } };
  wb.id = uid('mos-xl-2');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
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
    sheet.cellData[r] = { 0: { v: row[0], t: 1 }, 2: { v: row[1], t: 1 }, 3: { v: row[2], t: 2 }, 4: { v: row[3], t: 2 } };
  });
  sheet.columnData = { 0: { w: 120 }, 1: { w: 95 }, 2: { w: 200 }, 3: { w: 95 }, 4: { w: 95 }, 5: { w: 95 }, 6: { w: 120 }, 7: { w: 125 } };
  const rateSheet = emptySheet('BangGia');
  rateSheet.cellData[0] = { 0: { v: 'Mã vùng', t: 1, s: 'head' }, 1: { v: 'Phụ phí (VNĐ)', t: 1, s: 'head' } };
  [['HN', 35000], ['SG', 45000], ['DN', 40000], ['CT', 55000]].forEach((item, idx) => {
    rateSheet.cellData[idx + 1] = { 0: { v: item[0] as string, t: 1 }, 1: { v: item[1] as number, t: 2, s: 'money' } };
  });
  rateSheet.columnData = { 0: { w: 120 }, 1: { w: 150 } };
  wb.sheetOrder.push(rateSheet.id);
  wb.sheets[rateSheet.id] = rateSheet;
  wb.id = uid('mos-xl-3');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
}

function buildPayrollStarter(): SheetContent {
  const wb = emptyWorkbook('BangLuong_Thang11');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'Luong';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#1E293B' } },
    head: { bl: 1, bg: { rgb: '#1E40AF' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    money: { n: { pattern: '#,##0' } },
  };
  sheet.cellData[0] = { 0: { v: 'BẢNG TÍNH LƯƠNG & THƯỞNG NHÂN SỰ THÁNG 11', t: 1, s: 'title' } };
  const headers = ['Mã NV', 'Họ tên', 'Lương ngày', 'Ngày công', 'Lương chính', 'Thưởng', 'Tổng lĩnh'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });
  const staff: [string, string, number, number, number][] = [
    ['NV01', 'Nguyễn Minh Trí', 650000, 24, 1500000],
    ['NV02', 'Lê Thị Hương', 580000, 26, 2000000],
    ['NV03', 'Phạm Anh Tuấn', 720000, 22, 1000000],
    ['NV04', 'Trần Ngọc Mai', 600000, 25, 1800000],
    ['NV05', 'Hoàng Đức Long', 540000, 23, 1200000],
  ];
  staff.forEach((row, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = { 0: { v: row[0], t: 1 }, 1: { v: row[1], t: 1 }, 2: { v: row[2], t: 2, s: 'money' }, 3: { v: row[3], t: 2 }, 5: { v: row[4], t: 2, s: 'money' } };
  });
  sheet.cellData[8] = { 0: { v: 'Lương thấp nhất', t: 1 } };
  sheet.cellData[9] = { 0: { v: 'Số nhân sự', t: 1 } };
  sheet.columnData = { 0: { w: 90 }, 1: { w: 180 }, 2: { w: 120 }, 3: { w: 100 }, 4: { w: 130 }, 5: { w: 120 }, 6: { w: 135 } };
  wb.id = uid('mos-xl-4a');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
}

function buildTextCleanStarter(): SheetContent {
  const wb = emptyWorkbook('ChuanHoa_KhachHang');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'KhachHang';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#0F766E' } },
    head: { bl: 1, bg: { rgb: '#0D9488' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
  };
  sheet.cellData[0] = { 0: { v: 'CHUẨN HOÁ DANH SÁCH KHÁCH HÀNG & EMAIL', t: 1, s: 'title' } };
  const headers = ['Họ', 'Tên', 'Họ tên chuẩn', 'Mã khu vực', 'Mã viết hoa', 'Độ dài mã'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });
  const people: [string, string, string][] = [
    ['nguyen', 'an', 'hn-001'],
    ['tran', 'binh', 'sg-024'],
    ['le', 'chi', 'dn-108'],
    ['pham', 'dung', 'ct-019'],
  ];
  people.forEach((row, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = { 0: { v: row[0], t: 1 }, 1: { v: row[1], t: 1 }, 3: { v: row[2], t: 1 } };
  });
  sheet.columnData = { 0: { w: 110 }, 1: { w: 110 }, 2: { w: 170 }, 3: { w: 120 }, 4: { w: 120 }, 5: { w: 110 } };
  wb.id = uid('mos-xl-5a');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
}

function buildExpenseStarter(): SheetContent {
  const wb = emptyWorkbook('NganSach_ChiTieu');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'ChiTieu';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#7C2D12' } },
    head: { bl: 1, bg: { rgb: '#C2410C' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    money: { n: { pattern: '#,##0' } },
  };
  sheet.cellData[0] = { 0: { v: 'THEO DÕI NGÂN SÁCH & TỶ TRỌNG CHI TIÊU', t: 1, s: 'title' } };
  const headers = ['Hạng mục', 'Dự toán', 'Thực chi', 'Chênh lệch', 'Tỷ lệ thực chi'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });
  const rows: [string, number, number][] = [
    ['Nhân sự', 300000000, 295000000],
    ['Marketing', 150000000, 162000000],
    ['Hạ tầng Cloud', 80000000, 74000000],
    ['Văn phòng', 60000000, 58000000],
  ];
  rows.forEach((row, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = { 0: { v: row[0], t: 1 }, 1: { v: row[1], t: 2, s: 'money' }, 2: { v: row[2], t: 2, s: 'money' } };
  });
  sheet.cellData[6] = { 0: { v: 'Tổng cộng', t: 1 } };
  sheet.columnData = { 0: { w: 165 }, 1: { w: 135 }, 2: { w: 135 }, 3: { w: 135 }, 4: { w: 135 } };
  wb.id = uid('mos-xl-6a');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
}

function buildOrderAuditStarter(): SheetContent {
  const wb = emptyWorkbook('KiemToan_DonHang');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  sheet.name = 'DonHang';
  wb.styles = {
    title: { bl: 1, fs: 14, cl: { rgb: '#312E81' } },
    head: { bl: 1, bg: { rgb: '#4338CA' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    money: { n: { pattern: '#,##0' } },
  };
  sheet.cellData[0] = { 0: { v: 'KIỂM TOÁN ĐƠN HÀNG & CHIẾT KHẤU', t: 1, s: 'title' } };
  const headers = ['Mã đơn', 'Kênh bán', 'Giá trị đơn', 'Chiết khấu (5%)', 'Thanh toán'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => { sheet.cellData[1][c] = { v: h, t: 1, s: 'head' }; });
  const orders: [string, string, number][] = [
    ['DH-2026-01', 'Online', 12000000],
    ['DH-2026-02', 'Showroom', 8500000],
    ['DH-2026-03', 'Online', 19400000],
    ['DH-2026-04', 'Đại lý', 24000000],
    ['DH-2026-05', 'Online', 6200000],
  ];
  orders.forEach((row, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = { 0: { v: row[0], t: 1 }, 1: { v: row[1], t: 1 }, 2: { v: row[2], t: 2, s: 'money' } };
  });
  sheet.cellData[8] = { 0: { v: 'Tổng đơn Online', t: 1 } };
  sheet.cellData[9] = { 0: { v: 'Số đơn Online', t: 1 } };
  sheet.columnData = { 0: { w: 120 }, 1: { w: 115 }, 2: { w: 130 }, 3: { w: 135 }, 4: { w: 135 } };
  wb.id = uid('mos-xl-7a');
  return { kind: 'sheet', workbook: wb, printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true } };
}

export const MOS_EXCEL_ASSOCIATE_PROJECTS: MosExcelProject[] = [
  {
    id: 'excel-retail-sales',
    track: 'excel',
    level: 'associate',
    kind: 'sheet',
    order: 1,
    title: 'Doanh thu Bán lẻ Quý III',
    titleEn: 'Q3 Retail Sales Report',
    fileName: 'DoanhThu_BanLe_Q3.xlsx',
    scenario: 'Bộ phận Kinh doanh gửi dữ liệu bán hàng thô. Bạn cần đổi tên trang tính, gộp tiêu đề, tính Thành tiền bằng công thức động và cố định tiêu đề bảng.',
    scenarioEn: 'Prepare the Q3 retail sales report by renaming the sheet, merging the title, calculating line totals, summary stats, and freezing header rows.',
    minutes: 7,
    difficulty: 'Cơ bản',
    createStarter: buildSalesStarter,
    tasks: [
      {
        id: 'e1-t1',
        domainId: 'excel-manage',
        title: 'Đổi tên trang tính thành DoanhThu',
        titleEn: 'Rename worksheet to DoanhThu',
        instruction: 'Đổi tên trang tính “Sheet1” thành “DoanhThu”.',
        instructionEn: 'Rename the worksheet “Sheet1” to “DoanhThu”.',
        copyTokens: ['DoanhThu'],
        ribbonPath: 'Nhấp đúp thẻ Sheet1 ở dưới cùng',
        hint: 'Nhấp đúp vào tên thẻ “Sheet1” ở góc dưới bên trái bảng tính, gõ DoanhThu rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const found = findSheet(content.workbook, 'DoanhThu');
          return found
            ? { passed: true, detail: `Đã đổi tên trang tính thành “${found.name}”.` }
            : { passed: false, detail: `Chưa thấy trang tính tên “DoanhThu”.` };
        },
      },
      {
        id: 'e1-t2',
        domainId: 'excel-format',
        title: 'Gộp ô tiêu đề A1:F1',
        titleEn: 'Merge title cells A1:F1',
        instruction: 'Gộp (Merge) vùng ô từ A1 đến F1 thành một ô tiêu đề duy nhất cho bảng báo cáo.',
        instructionEn: 'Merge the cell range A1:F1 into a single header cell.',
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
        titleEn: 'Calculate line totals in F3:F8',
        instruction: 'Tại cột Thành tiền (F3:F8), nhập công thức nhân Số lượng (D) với Đơn giá (E), ví dụ tại F3 là “=D3*E3”.',
        instructionEn: 'In F3:F8, enter a formula multiplying Quantity (D) by Unit Price (E), starting with “=D3*E3”.',
        copyTokens: ['=D3*E3'],
        ribbonPath: 'Ô F3 → =D3*E3 rồi sao chép xuống F8',
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
            if (hasMul || (f.startsWith('=') && isNear(numericOf(cell), expected[i], 1))) matched++;
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
        titleEn: 'Compute SUM, AVERAGE, and MAX',
        instruction: 'Tại F9 nhập “=SUM(F3:F8)”, tại F11 nhập “=AVERAGE(F3:F8)” và tại F12 nhập “=MAX(F3:F8)”.',
        instructionEn: 'Enter “=SUM(F3:F8)” in F9, “=AVERAGE(F3:F8)” in F11, and “=MAX(F3:F8)” in F12.',
        copyTokens: ['=SUM(F3:F8)', '=AVERAGE(F3:F8)', '=MAX(F3:F8)'],
        ribbonPath: 'Nhập trực tiếp hoặc dùng AutoSum tại F9, F11, F12',
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
        titleEn: 'Freeze top 2 rows',
        instruction: 'Cố định ít nhất 2 dòng đầu tiên (Freeze Panes) để dòng tiêu đề bảng luôn hiển thị khi cuộn xuống.',
        instructionEn: 'Freeze at least the top 2 rows so headers remain visible when scrolling.',
        ribbonPath: 'View (Xem) → Cố định khung (Freeze Panes)',
        hint: 'Mở thẻ View → Cố định khung → chọn Cố định 2 dòng đầu (hoặc đặt con trỏ tại A3 rồi cố định).',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'DoanhThu') ?? primarySheet(content.workbook);
          const ySplit = sheet?.freeze?.ySplit ?? 0;
          return ySplit >= 2
            ? { passed: true, detail: `Đã cố định ${ySplit} dòng đầu tiên.` }
            : { passed: false, detail: 'Trang tính chưa cố định ít nhất 2 dòng đầu.' };
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
    titleEn: 'Student Grades & Pass Classification',
    fileName: 'BangDiem_HocVien.xlsx',
    scenario: 'Trung tâm đào tạo cần tự động hoá việc tính điểm trung bình, xếp loại Đạt/Chưa đạt theo chuẩn MOS 700 điểm và tổng hợp theo lớp.',
    scenarioEn: 'Automate student average scores, MOS 700-point pass/fail logic, COUNTIF/SUMIF analytics, and add a summary worksheet.',
    minutes: 8,
    difficulty: 'Trung bình',
    createStarter: buildScoresStarter,
    tasks: [
      {
        id: 'e2-t1',
        domainId: 'excel-formulas',
        title: 'Tính Điểm TB tại F3:F8',
        titleEn: 'Calculate average scores in F3:F8',
        instruction: 'Tại vùng F3:F8, dùng hàm AVERAGE tính điểm trung bình của Lý thuyết (D) và Thực hành (E), ví dụ “=AVERAGE(D3:E3)”.',
        instructionEn: 'In F3:F8, calculate the average of columns D and E using “=AVERAGE(D3:E3)”.',
        copyTokens: ['=AVERAGE(D3:E3)'],
        ribbonPath: 'Ô F3 → =AVERAGE(D3:E3) rồi kéo xuống F8',
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
        titleEn: 'Classify Pass/Fail with IF in G3:G8',
        instruction: 'Tại vùng G3:G8, dùng hàm IF kiểm tra nếu Điểm TB >= 700 thì trả về “Đạt”, ngược lại trả về “Chưa đạt”.',
        instructionEn: 'In G3:G8, use IF to return “Đạt” when score >= 700, otherwise “Chưa đạt”.',
        copyTokens: ['=IF(F3>=700,"Đạt","Chưa đạt")'],
        ribbonPath: 'Ô G3 → =IF(F3>=700,"Đạt","Chưa đạt")',
        hint: 'Chọn G3, nhập =IF(F3>=700,"Đạt","Chưa đạt") rồi nhấn Enter và kéo xuống G8.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'HocVien') ?? primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 6; i++) {
            const r = i + 2;
            const rowNum = r + 1;
            const f = formulaOf(cellAt(sheet, r, 6));
            if (f.includes('IF(') && f.includes(`F${rowNum}`) && f.includes('700')) matched++;
          }
          return matched === 6
            ? { passed: true, detail: 'Cả 6 ô G3:G8 đều sử dụng hàm IF kiểm tra ngưỡng 700 điểm.' }
            : { passed: false, detail: `Mới có ${matched}/6 ô dùng công thức IF theo ngưỡng 700.` };
        },
      },
      {
        id: 'e2-t3',
        domainId: 'excel-formulas',
        title: 'Đếm học viên đạt bằng COUNTIF',
        titleEn: 'Count passing students using COUNTIF',
        instruction: 'Tại ô I3, dùng hàm COUNTIF để đếm số học viên đạt (Điểm TB >= 700 ở F3:F8 hoặc “Đạt” ở G3:G8).',
        instructionEn: 'In cell I3, use COUNTIF to count students with score >= 700 (F3:F8) or “Đạt” (G3:G8).',
        copyTokens: ['=COUNTIF(F3:F8,">=700")'],
        ribbonPath: 'Ô I3 → =COUNTIF(F3:F8,">=700")',
        hint: 'Chọn ô I3, gõ =COUNTIF(F3:F8,">=700") rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'HocVien') ?? primarySheet(content.workbook);
          const cell = cellAt(sheet, 2, 8);
          const f = formulaOf(cell);
          return f.includes('COUNTIF(') && (f.includes('F3:F8') || f.includes('G3:G8') || isNear(numericOf(cell), 4, 0.1))
            ? { passed: true, detail: 'Ô I3 đã dùng hàm COUNTIF chính xác.' }
            : { passed: false, detail: 'Ô I3 chưa có công thức COUNTIF đếm số học viên đạt.' };
        },
      },
      {
        id: 'e2-t4',
        domainId: 'excel-formulas',
        title: 'Tính tổng điểm lớp MOS-A bằng SUMIF',
        titleEn: 'Sum MOS-A scores using SUMIF',
        instruction: 'Tại ô I4, dùng hàm SUMIF để tính tổng Điểm TB (F3:F8) của học viên lớp “MOS-A” (C3:C8).',
        instructionEn: 'In cell I4, use SUMIF to total column F3:F8 where class C3:C8 equals “MOS-A”.',
        copyTokens: ['=SUMIF(C3:C8,"MOS-A",F3:F8)'],
        ribbonPath: 'Ô I4 → =SUMIF(C3:C8,"MOS-A",F3:F8)',
        hint: 'Chọn ô I4, nhập =SUMIF(C3:C8,"MOS-A",F3:F8) rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'HocVien') ?? primarySheet(content.workbook);
          const f = formulaOf(cellAt(sheet, 3, 8));
          return f.includes('SUMIF(') && f.includes('C3:C8') && f.includes('MOS-A') && f.includes('F3:F8')
            ? { passed: true, detail: 'Ô I4 đã áp dụng hàm SUMIF theo lớp MOS-A chính xác.' }
            : { passed: false, detail: 'Ô I4 chưa có công thức SUMIF đúng cú pháp cho lớp “MOS-A”.' };
        },
      },
      {
        id: 'e2-t5',
        domainId: 'excel-manage',
        title: 'Thêm trang tính mới tên TongHop',
        titleEn: 'Add a new worksheet named TongHop',
        instruction: 'Tạo thêm một trang tính mới trong sổ tính và đặt tên là “TongHop”.',
        instructionEn: 'Insert a new worksheet and name it “TongHop”.',
        copyTokens: ['TongHop'],
        ribbonPath: 'Nút + ở thanh trang tính phía dưới → đổi tên thành TongHop',
        hint: 'Bấm nút + cạnh thẻ HocVien ở dưới cùng, sau đó nhấp đúp đổi tên thành TongHop.',
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
    titleEn: 'Warehouse Stock & VLOOKUP Rates',
    fileName: 'KhoHang_TonKho.xlsx',
    scenario: 'Tách mã vùng từ mã hàng hoá, tính tồn kho cuối kỳ, cảnh báo thiếu hàng và tra cứu phụ phí vận chuyển từ trang BangGia.',
    scenarioEn: 'Extract region codes with LEFT, compute ending stock, add low-stock IF alerts, VLOOKUP shipping surcharges, and format for landscape printing.',
    minutes: 8,
    difficulty: 'Trung bình',
    createStarter: buildInventoryStarter,
    tasks: [
      {
        id: 'e3-t1',
        domainId: 'excel-lookup',
        title: 'Trích mã vùng bằng hàm LEFT',
        titleEn: 'Extract region code with LEFT',
        instruction: 'Tại B3:B7 trên trang TonKho, dùng hàm LEFT lấy 2 ký tự đầu của Mã hàng ở cột A (ví dụ “=LEFT(A3,2)”).',
        instructionEn: 'In B3:B7, use “=LEFT(A3,2)” to extract the 2-character region prefix from column A.',
        copyTokens: ['=LEFT(A3,2)'],
        ribbonPath: 'Ô B3 → =LEFT(A3,2) rồi sao chép xuống B7',
        hint: 'Chọn ô B3, gõ =LEFT(A3,2) và sao chép công thức xuống B7.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TonKho') ?? primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 1));
            if (f.includes(`LEFT(A${i + 3},2)`)) matched++;
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
        titleEn: 'Calculate ending inventory in F3:F7',
        instruction: 'Tại F3:F7, nhập công thức tính Tồn cuối bằng Tồn đầu (D) trừ Xuất kho (E), ví dụ “=D3-E3”.',
        instructionEn: 'In F3:F7, subtract Issued (E) from Opening Stock (D) using “=D3-E3”.',
        copyTokens: ['=D3-E3'],
        ribbonPath: 'Ô F3 → =D3-E3 rồi sao chép xuống F7',
        hint: 'Chọn ô F3, gõ =D3-E3 rồi sao chép xuống F7.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TonKho') ?? primarySheet(content.workbook);
          const expected = [15, 38, 12, 38, 9];
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const cell = cellAt(sheet, i + 2, 5);
            const f = formulaOf(cell);
            if (f.includes(`D${i + 3}-E${i + 3}`) || (f.startsWith('=') && isNear(numericOf(cell), expected[i], 0.1))) matched++;
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
        titleEn: 'Low-stock warning with IF',
        instruction: 'Tại G3:G7, dùng hàm IF kiểm tra nếu Tồn cuối < 20 thì hiện “Nhập thêm”, ngược lại hiện “Ổn định”.',
        instructionEn: 'In G3:G7, use IF to display “Nhập thêm” when ending stock < 20, else “Ổn định”.',
        copyTokens: ['=IF(F3<20,"Nhập thêm","Ổn định")'],
        ribbonPath: 'Ô G3 → =IF(F3<20,"Nhập thêm","Ổn định")',
        hint: 'Chọn G3, nhập =IF(F3<20,"Nhập thêm","Ổn định") rồi sao chép xuống G7.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TonKho') ?? primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 6));
            if (f.includes('IF(') && f.includes(`F${i + 3}`) && f.includes('20')) matched++;
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
        titleEn: 'Lookup shipping fees with VLOOKUP',
        instruction: 'Tại H3:H7, dùng VLOOKUP tra cứu Mã vùng (B) trong bảng “BangGia!$A$2:$B$5”, trả về cột 2 (khớp chính xác FALSE/0).',
        instructionEn: 'In H3:H7, use “=VLOOKUP(B3,BangGia!$A$2:$B$5,2,FALSE)” to look up fees from BangGia.',
        copyTokens: ['=VLOOKUP(B3,BangGia!$A$2:$B$5,2,FALSE)'],
        ribbonPath: 'Ô H3 → =VLOOKUP(B3,BangGia!$A$2:$B$5,2,FALSE)',
        hint: 'Chọn H3, nhập =VLOOKUP(B3,BangGia!$A$2:$B$5,2,FALSE) rồi kéo xuống H7.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TonKho') ?? primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 7));
            if (f.includes('VLOOKUP(') && f.includes(`B${i + 3}`) && f.includes('BANGGIA!') && f.includes(',2,')) matched++;
          }
          return matched === 5
            ? { passed: true, detail: 'Cả 5 ô H3:H7 đã dùng VLOOKUP tra cứu từ trang BangGia.' }
            : { passed: false, detail: `Mới đúng ${matched}/5 ô công thức VLOOKUP tại H3:H7.` };
        },
      },
      {
        id: 'e3-t5',
        domainId: 'excel-format',
        title: 'Định dạng số tiền và hướng in ngang',
        titleEn: 'Apply thousand separator format and Landscape print',
        instruction: 'Áp dụng định dạng số có dấu phân tách hàng nghìn (#,##0) cho H3:H7 và đặt hướng trang in là Ngang (Landscape).',
        instructionEn: 'Apply #,##0 number formatting to H3:H7 and set print orientation to Landscape.',
        ribbonPath: 'Home → Định dạng số (#,##0) · Page Layout → Hướng trang → Ngang',
        hint: 'Bôi chọn H3:H7 bấm định dạng số dấu phẩy trên Home; sau đó vào Page Layout đổi Hướng trang sang Ngang.',
        points: 20,
        check: (content) => {
          const sheet = findSheet(content.workbook, 'TonKho') ?? primarySheet(content.workbook);
          let formatted = 0;
          for (let i = 0; i < 5; i++) {
            const pattern = resolveStyle(content.workbook, cellAt(sheet, i + 2, 7))?.n?.pattern ?? '';
            if (pattern.includes('#') || pattern.includes(',0') || pattern.includes('₫') || pattern.includes('$')) formatted++;
          }
          const landscape = content.printSettings?.orientation === 'landscape';
          if (formatted >= 5 && landscape) return { passed: true, detail: 'Đã định dạng số tiền vùng H3:H7 và chuyển hướng in Ngang.' };
          return { passed: false, detail: formatted < 5 ? `Mới định dạng số ${formatted}/5 ô ở H3:H7.` : 'Hướng in vẫn đang là Dọc.' };
        },
      },
    ],
  },
  {
    id: 'excel-payroll-nov',
    track: 'excel',
    level: 'associate',
    kind: 'sheet',
    order: 4,
    title: 'Bảng Tính Lương Nhân sự Tháng 11',
    titleEn: 'November Staff Payroll Sheet',
    fileName: 'BangLuong_Thang11.xlsx',
    scenario: 'Tính lương chính, tổng thu nhập, mức lương thấp nhất, số nhân sự bằng hàm MIN/COUNTA và gộp dòng tiêu đề bảng lương.',
    scenarioEn: 'Compute base pay, total pay, minimum pay (MIN), headcount (COUNTA), and merge the payroll title.',
    minutes: 7,
    difficulty: 'Cơ bản',
    createStarter: buildPayrollStarter,
    tasks: [
      {
        id: 'e4a-t1',
        domainId: 'excel-formulas',
        title: 'Tính Lương chính tại E3:E7',
        titleEn: 'Calculate Base Pay in E3:E7',
        instruction: 'Tại E3:E7, nhập công thức nhân Lương ngày (C) với Ngày công (D), ví dụ “=C3*D3”.',
        instructionEn: 'In E3:E7, multiply Daily Rate (C) by Days Worked (D) using “=C3*D3”.',
        copyTokens: ['=C3*D3'],
        ribbonPath: 'Ô E3 → =C3*D3 rồi kéo xuống E7',
        hint: 'Chọn E3, gõ =C3*D3 rồi kéo xuống E7.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 4));
            if (f.includes(`C${i + 3}*D${i + 3}`) || f.includes(`D${i + 3}*C${i + 3}`)) matched++;
          }
          return matched === 5 ? { passed: true, detail: 'Đã tính Lương chính đúng cho 5 nhân sự.' } : { passed: false, detail: `Mới đúng ${matched}/5 ô tại E3:E7.` };
        },
      },
      {
        id: 'e4a-t2',
        domainId: 'excel-formulas',
        title: 'Tính Tổng lĩnh tại G3:G7',
        titleEn: 'Calculate Net Total Pay in G3:G7',
        instruction: 'Tại G3:G7, tính Tổng lĩnh bằng Lương chính (E) cộng Thưởng (F), ví dụ “=E3+F3” hoặc “=SUM(E3:F3)”.',
        instructionEn: 'In G3:G7, add Base Pay (E) and Bonus (F) using “=E3+F3” or “=SUM(E3:F3)”.',
        copyTokens: ['=E3+F3'],
        ribbonPath: 'Ô G3 → =E3+F3 rồi kéo xuống G7',
        hint: 'Chọn G3, nhập =E3+F3 (hoặc =SUM(E3:F3)) rồi kéo xuống G7.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const r = i + 3;
            const f = formulaOf(cellAt(sheet, i + 2, 6));
            if (f.includes(`E${r}+F${r}`) || f.includes(`F${r}+E${r}`) || f.includes(`SUM(E${r}:F${r})`)) matched++;
          }
          return matched === 5 ? { passed: true, detail: 'Đã tính Tổng lĩnh cho cả 5 nhân sự.' } : { passed: false, detail: `Mới đúng ${matched}/5 ô tại G3:G7.` };
        },
      },
      {
        id: 'e4a-t3',
        domainId: 'excel-formulas',
        title: 'Tìm mức lương thấp nhất bằng MIN',
        titleEn: 'Find minimum Total Pay with MIN',
        instruction: 'Tại ô B9, dùng hàm MIN tìm mức Tổng lĩnh thấp nhất trong vùng G3:G7 (“=MIN(G3:G7)”).',
        instructionEn: 'In B9, use “=MIN(G3:G7)” to find the lowest Total Pay.',
        copyTokens: ['=MIN(G3:G7)'],
        ribbonPath: 'Ô B9 → =MIN(G3:G7)',
        hint: 'Chọn B9, nhập =MIN(G3:G7) rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const f = formulaOf(cellAt(primarySheet(content.workbook), 8, 1));
          return f.includes('MIN(') && f.includes('G3:G7')
            ? { passed: true, detail: 'Ô B9 đã dùng hàm MIN(G3:G7) chính xác.' }
            : { passed: false, detail: 'Ô B9 chưa có công thức =MIN(G3:G7).' };
        },
      },
      {
        id: 'e4a-t4',
        domainId: 'excel-formulas',
        title: 'Đếm số nhân sự bằng COUNTA',
        titleEn: 'Count employees with COUNTA',
        instruction: 'Tại ô B10, dùng hàm COUNTA đếm số nhân viên dựa trên cột Mã NV A3:A7 (“=COUNTA(A3:A7)”).',
        instructionEn: 'In B10, use “=COUNTA(A3:A7)” to count total staff.',
        copyTokens: ['=COUNTA(A3:A7)'],
        ribbonPath: 'Ô B10 → =COUNTA(A3:A7)',
        hint: 'Chọn B10, gõ =COUNTA(A3:A7) rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const f = formulaOf(cellAt(primarySheet(content.workbook), 9, 1));
          return (f.includes('COUNTA(') || f.includes('COUNT(')) && (f.includes('A3:A7') || f.includes('B3:B7'))
            ? { passed: true, detail: 'Ô B10 đã dùng hàm đếm nhân sự chính xác.' }
            : { passed: false, detail: 'Ô B10 chưa có công thức COUNTA(A3:A7).' };
        },
      },
      {
        id: 'e4a-t5',
        domainId: 'excel-format',
        title: 'Gộp tiêu đề A1:G1 và ẩn đường lưới in',
        titleEn: 'Merge A1:G1 and hide print gridlines',
        instruction: 'Gộp vùng ô tiêu đề A1:G1 và tắt in đường lưới (Gridlines) hoặc bật hướng in Ngang.',
        instructionEn: 'Merge cells A1:G1 and switch print orientation to Landscape or hide print gridlines.',
        ribbonPath: 'Home → Gộp ô (A1:G1) · Page Layout → Hướng trang / Đường lưới',
        hint: 'Bôi chọn A1:G1 bấm Gộp ô; sau đó vào Page Layout đổi Hướng trang sang Ngang (hoặc bỏ tick In đường lưới).',
        points: 20,
        check: (content) => {
          const merged = (primarySheet(content.workbook)?.mergeData ?? []).some((m) => m.startRow === 0 && m.endRow === 0 && m.startColumn === 0 && m.endColumn === 6);
          const printOk = content.printSettings?.orientation === 'landscape' || content.printSettings?.showGridlines === false;
          if (merged && printOk) return { passed: true, detail: 'Đã gộp A1:G1 và cập nhật thiết lập in.' };
          return { passed: false, detail: !merged ? 'Vùng A1:G1 chưa được gộp.' : 'Chưa đổi hướng in Ngang hoặc tắt đường lưới in.' };
        },
      },
    ],
  },
  {
    id: 'excel-text-clean',
    track: 'excel',
    level: 'associate',
    kind: 'sheet',
    order: 5,
    title: 'Chuẩn hoá Dữ liệu Văn bản Khách hàng',
    titleEn: 'Customer Text Normalization',
    fileName: 'ChuanHoa_KhachHang.xlsx',
    scenario: 'Làm sạch bảng khách hàng bằng các hàm xử lý chuỗi chuẩn MOS: PROPER, UPPER, LEN, ghép nối họ tên và cố định cột đầu tiên.',
    scenarioEn: 'Clean customer strings using PROPER/CONCAT, UPPER, LEN, freeze column A, and rename the worksheet.',
    minutes: 7,
    difficulty: 'Trung bình',
    createStarter: buildTextCleanStarter,
    tasks: [
      {
        id: 'e5a-t1',
        domainId: 'excel-lookup',
        title: 'Ghép Họ và Tên chuẩn hoá tại C3:C6',
        titleEn: 'Combine First and Last Name in C3:C6',
        instruction: 'Tại C3:C6, ghép Họ (A) và Tên (B) có dấu cách ở giữa bằng toán tử & hoặc hàm CONCAT / PROPER (ví dụ “=PROPER(A3&" "&B3)”).',
        instructionEn: 'In C3:C6, combine columns A and B with a space using “=PROPER(A3&" "&B3)” or CONCAT.',
        copyTokens: ['=PROPER(A3&" "&B3)'],
        ribbonPath: 'Ô C3 → =PROPER(A3&" "&B3) rồi kéo xuống C6',
        hint: 'Chọn C3, nhập =PROPER(A3&" "&B3) hoặc =CONCAT(A3," ",B3) rồi kéo xuống C6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 4; i++) {
            const r = i + 3;
            const f = formulaOf(cellAt(sheet, i + 2, 2));
            if (f.includes(`A${r}`) && f.includes(`B${r}`) && (f.includes('&') || f.includes('CONCAT'))) matched++;
          }
          return matched === 4 ? { passed: true, detail: 'Đã ghép Họ Tên bằng công thức cho cả 4 dòng.' } : { passed: false, detail: `Mới đúng ${matched}/4 ô tại C3:C6.` };
        },
      },
      {
        id: 'e5a-t2',
        domainId: 'excel-lookup',
        title: 'Chuyển Mã khu vực sang chữ IN HOA (UPPER)',
        titleEn: 'Convert region codes to uppercase with UPPER',
        instruction: 'Tại E3:E6, dùng hàm UPPER viết hoa toàn bộ Mã khu vực ở cột D (ví dụ “=UPPER(D3)”).',
        instructionEn: 'In E3:E6, convert column D codes to uppercase using “=UPPER(D3)”.',
        copyTokens: ['=UPPER(D3)'],
        ribbonPath: 'Ô E3 → =UPPER(D3) rồi kéo xuống E6',
        hint: 'Chọn E3, nhập =UPPER(D3) rồi sao chép xuống E6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 4; i++) {
            if (formulaOf(cellAt(sheet, i + 2, 4)).includes(`UPPER(D${i + 3})`)) matched++;
          }
          return matched === 4 ? { passed: true, detail: 'Cả 4 ô E3:E6 đã dùng hàm UPPER.' } : { passed: false, detail: `Mới đúng ${matched}/4 ô dùng hàm UPPER.` };
        },
      },
      {
        id: 'e5a-t3',
        domainId: 'excel-lookup',
        title: 'Đếm số ký tự mã bằng hàm LEN',
        titleEn: 'Measure code length with LEN',
        instruction: 'Tại F3:F6, dùng hàm LEN đếm số ký tự của Mã khu vực ở cột D (ví dụ “=LEN(D3)”).',
        instructionEn: 'In F3:F6, use “=LEN(D3)” to measure each code length.',
        copyTokens: ['=LEN(D3)'],
        ribbonPath: 'Ô F3 → =LEN(D3) rồi kéo xuống F6',
        hint: 'Chọn F3, nhập =LEN(D3) rồi kéo xuống F6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 4; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 5));
            if (f.includes(`LEN(D${i + 3})`) || f.includes(`LEN(E${i + 3})`)) matched++;
          }
          return matched === 4 ? { passed: true, detail: 'Cả 4 ô F3:F6 đã dùng hàm LEN chính xác.' } : { passed: false, detail: `Mới đúng ${matched}/4 ô dùng hàm LEN.` };
        },
      },
      {
        id: 'e5a-t4',
        domainId: 'excel-manage',
        title: 'Cố định cột đầu tiên (Freeze First Column)',
        titleEn: 'Freeze the first column',
        instruction: 'Cố định ít nhất cột A (Freeze First Column) để cột Họ luôn hiển thị khi cuộn ngang.',
        instructionEn: 'Freeze at least Column A so it stays visible while scrolling horizontally.',
        ribbonPath: 'View (Xem) → Cố định khung → Cố định cột đầu tiên',
        hint: 'Vào thẻ View → Cố định khung → chọn Cố định cột đầu tiên.',
        points: 20,
        check: (content) =>
          (primarySheet(content.workbook)?.freeze?.xSplit ?? 0) >= 1
            ? { passed: true, detail: 'Đã cố định cột đầu tiên.' }
            : { passed: false, detail: 'Chưa cố định cột đầu tiên (xSplit = 0).' },
      },
      {
        id: 'e5a-t5',
        domainId: 'excel-manage',
        title: 'Đổi tên trang tính thành DanhBa',
        titleEn: 'Rename sheet to DanhBa',
        instruction: 'Đổi tên trang tính “KhachHang” thành “DanhBa”.',
        instructionEn: 'Rename the worksheet “KhachHang” to “DanhBa”.',
        copyTokens: ['DanhBa'],
        ribbonPath: 'Nhấp đúp thẻ KhachHang → gõ DanhBa',
        hint: 'Nhấp đúp tên tab “KhachHang” phía dưới, nhập DanhBa rồi Enter.',
        points: 20,
        check: (content) =>
          findSheet(content.workbook, 'DanhBa')
            ? { passed: true, detail: 'Đã đổi tên trang tính thành DanhBa.' }
            : { passed: false, detail: 'Chưa tìm thấy trang tính tên DanhBa.' },
      },
    ],
  },
  {
    id: 'excel-budget-variance',
    track: 'excel',
    level: 'associate',
    kind: 'sheet',
    order: 6,
    title: 'Ngân sách & Tỷ trọng Chi tiêu',
    titleEn: 'Budget Variance & Expense Ratio',
    fileName: 'NganSach_ChiTieu.xlsx',
    scenario: 'Tính chênh lệch dự toán – thực chi, tính tổng cộng bằng SUM, tính tỷ lệ thực chi theo phần trăm (%) và thiết lập in vừa 1 trang.',
    scenarioEn: 'Compute budget variance, total rows with SUM, percentage execution rates with % format, and enable Fit to Page.',
    minutes: 7,
    difficulty: 'Trung bình',
    createStarter: buildExpenseStarter,
    tasks: [
      {
        id: 'e6a-t1',
        domainId: 'excel-formulas',
        title: 'Tính Chênh lệch tại D3:D6',
        titleEn: 'Calculate Budget Variance in D3:D6',
        instruction: 'Tại D3:D6, tính Chênh lệch bằng Dự toán (B) trừ Thực chi (C), ví dụ “=B3-C3”.',
        instructionEn: 'In D3:D6, calculate Budget (B) minus Actual (C) using “=B3-C3”.',
        copyTokens: ['=B3-C3'],
        ribbonPath: 'Ô D3 → =B3-C3 rồi kéo xuống D6',
        hint: 'Chọn D3, nhập =B3-C3 rồi sao chép xuống D6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 4; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 3));
            if (f.includes(`B${i + 3}-C${i + 3}`) || f.includes(`C${i + 3}-B${i + 3}`)) matched++;
          }
          return matched === 4 ? { passed: true, detail: 'Đã tính Chênh lệch cho cả 4 hạng mục.' } : { passed: false, detail: `Mới đúng ${matched}/4 ô tại D3:D6.` };
        },
      },
      {
        id: 'e6a-t2',
        domainId: 'excel-formulas',
        title: 'Tính Tỷ lệ thực chi tại E3:E6',
        titleEn: 'Calculate Actual/Budget ratio in E3:E6',
        instruction: 'Tại E3:E6, nhập công thức chia Thực chi (C) cho Dự toán (B), ví dụ “=C3/B3”.',
        instructionEn: 'In E3:E6, divide Actual (C) by Budget (B) using “=C3/B3”.',
        copyTokens: ['=C3/B3'],
        ribbonPath: 'Ô E3 → =C3/B3 rồi kéo xuống E6',
        hint: 'Chọn E3, gõ =C3/B3 rồi kéo xuống E6.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 4; i++) {
            if (formulaOf(cellAt(sheet, i + 2, 4)).includes(`C${i + 3}/B${i + 3}`)) matched++;
          }
          return matched === 4 ? { passed: true, detail: 'Đã tính tỷ lệ thực chi tại E3:E6.' } : { passed: false, detail: `Mới đúng ${matched}/4 ô tại E3:E6.` };
        },
      },
      {
        id: 'e6a-t3',
        domainId: 'excel-format',
        title: 'Định dạng Phần trăm (%) cho E3:E6',
        titleEn: 'Apply Percentage format to E3:E6',
        instruction: 'Áp dụng định dạng Phần trăm (%) cho toàn bộ vùng E3:E6.',
        instructionEn: 'Format the cell range E3:E6 as Percentage (%).',
        ribbonPath: 'Home → Định dạng số → %',
        hint: 'Bôi chọn E3:E6 rồi bấm biểu tượng % trên thẻ Home.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let count = 0;
          for (let i = 0; i < 4; i++) {
            if ((resolveStyle(content.workbook, cellAt(sheet, i + 2, 4))?.n?.pattern ?? '').includes('%')) count++;
          }
          return count === 4 ? { passed: true, detail: 'Đã áp dụng định dạng % cho E3:E6.' } : { passed: false, detail: `Mới định dạng % cho ${count}/4 ô ở E3:E6.` };
        },
      },
      {
        id: 'e6a-t4',
        domainId: 'excel-formulas',
        title: 'Tính tổng dòng 7 (B7, C7, D7) bằng SUM',
        titleEn: 'Sum columns B, C, and D on row 7',
        instruction: 'Tại B7 nhập “=SUM(B3:B6)”, tại C7 nhập “=SUM(C3:C6)” và tại D7 nhập “=SUM(D3:D6)”.',
        instructionEn: 'Enter SUM formulas in B7, C7, and D7 for rows 3 through 6.',
        copyTokens: ['=SUM(B3:B6)', '=SUM(C3:C6)', '=SUM(D3:D6)'],
        ribbonPath: 'Ô B7, C7, D7 → AutoSum',
        hint: 'Nhập lần lượt =SUM(B3:B6) tại B7, =SUM(C3:C6) tại C7 và =SUM(D3:D6) tại D7.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          const okB = formulaOf(cellAt(sheet, 6, 1)).includes('SUM(B3:B6)');
          const okC = formulaOf(cellAt(sheet, 6, 2)).includes('SUM(C3:C6)');
          const okD = formulaOf(cellAt(sheet, 6, 3)).includes('SUM(D3:D6)');
          return okB && okC && okD
            ? { passed: true, detail: 'Cả 3 ô tổng B7, C7, D7 đều chính xác.' }
            : { passed: false, detail: 'Chưa đủ công thức SUM tại cả 3 ô B7, C7 và D7.' };
        },
      },
      {
        id: 'e6a-t5',
        domainId: 'excel-format',
        title: 'Bật thu gọn in vừa 1 trang (Fit to Page)',
        titleEn: 'Enable Fit to Page for printing',
        instruction: 'Bật chế độ thu gọn bảng tính vừa trong 1 trang in (Fit to Page).',
        instructionEn: 'Configure Page Setup to Fit Sheet on One Page.',
        ribbonPath: 'Page Layout → Tỷ lệ → Vừa 1 trang',
        hint: 'Mở thẻ Page Layout (hoặc In / PDF), chọn Vừa 1 trang (Fit to Page).',
        points: 20,
        check: (content) => {
          const ps = content.printSettings;
          return ps?.fitToPage || ps?.scaleMode === 'fit-page' || ps?.scaleMode === 'fit-width'
            ? { passed: true, detail: 'Đã bật chế độ in vừa trang.' }
            : { passed: false, detail: 'Chưa bật thu gọn vừa trang in.' };
        },
      },
    ],
  },
  {
    id: 'excel-order-audit',
    track: 'excel',
    level: 'associate',
    kind: 'sheet',
    order: 7,
    title: 'Kiểm toán Đơn hàng & Kênh Bán',
    titleEn: 'Order Audit & Channel Discounts',
    fileName: 'KiemToan_DonHang.xlsx',
    scenario: 'Hoàn tất bảng kiểm toán đơn hàng với chiết khấu 5%, tổng thanh toán, thống kê kênh Online bằng SUMIF/COUNTIF và gộp tiêu đề báo cáo.',
    scenarioEn: 'Compute 5% discounts, net payments, Online channel SUMIF/COUNTIF summaries, and merge the header row.',
    minutes: 7,
    difficulty: 'Nâng cao',
    createStarter: buildOrderAuditStarter,
    tasks: [
      {
        id: 'e7a-t1',
        domainId: 'excel-formulas',
        title: 'Tính Chiết khấu 5% tại D3:D7',
        titleEn: 'Calculate 5% discount in D3:D7',
        instruction: 'Tại D3:D7, nhập công thức tính 5% của Giá trị đơn ở cột C (ví dụ “=C3*5%” hoặc “=C3*0.05”).',
        instructionEn: 'In D3:D7, compute 5% of column C using “=C3*5%” or “=C3*0.05”.',
        copyTokens: ['=C3*5%'],
        ribbonPath: 'Ô D3 → =C3*5% rồi kéo xuống D7',
        hint: 'Chọn D3, gõ =C3*5% (hoặc =C3*0.05) rồi sao chép xuống D7.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            const f = formulaOf(cellAt(sheet, i + 2, 3));
            if (f.includes(`C${i + 3}`) && (f.includes('5%') || f.includes('0.05'))) matched++;
          }
          return matched === 5 ? { passed: true, detail: 'Đã tính chiết khấu 5% cho cả 5 đơn hàng.' } : { passed: false, detail: `Mới đúng ${matched}/5 ô tại D3:D7.` };
        },
      },
      {
        id: 'e7a-t2',
        domainId: 'excel-formulas',
        title: 'Tính Thanh toán tại E3:E7',
        titleEn: 'Calculate Net Payment in E3:E7',
        instruction: 'Tại E3:E7, tính Thanh toán bằng Giá trị đơn (C) trừ Chiết khấu (D), ví dụ “=C3-D3”.',
        instructionEn: 'In E3:E7, subtract Discount (D) from Order Value (C) using “=C3-D3”.',
        copyTokens: ['=C3-D3'],
        ribbonPath: 'Ô E3 → =C3-D3 rồi kéo xuống E7',
        hint: 'Chọn E3, nhập =C3-D3 rồi kéo xuống E7.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          let matched = 0;
          for (let i = 0; i < 5; i++) {
            if (formulaOf(cellAt(sheet, i + 2, 4)).includes(`C${i + 3}-D${i + 3}`)) matched++;
          }
          return matched === 5 ? { passed: true, detail: 'Cả 5 ô E3:E7 đã tính số tiền thanh toán chính xác.' } : { passed: false, detail: `Mới đúng ${matched}/5 ô tại E3:E7.` };
        },
      },
      {
        id: 'e7a-t3',
        domainId: 'excel-formulas',
        title: 'Tổng giá trị đơn Online bằng SUMIF',
        titleEn: 'Sum Online orders with SUMIF',
        instruction: 'Tại B9, dùng SUMIF tính tổng Giá trị đơn (C3:C7) cho các đơn thuộc kênh “Online” (B3:B7).',
        instructionEn: 'In B9, use “=SUMIF(B3:B7,"Online",C3:C7)” to sum Online orders.',
        copyTokens: ['=SUMIF(B3:B7,"Online",C3:C7)'],
        ribbonPath: 'Ô B9 → =SUMIF(B3:B7,"Online",C3:C7)',
        hint: 'Chọn B9, gõ =SUMIF(B3:B7,"Online",C3:C7) rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const f = formulaOf(cellAt(primarySheet(content.workbook), 8, 1));
          return f.includes('SUMIF(') && f.includes('B3:B7') && f.includes('ONLINE') && (f.includes('C3:C7') || f.includes('E3:E7'))
            ? { passed: true, detail: 'Ô B9 đã dùng SUMIF tính tổng kênh Online chính xác.' }
            : { passed: false, detail: 'Ô B9 chưa có công thức SUMIF theo kênh “Online”.' };
        },
      },
      {
        id: 'e7a-t4',
        domainId: 'excel-formulas',
        title: 'Đếm số đơn Online bằng COUNTIF',
        titleEn: 'Count Online orders with COUNTIF',
        instruction: 'Tại B10, dùng COUNTIF đếm số đơn thuộc kênh “Online” trong vùng B3:B7.',
        instructionEn: 'In B10, use “=COUNTIF(B3:B7,"Online")” to count Online orders.',
        copyTokens: ['=COUNTIF(B3:B7,"Online")'],
        ribbonPath: 'Ô B10 → =COUNTIF(B3:B7,"Online")',
        hint: 'Chọn B10, gõ =COUNTIF(B3:B7,"Online") rồi nhấn Enter.',
        points: 20,
        check: (content) => {
          const f = formulaOf(cellAt(primarySheet(content.workbook), 9, 1));
          return f.includes('COUNTIF(') && f.includes('B3:B7') && f.includes('ONLINE')
            ? { passed: true, detail: 'Ô B10 đã dùng COUNTIF đếm đơn Online.' }
            : { passed: false, detail: 'Ô B10 chưa có công thức =COUNTIF(B3:B7,"Online").' };
        },
      },
      {
        id: 'e7a-t5',
        domainId: 'excel-format',
        title: 'Gộp tiêu đề A1:E1 và cố định 2 dòng đầu',
        titleEn: 'Merge A1:E1 and freeze top 2 rows',
        instruction: 'Gộp vùng ô tiêu đề A1:E1 và cố định 2 dòng đầu tiên (Freeze Panes).',
        instructionEn: 'Merge A1:E1 and freeze the top 2 rows.',
        ribbonPath: 'Home → Gộp ô (A1:E1) · View → Cố định 2 dòng đầu',
        hint: 'Gộp vùng A1:E1 trên thẻ Home, rồi vào thẻ View chọn Cố định 2 dòng đầu.',
        points: 20,
        check: (content) => {
          const sheet = primarySheet(content.workbook);
          const merged = (sheet?.mergeData ?? []).some((m) => m.startRow === 0 && m.endRow === 0 && m.startColumn === 0 && m.endColumn === 4);
          const frozen = (sheet?.freeze?.ySplit ?? 0) >= 2;
          if (merged && frozen) return { passed: true, detail: 'Đã gộp A1:E1 và cố định 2 dòng đầu.' };
          return { passed: false, detail: !merged ? 'Vùng A1:E1 chưa được gộp.' : 'Chưa cố định 2 dòng đầu.' };
        },
      },
    ],
  },
];
