import type { SheetContent } from '../storage';
import { emptySheet, emptyWorkbook, uid } from '../workbookBasics';
import { cellAt, findSheet, foldCell, formulaOf, primarySheet, resolveStyle } from './excelHelpers';
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

const EXCEL_SEEDS: ExcelDatasetSeed[] = [
  {
    slug: 'electronics-chain',
    fileName: 'DoanhSo_DienMay.xlsx',
    title: 'Phân tích Doanh số Chuỗi Điện máy',
    titleEn: 'Consumer Electronics Chain Sales',
    scenario: 'Hoàn thiện bảng tính tổng hợp doanh thu, phí vận chuyển theo vùng và chỉ số hiệu quả cho chuỗi cửa hàng điện máy.',
    scenarioEn: 'Complete the regional sales, shipping surcharge, and performance metrics workbook for an electronics chain.',
    banner: 'BÁO CÁO DOANH SỐ CHUỖI ĐIỆN MÁY 2026',
    rawSheetName: 'DuLieuGoc',
    targetSheetName: 'DienMay',
    extraSheetName: 'BaoCaoQuy',
    refSheetName: 'PhiVung',
    headers: ['Mã đơn', 'Thiết bị', 'Kênh bán', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Phân loại', 'Phí giao'],
    rows: [
      ['HN-TV01', 'Tivi OLED 55 inch', 'Online', 14, 18500000],
      ['SG-TL02', 'Tủ lạnh Inverter 420L', 'Showroom', 11, 14200000],
      ['DN-MG03', 'Máy giặt lồng ngang', 'Online', 19, 9800000],
      ['HN-DH04', 'Điều hoà 2 chiều 12k', 'Đại lý', 22, 11400000],
      ['SG-LN05', 'Máy lọc nước RO nóng lạnh', 'Online', 28, 6500000],
      ['CT-HB06', 'Robot hút bụi lau nhà', 'Showroom', 16, 7900000],
    ],
    refRows: [['HN', 180000], ['SG', 220000], ['DN', 200000], ['CT', 250000]],
    targetGroup: 'Online',
    passThreshold: 180000000,
    passLabel: 'Chủ lực',
    failLabel: 'Tiêu chuẩn',
    accentBg: '#166534',
  },
  {
    slug: 'cloud-subscriptions',
    fileName: 'ThueBao_SaaS_DoanhNghiep.xlsx',
    title: 'Quản lý Hợp đồng Thuê bao SaaS',
    titleEn: 'Enterprise SaaS Subscription Ledger',
    scenario: 'Tính giá trị hợp đồng năm, phân hạng khách hàng doanh nghiệp và tra cứu chiết khấu đối tác cho nền tảng phần mềm.',
    scenarioEn: 'Calculate annual contract values, customer tiers, and partner fee lookups for an enterprise SaaS ledger.',
    banner: 'SỔ THEO DÕI HỢP ĐỒNG THUÊ BAO SAAS 2026',
    rawSheetName: 'Sheet1',
    targetSheetName: 'ThueBao',
    extraSheetName: 'GiaHan',
    refSheetName: 'BangPhi',
    headers: ['Mã HĐ', 'Khách hàng', 'Phân khúc', 'Số ghế', 'Phí năm/ghế', 'Giá trị HĐ', 'Hạng KH', 'Phí hỗ trợ'],
    rows: [
      ['MB-SA10', 'Tập đoàn Sao Việt', 'Enterprise', 120, 1800000],
      ['MN-SA11', 'Công ty Minh Phú', 'SMB', 45, 1950000],
      ['MT-SA12', 'Trường ĐH Đông Á', 'Education', 200, 950000],
      ['MB-SA13', 'Ngân hàng Số Á Châu', 'Enterprise', 160, 1750000],
      ['MN-SA14', 'Chuỗi Dược An Khang', 'Enterprise', 95, 1850000],
      ['MB-SA15', 'Viện Thiết kế Đô thị', 'SMB', 35, 2000000],
    ],
    refRows: [['MB', 4500000], ['MN', 5000000], ['MT', 3800000]],
    targetGroup: 'Enterprise',
    passThreshold: 150000000,
    passLabel: 'VIP',
    failLabel: 'Thường',
    accentBg: '#1D4ED8',
  },
  {
    slug: 'port-containers',
    fileName: 'DieuDo_Container_CangBien.xlsx',
    title: 'Điều độ Sản lượng Container Cảng Biển',
    titleEn: 'Seaport Container Throughput Audit',
    scenario: 'Thống kê phí bốc xếp theo cảng đích, kiểm tra lô hàng ưu tiên thông quan và chuẩn hoá trang in điều vận.',
    scenarioEn: 'Audit container handling fees, priority customs clearance status, and dispatch print settings.',
    banner: 'BẢNG ĐIỀU ĐỘ SẢN LƯỢNG CONTAINER CẢNG BIỂN',
    rawSheetName: 'DataCang',
    targetSheetName: 'DieuDo',
    extraSheetName: 'LichTau',
    refSheetName: 'BieuCuoc',
    headers: ['Mã vận đơn', 'Chủ hàng', 'Tuyến tàu', 'Số TEU', 'Đơn giá TEU', 'Tổng cước', 'Luồng thông quan', 'Phụ phí cảng'],
    rows: [
      ['HP-CT21', 'Thép Hòa Phát Đông Bắc', 'Nội Á', 38, 4200000],
      ['SG-CT22', 'Thủy sản Minh Hải', 'Châu Âu', 26, 7800000],
      ['QN-CT23', 'Gỗ Nội thất Bình Định', 'Bắc Mỹ', 30, 8400000],
      ['HP-CT24', 'Điện tử Bắc Ninh', 'Châu Âu', 44, 7600000],
      ['SG-CT25', 'Cà phê Xuất khẩu Đắk Lắk', 'Châu Âu', 32, 7500000],
      ['VT-CT26', 'Hạt điều Bình Phước', 'Nội Á', 24, 4300000],
    ],
    refRows: [['HP', 1200000], ['SG', 1450000], ['QN', 1100000], ['VT', 1350000]],
    targetGroup: 'Châu Âu',
    passThreshold: 200000000,
    passLabel: 'Luồng xanh',
    failLabel: 'Luồng vàng',
    accentBg: '#0F766E',
  },
  {
    slug: 'clinic-pharmacy',
    fileName: 'KiemKe_DuocPham_BenhVien.xlsx',
    title: 'Kiểm kê Vật tư & Dược phẩm Nội viện',
    titleEn: 'Hospital Pharmacy Inventory Valuation',
    scenario: 'Xây dựng công thức định giá tồn kho dược phẩm, cảnh báo dự trù mua sắm và đối chiếu phụ phí bảo quản lạnh.',
    scenarioEn: 'Build formulas for pharmacy stock valuation, reorder alerts, and cold-storage handling fees.',
    banner: 'BẢNG KIỂM KÊ & ĐỊNH GIÁ DƯỢC PHẨM QUÝ IV',
    rawSheetName: 'Sheet1',
    targetSheetName: 'DuocPham',
    extraSheetName: 'DuTruMua',
    refSheetName: 'PhiBaoQuan',
    headers: ['Mã thuốc', 'Hoạt chất', 'Nhóm điều trị', 'Số hộp tồn', 'Giá nhập/hộp', 'Giá trị tồn', 'Trạng thái dự trù', 'Phí kho'],
    rows: [
      ['KS-DP01', 'Amoxicillin 500mg', 'Kháng sinh', 420, 145000],
      ['TM-DP02', 'Atorvastatin 20mg', 'Tim mạch', 310, 210000],
      ['VX-DP03', 'Vắc-xin Cúm tứ giá', 'Dự phòng', 180, 390000],
      ['KS-DP04', 'Cefuroxim 250mg', 'Kháng sinh', 260, 185000],
      ['TM-DP05', 'Losartan 50mg', 'Tim mạch', 350, 160000],
      ['VX-DP06', 'Huyết thanh kháng độc', 'Dự phòng', 95, 520000],
    ],
    refRows: [['KS', 450000], ['TM', 400000], ['VX', 1250000]],
    targetGroup: 'Kháng sinh',
    passThreshold: 60000000,
    passLabel: 'Đủ định mức',
    failLabel: 'Cần bổ sung',
    accentBg: '#1E40AF',
  },
  {
    slug: 'hotel-occupancy',
    fileName: 'DoanhThu_ChuoiKhachSan.xlsx',
    title: 'Hiệu suất Khai thác Chuỗi Khách sạn Nghỉ dưỡng',
    titleEn: 'Resort & Hotel Occupancy Revenue Model',
    scenario: 'Tổng hợp doanh thu buồng phòng theo điểm đến, đánh giá công suất khai thác và tra cứu phí dịch vụ đưa đón.',
    scenarioEn: 'Summarize room revenue by destination, evaluate occupancy performance, and lookup transfer fees.',
    banner: 'BÁO CÁO HIỆU SUẤT KHAI THÁC CHUỖI RESORT 2026',
    rawSheetName: 'BookingRaw',
    targetSheetName: 'BuongPhong',
    extraSheetName: 'TongKetNam',
    refSheetName: 'PhiDuaDon',
    headers: ['Mã cơ sở', 'Tên khu nghỉ dưỡng', 'Hạng sao', 'Đêm phòng bán', 'Giá bình quân', 'Doanh thu phòng', 'Đánh giá hiệu suất', 'Phí sân bay'],
    rows: [
      ['PQ-RS01', 'Pearl Bay Phú Quốc', '5 sao', 640, 3200000],
      ['DN-RS02', 'My Khe Ocean Đà Nẵng', '5 sao', 580, 2850000],
      ['NT-RS03', 'Cam Ranh Lagoon', '4 sao', 510, 2100000],
      ['DL-RS04', 'Pine Valley Đà Lạt', '4 sao', 490, 1950000],
      ['HL-RS05', 'Heritage Marina Hạ Long', '5 sao', 610, 3100000],
      ['PQ-RS06', 'Coral Reef Villas', '5 sao', 430, 3600000],
    ],
    refRows: [['PQ', 650000], ['DN', 450000], ['NT', 550000], ['DL', 500000], ['HL', 700000]],
    targetGroup: '5 sao',
    passThreshold: 1500000000,
    passLabel: 'Vượt kế hoạch',
    failLabel: 'Đạt chuẩn',
    accentBg: '#7C2D12',
  },
  {
    slug: 'solar-epc',
    fileName: 'DuToan_VatTu_DienMatTroi.xlsx',
    title: 'Quyết toán Vật tư Dự án Điện Mặt Trời',
    titleEn: 'Solar EPC Material Settlement Workbook',
    scenario: 'Tính giá trị quyết toán thiết bị điện mặt trời, phân nhóm gói thầu trọng điểm và kiểm soát định dạng báo cáo in.',
    scenarioEn: 'Compute solar EPC equipment settlement totals, classify major packages, and configure print layout.',
    banner: 'BẢNG QUYẾT TOÁN VẬT TƯ DỰ ÁN ĐIỆN MẶT TRỜI',
    rawSheetName: 'VatTuTam',
    targetSheetName: 'QuyetToan',
    extraSheetName: 'BienBan',
    refSheetName: 'DonGiaLapDat',
    headers: ['Mã hạng mục', 'Tên vật tư thiết bị', 'Gói thầu', 'Khối lượng', 'Đơn giá vật tư', 'Thành tiền', 'Cấp phê duyệt', 'Chi phí lắp'],
    rows: [
      ['PV-TB01', 'Tấm pin Mono 580Wp', 'Phần điện DC', 820, 2650000],
      ['IN-TB02', 'Biến tần chuỗi 110kW', 'Phần điện AC', 12, 68000000],
      ['KH-TB03', 'Khung nhôm định hình', 'Kết cấu mái', 450, 1150000],
      ['PV-TB04', 'Cáp điện DC 6mm2 chống tia UV', 'Phần điện DC', 1600, 42000],
      ['IN-TB05', 'Tủ hòa lưới & bảo vệ rơ-le', 'Phần điện AC', 6, 95000000],
      ['KH-TB06', 'Kẹp biên & tiếp địa mạ kẽm', 'Kết cấu mái', 900, 85000],
    ],
    refRows: [['PV', 3200000], ['IN', 8500000], ['KH', 2400000]],
    targetGroup: 'Phần điện AC',
    passThreshold: 500000000,
    passLabel: 'HĐQT duyệt',
    failLabel: 'Giám đốc dự án',
    accentBg: '#0369A1',
  },
  {
    slug: 'edtech-courses',
    fileName: 'ThongKe_KhoaHoc_TrucTuyen.xlsx',
    title: 'Báo cáo Ghi danh Học viện Trực tuyến',
    titleEn: 'Online Academy Enrollment Analytics',
    scenario: 'Phân tích doanh thu học phí các khoá đào tạo chứng chỉ số, thống kê nhóm kỹ năng mũi nhọn và tra cứu thù lao giảng viên.',
    scenarioEn: 'Analyze tuition revenue across digital certification courses, track top tracks, and lookup instructor stipends.',
    banner: 'THỐNG KÊ GHI DANH & DOANH THU HỌC VIỆN SỐ 2026',
    rawSheetName: 'Sheet1',
    targetSheetName: 'KhoaHoc',
    extraSheetName: 'LichKhaiGiang',
    refSheetName: 'ThuLaoGV',
    headers: ['Mã khoá', 'Tên khoá đào tạo', 'Chuyên ngành', 'Học viên', 'Học phí', 'Tổng thu', 'Xếp loại lớp', 'Phụ cấp mentor'],
    rows: [
      ['MS-KH01', 'Luyện thi MOS Word & Excel Chuẩn', 'Tin học văn phòng', 185, 1290000],
      ['DA-KH02', 'Phân tích dữ liệu SQL & Python', 'Dữ liệu', 142, 2490000],
      ['AI-KH03', 'Tự động hoá quy trình với AI', 'Trí tuệ nhân tạo', 210, 1990000],
      ['MS-KH04', 'MOS Expert Chuyên sâu Doanh nghiệp', 'Tin học văn phòng', 96, 1790000],
      ['DA-KH05', 'Thiết kế Dashboard Quản trị KPI', 'Dữ liệu', 128, 2190000],
      ['AI-KH06', 'Ứng dụng AI cho Nhân sự & Kế toán', 'Trí tuệ nhân tạo', 164, 1590000],
    ],
    refRows: [['MS', 3500000], ['DA', 5200000], ['AI', 6000000]],
    targetGroup: 'Trí tuệ nhân tạo',
    passThreshold: 250000000,
    passLabel: 'Lớp đông',
    failLabel: 'Tiêu chuẩn',
    accentBg: '#4338CA',
  },
  {
    slug: 'coffee-roastery',
    fileName: 'SanXuat_CaPhe_RangXay.xlsx',
    title: 'Kế hoạch Sản xuất & Xuất xưởng Cà phê Rang xay',
    titleEn: 'Specialty Coffee Roastery Production Ledger',
    scenario: 'Theo dõi giá trị xuất xưởng từng dòng hạt rang, phân tích kênh xuất khẩu và đối chiếu đơn giá bao bì van một chiều.',
    scenarioEn: 'Track ex-factory values by roast batch, analyze export channels, and lookup valve-packaging costs.',
    banner: 'SỔ THEO DÕI SẢN XUẤT & XUẤT XƯỞNG CÀ PHÊ 2026',
    rawSheetName: 'MeRang',
    targetSheetName: 'SanXuat',
    extraSheetName: 'TonHatXanh',
    refSheetName: 'PhiBaoBi',
    headers: ['Mã lô', 'Dòng sản phẩm', 'Thị trường', 'Sản lượng (kg)', 'Giá xuất/kg', 'Doanh thu lô', 'Kiểm định', 'Chi phí túi'],
    rows: [
      ['AR-CF01', 'Arabica Cầu Đất Rang Vừa', 'Nhật Bản', 850, 340000],
      ['RB-CF02', 'Fine Robusta Đắk Nông Honey', 'Nội địa', 1200, 215000],
      ['BL-CF03', 'Espresso Signature Blend', 'Hàn Quốc', 960, 275000],
      ['AR-CF04', 'Arabica Sơn La Sơ chế Ướt', 'Nhật Bản', 740, 310000],
      ['CB-CF05', 'Cold Brew Túi Lọc Tiện lợi', 'Nội địa', 680, 290000],
      ['BL-CF06', 'Pour Over Phin Giấy Đặc sản', 'Nhật Bản', 590, 360000],
    ],
    refRows: [['AR', 1800000], ['RB', 1400000], ['BL', 1600000], ['CB', 1950000]],
    targetGroup: 'Nhật Bản',
    passThreshold: 250000000,
    passLabel: 'Ưu tiên xuất',
    failLabel: 'Thường kỳ',
    accentBg: '#6D28D9',
  },
  {
    slug: 'fleet-ev',
    fileName: 'VanHanh_DoiXe_Dien.xlsx',
    title: 'Quản trị Chi phí Đội xe Giao nhận Điện',
    titleEn: 'Electric Delivery Fleet Operations Sheet',
    scenario: 'Tính doanh thu tuyến giao nhận xanh, theo dõi năng suất đội xe tải điện và tra cứu định mức bảo dưỡng định kỳ.',
    scenarioEn: 'Compute green delivery route revenue, track EV van productivity, and lookup maintenance allowances.',
    banner: 'BÁO CÁO VẬN HÀNH ĐỘI XE GIAO NHẬN ĐIỆN 2026',
    rawSheetName: 'NhatKyXe',
    targetSheetName: 'DoiXeDien',
    extraSheetName: 'LichSacPin',
    refSheetName: 'DinhMucBD',
    headers: ['Mã đội', 'Tuyến khai thác', 'Loại xe', 'Số chuyến', 'Doanh thu/chuyến', 'Tổng thu tuyến', 'Hiệu suất', 'Định mức bảo dưỡng'],
    rows: [
      ['VN-EV01', 'Nội thành Hà Nội - Bắc Ninh', 'Van điện 1 tấn', 145, 1650000],
      ['VS-EV02', 'TP.HCM - Bình Dương - Đồng Nai', 'Tải điện 2 tấn', 132, 2350000],
      ['VD-EV03', 'Đà Nẵng - Hội An - Chu Lai', 'Van điện 1 tấn', 98, 1750000],
      ['VN-EV04', 'Hà Nội - Hải Phòng Cao tốc', 'Tải điện 2 tấn', 118, 2600000],
      ['VS-EV05', 'Trung tâm Quận 1 - Khu Công nghệ cao', 'Xe máy điện Cargo', 320, 480000],
      ['VC-EV06', 'Cần Thơ - Mỹ Tho - Long Xuyên', 'Van điện 1 tấn', 105, 1820000],
    ],
    refRows: [['VN', 2800000], ['VS', 3100000], ['VD', 2500000], ['VC', 2600000]],
    targetGroup: 'Tải điện 2 tấn',
    passThreshold: 220000000,
    passLabel: 'Hiệu suất cao',
    failLabel: 'Ổn định',
    accentBg: '#0F766E',
  },
  {
    slug: 'textile-factory',
    fileName: 'KeHoach_MayXuatKhau.xlsx',
    title: 'Thống kê Đơn hàng Nhà máy May Xuất khẩu',
    titleEn: 'Export Garment Factory Order Schedule',
    scenario: 'Tổng hợp giá trị gia công FOB cho các chuyền may xuất khẩu, xét duyệt tiến độ giao hàng và tra cứu phí kiểm định vải.',
    scenarioEn: 'Calculate FOB garment order values, audit delivery readiness, and lookup fabric testing fees.',
    banner: 'BẢNG THEO DÕI ĐƠN HÀNG NHÀ MÁY MAY XUẤT KHẨU',
    rawSheetName: 'Sheet1',
    targetSheetName: 'DonMay',
    extraSheetName: 'NangSuatChuyen',
    refSheetName: 'PhiKiemVai',
    headers: ['Mã đơn may', 'Mặt hàng', 'Khách hàng vùng', 'Số sản phẩm', 'Đơn giá FOB', 'Kim ngạch', 'Tiến độ', 'Phí test vải'],
    rows: [
      ['JK-GM01', 'Áo khoác chống thấm 3 lớp', 'Bắc Âu', 4200, 385000],
      ['SH-GM02', 'Sơ mi sợi tre kháng khuẩn', 'Nhật Bản', 6500, 195000],
      ['SP-GM03', 'Bộ đồ thể thao tái chế', 'Bắc Mỹ', 8000, 210000],
      ['JK-GM04', 'Áo lông vũ siêu nhẹ thu đông', 'Bắc Âu', 3600, 440000],
      ['SH-GM05', 'Quần âu co giãn công sở', 'Nhật Bản', 5400, 230000],
      ['SP-GM06', 'Áo chạy bộ phản quang', 'Bắc Mỹ', 7200, 165000],
    ],
    refRows: [['JK', 4200000], ['SH', 2800000], ['SP', 3100000]],
    targetGroup: 'Bắc Âu',
    passThreshold: 1400000000,
    passLabel: 'Ưu tiên chuyền',
    failLabel: 'Theo lịch',
    accentBg: '#1E3A8A',
  },
];

const EXCEL_SUITE_TITLES: Record<MosVersion, Record<MosExamNumber, { vi: string; en: string; subVi: string; subEn: string }>> = {
  '2016': {
    1: { vi: 'Đề số 1 · Bán lẻ, Tài chính & Kho vận 2016', en: 'Exam 1 · Retail, Finance & Inventory 2016', subVi: 'SUM/AVERAGE/MAX/MIN, IF, SUMIF/COUNTIF, LEFT/PROPER & VLOOKUP chuẩn 77-727', subEn: 'Core 77-727 formulas: SUM/AVERAGE, IF, SUMIF/COUNTIF, text & VLOOKUP' },
    2: { vi: 'Đề số 2 · Quản trị Nhân sự & Chuỗi Cửa hàng', en: 'Exam 2 · HR Payroll & Store Chain Analytics', subVi: 'Cố định dòng cột, gộp tiêu đề, định dạng phần trăm & thống kê có điều kiện', subEn: 'Freeze panes, title merges, percentage formats & conditional stats' },
    3: { vi: 'Đề số 3 · Điều vận Cảng biển & Y tế Số', en: 'Exam 3 · Port Logistics & Healthcare Stock', subVi: 'Hàm xử lý mã chuỗi cổ điển, tra cứu bảng phụ & thiết lập trang in ngang', subEn: 'Classic string extraction, reference sheet lookups & landscape printing' },
    4: { vi: 'Đề số 4 · Sản xuất Xuất khẩu & Du lịch', en: 'Exam 4 · Export Manufacturing & Hospitality', subVi: 'Kiểm đếm COUNTA/COUNTBLANK, hàm logic lồng & quản lý đa trang tính', subEn: 'COUNTA/COUNTBLANK auditing, logical formulas & multi-sheet management' },
    5: { vi: 'Đề số 5 · Tổng duyệt Sát hạch 77-727 / 77-728', en: 'Exam 5 · Final Readiness Mock 77-727 / 77-728', subVi: 'Đề tổng duyệt toàn diện hàm thống kê, tra cứu và in ấn chuẩn MOS 2016', subEn: 'Full-length final readiness simulation for MOS Excel 2016' },
  },
  '2019': {
    1: { vi: 'Đề số 1 · Phân tích Kinh doanh & Hàm Mới 2019', en: 'Exam 1 · Business Analytics & 2019 Functions', subVi: 'Bổ sung CONCAT, TEXTJOIN, MAXIFS, MINIFS, IFS chuẩn MO-200 / MO-201', subEn: 'Features CONCAT, TEXTJOIN, MAXIFS, MINIFS, and IFS for MO-200 / MO-201' },
    2: { vi: 'Đề số 2 · Hợp đồng SaaS & Kiểm toán Doanh thu', en: 'Exam 2 · SaaS Contracts & Revenue Auditing', subVi: 'Ghép mã tự động TEXTJOIN, cực trị có điều kiện & kiểm soát trang in', subEn: 'TEXTJOIN code generation, conditional extrema & print scaling' },
    3: { vi: 'Đề số 3 · Quyết toán Dự án & Chuỗi Cung ứng', en: 'Exam 3 · EPC Project Settlement & Supply Chain', subVi: 'Phân tầng IFS/SWITCH, tra cứu INDEX/MATCH & bẫy lỗi IFERROR', subEn: 'Multi-tier IFS/SWITCH logic, INDEX/MATCH lookups & IFERROR handling' },
    4: { vi: 'Đề số 4 · Học viện Số & Vận hành Đội xe Xanh', en: 'Exam 4 · Digital Academy & EV Fleet Metrics', subVi: 'Tổng hợp đa điều kiện SUMIFS/COUNTIFS kết hợp chuẩn hoá bảng báo cáo', subEn: 'SUMIFS/COUNTIFS analytics paired with executive sheet formatting' },
    5: { vi: 'Đề số 5 · Tổng duyệt Sát hạch MO-200 / MO-201', en: 'Exam 5 · Final Readiness Mock MO-200 / MO-201', subVi: 'Mô phỏng sát đề thi thật MO-200 / MO-201 với bộ dữ liệu doanh nghiệp', subEn: 'Full-scale MO-200 / MO-201 exam simulation on enterprise workbooks' },
  },
  '365': {
    1: { vi: 'Đề số 1 · Bộ đề Chuẩn Quốc tế Microsoft 365', en: 'Exam 1 · Microsoft 365 Official Benchmark', subVi: 'Bộ dự án nền tảng 23 Sheets: thống kê, chuỗi, VLOOKUP/INDEX & kiểm toán', subEn: 'Core 23 Sheets benchmark: stats, text, VLOOKUP/INDEX & auditing' },
    2: { vi: 'Đề số 2 · Tra cứu Hiện đại XLOOKUP & Mảng Động', en: 'Exam 2 · Modern XLOOKUP & Dynamic Arrays', subVi: 'Ứng dụng XLOOKUP, UNIQUE, MAXIFS, TEXTJOIN chuẩn MO-210 / MO-211', subEn: 'Applies XLOOKUP, UNIQUE, MAXIFS, and TEXTJOIN for MO-210 / MO-211' },
    3: { vi: 'Đề số 3 · Tài chính Đám mây & Chuỗi Kho vận', en: 'Exam 3 · Cloud Finance & Fulfillment Modeling', subVi: 'XLOOKUP bẫy lỗi trực tiếp, FILTER/SORT & phân tích KPI đa chiều', subEn: 'Built-in XLOOKUP fallback, FILTER/SORT & multi-criteria KPI modeling' },
    4: { vi: 'Đề số 4 · Sản xuất Thông minh & Thương mại Số', en: 'Exam 4 · Smart Manufacturing & E-Commerce', subVi: 'Kết hợp XMATCH, IFS, SUMIFS và chuẩn hoá bố cục in một trang', subEn: 'Combines XMATCH, IFS, SUMIFS, and Fit-to-Page report layouts' },
    5: { vi: 'Đề số 5 · Tổng duyệt Sát hạch MO-210 / MO-211', en: 'Exam 5 · Final Readiness Mock MO-210 / MO-211', subVi: 'Đề tổng duyệt tốc độ 50 phút bao phủ trọn vẹn chuẩn Excel 365 mới nhất', subEn: '50-minute full-coverage mock exam for MO-210 / MO-211 certification' },
  },
};

export function excelExamSuiteMeta(version: MosVersion, examNumber: MosExamNumber) {
  return EXCEL_SUITE_TITLES[version][examNumber];
}

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
            const merged = (sh?.mergeData ?? []).some((m) => m.startRow === 0 && m.startColumn === 0 && m.endColumn >= 6);
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
            const merged = (sh?.mergeData ?? []).some((m) => m.startRow === 0 && m.startColumn === 0 && m.endColumn >= 6);
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

function makeExcelExpertTasks(prefix: string, version: MosVersion, orderIdx: number, seed: ExcelDatasetSeed): MosExcelProject['tasks'] {
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

  const t4: MosExcelProject['tasks'][number] = {
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
        title: `Gộp tiêu đề A1:H1, định dạng số #,##0 cho F3:H8 và thêm trang “${seed.extraSheetName}”`,
        titleEn: `Merge A1:H1, format F3:H8 as #,##0 & add sheet “${seed.extraSheetName}”`,
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
          const sh = primarySheet(sc.workbook);
          const merged = (sh?.mergeData ?? []).some((m) => m.startRow === 0 && m.startColumn === 0 && m.endColumn >= 6);
          const fmtOk = [0, 1, 2, 3, 4, 5].some((i) => {
            const st = resolveStyle(sc.workbook, cellAt(sh, i + 2, 5));
            return foldCell(st?.n?.pattern ?? '').includes('#,##0') || foldCell(st?.n?.pattern ?? '').includes('0');
          });
          const sheetOk = Boolean(findSheet(sc.workbook, seed.extraSheetName));
          return merged && fmtOk && sheetOk
            ? { passed: true, detail: `Đã gộp tiêu đề, định dạng số #,##0 và thêm trang “${seed.extraSheetName}”.` }
            : { passed: false, detail: `Cần gộp A1:H1, định dạng #,##0 cho F3:F8 và thêm trang “${seed.extraSheetName}”.` };
        },
      };

  return [t1, t2, t3, t4, t5];
}

function buildGeneratedExcelBank(): MosExcelProject[] {
  const out: MosExcelProject[] = [];
  const versions: MosVersion[] = ['2016', '2019', '365'];
  const exams: MosExamNumber[] = [1, 2, 3, 4, 5];

  for (let vIdx = 0; vIdx < versions.length; vIdx++) {
    const version = versions[vIdx];
    for (const examNumber of exams) {
      if (version === '365' && examNumber === 1) continue;
      const examSlot = vIdx * 5 + (examNumber - 1);
      const assocStart = (examSlot * 3) % EXCEL_SEEDS.length;
      const expStart = (examSlot * 5 + 2) % EXCEL_SEEDS.length;

      for (let order = 1; order <= 7; order++) {
        const seed = EXCEL_SEEDS[(assocStart + order - 1) % EXCEL_SEEDS.length];
        const variant = examSlot * 7 + (order - 1);
        const projId = `excel-${version}-e${examNumber}-p${order}`;
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
        const seed = EXCEL_SEEDS[(expStart + order - 1) % EXCEL_SEEDS.length];
        const projId = `excel-exp-${version}-e${examNumber}-p${order}`;
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
          tasks: makeExcelExpertTasks(projId, version, examSlot + order - 1, seed),
        });
      }
    }
  }
  return out;
}

export const MOS_GENERATED_EXCEL_PROJECTS: MosExcelProject[] = buildGeneratedExcelBank();
