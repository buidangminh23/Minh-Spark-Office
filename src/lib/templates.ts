import type { JSONContent } from '@tiptap/react';
import { emptySheet, emptyWorkbook, uid } from './xlsxConvert';
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
