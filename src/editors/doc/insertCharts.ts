export type ChartKind = 'column' | 'column-stacked' | 'column-percent' | 'column-3d' | 'bar' | 'bar-stacked' | 'bar-percent'
  | 'line' | 'line-smooth' | 'area' | 'area-stacked' | 'area-percent' | 'combo' | 'pie' | 'pie-exploded' | 'doughnut' | 'polar-area' | 'sunburst' | 'treemap'
  | 'radar' | 'radar-filled' | 'scatter' | 'scatter-line' | 'bubble' | 'stock' | 'histogram' | 'pareto' | 'box' | 'funnel' | 'waterfall' | 'gauge' | 'gantt' | 'heatmap';

export type ChartData = { categories: string[]; series: { name: string; values: number[] }[] };
export type ChartSpec = { kind: ChartKind; title: string; raw: string; palette: string; legend: boolean; labels: boolean; grid: boolean };

export const CHART_KINDS: { id: ChartKind; label: string; group: string; hint: string }[] = [
  { id: 'column', label: 'Cột nhóm', group: 'Cột', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'column-stacked', label: 'Cột chồng', group: 'Cột', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'column-percent', label: 'Cột chồng 100%', group: 'Cột', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'column-3d', label: 'Cột 3D', group: 'Cột', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'bar', label: 'Thanh nhóm', group: 'Thanh', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'bar-stacked', label: 'Thanh chồng', group: 'Thanh', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'bar-percent', label: 'Thanh chồng 100%', group: 'Thanh', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'line', label: 'Đường có điểm', group: 'Đường', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'line-smooth', label: 'Đường cong', group: 'Đường', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'area', label: 'Vùng', group: 'Vùng', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'area-stacked', label: 'Vùng chồng', group: 'Vùng', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'area-percent', label: 'Vùng chồng 100%', group: 'Vùng', hint: 'Nhãn, giá trị 1, giá trị 2…' },
  { id: 'pie', label: 'Tròn', group: 'Tròn', hint: 'Nhãn, giá trị' },
  { id: 'pie-exploded', label: 'Tròn tách miếng', group: 'Tròn', hint: 'Nhãn, giá trị' },
  { id: 'doughnut', label: 'Vành khuyên', group: 'Tròn', hint: 'Nhãn, giá trị' },
  { id: 'polar-area', label: 'Hoa hồng', group: 'Tròn', hint: 'Nhãn, giá trị' },
  { id: 'sunburst', label: 'Mặt trời', group: 'Phân cấp', hint: 'Nhóm > Mục, giá trị' },
  { id: 'treemap', label: 'Bản đồ cây', group: 'Phân cấp', hint: 'Nhãn, giá trị' },
  { id: 'scatter', label: 'Phân tán', group: 'X Y', hint: 'X, Y1, Y2…' },
  { id: 'scatter-line', label: 'Phân tán có đường', group: 'X Y', hint: 'X, Y1, Y2…' },
  { id: 'bubble', label: 'Bong bóng', group: 'X Y', hint: 'Tên, X, Y, Kích thước' },
  { id: 'radar', label: 'Mạng nhện', group: 'Mạng nhện', hint: 'Tiêu chí, điểm 1, điểm 2…' },
  { id: 'radar-filled', label: 'Mạng nhện tô màu', group: 'Mạng nhện', hint: 'Tiêu chí, điểm 1, điểm 2…' },
  { id: 'histogram', label: 'Tần suất (Histogram)', group: 'Thống kê', hint: 'Tên, giá trị (mỗi dòng một số đo)' },
  { id: 'pareto', label: 'Pareto', group: 'Thống kê', hint: 'Nguyên nhân, số lần' },
  { id: 'box', label: 'Hộp và râu', group: 'Thống kê', hint: 'Lần đo, nhóm 1, nhóm 2…' },
  { id: 'heatmap', label: 'Bản đồ nhiệt', group: 'Thống kê', hint: 'Dòng, cột 1, cột 2…' },
  { id: 'waterfall', label: 'Thác nước', group: 'Tài chính', hint: 'Khoản, giá trị (âm là giảm)' },
  { id: 'stock', label: 'Cổ phiếu (nến)', group: 'Tài chính', hint: 'Ngày, Mở, Cao, Thấp, Đóng' },
  { id: 'funnel', label: 'Phễu', group: 'Tài chính', hint: 'Giai đoạn, số lượng' },
  { id: 'combo', label: 'Cột kết hợp đường', group: 'Kết hợp', hint: 'Nhãn, giá trị cột, giá trị đường…' },
  { id: 'gauge', label: 'Đồng hồ đo', group: 'Quản lý', hint: 'Chỉ tiêu, giá trị, tối đa' },
  { id: 'gantt', label: 'Tiến độ Gantt', group: 'Quản lý', hint: 'Công việc, ngày bắt đầu, số ngày' },
];

export const CHART_PALETTES: { id: string; label: string; colors: string[] }[] = [
  { id: 'office', label: 'Office', colors: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478', '#9e480e'] },
  { id: 'docs', label: '23 Docs', colors: ['#2b579a', '#107c41', '#d7473c', '#d98e04', '#7c3aed', '#0891b2', '#be185d', '#4d7c0f'] },
  { id: 'blue', label: 'Xanh dương', colors: ['#1e3a8a', '#2563eb', '#60a5fa', '#93c5fd', '#1d4ed8', '#3b82f6'] },
  { id: 'green', label: 'Xanh lục', colors: ['#14532d', '#16a34a', '#4ade80', '#86efac', '#15803d', '#22c55e'] },
  { id: 'warm', label: 'Ấm', colors: ['#9a3412', '#ea580c', '#f59e0b', '#dc2626', '#facc15', '#c2410c'] },
  { id: 'pastel', label: 'Pastel', colors: ['#7aa6e8', '#86d0b4', '#f2b880', '#e89ab0', '#b7a3e3', '#9fd3e8'] },
  { id: 'mono', label: 'Xám', colors: ['#1f2937', '#4b5563', '#9ca3af', '#d1d5db', '#374151', '#6b7280'] },
];

export const CHART_TEMPLATES: { id: string; label: string; kind: ChartKind; title: string; raw: string }[] = [
  { id: 'revenue', label: 'Doanh thu theo quý', kind: 'column', title: 'Doanh thu theo quý (triệu đồng)', raw: 'Quý, Doanh thu\nQuý I, 120\nQuý II, 150\nQuý III, 135\nQuý IV, 190' },
  { id: 'compare-years', label: 'So sánh hai năm', kind: 'column', title: 'Doanh thu 2025 và 2026', raw: 'Tháng, 2025, 2026\nT1, 80, 95\nT2, 70, 88\nT3, 92, 110\nT4, 100, 126\nT5, 112, 131\nT6, 120, 150' },
  { id: 'workload', label: 'Khối lượng theo đội', kind: 'bar-stacked', title: 'Khối lượng việc theo đội', raw: 'Đội, Đã xong, Đang làm, Chưa làm\nĐội 1, 24, 8, 6\nĐội 2, 18, 10, 9\nĐội 3, 30, 5, 3\nĐội 4, 12, 12, 14' },
  { id: 'output', label: 'Sản lượng tích luỹ', kind: 'area', title: 'Sản lượng điện theo tháng (MWh)', raw: 'Tháng, Sản lượng\nT1, 320\nT2, 300\nT3, 360\nT4, 420\nT5, 480\nT6, 510\nT7, 530\nT8, 500' },
  { id: 'channel-share', label: 'Tỷ trọng kênh bán', kind: 'column-percent', title: 'Tỷ trọng doanh thu theo kênh', raw: 'Năm, Cửa hàng, Online, Đại lý\n2023, 50, 20, 30\n2024, 44, 30, 26\n2025, 38, 40, 22\n2026, 32, 50, 18' },
  { id: 'cost-structure', label: 'Cơ cấu chi phí', kind: 'column-stacked', title: 'Cơ cấu chi phí dự án', raw: 'Hạng mục, Vật tư, Nhân công, Máy\nMóng, 320, 140, 60\nThân, 540, 260, 90\nMái, 210, 110, 40\nHoàn thiện, 380, 300, 30' },
  { id: 'progress', label: 'Tiến độ công việc', kind: 'bar', title: 'Tiến độ hoàn thành (%)', raw: 'Công việc, Hoàn thành\nKhảo sát, 100\nThiết kế, 85\nMua sắm, 60\nThi công, 35\nNghiệm thu, 5' },
  { id: 'trend', label: 'Xu hướng theo tháng', kind: 'line', title: 'Số khách hàng mới', raw: 'Tháng, Online, Cửa hàng\nT1, 120, 90\nT2, 140, 85\nT3, 180, 96\nT4, 210, 92\nT5, 260, 101\nT6, 300, 98' },
  { id: 'temperature', label: 'Nhiệt độ trung bình', kind: 'line-smooth', title: 'Nhiệt độ trung bình Hà Nội (°C)', raw: 'Tháng, Nhiệt độ\nT1, 17\nT2, 18\nT3, 21\nT4, 25\nT5, 28\nT6, 30\nT7, 30\nT8, 29\nT9, 28\nT10, 25\nT11, 22\nT12, 18' },
  { id: 'traffic', label: 'Lượt truy cập', kind: 'area-stacked', title: 'Lượt truy cập theo nguồn', raw: 'Tuần, Tìm kiếm, Mạng xã hội, Trực tiếp\nTuần 1, 400, 220, 120\nTuần 2, 460, 260, 130\nTuần 3, 520, 330, 150\nTuần 4, 610, 380, 160' },
  { id: 'market-share', label: 'Thị phần', kind: 'pie', title: 'Thị phần năm 2026', raw: 'Hãng, Thị phần\nCông ty A, 38\nCông ty B, 27\nCông ty C, 18\nKhác, 17' },
  { id: 'budget', label: 'Phân bổ ngân sách', kind: 'doughnut', title: 'Phân bổ ngân sách', raw: 'Khoản, Tỷ lệ\nNhân sự, 45\nMarketing, 20\nVận hành, 25\nDự phòng, 10' },
  { id: 'skills', label: 'Đánh giá năng lực', kind: 'radar', title: 'Đánh giá năng lực nhân viên', raw: 'Kỹ năng, Nhân viên A, Nhân viên B\nChuyên môn, 8, 6\nGiao tiếp, 6, 9\nLàm nhóm, 7, 8\nSáng tạo, 9, 5\nKỷ luật, 7, 8' },
  { id: 'correlation', label: 'Tương quan', kind: 'scatter', title: 'Giờ học và điểm thi', raw: 'Giờ học, Điểm\n2, 4.5\n3, 5.2\n4, 6\n5, 6.4\n6, 7.1\n7, 7.8\n8, 8.4\n9, 8.6' },
  { id: 'sales-funnel', label: 'Phễu bán hàng', kind: 'funnel', title: 'Phễu bán hàng', raw: 'Giai đoạn, Số lượng\nTiếp cận, 10000\nQuan tâm, 4200\nĐăng ký, 1500\nMua hàng, 420' },
  { id: 'cashflow', label: 'Biến động dòng tiền', kind: 'waterfall', title: 'Biến động dòng tiền (triệu đồng)', raw: 'Khoản, Giá trị\nĐầu kỳ, 500\nDoanh thu, 320\nChi phí, -210\nThuế, -40\nĐầu tư, -90' },
  { id: 'profit-margin', label: 'Doanh thu và lợi nhuận', kind: 'combo', title: 'Doanh thu và lợi nhuận', raw: 'Quý, Doanh thu, Lợi nhuận\nQuý I, 120, 18\nQuý II, 150, 26\nQuý III, 135, 21\nQuý IV, 190, 38' },
  { id: 'region-3d', label: 'Doanh số theo miền', kind: 'column-3d', title: 'Doanh số theo miền', raw: 'Miền, 2025, 2026\nBắc, 420, 510\nTrung, 260, 300\nNam, 530, 640' },
  { id: 'satisfaction', label: 'Mức độ hài lòng', kind: 'bar-percent', title: 'Mức độ hài lòng theo bộ phận', raw: 'Bộ phận, Hài lòng, Bình thường, Chưa hài lòng\nBán hàng, 62, 28, 10\nKỹ thuật, 70, 20, 10\nChăm sóc khách hàng, 55, 30, 15\nGiao hàng, 48, 32, 20' },
  { id: 'energy-mix', label: 'Cơ cấu nguồn điện', kind: 'area-percent', title: 'Cơ cấu nguồn điện (%)', raw: 'Năm, Thuỷ điện, Nhiệt điện, Năng lượng tái tạo\n2020, 30, 55, 15\n2022, 28, 50, 22\n2024, 26, 45, 29\n2026, 24, 40, 36' },
  { id: 'expense-pie', label: 'Chi tiêu gia đình', kind: 'pie-exploded', title: 'Chi tiêu gia đình mỗi tháng', raw: 'Khoản, Triệu đồng\nĂn uống, 6\nNhà ở, 5\nĐi lại, 2\nGiáo dục, 3\nTiết kiệm, 4' },
  { id: 'sales-by-month', label: 'Doanh số theo mùa', kind: 'polar-area', title: 'Doanh số theo tháng', raw: 'Tháng, Doanh số\nT1, 30\nT2, 22\nT3, 35\nT4, 40\nT5, 52\nT6, 61\nT7, 58\nT8, 49\nT9, 44\nT10, 38\nT11, 46\nT12, 70' },
  { id: 'org-cost', label: 'Chi phí theo phòng ban', kind: 'sunburst', title: 'Chi phí theo khối và phòng ban', raw: 'Khối > Phòng, Chi phí\nKinh doanh > Bán hàng, 320\nKinh doanh > Marketing, 180\nKỹ thuật > Thiết kế, 240\nKỹ thuật > Thi công, 410\nVăn phòng > Kế toán, 120\nVăn phòng > Nhân sự, 90' },
  { id: 'inventory', label: 'Giá trị tồn kho', kind: 'treemap', title: 'Giá trị tồn kho theo nhóm', raw: 'Nhóm, Giá trị\nThép, 820\nXi măng, 460\nCáp điện, 390\nỐng nhựa, 210\nSơn, 150\nThiết bị điện, 330\nPhụ kiện, 90' },
  { id: 'kpi-team', label: 'Năng lực đội nhóm', kind: 'radar-filled', title: 'Năng lực hai đội', raw: 'Tiêu chí, Đội A, Đội B\nTốc độ, 8, 6\nChất lượng, 7, 9\nChi phí, 6, 7\nAn toàn, 9, 8\nĐổi mới, 7, 5\nPhối hợp, 8, 7' },
  { id: 'load-curve', label: 'Đường đặc tính', kind: 'scatter-line', title: 'Công suất theo tốc độ gió', raw: 'Tốc độ gió (m/s), Công suất (kW)\n3, 20\n5, 160\n7, 520\n9, 1100\n11, 1700\n13, 1950\n15, 2000' },
  { id: 'products', label: 'Danh mục sản phẩm', kind: 'bubble', title: 'Giá, sản lượng và thị phần', raw: 'Sản phẩm, Giá, Sản lượng, Thị phần\nSản phẩm A, 12, 340, 28\nSản phẩm B, 18, 220, 18\nSản phẩm C, 25, 140, 12\nSản phẩm D, 9, 410, 32\nSản phẩm E, 30, 80, 10' },
  { id: 'stock-price', label: 'Giá cổ phiếu', kind: 'stock', title: 'Giá cổ phiếu tuần này (nghìn đồng)', raw: 'Ngày, Mở, Cao, Thấp, Đóng\nThứ 2, 52, 55, 51, 54\nThứ 3, 54, 56, 52, 53\nThứ 4, 53, 54, 49, 50\nThứ 5, 50, 53, 49, 52\nThứ 6, 52, 57, 52, 56' },
  { id: 'scores', label: 'Phân bố điểm thi', kind: 'histogram', title: 'Phân bố điểm thi', raw: 'Học sinh, Điểm\nHS1, 5.5\nHS2, 6\nHS3, 6.5\nHS4, 7\nHS5, 7\nHS6, 7.5\nHS7, 7.5\nHS8, 8\nHS9, 8\nHS10, 8\nHS11, 8.5\nHS12, 9\nHS13, 9.5\nHS14, 4.5\nHS15, 6.5\nHS16, 7' },
  { id: 'defects', label: 'Nguyên nhân lỗi', kind: 'pareto', title: 'Nguyên nhân lỗi sản phẩm', raw: 'Nguyên nhân, Số lần\nSai kích thước, 48\nTrầy xước, 31\nThiếu linh kiện, 14\nĐóng gói lỗi, 9\nKhác, 6' },
  { id: 'measures', label: 'Độ ổn định máy', kind: 'box', title: 'Sai số đo của ba máy (mm)', raw: 'Lần đo, Máy A, Máy B, Máy C\n1, 2.1, 1.8, 2.6\n2, 2.3, 1.9, 2.2\n3, 1.9, 2.0, 3.1\n4, 2.4, 1.7, 2.4\n5, 2.2, 2.1, 2.8\n6, 2.0, 1.9, 2.5\n7, 2.6, 2.0, 4.2\n8, 2.1, 1.8, 2.3' },
  { id: 'attendance', label: 'Mức độ đông khách', kind: 'heatmap', title: 'Lượng khách theo giờ', raw: 'Khung giờ, T2, T3, T4, T5, T6, T7, CN\n8h, 12, 10, 11, 13, 15, 30, 34\n12h, 40, 38, 42, 41, 45, 60, 65\n18h, 55, 52, 58, 60, 72, 80, 76\n21h, 20, 18, 22, 25, 40, 55, 48' },
  { id: 'kpi-gauge', label: 'Hoàn thành chỉ tiêu', kind: 'gauge', title: 'Doanh thu so với kế hoạch', raw: 'Chỉ tiêu, Thực hiện, Kế hoạch\nDoanh thu (tỷ đồng), 78, 100' },
  { id: 'schedule', label: 'Kế hoạch dự án', kind: 'gantt', title: 'Kế hoạch triển khai dự án', raw: 'Công việc, Bắt đầu (ngày), Số ngày\nKhảo sát, 0, 5\nThiết kế, 4, 10\nMua sắm vật tư, 12, 8\nThi công, 18, 25\nNghiệm thu, 42, 4' },
];

const splitCells = (line: string) => {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(';')) return line.split(';');
  return line.split(',');
};

const toNumber = (cell: string) => {
  let value = cell.trim().replace(/[\s%]/g, '');
  if (!value) return NaN;
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) value = comma > dot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  else if (comma >= 0) value = value.replace(',', '.');
  return Number(value);
};

const isYear = (cell: string) => /^(19|20)\d{2}$/.test(cell.trim());

const isHeaderRow = (row: string[]) => {
  const rest = row.slice(1);
  if (!rest.length) return false;
  if (rest.every((cell) => !Number.isFinite(toNumber(cell)))) return true;
  return rest.every(isYear) && rest.every((cell, i) => i === 0 || Number(cell) > Number(rest[i - 1]));
};

export function parseChartData(raw: string): ChartData {
  const rows = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return { categories: [], series: [] };
  const table = rows.map((line) => splitCells(line).map((cell) => cell.trim()));
  const width = Math.max(...table.map((row) => row.length));
  const header = isHeaderRow(table[0]) ? table.shift()! : null;
  const seriesCount = Math.max(1, width - 1);
  const series = Array.from({ length: seriesCount }, (_, i) => ({ name: header?.[i + 1] || (seriesCount > 1 ? `Chuỗi ${i + 1}` : header?.[0] ?? 'Giá trị'), values: [] as number[] }));
  const categories: string[] = [];
  for (const row of table) {
    if (!row[0]) continue;
    const values = series.map((_, i) => toNumber(row[i + 1] ?? ''));
    if (!values.some(Number.isFinite)) continue;
    categories.push(row[0]);
    series.forEach((item, i) => item.values.push(Number.isFinite(values[i]) ? values[i] : 0));
  }
  return { categories, series };
}

export type Box = { left: number; top: number; right: number; bottom: number };
export type Draw = { ctx: CanvasRenderingContext2D; data: ChartData; colors: string[]; spec: ChartSpec; box: Box; mini: boolean; width: number; height: number };

export const FONT = 'Segoe UI, Arial, sans-serif';
export const TEXT = '#1e2430';
export const MUTED = '#6b7385';
export const GRID = '#e3e7ee';

export const fmt = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
export const color = (d: Draw, i: number) => d.colors[i % d.colors.length];

const niceStep = (range: number, ticks: number) => {
  const raw = range / Math.max(1, ticks);
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
};

export const niceRange = (min: number, max: number, ticks = 5) => {
  const lo = Math.min(0, min);
  const hi = max <= lo ? lo + 1 : max;
  const step = niceStep(hi - lo, ticks);
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
};

export const text = (d: Draw, value: string, x: number, y: number, align: CanvasTextAlign = 'center', size = 12, fill = MUTED, weight = 400) => {
  if (d.mini) return;
  d.ctx.font = `${weight} ${size}px ${FONT}`;
  d.ctx.fillStyle = fill;
  d.ctx.textAlign = align;
  d.ctx.textBaseline = 'middle';
  d.ctx.fillText(value, x, y);
};

export const stackTotals = (data: ChartData) => data.categories.map((_, c) => data.series.reduce((sum, s) => sum + Math.max(0, s.values[c]), 0));

const valueRange = (d: Draw) => {
  const { kind } = d.spec;
  if (kind.endsWith('percent')) return { min: 0, max: 100, step: 20 };
  if (kind === 'column-stacked' || kind === 'bar-stacked' || kind === 'area-stacked') return niceRange(0, Math.max(...stackTotals(d.data), 1));
  if (kind === 'waterfall') {
    let run = 0;
    const points = [0, ...(d.data.series[0]?.values ?? []).map((v) => (run += v))];
    return niceRange(Math.min(...points), Math.max(...points));
  }
  const all = d.data.series.flatMap((s) => s.values);
  return niceRange(Math.min(0, ...all), Math.max(...all, 1));
};

export const valueAxis = (d: Draw, range: { min: number; max: number; step: number }, horizontal: boolean) => {
  const { ctx, box } = d;
  const span = range.max - range.min || 1;
  const pos = (v: number) => horizontal ? box.left + ((v - range.min) / span) * (box.right - box.left) : box.bottom - ((v - range.min) / span) * (box.bottom - box.top);
  for (let v = range.min; v <= range.max + range.step / 2; v += range.step) {
    const p = pos(v);
    if (d.spec.grid || Math.abs(v) < 1e-9) {
      ctx.strokeStyle = Math.abs(v) < 1e-9 ? '#b6bdca' : GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (horizontal) { ctx.moveTo(p, box.top); ctx.lineTo(p, box.bottom); } else { ctx.moveTo(box.left, p); ctx.lineTo(box.right, p); }
      ctx.stroke();
    }
    const label = d.spec.kind.endsWith('percent') ? `${fmt(v)}%` : fmt(v);
    if (horizontal) text(d, label, p, box.bottom + 14);
    else text(d, label, box.left - 8, p, 'right', 11);
  }
  return pos;
};

export const categoryAxis = (d: Draw, horizontal: boolean) => {
  const { box, data } = d;
  const count = Math.max(1, data.categories.length);
  const size = horizontal ? (box.bottom - box.top) / count : (box.right - box.left) / count;
  const center = (i: number) => horizontal ? box.top + size * i + size / 2 : box.left + size * i + size / 2;
  data.categories.forEach((cat, i) => {
    if (horizontal) text(d, cat.slice(0, 16), box.left - 8, center(i), 'right', 11);
    else text(d, cat.slice(0, Math.max(4, Math.floor(size / 6.5))), center(i), box.bottom + 14, 'center', 11);
  });
  return { size, center };
};

export const drawBars = (d: Draw, horizontal: boolean) => {
  const { ctx, data, spec } = d;
  const percent = spec.kind.endsWith('percent');
  const stacked = spec.kind.includes('stacked') || percent;
  const combo = spec.kind === 'combo';
  const range = combo ? niceRange(Math.min(0, ...(data.series[0]?.values ?? [0])), Math.max(...(data.series[0]?.values ?? [1]), 1)) : valueRange(d);
  const pos = valueAxis(d, range, horizontal);
  const cat = categoryAxis(d, horizontal);
  const totals = stackTotals(data);
  const seriesList = spec.kind === 'combo' ? data.series.slice(0, 1) : data.series;
  const groupSize = cat.size * 0.72;
  const barSize = stacked ? groupSize : groupSize / Math.max(1, seriesList.length);
  data.categories.forEach((_, c) => {
    let acc = 0;
    seriesList.forEach((s, i) => {
      const raw = s.values[c];
      const value = percent ? (totals[c] ? (Math.max(0, raw) / totals[c]) * 100 : 0) : raw;
      const from = stacked ? acc : 0;
      const to = stacked ? acc + Math.max(0, value) : value;
      if (stacked) acc = to;
      const offset = stacked ? -groupSize / 2 : -groupSize / 2 + barSize * i;
      const a = pos(from);
      const b = pos(to);
      ctx.fillStyle = color(d, i);
      if (horizontal) ctx.fillRect(Math.min(a, b), cat.center(c) + offset, Math.abs(b - a), barSize - (stacked ? 0 : 2));
      else ctx.fillRect(cat.center(c) + offset, Math.min(a, b), barSize - (stacked ? 0 : 2), Math.abs(b - a));
      if (spec.labels && Math.abs(b - a) > 14) {
        const label = percent ? `${Math.round(value)}%` : fmt(raw);
        if (horizontal) text(d, label, stacked ? (a + b) / 2 : b + 6, cat.center(c) + offset + barSize / 2, stacked ? 'center' : 'left', 10, stacked ? '#ffffff' : TEXT);
        else text(d, label, cat.center(c) + offset + barSize / 2, stacked ? (a + b) / 2 : b - 9, 'center', 10, stacked ? '#ffffff' : TEXT);
      }
    });
  });
  if (combo && data.series.length > 1) drawLines(d, data.series.slice(1), 1, secondaryAxis(d, data.series.slice(1)), cat);
};

const secondaryAxis = (d: Draw, series: ChartData['series']) => {
  const values = series.flatMap((s) => s.values);
  const range = niceRange(Math.min(0, ...values), Math.max(...values, 1));
  const { box } = d;
  const pos = (v: number) => box.bottom - ((v - range.min) / (range.max - range.min || 1)) * (box.bottom - box.top);
  for (let v = range.min; v <= range.max + range.step / 2; v += range.step) text(d, fmt(v), box.right + 6, pos(v), 'left', 11);
  return pos;
};

export const smoothPath = (ctx: CanvasRenderingContext2D, points: [number, number][]) => {
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
};

const drawLines = (d: Draw, series: ChartData['series'], colorOffset: number, pos: (v: number) => number, cat: { center: (i: number) => number }) => {
  const { ctx, spec } = d;
  const area = spec.kind.startsWith('area');
  const stacked = spec.kind === 'area-stacked' || spec.kind === 'area-percent';
  const totals = stackTotals(d.data);
  const base = pos(0);
  const acc = d.data.categories.map(() => 0);
  const layers = series.map((s) => s.values.map((raw, c) => {
    const v = spec.kind === 'area-percent' ? (totals[c] ? (Math.max(0, raw) / totals[c]) * 100 : 0) : raw;
    const lower = acc[c];
    if (stacked) acc[c] += Math.max(0, v);
    return { lower, upper: stacked ? acc[c] : v, raw, c };
  }));
  const order = stacked ? layers.map((_, i) => i).reverse() : layers.map((_, i) => i);
  for (const i of order) {
    const pts = layers[i].map((p) => [cat.center(p.c), pos(p.upper)] as [number, number]);
    if (!pts.length) continue;
    const stroke = color(d, i + colorOffset);
    if (area) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], stacked ? pos(layers[i][0].lower) : base);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      for (let k = layers[i].length - 1; k >= 0; k--) ctx.lineTo(pts[k][0], stacked ? pos(layers[i][k].lower) : base);
      ctx.closePath();
      ctx.globalAlpha = stacked ? 0.85 : 0.3;
      ctx.fillStyle = stroke;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    if (spec.kind === 'line-smooth') smoothPath(ctx, pts);
    else pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = d.mini ? 2 : 2.5;
    ctx.stroke();
    if (!area) pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, d.mini ? 2 : 3.5, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); });
    if (spec.labels) layers[i].forEach((p, k) => text(d, fmt(p.raw), pts[k][0], pts[k][1] - 12, 'center', 10, TEXT));
  }
};

export const drawLineChart = (d: Draw) => {
  const pos = valueAxis(d, valueRange(d), false);
  const cat = categoryAxis(d, false);
  drawLines(d, d.data.series, 0, pos, cat);
};

export const drawWaterfall = (d: Draw) => {
  const { ctx } = d;
  const values = d.data.series[0]?.values ?? [];
  const extended = { ...d, data: { categories: [...d.data.categories, 'Cuối kỳ'], series: d.data.series } };
  const pos = valueAxis(d, valueRange(d), false);
  const cat = categoryAxis(extended, false);
  let run = 0;
  const width = cat.size * 0.6;
  values.forEach((v, i) => {
    const from = i === 0 ? 0 : run;
    run = i === 0 ? v : run + v;
    const a = pos(from);
    const b = pos(run);
    ctx.fillStyle = i === 0 ? d.colors[0] : v >= 0 ? '#16a34a' : '#dc2626';
    ctx.fillRect(cat.center(i) - width / 2, Math.min(a, b), width, Math.max(1, Math.abs(b - a)));
    if (d.spec.labels) text(d, fmt(v), cat.center(i), Math.min(a, b) - 9, 'center', 10, TEXT);
    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cat.center(i) + width / 2, b);
    ctx.lineTo(cat.center(i + 1) - width / 2, b);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  const end = values.length;
  ctx.fillStyle = d.colors[1 % d.colors.length];
  ctx.fillRect(cat.center(end) - width / 2, Math.min(pos(0), pos(run)), width, Math.abs(pos(run) - pos(0)));
  if (d.spec.labels) text(d, fmt(run), cat.center(end), Math.min(pos(0), pos(run)) - 9, 'center', 10, TEXT);
};

export const drawPie = (d: Draw) => {
  const { ctx, box, data } = d;
  const values = (data.series[0]?.values ?? []).map((v) => Math.max(0, v));
  const total = values.reduce((sum, v) => sum + v, 0) || 1;
  const legendRight = !d.mini && d.spec.legend;
  const cx = legendRight ? box.left + (box.right - box.left) * 0.36 : (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const radius = Math.min((legendRight ? (box.right - box.left) * 0.33 : (box.right - box.left) / 2), (box.bottom - box.top) / 2) - 4;
  const inner = d.spec.kind === 'doughnut' ? radius * 0.56 : 0;
  const explode = d.spec.kind === 'pie-exploded' ? Math.max(4, radius * 0.06) : 0;
  let angle = -Math.PI / 2;
  values.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2;
    const ox = cx + explode * Math.cos(angle + slice / 2);
    const oy = cy + explode * Math.sin(angle + slice / 2);
    ctx.beginPath();
    ctx.arc(ox, oy, radius, angle, angle + slice);
    if (inner) ctx.arc(ox, oy, inner, angle + slice, angle, true);
    else ctx.lineTo(ox, oy);
    ctx.closePath();
    ctx.fillStyle = color(d, i);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (d.spec.labels && slice > 0.25) {
      const mid = angle + slice / 2;
      const r = inner ? (radius + inner) / 2 : radius * 0.64;
      text(d, `${Math.round((v / total) * 100)}%`, cx + r * Math.cos(mid), cy + r * Math.sin(mid), 'center', 12, '#ffffff', 700);
    }
    angle += slice;
  });
  if (inner) text(d, fmt(total), cx, cy, 'center', 18, TEXT, 700);
  if (legendRight) data.categories.forEach((cat, i) => {
    const y = box.top + 20 + i * 24;
    ctx.fillStyle = color(d, i);
    ctx.fillRect(box.left + (box.right - box.left) * 0.72, y - 6, 12, 12);
    text(d, `${cat} — ${fmt(values[i])}`, box.left + (box.right - box.left) * 0.72 + 18, y, 'left', 12, TEXT);
  });
};

export const drawRadar = (d: Draw) => {
  const { ctx, box, data } = d;
  const count = Math.max(3, data.categories.length);
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const radius = Math.min(box.right - box.left, box.bottom - box.top) / 2 - (d.mini ? 4 : 22);
  const max = niceRange(0, Math.max(...data.series.flatMap((s) => s.values), 1), 4).max;
  const at = (i: number, r: number) => [cx + r * Math.cos(-Math.PI / 2 + (i * Math.PI * 2) / count), cy + r * Math.sin(-Math.PI / 2 + (i * Math.PI * 2) / count)];
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (let i = 0; i < count; i++) { const [x, y] = at(i, (radius * ring) / 4); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath();
    ctx.stroke();
  }
  for (let i = 0; i < count; i++) {
    const [x, y] = at(i, radius);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    const [lx, ly] = at(i, radius + 14);
    text(d, data.categories[i] ?? '', lx, ly, lx < cx - 4 ? 'right' : lx > cx + 4 ? 'left' : 'center', 11, TEXT);
  }
  data.series.forEach((s, k) => {
    ctx.beginPath();
    s.values.forEach((v, i) => { const [x, y] = at(i, (radius * Math.max(0, v)) / max); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.globalAlpha = d.spec.kind === 'radar-filled' ? 0.5 : 0.1;
    ctx.fillStyle = color(d, k);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color(d, k);
    ctx.lineWidth = 2;
    ctx.stroke();
  });
};

export const drawScatter = (d: Draw) => {
  const { ctx, box, data } = d;
  const xs = data.categories.map((c) => Number(c.replace(',', '.')));
  const xr = niceRange(Math.min(...xs.filter(Number.isFinite), 0), Math.max(...xs.filter(Number.isFinite), 1));
  const pos = valueAxis(d, valueRange(d), false);
  const xpos = (v: number) => box.left + ((v - xr.min) / (xr.max - xr.min || 1)) * (box.right - box.left);
  for (let v = xr.min; v <= xr.max + xr.step / 2; v += xr.step) text(d, fmt(v), xpos(v), box.bottom + 14, 'center', 11);
  data.series.forEach((s, k) => s.values.forEach((v, i) => {
    if (!Number.isFinite(xs[i])) return;
    ctx.beginPath();
    ctx.arc(xpos(xs[i]), pos(v), d.mini ? 2.5 : 5, 0, Math.PI * 2);
    ctx.fillStyle = color(d, k);
    ctx.fill();
  }));
};

export const drawFunnel = (d: Draw) => {
  const { ctx, box, data } = d;
  const values = data.series[0]?.values ?? [];
  const max = Math.max(...values, 1);
  const rowH = (box.bottom - box.top) / Math.max(1, values.length);
  const cx = (box.left + box.right) / 2;
  const full = box.right - box.left;
  values.forEach((v, i) => {
    const w = Math.max(12, (Math.max(0, v) / max) * full);
    const y = box.top + i * rowH;
    ctx.fillStyle = color(d, i);
    ctx.fillRect(cx - w / 2, y + 2, w, rowH - 4);
    text(d, `${data.categories[i]}: ${fmt(v)}`, cx, y + rowH / 2, 'center', 12, w > 140 ? '#ffffff' : TEXT, 600);
  });
};

export const drawLegend = (d: Draw) => {
  const names = d.data.series.map((s) => s.name);
  if (d.mini || !d.spec.legend || names.length < 2) return;
  const { ctx } = d;
  ctx.font = `12px ${FONT}`;
  const widths = names.map((name) => ctx.measureText(name).width + 30);
  let x = (d.width - widths.reduce((a, b) => a + b, 0)) / 2;
  const y = d.height - 16;
  names.forEach((name, i) => {
    ctx.fillStyle = color(d, i);
    ctx.fillRect(x, y - 6, 12, 12);
    text(d, name, x + 16, y, 'left', 12, TEXT);
    x += widths[i];
  });
};
