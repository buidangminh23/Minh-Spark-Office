import type { JSONContent } from '@tiptap/react';
import { emptySheet, emptyWorkbook, uid } from './workbookBasics';
import type { WorkbookData } from './sheetTypes';

export const blankDoc = (): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph' }] });

export const sampleDocHtml = () => `
<p style="text-align: center"><span style="font-size: 10pt; color: #8a94a6">CÔNG TY MINH SPARK · BÁO CÁO NỘI BỘ</span></p>
<h1 style="text-align: center">Kế hoạch hoạt động quý IV/2026</h1>
<p style="text-align: center"><em>Ngày lập: ${new Date().toLocaleDateString('vi-VN')}</em></p>
<h2>1. Mục tiêu</h2>
<p>Tài liệu này tổng hợp định hướng, nguồn lực và các mốc chính cho quý IV. Mọi số liệu được cập nhật từ bảng tính theo dõi chung.</p>
<ul><li><p>Tăng trưởng doanh thu <strong>15%</strong> so với quý III.</p></li><li><p>Hoàn thiện bộ công cụ văn phòng nội bộ <mark data-color="#fff59d" style="background-color: #fff59d">Minh Office</mark>.</p></li><li><p>Chuẩn hoá quy trình báo cáo tuần.</p></li></ul>
<h2>2. Ngân sách dự kiến</h2>
<table><tbody>
<tr><th><p>Hạng mục</p></th><th><p>Phụ trách</p></th><th><p>Ngân sách (triệu đồng)</p></th></tr>
<tr><td><p>Phát triển sản phẩm</p></td><td><p>Nhóm kỹ thuật</p></td><td><p>320</p></td></tr>
<tr><td><p>Marketing</p></td><td><p>Nhóm tăng trưởng</p></td><td><p>180</p></td></tr>
<tr><td><p>Vận hành</p></td><td><p>Văn phòng</p></td><td><p>95</p></td></tr>
</tbody></table>
<h2>3. Lịch triển khai</h2>
<ol><li><p>Tháng 10: chốt phạm vi và phân công.</p></li><li><p>Tháng 11: triển khai, kiểm thử nội bộ.</p></li><li><p>Tháng 12: tổng kết và lập kế hoạch năm mới.</p></li></ol>
<blockquote><p>“Làm ít việc hơn, nhưng làm đến nơi đến chốn.”</p></blockquote>
<h3>Việc cần làm</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Gửi bản nháp cho ban giám đốc</p></li><li data-type="taskItem" data-checked="false"><p>Cập nhật số liệu tháng 11</p></li></ul>
`;

export const contractDocHtml = () => `
<p style="text-align: center"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br><em>Độc lập – Tự do – Hạnh phúc</em></p>
<p style="text-align: center">------------------------</p>
<h1 style="text-align: center">HỢP ĐỒNG DỊCH VỤ CÔNG NGHỆ</h1>
<p style="text-align: center"><em>Số: 01/2026/HĐDV-MS</em></p>
<p><em>Hôm nay, ngày ${new Date().toLocaleDateString('vi-VN')}, tại Văn phòng Công ty, chúng tôi gồm có:</em></p>
<h2>BÊN A: BÊN YÊU CẦU DỊCH VỤ (KHÁCH HÀNG)</h2>
<ul>
  <li><strong>Đơn vị:</strong> CÔNG TY TNHH ĐẦU TƯ & THƯƠNG MẠI MINH SPARK</li>
  <li><strong>Đại diện:</strong> Ông Nguyễn Văn A - Chức vụ: Giám đốc</li>
  <li><strong>Địa chỉ:</strong> Hà Nội, Việt Nam</li>
  <li><strong>Điện thoại:</strong> (+84) 988 123 456</li>
</ul>
<h2>BÊN B: BÊN CUNG CẤP DỊCH VỤ</h2>
<ul>
  <li><strong>Đơn vị:</strong> ĐỐI TÁC CÔNG NGHỆ & PHẦN MỀM</li>
  <li><strong>Đại diện:</strong> Trưởng nhóm giải pháp</li>
  <li><strong>Lĩnh vực:</strong> Phát triển phần mềm & Giải pháp văn phòng</li>
</ul>
<h2>ĐIỀU 1: NỘI DUNG VÀ PHẠM VI CÔNG VIỆC</h2>
<p>Bên A đồng ý thuê và Bên B đồng ý thực hiện cung cấp giải pháp bộ ứng dụng văn phòng trực tuyến tích hợp đầy đủ công cụ soạn thảo tài liệu chuẩn Word và bảng tính chuẩn Excel.</p>
<h2>ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN</h2>
<table><tbody>
<tr><th><p>Giai đoạn</p></th><th><p>Nội dung nghiệm thu</p></th><th><p>Tỷ lệ thanh toán</p></th></tr>
<tr><td><p>Giai đoạn 1</p></td><td><p>Khảo sát, thiết kế giao diện và kiến trúc hệ thống</p></td><td><p>30%</p></td></tr>
<tr><td><p>Giai đoạn 2</p></td><td><p>Hoàn thiện module Word & Excel, kiểm thử tính năng</p></td><td><p>50%</p></td></tr>
<tr><td><p>Giai đoạn 3</p></td><td><p>Bàn giao toàn bộ source code và tài liệu kỹ thuật</p></td><td><p>20%</p></td></tr>
</tbody></table>
<h2>ĐIỀU 3: CAM KẾT VÀ BẢO HÀNH</h2>
<p>Bên B cam kết toàn bộ dữ liệu người dùng được bảo vệ an toàn 100% tại máy trạm, mã hoá hoàn toàn chuẩn quân sự ECMA-376 và không rò rỉ ra máy chủ bên thứ ba.</p>
<p><br></p>
<table style="border: none"><tbody>
<tr style="border: none">
<td style="border: none; text-align: center; width: 50%"><p><strong>ĐẠI DIỆN BÊN A</strong><br><em>(Ký, ghi rõ họ tên)</em></p></td>
<td style="border: none; text-align: center; width: 50%"><p><strong>ĐẠI DIỆN BÊN B</strong><br><em>(Ký, ghi rõ họ tên)</em></p></td>
</tr>
</tbody></table>
`;

export const meetingMinutesDocHtml = () => `
<h1 style="text-align: center">BIÊN BẢN CUỘC HỌP GIAO BAN TUẦN</h1>
<p style="text-align: center"><em>Thời gian: 09:00 - 11:30 | Ngày: ${new Date().toLocaleDateString('vi-VN')}</em></p>
<h2>1. Thành phần tham dự</h2>
<ul>
  <li><strong>Chủ trì:</strong> Nguyễn Văn A</li>
  <li><strong>Thư ký:</strong> Ban Văn phòng</li>
  <li><strong>Thành viên:</strong> Toàn thể kỹ thuật viên và nhân sự vận hành</li>
</ul>
<h2>2. Nội dung thảo luận</h2>
<ol>
  <li>Đánh giá tiến độ triển khai sản phẩm bộ phần mềm văn phòng Minh Spark Office.</li>
  <li>Thử nghiệm tính năng nhập xuất tệp Word và Excel bảo mật cao.</li>
  <li>Kế hoạch tối ưu trải nghiệm người dùng và mở rộng tính năng.</li>
</ol>
<h2>3. Kết luận và Phân công hành động</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><p>Hoàn thiện bộ Ribbon đầy đủ tính năng chuẩn Office 365</p></li>
  <li data-type="taskItem" data-checked="true"><p>Tích hợp bộ giải mã mật khẩu ECMA-376 tự động</p></li>
  <li data-type="taskItem" data-checked="false"><p>Tập huấn toàn diện cho các phòng ban sử dụng</p></li>
</ul>
`;

export const sampleWorkbook = (name: string): WorkbookData => {
  const workbook = emptyWorkbook(name);
  const sheet = workbook.sheets[workbook.sheetOrder[0]];
  sheet.name = 'Ngân sách';
  workbook.styles = {
    head: { bl: 1, bg: { rgb: '#267863' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    title: { bl: 1, fs: 16, cl: { rgb: '#1F3B30' } },
    money: { n: { pattern: '#,##0' } },
    pct: { n: { pattern: '0.0%' } },
    total: { bl: 1, bg: { rgb: '#EAF3EE' }, n: { pattern: '#,##0' } },
    totalLabel: { bl: 1, bg: { rgb: '#EAF3EE' } },
  };
  const rows: (string | number | { f: string; s?: string } | null)[][] = [
    ['Hạng mục', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tổng quý', 'Tỷ trọng'],
    ['Nhân sự', 120000000, 125000000, 130000000, { f: '=SUM(B3:D3)', s: 'money' }, { f: '=E3/$E$8', s: 'pct' }],
    ['Marketing', 45000000, 60000000, 75000000, { f: '=SUM(B4:D4)', s: 'money' }, { f: '=E4/$E$8', s: 'pct' }],
    ['Văn phòng', 18000000, 18000000, 20000000, { f: '=SUM(B5:D5)', s: 'money' }, { f: '=E5/$E$8', s: 'pct' }],
    ['Công nghệ', 32000000, 28000000, 35000000, { f: '=SUM(B6:D6)', s: 'money' }, { f: '=E6/$E$8', s: 'pct' }],
    ['Khác', 9000000, 7500000, 12000000, { f: '=SUM(B7:D7)', s: 'money' }, { f: '=E7/$E$8', s: 'pct' }],
    [{ f: '="Tổng cộng"', s: 'totalLabel' }, { f: '=SUM(B3:B7)', s: 'total' }, { f: '=SUM(C3:C7)', s: 'total' }, { f: '=SUM(D3:D7)', s: 'total' }, { f: '=SUM(E3:E7)', s: 'total' }, { f: '=SUM(F3:F7)', s: 'pct' }],
  ];
  sheet.cellData[0] = { 0: { v: 'Ngân sách hoạt động quý IV/2026', t: 1, s: 'title' } };
  rows.forEach((row, rowIndex) => {
    const r = rowIndex + 1;
    sheet.cellData[r] = {};
    row.forEach((value, c) => {
      if (value === null) return;
      if (typeof value === 'object') sheet.cellData[r][c] = { f: value.f, s: value.s };
      else if (typeof value === 'number') sheet.cellData[r][c] = { v: value, t: 2, s: 'money' };
      else sheet.cellData[r][c] = { v: value, t: 1, s: r === 1 ? 'head' : undefined };
    });
  });
  sheet.cellData[9] = { 0: { v: 'Chi tiêu trung bình/tháng', t: 1 }, 1: { f: '=AVERAGE(B8:D8)', s: 'money' } };
  sheet.cellData[10] = { 0: { v: 'Tháng chi cao nhất', t: 1 }, 1: { f: '=INDEX(B2:D2,MATCH(MAX(B8:D8),B8:D8,0))' } };
  sheet.columnData = { 0: { w: 220 }, 1: { w: 130 }, 2: { w: 130 }, 3: { w: 130 }, 4: { w: 140 }, 5: { w: 100 } };
  sheet.rowData = { 0: { h: 36 }, 1: { h: 30 } };
  sheet.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 5 }];
  sheet.freeze = { xSplit: 1, ySplit: 2, startRow: 2, startColumn: 1 };
  const second = emptySheet('Ghi chú');
  second.cellData[0] = { 0: { v: 'Dùng tab này cho ghi chú, nhật ký thay đổi…', t: 1 } };
  workbook.sheetOrder.push(second.id);
  workbook.sheets[second.id] = second;
  workbook.id = uid('wb');
  return workbook;
};

export const payrollWorkbook = (): WorkbookData => {
  const workbook = emptyWorkbook('Bảng chấm công & lương');
  const sheet = workbook.sheets[workbook.sheetOrder[0]];
  sheet.name = 'Bảng lương T11';
  workbook.styles = {
    head: { bl: 1, bg: { rgb: '#1B5E20' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    title: { bl: 1, fs: 15, cl: { rgb: '#1B5E20' } },
    money: { n: { pattern: '#,##0' } },
    center: { ht: 2, vt: 2 },
    total: { bl: 1, bg: { rgb: '#E8F5E9' }, n: { pattern: '#,##0' } },
  };

  sheet.cellData[0] = { 0: { v: 'BẢNG CHẤM CÔNG VÀ THANH TOÁN LƯƠNG NHÂN SỰ', t: 1, s: 'title' } };

  const headers = ['Mã NV', 'Họ và tên', 'Chức vụ', 'Lương cơ bản', 'Ngày công', 'Phụ cấp', 'Tổng thu nhập', 'Thực lĩnh'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => {
    sheet.cellData[1][c] = { v: h, t: 1, s: 'head' };
  });

  const staff = [
    ['MS01', 'Nguyễn Văn A', 'Giám đốc', 50000000, 26, 5000000],
    ['MS02', 'Nguyễn Văn An', 'Trưởng phòng Kỹ thuật', 30000000, 25, 3000000],
    ['MS03', 'Trần Thị Bình', 'Kế toán trưởng', 25000000, 26, 2500000],
    ['MS04', 'Lê Hoàng Cường', 'Kỹ sư Fullstack', 22000000, 24, 2000000],
    ['MS05', 'Phạm Minh Đức', 'Chuyên viên Marketing', 18000000, 26, 1500000],
  ];

  staff.forEach((person, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = {
      0: { v: person[0] as string, t: 1, s: 'center' },
      1: { v: person[1] as string, t: 1 },
      2: { v: person[2] as string, t: 1 },
      3: { v: person[3] as number, t: 2, s: 'money' },
      4: { v: person[4] as number, t: 2, s: 'center' },
      5: { v: person[5] as number, t: 2, s: 'money' },
      6: { f: `=ROUND(D${r+1}*E${r+1}/26+F${r+1},0)`, s: 'money' },
      7: { f: `=G${r+1}`, s: 'money' },
    };
  });

  sheet.cellData[7] = {
    1: { v: 'TỔNG CỘNG', t: 1, s: 'head' },
    3: { f: '=SUM(D3:D7)', s: 'total' },
    5: { f: '=SUM(F3:F7)', s: 'total' },
    6: { f: '=SUM(G3:G7)', s: 'total' },
    7: { f: '=SUM(H3:H7)', s: 'total' },
  };

  sheet.columnData = { 0: { w: 90 }, 1: { w: 180 }, 2: { w: 180 }, 3: { w: 130 }, 4: { w: 100 }, 5: { w: 120 }, 6: { w: 140 }, 7: { w: 140 } };
  sheet.rowData = { 0: { h: 36 }, 1: { h: 32 } };
  sheet.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 7 }];
  return workbook;
};

export const salesKpiWorkbook = (): WorkbookData => {
  const workbook = emptyWorkbook('Báo cáo doanh số & KPI');
  const sheet = workbook.sheets[workbook.sheetOrder[0]];
  sheet.name = 'Doanh số 2026';
  workbook.styles = {
    head: { bl: 1, bg: { rgb: '#0D47A1' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    title: { bl: 1, fs: 15, cl: { rgb: '#0D47A1' } },
    money: { n: { pattern: '#,##0' } },
    pct: { n: { pattern: '0.0%' } },
    center: { ht: 2, vt: 2 },
    total: { bl: 1, bg: { rgb: '#E3F2FD' }, n: { pattern: '#,##0' } },
  };

  sheet.cellData[0] = { 0: { v: 'BÁO CÁO DOANH SỐ BÁN HÀNG VÀ TỶ LỆ HOÀN THÀNH KPI', t: 1, s: 'title' } };

  const headers = ['Khu vực', 'Sản phẩm chủ lực', 'Chỉ tiêu KPI', 'Doanh số thực đạt', 'Tỷ lệ hoàn thành', 'Đánh giá'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => {
    sheet.cellData[1][c] = { v: h, t: 1, s: 'head' };
  });

  const regions = [
    ['Miền Bắc', 'Minh Spark Office Pro', 500000000, 580000000],
    ['Miền Trung', 'Minh Spark Cloud Suite', 250000000, 240000000],
    ['Miền Nam', 'Minh Spark Enterprise', 800000000, 920000000],
    ['Thương mại điện tử', 'Bản quyền cá nhân', 150000000, 195000000],
  ];

  regions.forEach((item, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = {
      0: { v: item[0] as string, t: 1, s: 'center' },
      1: { v: item[1] as string, t: 1 },
      2: { v: item[2] as number, t: 2, s: 'money' },
      3: { v: item[3] as number, t: 2, s: 'money' },
      4: { f: `=D${r+1}/C${r+1}`, s: 'pct' },
      5: { f: `=IF(E${r+1}>=1,"Vượt chỉ tiêu","Cần nỗ lực")`, s: 'center' },
    };
  });

  sheet.cellData[6] = {
    0: { v: 'TỔNG CỘNG', t: 1, s: 'head' },
    2: { f: '=SUM(C3:C6)', s: 'total' },
    3: { f: '=SUM(D3:D6)', s: 'total' },
    4: { f: '=D7/C7', s: 'pct' },
  };

  sheet.columnData = { 0: { w: 140 }, 1: { w: 220 }, 2: { w: 150 }, 3: { w: 150 }, 4: { w: 130 }, 5: { w: 140 } };
  sheet.rowData = { 0: { h: 36 }, 1: { h: 32 } };
  sheet.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 5 }];
  return workbook;
};

export const inventoryWorkbook = (): WorkbookData => {
  const workbook = emptyWorkbook('Quản lý kho hàng');
  const sheet = workbook.sheets[workbook.sheetOrder[0]];
  sheet.name = 'Tồn kho';
  workbook.styles = {
    head: { bl: 1, bg: { rgb: '#E65100' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    title: { bl: 1, fs: 15, cl: { rgb: '#E65100' } },
    money: { n: { pattern: '#,##0' } },
    num: { n: { pattern: '#,##0' }, ht: 2 },
    center: { ht: 2, vt: 2 },
    total: { bl: 1, bg: { rgb: '#FFF3E0' }, n: { pattern: '#,##0' } },
  };

  sheet.cellData[0] = { 0: { v: 'BÁO CÁO THEO DÕI HÀNG TỒN KHO & ĐỊNH MỨC AN TOÀN', t: 1, s: 'title' } };

  const headers = ['Mã SKU', 'Tên sản phẩm', 'Đơn vị tính', 'Tồn đầu kỳ', 'Nhập', 'Xuất', 'Tồn cuối kỳ', 'Đơn giá', 'Thành tiền', 'Trạng thái'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => {
    sheet.cellData[1][c] = { v: h, t: 1, s: 'head' };
  });

  const products = [
    ['SP001', 'Màn hình Dell UltraSharp 27"', 'Chiếc', 40, 50, 35, 12500000],
    ['SP002', 'Bàn phím cơ không dây Pro', 'Chiếc', 120, 80, 95, 2100000],
    ['SP003', 'Chuột công thái học Master', 'Chiếc', 85, 40, 60, 1850000],
    ['SP004', 'Tai nghe chống ồn khử tạp âm', 'Bộ', 30, 20, 28, 4500000],
  ];

  products.forEach((prod, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = {
      0: { v: prod[0] as string, t: 1, s: 'center' },
      1: { v: prod[1] as string, t: 1 },
      2: { v: prod[2] as string, t: 1, s: 'center' },
      3: { v: prod[3] as number, t: 2, s: 'num' },
      4: { v: prod[4] as number, t: 2, s: 'num' },
      5: { v: prod[5] as number, t: 2, s: 'num' },
      6: { f: `=D${r+1}+E${r+1}-F${r+1}`, s: 'num' },
      7: { v: prod[6] as number, t: 2, s: 'money' },
      8: { f: `=G${r+1}*H${r+1}`, s: 'money' },
      9: { f: `=IF(G${r+1}<=25,"Cảnh báo nhập","Ổn định")`, s: 'center' },
    };
  });

  sheet.cellData[6] = {
    1: { v: 'TỔNG CỘNG GIÁ TRỊ TỒN KHO', t: 1, s: 'head' },
    8: { f: '=SUM(I3:I6)', s: 'total' },
  };

  sheet.columnData = { 0: { w: 90 }, 1: { w: 220 }, 2: { w: 90 }, 3: { w: 90 }, 4: { w: 80 }, 5: { w: 80 }, 6: { w: 90 }, 7: { w: 120 }, 8: { w: 140 }, 9: { w: 130 } };
  sheet.rowData = { 0: { h: 36 }, 1: { h: 32 } };
  sheet.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 9 }];
  return workbook;
};

export const cashbookWorkbook = (): WorkbookData => {
  const workbook = emptyWorkbook('Sổ quỹ thu chi kế toán');
  const sheet = workbook.sheets[workbook.sheetOrder[0]];
  sheet.name = 'Sổ quỹ T11';
  workbook.styles = {
    head: { bl: 1, bg: { rgb: '#0F766E' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    title: { bl: 1, fs: 15, cl: { rgb: '#0F766E' } },
    money: { n: { pattern: '#,##0' } },
    center: { ht: 2, vt: 2 },
    opening: { bl: 1, bg: { rgb: '#F0FDFA' }, n: { pattern: '#,##0' } },
    total: { bl: 1, bg: { rgb: '#CCFBF1' }, n: { pattern: '#,##0' } },
  };

  sheet.cellData[0] = { 0: { v: 'SỔ QUỸ TIỀN MẶT & NGÂN HÀNG THÁNG 11/2026', t: 1, s: 'title' } };

  const headers = ['STT', 'Ngày CT', 'Số phiếu', 'Diễn giải nghiệp vụ', 'Phân loại', 'Thu (VNĐ)', 'Chi (VNĐ)', 'Tồn quỹ luỹ kế'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => {
    sheet.cellData[1][c] = { v: h, t: 1, s: 'head' };
  });

  sheet.cellData[2] = {
    0: { v: '-', t: 1, s: 'center' },
    1: { v: '01/11/2026', t: 1, s: 'center' },
    2: { v: 'DK-001', t: 1, s: 'center' },
    3: { v: 'Số dư tồn quỹ đầu kỳ tháng 11', t: 1 },
    4: { v: 'Đầu kỳ', t: 1, s: 'center' },
    5: { v: 0, t: 2, s: 'money' },
    6: { v: 0, t: 2, s: 'money' },
    7: { v: 250000000, t: 2, s: 'opening' },
  };

  const entries: [number, string, string, string, string, number, number][] = [
    [1, '03/11/2026', 'PT-101', 'Thu tiền hợp đồng Minh Spark Enterprise đợt 1', 'Doanh thu', 320000000, 0],
    [2, '06/11/2026', 'PC-201', 'Thanh toán chi phí thuê văn phòng & điện nước', 'Vận hành', 0, 42000000],
    [3, '10/11/2026', 'PT-102', 'Thu phí gia hạn bản quyền Cloud Suite (18 khách hàng)', 'Doanh thu', 145000000, 0],
    [4, '15/11/2026', 'PC-202', 'Tạm ứng lương đợt 1 tháng 11 cho khối kỹ thuật', 'Nhân sự', 0, 115000000],
    [5, '20/11/2026', 'PC-203', 'Thanh toán hạ tầng máy chủ & bản quyền API', 'Công nghệ', 0, 38500000],
    [6, '25/11/2026', 'PT-103', 'Thu thanh lý hợp đồng tư vấn chuyển đổi số', 'Dịch vụ', 95000000, 0],
  ];

  entries.forEach((item, idx) => {
    const r = idx + 3;
    sheet.cellData[r] = {
      0: { v: item[0], t: 2, s: 'center' },
      1: { v: item[1], t: 1, s: 'center' },
      2: { v: item[2], t: 1, s: 'center' },
      3: { v: item[3], t: 1 },
      4: { v: item[4], t: 1, s: 'center' },
      5: { v: item[5], t: 2, s: 'money' },
      6: { v: item[6], t: 2, s: 'money' },
      7: { f: `=H${r}+F${r + 1}-G${r + 1}`, s: 'money' },
    };
  });

  sheet.cellData[9] = {
    3: { v: 'TỔNG PHÁT SINH & TỒN CUỐI KỲ', t: 1, s: 'head' },
    5: { f: '=SUM(F4:F9)', s: 'total' },
    6: { f: '=SUM(G4:G9)', s: 'total' },
    7: { f: '=H9', s: 'total' },
  };

  sheet.columnData = { 0: { w: 60 }, 1: { w: 105 }, 2: { w: 95 }, 3: { w: 280 }, 4: { w: 110 }, 5: { w: 135 }, 6: { w: 135 }, 7: { w: 150 } };
  sheet.rowData = { 0: { h: 36 }, 1: { h: 32 } };
  sheet.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 7 }];
  sheet.freeze = { xSplit: 0, ySplit: 2, startRow: 2, startColumn: 0 };
  return workbook;
};

export const projectEstimateWorkbook = (): WorkbookData => {
  const workbook = emptyWorkbook('Dự toán & tiến độ dự án');
  const sheet = workbook.sheets[workbook.sheetOrder[0]];
  sheet.name = 'Dự toán dự án';
  workbook.styles = {
    head: { bl: 1, bg: { rgb: '#3730A3' }, cl: { rgb: '#FFFFFF' }, ht: 2, vt: 2 },
    title: { bl: 1, fs: 15, cl: { rgb: '#312E81' } },
    money: { n: { pattern: '#,##0' } },
    pct: { n: { pattern: '0%' }, ht: 2 },
    center: { ht: 2, vt: 2 },
    total: { bl: 1, bg: { rgb: '#EEF2FF' }, n: { pattern: '#,##0' } },
  };

  sheet.cellData[0] = { 0: { v: 'BẢNG DỰ TOÁN NGÂN SÁCH & TIẾN ĐỘ TRIỂN KHAI DỰ ÁN', t: 1, s: 'title' } };

  const headers = ['Mã HM', 'Hạng mục công việc', 'Phụ trách', 'Ngày công', 'Đơn giá/ngày', 'Dự toán', 'Giải ngân thực tế', 'Chênh lệch', 'Tiến độ', 'Trạng thái'];
  sheet.cellData[1] = {};
  headers.forEach((h, c) => {
    sheet.cellData[1][c] = { v: h, t: 1, s: 'head' };
  });

  const tasks: [string, string, string, number, number, number, number][] = [
    ['HM-01', 'Khảo sát nghiệp vụ & kiến trúc hệ thống', 'Nguyễn Văn A', 15, 3500000, 52500000, 1],
    ['HM-02', 'Phát triển lõi soạn thảo Minh Docs & Minh Sheets', 'Nhóm Frontend', 45, 3200000, 128000000, 0.9],
    ['HM-03', 'Tích hợp xử lý chữ ký số & bảo mật ECMA-376', 'Nhóm Bảo mật', 25, 3800000, 76000000, 0.8],
    ['HM-04', 'Kiểm thử hiệu năng, bảo mật & UAT nội bộ', 'Nhóm QA', 20, 2500000, 22000000, 0.45],
    ['HM-05', 'Đào tạo chuyển giao & triển khai vận hành', 'Ban Dự án', 12, 2800000, 0, 0.15],
  ];

  tasks.forEach((task, idx) => {
    const r = idx + 2;
    sheet.cellData[r] = {
      0: { v: task[0], t: 1, s: 'center' },
      1: { v: task[1], t: 1 },
      2: { v: task[2], t: 1 },
      3: { v: task[3], t: 2, s: 'center' },
      4: { v: task[4], t: 2, s: 'money' },
      5: { f: `=D${r + 1}*E${r + 1}`, s: 'money' },
      6: { v: task[5], t: 2, s: 'money' },
      7: { f: `=F${r + 1}-G${r + 1}`, s: 'money' },
      8: { v: task[6], t: 2, s: 'pct' },
      9: { f: `=IF(I${r + 1}>=1,"Hoàn thành",IF(I${r + 1}>=0.5,"Đang chạy","Chuẩn bị"))`, s: 'center' },
    };
  });

  sheet.cellData[7] = {
    1: { v: 'TỔNG HỢP TOÀN DỰ ÁN', t: 1, s: 'head' },
    3: { f: '=SUM(D3:D7)', s: 'center' },
    5: { f: '=SUM(F3:F7)', s: 'total' },
    6: { f: '=SUM(G3:G7)', s: 'total' },
    7: { f: '=SUM(H3:H7)', s: 'total' },
    8: { f: '=AVERAGE(I3:I7)', s: 'pct' },
  };

  sheet.columnData = { 0: { w: 80 }, 1: { w: 260 }, 2: { w: 135 }, 3: { w: 85 }, 4: { w: 120 }, 5: { w: 135 }, 6: { w: 135 }, 7: { w: 130 }, 8: { w: 90 }, 9: { w: 120 } };
  sheet.rowData = { 0: { h: 36 }, 1: { h: 32 } };
  sheet.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 9 }];
  return workbook;
};
