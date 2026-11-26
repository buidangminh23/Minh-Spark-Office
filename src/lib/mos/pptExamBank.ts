import type { PresentationData } from '../slideTypes';
import type { SlideContent } from '../storage';
import { baseSlide, countAnimations, foldSlide, hasAnyLink } from './pptHelpers';
import type { MosExamNumber, MosPptProject, MosVersion } from './types';

type PptDeckSeed = {
  slug: string;
  fileName: string;
  title: string;
  titleEn: string;
  scenario: string;
  scenarioEn: string;
  deckHeading: string;
  deckSubtitle: string;
  s2Title: string;
  s2Body: string;
  s3Title: string;
  s3Body: string;
  s4Title: string;
  s4Body: string;
  footerBrand: string;
  speakerNote: string;
  sectionLabel: string;
  portalUrl: string;
  badgeText: string;
  themeTarget: 'sapphire-modern' | 'emerald-executive' | 'sunset-gradient' | 'midnight-dark' | 'minimalist-ivory' | 'coral-vibrant' | 'nordic-steel';
};

const PPT_SEEDS: PptDeckSeed[] = [
  {
    slug: 'ai-hospital',
    fileName: 'ChuyenDoiSo_BenhVien.pptx',
    title: 'Trình bày Hệ sinh thái Bệnh viện Thông minh',
    titleEn: 'Smart Hospital Ecosystem Pitch',
    scenario: 'Hoàn thiện bài thuyết trình hội thảo y tế số với chủ đề đồng bộ, bảng phân luồng, biểu đồ thời gian chờ và chân trang.',
    scenarioEn: 'Finalize the digital healthcare conference presentation with theme styling, triage table, wait-time chart, and footer.',
    deckHeading: 'BỆNH VIỆN THÔNG MINH 2026',
    deckSubtitle: 'Chẩn đoán hỗ trợ AI & Hồ sơ sức khoẻ liên thông',
    s2Title: 'Phân luồng khám ngoại trú tự động',
    s2Body: '• Đăng ký sinh trắc học tại Kiosk trong 18 giây\n• Điều phối phòng khám theo tải thực tế từng chuyên khoa',
    s3Title: 'Tỷ lệ rút ngắn thời gian chờ cận lâm sàng',
    s3Body: 'Minh hoạ tốc độ trả kết quả xét nghiệm và chẩn đoán hình ảnh qua 4 quý.',
    s4Title: 'Phụ lục kỹ thuật PACS nội bộ',
    s4Body: 'Thông số máy chủ lưu trữ ảnh DICOM — ẩn khi trình bày phiên toàn thể.',
    footerBrand: 'MedTech Summit 2026',
    speakerNote: 'Nhấn mạnh tỷ lệ hài lòng người bệnh tăng lên 96% sau 6 tháng triển khai.',
    sectionLabel: 'Giải pháp Lâm sàng',
    portalUrl: 'https://office.minhspark.com/medtech',
    badgeText: 'Chuẩn HL7 FHIR',
    themeTarget: 'sapphire-modern',
  },
  {
    slug: 'green-port',
    fileName: 'CangBien_Xanh_NetZero.pptx',
    title: 'Lộ trình Chuyển đổi Cảng Biển Xanh Net-Zero',
    titleEn: 'Net-Zero Green Seaport Roadmap',
    scenario: 'Thiết kế bài báo cáo ban điều hành cảng container điện khí hoá cần cẩu bờ và cấp điện bờ cho tàu biển quốc tế.',
    scenarioEn: 'Prepare an executive deck on electrified quay cranes and shore-power infrastructure for container terminals.',
    deckHeading: 'CẢNG BIỂN XANH NET-ZERO 2030',
    deckSubtitle: 'Điện khí hoá thiết bị bốc xếp & Quản lý năng lượng thông minh',
    s2Title: 'Cơ cấu phát thải tại cầu cảng hiện hữu',
    s2Body: '• 62% phát thải đến từ xe đầu kéo nội cảng chạy dầu diesel\n• Cần chuyển đổi 100% cẩu khung RTG sang nguồn điện lưới sạch',
    s3Title: 'Quy trình tiếp nhận tàu xanh 4 bước',
    s3Body: 'Trình bày sơ đồ quy trình cấp điện bờ và thông quan điện tử tự động.',
    s4Title: 'Bảng tính chi phí khấu hao nội bộ',
    s4Body: 'Tài liệu tham khảo riêng cho Ủy ban Đầu tư — ẩn khi trình chiếu đối ngoại.',
    footerBrand: 'GreenPort Vietnam',
    speakerNote: 'Trích dẫn cam kết giảm 45% lượng phát thải CO2 trên mỗi TEU trước năm 2028.',
    sectionLabel: 'Hạ tầng Điện khí hoá',
    portalUrl: 'https://office.minhspark.com/greenport',
    badgeText: '-45% CO2/TEU',
    themeTarget: 'emerald-executive',
  },
  {
    slug: 'fintech-wallet',
    fileName: 'RaMat_NganHang_So_GenZ.pptx',
    title: 'Chiến dịch Ra mắt Ngân hàng Số Thế hệ Mới',
    titleEn: 'Next-Gen Digital Banking Launch Deck',
    scenario: 'Chuẩn bị bộ slide công bố tính năng quản lý tài chính cá nhân tự động, biểu đồ tăng trưởng người dùng và hoạt hình điểm nhấn.',
    scenarioEn: 'Build the product launch deck featuring automated personal finance tools, user growth charts, and animations.',
    deckHeading: 'SPARKBANK · NGÂN HÀNG SỐ THẾ HỆ MỚI',
    deckSubtitle: 'Tiết kiệm mục tiêu tự động & Thanh toán đa quốc gia không phí ẩn',
    s2Title: 'Ba trụ cột trải nghiệm người dùng trẻ',
    s2Body: '• Mở tài khoản eKYC trong 45 giây\n• Chia hoá đơn nhóm tức thì qua mã VietQR động\n• Cảnh báo ngân sách chi tiêu thông minh',
    s3Title: 'Tăng trưởng người dùng hoạt động tháng (MAU)',
    s3Body: 'Trực quan hoá đà tăng trưởng MAU từ Quý I đến Quý IV bằng biểu đồ.',
    s4Title: 'Ghi chú kiểm thử bảo mật nội bộ',
    s4Body: 'Bản nháp dành riêng cho đội An toàn thông tin.',
    footerBrand: 'SparkBank Launch',
    speakerNote: 'Mời khán giả quét mã trải nghiệm tính năng Hũ Tiết Kiệm Tự Động ngay trên sân khấu.',
    sectionLabel: 'Trải nghiệm Sản phẩm',
    portalUrl: 'https://office.minhspark.com/fintech',
    badgeText: '2,4 Triệu MAU',
    themeTarget: 'midnight-dark',
  },
  {
    slug: 'vietnam-craft',
    fileName: 'XuatKhau_ThuCong_MyNghe.pptx',
    title: 'Quảng bá Thủ công Mỹ nghệ Việt Nam Toàn cầu',
    titleEn: 'Vietnamese Artisanal Craft Global Showcase',
    scenario: 'Hoàn thiện hồ sơ thuyết trình tại hội chợ quốc tế giới thiệu gốm sứ, mây tre đan bền vững và mạng lưới phân phối.',
    scenarioEn: 'Polish the international trade-fair presentation showcasing sustainable ceramics, bamboo crafts, and export channels.',
    deckHeading: 'TINH HOA THỦ CÔNG BỀN VỮNG VIỆT NAM',
    deckSubtitle: 'Bộ sưu tập nội thất sinh thái xuất khẩu mùa Thu – Đông 2026',
    s2Title: 'Nguồn nguyên liệu mây tre đạt chuẩn FSC',
    s2Body: '• Khai thác có kế hoạch gắn với tái sinh rừng tre bản địa\n• Sấy khô tự nhiên và phủ sơn gốc nước an toàn thực phẩm',
    s3Title: 'Danh mục dòng sản phẩm xuất khẩu chủ lực',
    s3Body: 'Chèn bảng quy cách đóng gói và số lượng đặt hàng tối thiểu (MOQ).',
    s4Title: 'Dự thảo chiết khấu nhà nhập khẩu độc quyền',
    s4Body: 'Chỉ hiển thị khi đàm phán trực tiếp 1-1 với đối tác phân phối.',
    footerBrand: 'VietCraft Expo 2026',
    speakerNote: 'Giới thiệu câu chuyện 3 thế hệ nghệ nhân tại làng gốm và làng mây tre truyền thống.',
    sectionLabel: 'Bộ sưu tập Xuất khẩu',
    portalUrl: 'https://office.minhspark.com/craft',
    badgeText: '100% FSC Eco',
    themeTarget: 'sunset-gradient',
  },
  {
    slug: 'semiconductor-talent',
    fileName: 'DaoTao_KySu_ViMach.pptx',
    title: 'Chương trình Đào tạo Kỹ sư Thiết kế Vi mạch',
    titleEn: 'Semiconductor IC Design Talent Program',
    scenario: 'Trình bày đề án hợp tác đại học – doanh nghiệp đào tạo 5.000 kỹ sư thiết kế chip và kiểm thử đóng gói bán dẫn.',
    scenarioEn: 'Present the university-industry partnership plan to train 5,000 IC design and packaging engineers.',
    deckHeading: 'ĐÀO TẠO NHÂN LỰC VI MẠCH BÁN DẪN 2026–2030',
    deckSubtitle: 'Liên kết phòng Lab EDA chuẩn công nghiệp & Học bổng thực tập quốc tế',
    s2Title: 'Lộ trình 4 học kỳ chuyên sâu thiết kế RTL & Physical',
    s2Body: '• Nền tảng kiến trúc vi xử lý RISC-V mở\n• Thực hành trực tiếp bộ công cụ mô phỏng & kiểm chứng phần cứng',
    s3Title: 'Phân bổ chỉ tiêu đào tạo theo mảng kỹ thuật',
    s3Body: 'Chèn biểu đồ cơ cấu kỹ sư Thiết kế mạch, Kiểm chứng và Đóng gói ATP.',
    s4Title: 'Ngân sách tài trợ bản quyền phần mềm EDA',
    s4Body: 'Phụ lục tài chính dành riêng cho hội đồng quản trị đại học.',
    footerBrand: 'SemiTalent Vietnam',
    speakerNote: 'Nhấn mạnh cam kết 100% học viên đạt chuẩn được tiếp nhận thực tập hưởng lương.',
    sectionLabel: 'Khung Chương trình',
    portalUrl: 'https://office.minhspark.com/semi',
    badgeText: '5.000 Kỹ sư IC',
    themeTarget: 'nordic-steel',
  },
  {
    slug: 'aviation-cargo',
    fileName: 'TrungTam_Logistics_HangKhong.pptx',
    title: 'Quy hoạch Nhà ga Hàng hoá Hàng không Tự động',
    titleEn: 'Automated Air Cargo Terminal Masterplan',
    scenario: 'Thiết kế bài thuyết trình quy hoạch nhà ga hàng hoá sân bay tích hợp kệ lưu trữ tự động AS/RS và dây chuyền soi chiếu nhanh.',
    scenarioEn: 'Design the air-cargo terminal masterplan presentation featuring AS/RS storage and rapid screening lanes.',
    deckHeading: 'NHÀ GA HÀNG HOÁ HÀNG KHÔNG THẾ HỆ MỚI',
    deckSubtitle: 'Tự động hoá xử lý ULD & Kết nối chuỗi cung ứng thương mại điện tử xuyên biên giới',
    s2Title: 'Công suất khai thác mục tiêu 550.000 tấn/năm',
    s2Body: '• Rút ngắn 40% thời gian luân chuyển lô hàng chuyển phát nhanh\n• Kho lạnh chuyên biệt cho dược phẩm và linh kiện điện tử nhạy nhiệt',
    s3Title: 'Quy trình xử lý mâm hàng ULD tự động',
    s3Body: 'Thể hiện chuỗi xử lý từ sân đỗ tàu bay tới cửa xuất xe tải bằng SmartArt.',
    s4Title: 'Phương án phân kỳ vốn vay hợp vốn',
    s4Body: 'Slide dự phòng cho phiên họp tổ chức tín dụng.',
    footerBrand: 'AeroCargo Hub 2026',
    speakerNote: 'Làm rõ khả năng kết nối trực tiếp đường cao tốc và khu thương mại tự do sân bay.',
    sectionLabel: 'Dây chuyền Tự động',
    portalUrl: 'https://office.minhspark.com/aerocargo',
    badgeText: '550K Tấn/Năm',
    themeTarget: 'coral-vibrant',
  },
  {
    slug: 'renewable-storage',
    fileName: 'HeThong_LuuTru_Pin_BESS.pptx',
    title: 'Giải pháp Lưu trữ Năng lượng Pin BESS Công nghiệp',
    titleEn: 'Utility-Scale BESS Energy Storage Pitch',
    scenario: 'Xây dựng bộ slide kỹ thuật – thương mại cho hệ thống pin lưu trữ điều tần lưới điện và dịch chuyển phụ tải giờ cao điểm.',
    scenarioEn: 'Create the commercial-technical deck for grid-scale battery storage and peak-shaving deployment.',
    deckHeading: 'HỆ THỐNG LƯU TRỮ NĂNG LƯỢNG BESS 200 MWh',
    deckSubtitle: 'Ổn định tần số lưới điện & Tối ưu chi phí phụ tải công nghiệp',
    s2Title: 'Công nghệ cell pin LFP làm mát chất lỏng',
    s2Body: '• Tuổi thọ vận hành vượt 8.000 chu kỳ nạp xả sâu\n• Hệ thống dập cháy khí dung đa tầng cách ly từng module',
    s3Title: 'Bảng so sánh hiệu quả cắt đỉnh phụ tải',
    s3Body: 'Chèn bảng đối chiếu chi phí điện trước và sau khi lắp đặt BESS.',
    s4Title: 'Thông số đấu nối trạm biến áp 110kV',
    s4Body: 'Bản vẽ đơn tuyến chi tiết dành cho kỹ sư điều độ.',
    footerBrand: 'GridStorage 2026',
    speakerNote: 'Giải thích cơ chế hoàn vốn trong 4,8 năm nhờ chênh lệch biểu giá điện ba thành phần.',
    sectionLabel: 'Kiến trúc BESS',
    portalUrl: 'https://office.minhspark.com/bess',
    badgeText: '8.000 Chu kỳ',
    themeTarget: 'minimalist-ivory',
  },
  {
    slug: 'smart-retail',
    fileName: 'ChuoiSieuThi_KhongTienMat.pptx',
    title: 'Mô hình Chuỗi Siêu thị Tiện lợi Tự Thanh toán',
    titleEn: 'Autonomous Cashless Convenience Store Deck',
    scenario: 'Hoàn thiện bài giới thiệu mô hình cửa hàng tiện lợi dùng quầy tự quét RFID, nhãn giá điện tử ESL và tối ưu tồn kho tươi sống.',
    scenarioEn: 'Complete the retail innovation presentation covering RFID self-checkout, electronic shelf labels, and fresh stock AI.',
    deckHeading: 'SIÊU THỊ TIỆN LỢI TỰ ĐỘNG 24/7',
    deckSubtitle: 'Thanh toán RFID 3 giây & Đồng bộ giá điện tử toàn hệ thống',
    s2Title: 'Trải nghiệm mua sắm không xếp hàng chờ',
    s2Body: '• Đặt giỏ hàng vào khay RFID tự nhận diện toàn bộ sản phẩm cùng lúc\n• Tự động áp mã ưu đãi thành viên và xuất hoá đơn điện tử tức thì',
    s3Title: 'Biểu đồ giảm tỷ lệ huỷ hàng thực phẩm tươi',
    s3Body: 'Chèn biểu đồ theo dõi tỷ lệ hao hụt qua 4 quý triển khai nhãn giá động.',
    s4Title: 'Chi phí thuê mặt bằng từng quận trung tâm',
    s4Body: 'Dữ liệu mật phòng Phát triển Mặt bằng — ẩn khi trình bày chung.',
    footerBrand: 'SmartRetail 2026',
    speakerNote: 'Trình diễn thực tế quy trình thanh toán giỏ 10 món hàng chỉ mất chưa tới 5 giây.',
    sectionLabel: 'Vận hành Cửa hàng',
    portalUrl: 'https://office.minhspark.com/retail',
    badgeText: 'Checkout 3 Giây',
    themeTarget: 'sapphire-modern',
  },
];

const PPT_SUITE_TITLES: Record<MosVersion, Record<MosExamNumber, { vi: string; en: string; subVi: string; subEn: string }>> = {
  '2016': {
    1: { vi: 'Đề số 1 · Thiết kế & Trình bày Chuẩn 77-729', en: 'Exam 1 · Core Presentation Design 77-729', subVi: 'Chủ đề, bố cục trang chiếu, bảng biểu, biểu đồ & chuyển tiếp cổ điển', subEn: 'Themes, slide layouts, tables, charts & classic transitions' },
    2: { vi: 'Đề số 2 · Hồ sơ Thương mại & Hội chợ Quốc tế', en: 'Exam 2 · Trade Fair & Commercial Pitch', subVi: 'Sơ đồ SmartArt, hình khối, ghi chú diễn giả & đầu chân trang chiếu', subEn: 'SmartArt diagrams, shapes, speaker notes & slide headers/footers' },
    3: { vi: 'Đề số 3 · Báo cáo Điều hành & Quy hoạch Hạ tầng', en: 'Exam 3 · Executive & Infrastructure Briefing', subVi: 'Tỷ lệ màn hình, ẩn trang phụ lục, sắp xếp slide & hoạt hình đối tượng', subEn: 'Slide sizing, hidden appendix slides, reordering & object animations' },
    4: { vi: 'Đề số 4 · Đào tạo Doanh nghiệp & Sản phẩm Số', en: 'Exam 4 · Corporate Training & Digital Launch', subVi: 'Slide Master, trình chiếu tuỳ chỉnh Custom Show & chia Phần (Section)', subEn: 'Slide Master branding, Custom Slide Shows & Section organization' },
    5: { vi: 'Đề số 5 · Tổng duyệt Sát hạch MOS PowerPoint 2016', en: 'Exam 5 · Final Readiness Mock 77-729', subVi: 'Đề tổng duyệt 50 phút bao quát toàn bộ kỹ năng trọng tâm 77-729', subEn: 'Full 50-minute readiness simulation for MOS PowerPoint 2016' },
  },
  '2019': {
    1: { vi: 'Đề số 1 · Chuyển cảnh Morph & Điều hướng 2019', en: 'Exam 1 · Morph Transitions & Navigation 2019', subVi: 'Bổ sung hiệu ứng Morph, liên kết chương & biểu đồ chuẩn MO-300', subEn: 'Introduces Morph transitions, slide links & charts for MO-300' },
    2: { vi: 'Đề số 2 · Thuyết trình Sản phẩm & Ngân hàng Số', en: 'Exam 2 · Product Keynote & Digital Banking', subVi: 'Hoạt hình phối hợp With/After Previous, phần Section & chân trang', subEn: 'Coordinated animations, Sections & consistent slide footers' },
    3: { vi: 'Đề số 3 · Năng lượng Sạch & Chuỗi Cung ứng', en: 'Exam 3 · Clean Energy & Logistics Brief', subVi: 'Biểu đồ trực quan, SmartArt quy trình, đóng dấu bảo mật & ghi chú', subEn: 'Data charts, process SmartArt, confidential watermarks & notes' },
    4: { vi: 'Đề số 4 · Liên kết Đại học & Công nghệ Bán dẫn', en: 'Exam 4 · Academic & Semiconductor Partnership', subVi: 'Bố cục so sánh, Handout Master in tài liệu phát tay & Custom Show', subEn: 'Comparison layouts, Handout Master setup & Custom Shows' },
    5: { vi: 'Đề số 5 · Tổng duyệt Sát hạch MO-300', en: 'Exam 5 · Final Readiness Mock MO-300', subVi: 'Đề sát hạch tổng hợp sát cấu trúc bài thi quốc tế MO-300', subEn: 'Comprehensive final simulation aligned with Certiport MO-300' },
  },
  '365': {
    1: { vi: 'Đề số 1 · Bộ đề Chuẩn Quốc tế Microsoft 365', en: 'Exam 1 · Microsoft 365 Official Benchmark', subVi: 'Bộ dự án chuẩn 23 Slides: Theme, bảng, biểu đồ, Morph & Kiosk', subEn: 'Core 23 Slides benchmark: Themes, tables, charts, Morph & Kiosk' },
    2: { vi: 'Đề số 2 · Thuyết trình Đám mây & Kiểm duyệt Nhóm', en: 'Exam 2 · Cloud Pitch & Collaborative Review', subVi: 'Nhận xét cộng tác trên slide, chuyển cảnh Morph/Zoom & đối tượng KPI', subEn: 'Collaborative slide comments, Morph/Zoom transitions & KPI badges' },
    3: { vi: 'Đề số 3 · Kiosk Triển lãm & Tự động hoá Trình chiếu', en: 'Exam 3 · Exhibition Kiosk & Auto-Timing', subVi: 'Cấu hình Kiosk lặp vô tận, tự chuyển trang theo giây & Slide Master', subEn: 'Looping Kiosk setup, timed slide advances & Slide Master governance' },
    4: { vi: 'Đề số 4 · Gọi vốn Công nghệ & Phát triển Bền vững', en: 'Exam 4 · Tech Fundraising & ESG Strategy', subVi: 'Kết hợp bảng dữ liệu, biểu đồ, SmartArt và chuỗi hoạt hình đa bước', subEn: 'Combines data tables, charts, SmartArt & multi-step animations' },
    5: { vi: 'Đề số 5 · Tổng duyệt Sát hạch MO-310', en: 'Exam 5 · Final Readiness Mock MO-310', subVi: 'Đề tổng duyệt toàn diện tốc độ cao chuẩn kỳ thi MO-310 mới nhất', subEn: 'Full-length high-tempo mock exam for MO-310 certification' },
  },
};

export function pptExamSuiteMeta(version: MosVersion, examNumber: MosExamNumber) {
  return PPT_SUITE_TITLES[version][examNumber];
}

function buildStarterDeck(seed: PptDeckSeed, prefix: string): SlideContent {
  const s2 = baseSlide(`${prefix}-s2`, 'title-content', seed.s2Title, seed.s2Body);
  s2.elements.push({
    id: `${prefix}-badge`,
    type: 'shape',
    shapeType: 'rounded-rect',
    x: 66,
    y: 66,
    width: 26,
    height: 15,
    fill: '#2563EB',
    color: '#FFFFFF',
    text: seed.badgeText,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  });
  const presentation: PresentationData = {
    title: seed.fileName,
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide(`${prefix}-s1`, 'title', seed.deckHeading, seed.deckSubtitle),
      s2,
      baseSlide(`${prefix}-s3`, 'title-content', seed.s3Title, seed.s3Body),
      baseSlide(`${prefix}-s4`, 'title-content', seed.s4Title, seed.s4Body),
    ],
    sections: [],
    customShows: [],
  };
  return { kind: 'slide', presentation };
}

function makePptAssocTasks(prefix: string, version: MosVersion, variant: number, seed: PptDeckSeed): MosPptProject['tasks'] {
  const layoutPick = variant % 2 === 0 ? 'comparison' : 'two-content';
  const layoutVi = layoutPick === 'comparison' ? 'So sánh (Comparison)' : 'Hai nội dung (Two Content)';
  const layoutEn = layoutPick === 'comparison' ? 'Comparison' : 'Two Content';

  const t1: MosPptProject['tasks'][number] = {
    id: `${prefix}-t1`,
    domainId: 'ppt-manage',
    title: `Áp dụng chủ đề thiết kế và thêm trang chiếu ${layoutVi}`,
    titleEn: `Apply presentation theme and insert a ${layoutEn} slide`,
    instruction: `Đổi Chủ đề (Theme) bài thuyết trình sang mẫu khác mặc định (khuyến nghị “${seed.themeTarget}”) và chèn thêm 1 trang chiếu mới dùng bố cục ${layoutVi}.`,
    instructionEn: `Apply a non-default Theme (such as “${seed.themeTarget}”) and insert a new slide with the ${layoutEn} layout.`,
    ribbonPath: `Thiết kế → Chủ đề · Trang đầu → Trang chiếu mới (${layoutVi})`,
    hint: `Vào Thiết kế chọn chủ đề mới, sau đó ở thẻ Trang đầu bấm Trang chiếu mới → chọn bố cục ${layoutVi}.`,
    points: 20,
    solution: {
      steps: [
        'Mở thẻ Thiết kế (Design) trên thanh Ribbon → chọn một Chủ đề khác Office Classic.',
        'Quay lại thẻ Trang đầu (Home) → bấm mũi tên cạnh nút Trang chiếu mới (New Slide).',
        `Chọn đúng mẫu bố cục ${layoutVi} để thêm trang mới vào bài.`,
      ],
      examTrap: 'Không bấm thẳng vào nửa trên nút New Slide nếu nó tạo ra bố cục Title & Content mặc định thay vì bố cục đề yêu cầu.',
      verifyTip: `Bài thuyết trình mang chủ đề mới và có tối thiểu 5 trang chiếu chứa bố cục ${layoutEn}.`,
    },
    applySampleSolution: (sc) => {
      sc.presentation.themeId = seed.themeTarget;
      sc.presentation.slides.push({
        id: `${prefix}-added`,
        layout: layoutPick,
        background: { type: 'solid', value: '#FFFFFF' },
        elements: [],
        notes: '',
        transition: { type: 'none', duration: 0.5 },
      });
    },
    check: (sc) => {
      const themeOk = Boolean(sc.presentation.themeId && sc.presentation.themeId !== 'office-classic');
      const layoutOk = sc.presentation.slides.length >= 5 && sc.presentation.slides.some((s) => s.layout === layoutPick);
      return themeOk && layoutOk
        ? { passed: true, detail: `Đã áp dụng chủ đề “${sc.presentation.themeId}” và chèn trang ${layoutVi}.` }
        : { passed: false, detail: `Cần đổi Chủ đề khác mặc định và thêm 1 trang bố cục ${layoutVi}.` };
    },
  };

  const visualMode = variant % 3;
  const t2: MosPptProject['tasks'][number] = visualMode === 0
    ? {
        id: `${prefix}-t2`,
        domainId: 'ppt-content',
        title: 'Chèn Bảng dữ liệu (Table) vào Slide 3',
        titleEn: 'Insert a comparison Table on Slide 3',
        instruction: `Trên trang chiếu số 3 (“${seed.s3Title}”), chèn một đối tượng Bảng (Table) tối thiểu 3 cột × 3 dòng.`,
        instructionEn: `On Slide 3 (“${seed.s3Title}”), insert a Table with at least 3 columns and 3 rows.`,
        ribbonPath: 'Chọn Slide 3 → Chèn (Insert) → Bảng (Table)',
        hint: 'Chọn Slide 3 ở cột trái, mở thẻ Chèn → Bảng và chèn một bảng dữ liệu vào trang chiếu.',
        points: 20,
        solution: {
          steps: [
            `Bấm chọn Slide 3 (“${seed.s3Title}”) ở danh sách thu nhỏ bên trái.`,
            'Mở thẻ Chèn (Insert) trên thanh công cụ.',
            'Bấm Bảng (Table) và chọn kích thước từ 3×3 trở lên để đưa bảng vào trang chiếu.',
          ],
          examTrap: 'Chú ý chọn đúng trang nội dung trước khi bấm Chèn bảng để tránh đặt nhầm lên trang bìa.',
          verifyTip: 'Trên trang chiếu xuất hiện khung bảng có lưới ô dữ liệu rõ ràng.',
        },
        applySampleSolution: (sc) => {
          sc.presentation.slides[2]?.elements.push({
            id: `${prefix}-tbl`,
            type: 'table',
            x: 10,
            y: 28,
            width: 80,
            height: 48,
            tableRows: 3,
            tableCols: 3,
          });
        },
        check: (sc) =>
          sc.presentation.slides.some((s) => s.elements.some((el) => el.type === 'table'))
            ? { passed: true, detail: 'Đã chèn đối tượng Bảng vào bài thuyết trình.' }
            : { passed: false, detail: 'Chưa thấy đối tượng Bảng (Table) nào trên các trang chiếu.' },
      }
    : visualMode === 1
      ? {
          id: `${prefix}-t2`,
          domainId: 'ppt-content',
          title: 'Chèn Biểu đồ trực quan (Chart) vào Slide 3',
          titleEn: 'Insert a data Chart on Slide 3',
          instruction: `Trên trang chiếu số 3 (“${seed.s3Title}”), chèn một Biểu đồ (Chart) để minh hoạ xu hướng số liệu.`,
          instructionEn: `On Slide 3 (“${seed.s3Title}”), insert a Chart to visualize the data trend.`,
          ribbonPath: 'Chọn Slide 3 → Chèn (Insert) → Biểu đồ (Chart)',
          hint: 'Chuyển tới Slide 3, mở thẻ Chèn → bấm Biểu đồ (Chart) và chọn kiểu biểu đồ cột, đường hoặc tròn.',
          points: 20,
          solution: {
            steps: [
              `Chọn trang chiếu số 3 (“${seed.s3Title}”) trong ngăn danh sách trang.`,
              'Mở thẻ Chèn (Insert) → bấm nút Biểu đồ (Chart).',
              'Chọn kiểu biểu đồ phù hợp (Column / Line / Doughnut) và bấm Chèn.',
            ],
            examTrap: 'Không vẽ các hình chữ nhật rời bằng Shape để giả làm biểu đồ cột.',
            verifyTip: 'Đối tượng Biểu đồ dữ liệu chuẩn xuất hiện trực tiếp trên Slide 3.',
          },
          applySampleSolution: (sc) => {
            sc.presentation.slides[2]?.elements.push({
              id: `${prefix}-chart`,
              type: 'chart',
              x: 10,
              y: 26,
              width: 78,
              height: 52,
              chartType: version === '2016' ? 'column' : 'doughnut',
            });
          },
          check: (sc) =>
            sc.presentation.slides.some((s) => s.elements.some((el) => el.type === 'chart'))
              ? { passed: true, detail: 'Đã chèn đối tượng Biểu đồ vào bài thuyết trình.' }
              : { passed: false, detail: 'Chưa tìm thấy đối tượng Biểu đồ (Chart) nào.' },
        }
      : {
          id: `${prefix}-t2`,
          domainId: 'ppt-content',
          title: 'Chèn sơ đồ quy trình SmartArt và gắn Siêu liên kết',
          titleEn: 'Insert a SmartArt graphic and add a Hyperlink',
          instruction: `Chèn một sơ đồ SmartArt vào Slide 3 và gắn siêu liên kết “${seed.portalUrl}” lên một đối tượng chữ hoặc thẻ hình trong bài.`,
          instructionEn: `Insert a SmartArt graphic on Slide 3 and attach the hyperlink “${seed.portalUrl}” to any text or shape object.`,
          copyTokens: [seed.portalUrl],
          ribbonPath: 'Chèn → SmartArt · Chèn → Liên kết (Ctrl + K)',
          hint: `Chèn 1 sơ đồ SmartArt trên Slide 3, sau đó chọn thẻ nhãn trên Slide 2 bấm Chèn → Liên kết nhập “${seed.portalUrl}”.`,
          points: 20,
          solution: {
            steps: [
              'Chọn Slide 3, vào thẻ Chèn (Insert) → bấm SmartArt → chọn mẫu Quy trình (Process) rồi chèn.',
              'Chọn một khung tiêu đề hoặc hình khối trên trang chiếu.',
              `Mở Chèn → Liên kết (hoặc Ctrl + K), dán địa chỉ “${seed.portalUrl}” và lưu.`,
            ],
            formulaOrValue: seed.portalUrl,
            shortcut: 'Ctrl + K',
            examTrap: 'Hoàn thành đủ cả 2 phần: sơ đồ SmartArt và liên kết điều hướng URL.',
            verifyTip: 'Slide 3 có sơ đồ SmartArt và bài thuyết trình có đối tượng gắn liên kết hoạt động.',
          },
          applySampleSolution: (sc) => {
            sc.presentation.slides[2]?.elements.push({
              id: `${prefix}-sa`,
              type: 'smartart',
              x: 10,
              y: 28,
              width: 78,
              height: 48,
              smartArtType: 'process',
            });
            if (sc.presentation.slides[0]?.elements[0]) {
              sc.presentation.slides[0].elements[0].link = { kind: 'url', url: seed.portalUrl };
            }
          },
          check: (sc) => {
            const hasSa = sc.presentation.slides.some((s) => s.elements.some((el) => el.type === 'smartart'));
            const linkOk = hasAnyLink(sc.presentation.slides);
            return hasSa && linkOk
              ? { passed: true, detail: 'Đã chèn sơ đồ SmartArt và gắn siêu liên kết thành công.' }
              : { passed: false, detail: `Cần có đủ sơ đồ SmartArt và liên kết “${seed.portalUrl}”.` };
          },
        };

  const t3: MosPptProject['tasks'][number] = version === '2016'
    ? {
        id: `${prefix}-t3`,
        domainId: 'ppt-motion',
        title: 'Chuyển cảnh Fade/Wipe toàn bài và gắn Hoạt hình trên Slide 2',
        titleEn: 'Apply Fade/Wipe transition to all slides and animate Slide 2',
        instruction: 'Áp dụng hiệu ứng chuyển tiếp Mờ dần (Fade) hoặc Quét (Wipe) cho tất cả trang chiếu và gắn ít nhất 1 hiệu ứng Hoạt hình (Animation) cho đối tượng trên Slide 2.',
        instructionEn: 'Apply the Fade or Wipe transition to all slides and add an Animation effect to at least one object on Slide 2.',
        ribbonPath: 'Chuyển tiếp → Fade/Wipe → Áp dụng cho tất cả · Hoạt hình (Slide 2)',
        hint: 'Trong thẻ Chuyển tiếp chọn Fade/Wipe rồi bấm Áp dụng cho tất cả; tiếp theo chọn đối tượng trên Slide 2 và gắn 1 hiệu ứng trong thẻ Hoạt hình.',
        points: 20,
        solution: {
          steps: [
            'Mở thẻ Chuyển tiếp (Transitions) → chọn hiệu ứng Mờ dần (Fade) hoặc Quét (Wipe).',
            'Bấm nút Áp dụng cho tất cả (Apply To All) để đồng bộ mọi trang chiếu.',
            'Chuyển sang Slide 2, chọn khung nội dung hoặc nhãn hình và bấm chọn 1 hiệu ứng trong thẻ Hoạt hình (Animations).',
          ],
          examTrap: 'Nếu quên bấm Apply To All, trang chiếu mới thêm sẽ vẫn ở trạng thái None và mất điểm.',
          verifyTip: 'Tất cả slide đều có chuyển cảnh Fade/Wipe và Slide 2 có huy hiệu số hoạt hình.',
        },
        applySampleSolution: (sc) => {
          for (const slide of sc.presentation.slides) {
            slide.transition = { ...slide.transition, type: 'fade', duration: 1 };
          }
          if (sc.presentation.slides[1]?.elements[0]) {
            sc.presentation.slides[1].elements[0].animation = { type: 'fade-in', duration: 0.6, delay: 0 };
          }
        },
        check: (sc) => {
          const allTrans = sc.presentation.slides.length > 0 && sc.presentation.slides.every((s) => s.transition.type === 'fade' || s.transition.type === 'wipe' || s.transition.type === 'push');
          const animOk = countAnimations(sc.presentation.slides[1]?.elements ?? []) >= 1;
          return allTrans && animOk
            ? { passed: true, detail: 'Toàn bộ slide đã có chuyển cảnh và Slide 2 đã gắn hoạt hình.' }
            : { passed: false, detail: 'Cần áp dụng chuyển cảnh Fade/Wipe cho TẤT CẢ slide và gắn hoạt hình trên Slide 2.' };
        },
      }
    : {
        id: `${prefix}-t3`,
        domainId: 'ppt-motion',
        title: 'Áp dụng chuyển cảnh Biến hình (Morph) và hoạt hình đối tượng Slide 2',
        titleEn: 'Apply Morph transition across slides and animate Slide 2',
        instruction: 'Áp dụng hiệu ứng chuyển tiếp Biến hình (Morph) cho toàn bộ các trang chiếu và gắn ít nhất 1 hiệu ứng Hoạt hình cho đối tượng trên Slide 2.',
        instructionEn: 'Apply the Morph transition to all slides and attach an Animation to an object on Slide 2.',
        ribbonPath: `Chuyển tiếp → Biến hình (Morph) → Áp dụng cho tất cả (${version === '2019' ? 'MO-300' : 'MO-310'})`,
        hint: 'Vào thẻ Chuyển tiếp chọn Morph → bấm Áp dụng cho tất cả, sau đó sang Slide 2 gắn 1 hiệu ứng Hoạt hình.',
        points: 20,
        solution: {
          steps: [
            'Mở thẻ Chuyển tiếp (Transitions) → chọn hiệu ứng Biến hình (Morph).',
            'Bấm Áp dụng cho tất cả (Apply To All) để toàn bộ bộ slide chuyển động mượt mà.',
            'Chọn Slide 2, bấm vào thẻ hình hoặc khung chữ rồi chọn 1 hiệu ứng trong thẻ Hoạt hình.',
          ],
          examTrap: 'Morph là hiệu ứng trọng tâm từ kỳ thi MOS 2019 và MOS 365; nhớ bấm Apply To All sau khi thêm slide mới.',
          verifyTip: 'Mọi trang chiếu đều mang chuyển tiếp Morph và đối tượng trên Slide 2 có gắn hoạt hình.',
        },
        applySampleSolution: (sc) => {
          for (const slide of sc.presentation.slides) {
            slide.transition = { ...slide.transition, type: 'morph', duration: 1 };
          }
          if (sc.presentation.slides[1]?.elements[0]) {
            sc.presentation.slides[1].elements[0].animation = { type: 'fly-in', duration: 0.6, delay: 0 };
          }
        },
        check: (sc) => {
          const morphOk = sc.presentation.slides.length > 0 && sc.presentation.slides.every((s) => s.transition.type === 'morph');
          const animOk = countAnimations(sc.presentation.slides[1]?.elements ?? []) >= 1;
          return morphOk && animOk
            ? { passed: true, detail: 'Đã áp dụng chuyển tiếp Morph toàn bài và hoạt hình trên Slide 2.' }
            : { passed: false, detail: 'Cần đặt chuyển tiếp Morph cho tất cả các trang và gắn ít nhất 1 hoạt hình ở Slide 2.' };
        },
      };

  const t4: MosPptProject['tasks'][number] = {
    id: `${prefix}-t4`,
    domainId: 'ppt-manage',
    title: 'Ẩn trang phụ lục nội bộ và bổ sung Ghi chú diễn giả (Speaker Notes)',
    titleEn: 'Hide the internal appendix slide and add Speaker Notes',
    instruction: `Đặt chế độ Ẩn trang chiếu (Hide Slide) cho trang phụ lục “${seed.s4Title}” và nhập ghi chú thuyết trình chứa cụm “${seed.speakerNote.slice(0, 18)}” vào Slide 1.`,
    instructionEn: `Hide the appendix slide “${seed.s4Title}” and add speaker notes starting with “${seed.speakerNote.slice(0, 18)}” on Slide 1.`,
    copyTokens: [seed.speakerNote],
    ribbonPath: 'Chuột phải / Trình chiếu → Ẩn trang chiếu · Khung Ghi chú (Notes) Slide 1',
    hint: `Chọn trang “${seed.s4Title}” bật Ẩn trang chiếu, sau đó về Slide 1 dán nội dung ghi chú diễn giả vào khung Notes bên dưới.`,
    points: 20,
    solution: {
      steps: [
        `Chọn trang phụ lục “${seed.s4Title}” ở cột trái → bật Ẩn trang chiếu (Hide Slide) trong thẻ Trình chiếu hoặc menu chuột phải.`,
        'Chuyển về Slide 1 (trang tiêu đề mở đầu).',
        'Mở khung Ghi chú (Notes) phía dưới trang chiếu và dán nội dung ghi chú bằng nút Click-to-Copy.',
      ],
      formulaOrValue: seed.speakerNote,
      examTrap: 'Đề yêu cầu Ẩn (Hide Slide) chứ KHÔNG xoá trang phụ lục — xoá mất trang sẽ bị trừ điểm.',
      verifyTip: 'Trang phụ lục có biểu tượng gạch chéo ẩn và Slide 1 lưu đầy đủ lời dẫn diễn giả.',
    },
    applySampleSolution: (sc) => {
      const target = sc.presentation.slides.find((s) => foldSlide(s.elements[0]?.text ?? '').includes(foldSlide(seed.s4Title))) ?? sc.presentation.slides[3];
      if (target) target.hidden = true;
      if (sc.presentation.slides[0]) sc.presentation.slides[0].notes = seed.speakerNote;
    },
    check: (sc) => {
      const hiddenOk = sc.presentation.slides.some((s) => Boolean(s.hidden));
      const noteKey = foldSlide(seed.speakerNote.slice(0, 14));
      const noteOk = foldSlide(sc.presentation.slides[0]?.notes ?? '').includes(noteKey);
      return hiddenOk && noteOk
        ? { passed: true, detail: 'Đã ẩn trang phụ lục nội bộ và điền ghi chú diễn giả trên Slide 1.' }
        : { passed: false, detail: 'Cần bật Ẩn trang chiếu cho trang phụ lục và nhập Ghi chú diễn giả tại Slide 1.' };
    },
  };

  const t5: MosPptProject['tasks'][number] = version === '365'
    ? {
        id: `${prefix}-t5`,
        domainId: 'ppt-deliver',
        title: `Bật Chân trang “${seed.footerBrand}”, Số trang và thêm Nhận xét rà soát`,
        titleEn: `Set Footer “${seed.footerBrand}”, Slide Numbers & add a Review Comment`,
        instruction: `Bật hiển thị Số trang chiếu, đặt Chân trang (Footer) chứa “${seed.footerBrand}” và đính kèm ít nhất 1 Nhận xét (Comment) rà soát trên Slide 1.`,
        instructionEn: `Enable Slide Numbers, set Footer text to “${seed.footerBrand}”, and attach a Review Comment on Slide 1.`,
        copyTokens: [seed.footerBrand],
        ribbonPath: 'Chèn → Đầu trang & Chân trang · Xem lại → Nhận xét mới',
        hint: `Mở Đầu trang & Chân trang bật Số trang + nhập “${seed.footerBrand}”, sau đó sang thẻ Xem lại thêm 1 Nhận xét trên Slide 1.`,
        points: 20,
        solution: {
          steps: [
            `Mở Chèn → Đầu trang & Chân trang, tích bật Số trang chiếu và nhập “${seed.footerBrand}” vào ô Chân trang.`,
            'Bấm Áp dụng cho tất cả để lưu cấu hình chân trang.',
            'Trên Slide 1, mở thẻ Xem lại (Review) → bấm Nhận xét mới (New Comment) và lưu ý kiến kiểm duyệt.',
          ],
          formulaOrValue: seed.footerBrand,
          examTrap: 'Kiểm tra đủ cả 3 điều kiện: Số trang bật, Chân trang đúng chuỗi và có ít nhất 1 Comment.',
          verifyTip: `Chân trang hiện “${seed.footerBrand}” kèm số trang và Slide 1 có gắn nhận xét.`,
        },
        applySampleSolution: (sc) => {
          sc.presentation.headerFooter = { showSlideNumber: true, showFooter: true, footerText: seed.footerBrand };
          if (sc.presentation.slides[0]) {
            sc.presentation.slides[0].comments = [{ id: `${prefix}-cm`, author: 'Reviewer', text: 'Đã duyệt bố cục 365', createdAt: 1 }];
          }
        },
        check: (sc) => {
          const hf = sc.presentation.headerFooter;
          const sm = sc.presentation.slideMaster;
          const numOk = Boolean(hf?.showSlideNumber || (sm?.enabled && sm?.showSlideNumber));
          const ftr = hf?.footerText ?? sm?.footerText ?? '';
          const ftrOk = foldSlide(ftr).includes(foldSlide(seed.footerBrand));
          const cmtOk = sc.presentation.slides.some((s) => (s.comments?.length ?? 0) >= 1);
          return numOk && ftrOk && cmtOk
            ? { passed: true, detail: `Đã bật chân trang “${ftr}”, số trang và nhận xét kiểm duyệt.` }
            : { passed: false, detail: `Cần bật Số trang, Chân trang “${seed.footerBrand}” và thêm ít nhất 1 Nhận xét.` };
        },
      }
    : {
        id: `${prefix}-t5`,
        domainId: 'ppt-deliver',
        title: `Bật Chân trang “${seed.footerBrand}”, Số trang và phân nhóm Phần (Section)`,
        titleEn: `Enable Footer “${seed.footerBrand}”, Slide Numbers & add a Section`,
        instruction: `Bật Số trang chiếu, nhập Chân trang chứa “${seed.footerBrand}” (ẩn trên trang tiêu đề) và tạo ít nhất 1 Phần (Section) ví dụ “${seed.sectionLabel}”.`,
        instructionEn: `Enable Slide Numbers, set Footer to “${seed.footerBrand}” (hidden on title slide), and add a Section.`,
        copyTokens: [seed.footerBrand, seed.sectionLabel],
        ribbonPath: 'Chèn → Đầu trang & Chân trang · Trang đầu → Phần (Section)',
        hint: `Thiết lập Chân trang “${seed.footerBrand}” + Số trang, sau đó ở thẻ Trang đầu bấm Phần → Thêm phần.`,
        points: 20,
        solution: {
          steps: [
            `Mở hộp thoại Đầu trang & Chân trang, bật Số trang chiếu và nhập “${seed.footerBrand}” vào Chân trang.`,
            'Tích chọn Không hiện trên trang tiêu đề (Don’t show on title slide) rồi áp dụng.',
            `Ở thẻ Trang đầu (Home) → bấm Phần (Section) → Thêm phần và đặt tên “${seed.sectionLabel}”.`,
          ],
          formulaOrValue: seed.footerBrand,
          examTrap: 'Đừng bỏ sót thao tác chia Phần (Section) để tổ chức cấu trúc bài thuyết trình.',
          verifyTip: `Chân trang lưu “${seed.footerBrand}”, số trang bật và danh sách slide được gom theo Phần.`,
        },
        applySampleSolution: (sc) => {
          sc.presentation.headerFooter = { showSlideNumber: true, showFooter: true, footerText: seed.footerBrand, hideOnTitle: true };
          sc.presentation.sections = [{ id: `${prefix}-sec`, name: seed.sectionLabel }];
        },
        check: (sc) => {
          const hf = sc.presentation.headerFooter;
          const sm = sc.presentation.slideMaster;
          const numOk = Boolean(hf?.showSlideNumber || (sm?.enabled && sm?.showSlideNumber));
          const ftr = hf?.footerText ?? sm?.footerText ?? '';
          const ftrOk = foldSlide(ftr).includes(foldSlide(seed.footerBrand));
          const secOk = (sc.presentation.sections?.length ?? 0) >= 1;
          return numOk && ftrOk && secOk
            ? { passed: true, detail: `Đã thiết lập chân trang “${ftr}”, số trang và phân nhóm Section.` }
            : { passed: false, detail: `Cần bật Số trang, Chân trang “${seed.footerBrand}” và tạo ít nhất 1 Section.` };
        },
      };

  return [t1, t2, t3, t4, t5];
}

function makePptExpertTasks(prefix: string, version: MosVersion, orderIdx: number, seed: PptDeckSeed): MosPptProject['tasks'] {
  const t1: MosPptProject['tasks'][number] = {
    id: `${prefix}-t1`,
    domainId: 'ppt-deliver',
    title: `Chuẩn hoá Slide Master với chân trang “${seed.footerBrand}” và chủ đề mới`,
    titleEn: `Configure Slide Master footer “${seed.footerBrand}” & presentation theme`,
    instruction: `Đổi Chủ đề bài thuyết trình sang “${seed.themeTarget}”, mở Slide Master bật kích hoạt, điền chân trang “${seed.footerBrand}” và bật Số trang chiếu.`,
    instructionEn: `Apply theme “${seed.themeTarget}”, enable Slide Master with footer “${seed.footerBrand}”, and turn on Slide Numbers.`,
    copyTokens: [seed.footerBrand],
    ribbonPath: 'Thiết kế → Chủ đề · Xem (View) → Slide Master',
    hint: `Chọn chủ đề “${seed.themeTarget}”, sau đó mở Xem → Slide Master, bật áp dụng, điền “${seed.footerBrand}” và bật Số trang.`,
    points: 20,
    solution: {
      steps: [
        `Mở thẻ Thiết kế (Design) → chọn chủ đề “${seed.themeTarget}”.`,
        'Chuyển sang thẻ Xem (View) → bấm mở hộp cấu hình Slide Master.',
        `Bật kích hoạt Slide Master, dán “${seed.footerBrand}” vào Chân trang và bật Số trang rồi lưu.`,
      ],
      formulaOrValue: seed.footerBrand,
      examTrap: 'Đề Expert kiểm tra trực tiếp cấu hình trong Slide Master chứ không chỉ hộp thoại Header & Footer thường.',
      verifyTip: `Chủ đề đổi sang ${seed.themeTarget} và Slide Master đang bật với chân trang “${seed.footerBrand}”.`,
    },
    applySampleSolution: (sc) => {
      sc.presentation.themeId = seed.themeTarget;
      sc.presentation.slideMaster = { enabled: true, showSlideNumber: true, footerText: seed.footerBrand };
    },
    check: (sc) => {
      const themeOk = Boolean(sc.presentation.themeId && sc.presentation.themeId !== 'office-classic');
      const sm = sc.presentation.slideMaster;
      const smOk = Boolean(sm?.enabled && sm?.showSlideNumber && foldSlide(sm?.footerText ?? '').includes(foldSlide(seed.footerBrand)));
      return themeOk && smOk
        ? { passed: true, detail: `Đã đồng bộ chủ đề và Slide Master “${sm?.footerText}”.` }
        : { passed: false, detail: `Cần đổi Chủ đề và cấu hình Slide Master bật Số trang + Chân trang “${seed.footerBrand}”.` };
    },
  };

  const t2: MosPptProject['tasks'][number] = {
    id: `${prefix}-t2`,
    domainId: 'ppt-content',
    title: 'Kết hợp Biểu đồ số liệu, Bảng quy cách và liên kết điều hướng',
    titleEn: 'Insert Chart, Table, and external navigation Hyperlink',
    instruction: `Chèn 1 Biểu đồ (Chart) và 1 Bảng (Table) vào các trang nội dung, đồng thời gắn siêu liên kết “${seed.portalUrl}” lên thẻ hình trên Slide 2.`,
    instructionEn: `Insert both a Chart and a Table on content slides, and attach hyperlink “${seed.portalUrl}” to the badge shape on Slide 2.`,
    copyTokens: [seed.portalUrl],
    ribbonPath: 'Chèn → Biểu đồ · Chèn → Bảng · Chèn → Liên kết',
    hint: `Chèn Biểu đồ và Bảng trên Slide 3, sau đó chọn nhãn hình trên Slide 2 gắn liên kết “${seed.portalUrl}”.`,
    points: 20,
    solution: {
      steps: [
        'Trên Slide 3, vào thẻ Chèn → chèn 1 Biểu đồ (Chart) và 1 Bảng dữ liệu (Table).',
        `Chuyển sang Slide 2, bấm chọn thẻ hình “${seed.badgeText}”.`,
        `Nhấn Ctrl + K (Chèn → Liên kết), dán URL “${seed.portalUrl}” và bấm Áp dụng.`,
      ],
      formulaOrValue: seed.portalUrl,
      shortcut: 'Ctrl + K',
      examTrap: 'Đảm bảo có đủ cả 3 đối tượng: Chart, Table và Hyperlink trên đối tượng trang chiếu.',
      verifyTip: 'Bài thuyết trình có đủ Biểu đồ, Bảng và siêu liên kết hoạt động.',
    },
    applySampleSolution: (sc) => {
      sc.presentation.slides[2]?.elements.push(
        { id: `${prefix}-ch`, type: 'chart', x: 8, y: 26, width: 40, height: 50, chartType: 'column' },
        { id: `${prefix}-tb`, type: 'table', x: 52, y: 26, width: 40, height: 50, tableRows: 3, tableCols: 3 },
      );
      const badge = sc.presentation.slides[1]?.elements.find((e) => e.type === 'shape') ?? sc.presentation.slides[1]?.elements[0];
      if (badge) badge.link = { kind: 'url', url: seed.portalUrl };
    },
    check: (sc) => {
      const hasChart = sc.presentation.slides.some((s) => s.elements.some((e) => e.type === 'chart'));
      const hasTable = sc.presentation.slides.some((s) => s.elements.some((e) => e.type === 'table'));
      const linkOk = hasAnyLink(sc.presentation.slides);
      return hasChart && hasTable && linkOk
        ? { passed: true, detail: 'Đã tích hợp đầy đủ Biểu đồ, Bảng và Siêu liên kết.' }
        : { passed: false, detail: 'Cần chèn đủ cả Biểu đồ (Chart), Bảng (Table) và Liên kết (Hyperlink).' };
    },
  };

  const t3: MosPptProject['tasks'][number] = {
    id: `${prefix}-t3`,
    domainId: 'ppt-motion',
    title: version === '2016'
      ? 'Tự động chuyển trang theo giây và chuỗi 2 Hoạt hình liên tiếp trên Slide 2'
      : 'Chuyển cảnh Morph tự động theo giây và chuỗi 2 Hoạt hình trên Slide 2',
    titleEn: version === '2016'
      ? 'Timed slide transitions and 2-step Animation sequence on Slide 2'
      : 'Timed Morph transitions and 2-step Animation sequence on Slide 2',
    instruction: version === '2016'
      ? 'Thiết lập chuyển cảnh Fade với tự động chuyển trang sau >= 4 giây cho toàn bộ slide và gắn ít nhất 2 bước hoạt hình trên Slide 2.'
      : 'Thiết lập chuyển cảnh Morph kèm tự động chuyển trang sau >= 4 giây cho mọi slide và gắn tối thiểu 2 bước hoạt hình trên Slide 2.',
    instructionEn: version === '2016'
      ? 'Apply Fade transition with Advance After >= 4s on all slides and add at least 2 animations on Slide 2.'
      : 'Apply Morph transition with Advance After >= 4s on all slides and add at least 2 animations on Slide 2.',
    ribbonPath: 'Chuyển tiếp → Tự chuyển sau >= 4s → Áp dụng cho tất cả · Hoạt hình (×2)',
    hint: `Chọn ${version === '2016' ? 'Fade' : 'Morph'}, đặt thời gian tự chuyển >= 4 giây, bấm Áp dụng cho tất cả; trên Slide 2 gắn hoạt hình cho 2 đối tượng.`,
    points: 20,
    solution: {
      steps: [
        `Mở thẻ Chuyển tiếp → chọn hiệu ứng ${version === '2016' ? 'Mờ dần (Fade)' : 'Biến hình (Morph)'}.`,
        'Bật Tự động chuyển sau (Advance Slide After) đặt tối thiểu 4 giây rồi bấm Áp dụng cho tất cả.',
        'Trên Slide 2, gắn lần lượt hiệu ứng Hoạt hình cho khung nội dung và thẻ hình điểm nhấn.',
      ],
      examTrap: 'Cần đủ ít nhất 2 hoạt hình trên Slide 2 và tự động chuyển trang >= 4s áp cho toàn bộ slide.',
      verifyTip: 'Mọi slide có lịch tự chuyển >= 4s và Slide 2 hiển thị 2 mốc thứ tự hoạt hình.',
    },
    applySampleSolution: (sc) => {
      const trType = version === '2016' ? 'fade' : 'morph';
      for (const slide of sc.presentation.slides) {
        slide.transition = { type: trType, duration: 1, advanceAfterSeconds: 5 };
      }
      const els = sc.presentation.slides[1]?.elements ?? [];
      if (els[0]) els[0].animation = { type: 'fade-in', duration: 0.5, delay: 0 };
      if (els[1]) els[1].animation = { type: 'zoom-in', duration: 0.5, delay: 0.2 };
    },
    check: (sc) => {
      const needType = version === '2016' ? ['fade', 'push', 'wipe'] : ['morph'];
      const transOk = sc.presentation.slides.every(
        (s) => needType.includes(s.transition.type) && (s.transition.advanceAfterSeconds ?? 0) >= 4,
      );
      const animOk = countAnimations(sc.presentation.slides[1]?.elements ?? []) >= 2;
      return transOk && animOk
        ? { passed: true, detail: 'Đã thiết lập chuyển cảnh tự động >= 4s và chuỗi 2 hoạt hình trên Slide 2.' }
        : { passed: false, detail: `Cần áp chuyển tiếp ${version === '2016' ? 'Fade' : 'Morph'} tự chuyển >= 4s toàn bài và >= 2 hoạt hình ở Slide 2.` };
    },
  };

  const t4: MosPptProject['tasks'][number] = {
    id: `${prefix}-t4`,
    domainId: 'ppt-deliver',
    title: 'Tạo Trình chiếu tuỳ chỉnh (Custom Show) VIP và bật chế độ lặp Kiosk',
    titleEn: 'Create a VIP Custom Slide Show and enable Kiosk looping',
    instruction: 'Tạo một bộ Trình chiếu tuỳ chỉnh (Custom Show) gồm ít nhất 2 trang chiếu chính và bật thiết lập trình chiếu Lặp liên tục / Kiosk.',
    instructionEn: 'Create a Custom Show containing at least 2 slides and enable continuous looping / Kiosk show settings.',
    ribbonPath: 'Trình chiếu (Slide Show) → Trình chiếu tuỳ chỉnh · Thiết lập trình chiếu',
    hint: 'Trong thẻ Trình chiếu, tạo 1 Custom Show có từ 2 slide trở lên, rồi mở Thiết lập trình chiếu bật Lặp liên tục (Loop / Kiosk).',
    points: 20,
    solution: {
      steps: [
        'Mở thẻ Trình chiếu (Slide Show) → bấm Trình chiếu tuỳ chỉnh (Custom Slide Show).',
        'Tạo bộ chiếu mới, tích chọn tối thiểu 2 trang chiếu đầu tiên và bấm Lưu.',
        'Bấm Thiết lập trình chiếu (Set Up Slide Show) → bật Lặp liên tục đến khi nhấn Esc (hoặc chế độ Kiosk).',
      ],
      examTrap: 'Một bộ Custom Show chỉ có 1 trang duy nhất sẽ chưa đạt điều kiện tối thiểu 2 trang của câu này.',
      verifyTip: 'Danh sách Custom Show có bộ chiếu >= 2 slide và chế độ lặp trình chiếu đã kích hoạt.',
    },
    applySampleSolution: (sc) => {
      const ids = sc.presentation.slides.slice(0, 3).map((s) => s.id);
      sc.presentation.customShows = [{ id: `${prefix}-cs`, name: 'VIP Executive', slideIds: ids }];
      sc.presentation.showSettings = { showType: 'kiosk', loop: true, useTimings: true };
    },
    check: (sc) => {
      const csOk = (sc.presentation.customShows ?? []).some((c) => c.slideIds.length >= 2);
      const loopOk = Boolean(sc.presentation.showSettings?.loop || sc.presentation.showSettings?.showType === 'kiosk');
      return csOk && loopOk
        ? { passed: true, detail: 'Đã tạo bộ Custom Show và cấu hình trình chiếu tự động lặp Kiosk.' }
        : { passed: false, detail: 'Cần tạo Custom Show (>= 2 slide) và bật Lặp liên tục / Kiosk trong Thiết lập trình chiếu.' };
    },
  };

  const t5: MosPptProject['tasks'][number] = orderIdx % 2 === 0
    ? {
        id: `${prefix}-t5`,
        domainId: 'ppt-manage',
        title: `Tổ chức tối thiểu 2 Phần (Sections), ẩn trang phụ lục và gắn hình mờ CONFIDENTIAL`,
        titleEn: 'Add 2 Sections, hide appendix slide & apply CONFIDENTIAL watermark',
        instruction: 'Chia bài thuyết trình thành ít nhất 2 Phần (Sections), ẩn trang phụ lục số 4 và bật đóng dấu hình mờ “CONFIDENTIAL”.',
        instructionEn: 'Organize the presentation into at least 2 Sections, hide Slide 4, and enable a “CONFIDENTIAL” watermark.',
        copyTokens: ['CONFIDENTIAL', seed.sectionLabel],
        ribbonPath: 'Trang đầu → Phần (×2) · Ẩn Slide 4 · Thiết kế → Hình mờ',
        hint: 'Tạo 2 Section trong thẻ Trang đầu, ẩn Slide 4 và bật Hình mờ CONFIDENTIAL.',
        points: 20,
        solution: {
          steps: [
            'Trên thẻ Trang đầu → Phần (Section) → tạo tối thiểu 2 Phần tách biệt cho phần mở đầu và nội dung.',
            `Chọn Slide 4 (“${seed.s4Title}”) và bật Ẩn trang chiếu (Hide Slide).`,
            'Vào thẻ Thiết kế → Hình mờ → bật đóng dấu chữ “CONFIDENTIAL”.',
          ],
          formulaOrValue: 'CONFIDENTIAL',
          examTrap: 'Đề yêu cầu tối thiểu 2 Section chứ không chỉ 1 Section đơn lẻ.',
          verifyTip: 'Có từ 2 Section trở lên, Slide 4 được đánh dấu ẩn và hình mờ CONFIDENTIAL đã bật.',
        },
        applySampleSolution: (sc) => {
          sc.presentation.sections = [
            { id: `${prefix}-s1`, name: 'Tổng quan' },
            { id: `${prefix}-s2`, name: seed.sectionLabel },
          ];
          if (sc.presentation.slides[3]) sc.presentation.slides[3].hidden = true;
          sc.presentation.watermark = { enabled: true, text: 'CONFIDENTIAL', opacity: 0.18 };
        },
        check: (sc) => {
          const secOk = (sc.presentation.sections?.length ?? 0) >= 2;
          const hidOk = sc.presentation.slides.some((s) => Boolean(s.hidden));
          const wmOk = Boolean(sc.presentation.watermark?.enabled && foldSlide(sc.presentation.watermark.text ?? '').includes('confidential'));
          return secOk && hidOk && wmOk
            ? { passed: true, detail: 'Đã phân tách 2 Section, ẩn trang phụ lục và đóng dấu CONFIDENTIAL.' }
            : { passed: false, detail: 'Cần đủ 3 thao tác: tối thiểu 2 Section, ẩn trang phụ lục và bật hình mờ CONFIDENTIAL.' };
        },
      }
    : {
        id: `${prefix}-t5`,
        domainId: 'ppt-deliver',
        title: 'Thiết lập Handout Master (6 trang/tờ) và 2 Nhận xét hội đồng kiểm duyệt',
        titleEn: 'Configure 6-slide Handout Master and 2 Review Comments',
        instruction: `Cấu hình bản in tài liệu phát tay Handout Master hiển thị 6 trang chiếu mỗi tờ kèm đầu trang “${seed.footerBrand}”, đồng thời thêm ít nhất 2 Nhận xét (Comments).`,
        instructionEn: `Set Handout Master to 6 slides per page with header “${seed.footerBrand}” and attach at least 2 Review Comments.`,
        copyTokens: [seed.footerBrand],
        ribbonPath: 'Xem → Handout Master (6 trang/tờ) · Xem lại → Nhận xét mới (×2)',
        hint: `Mở Xem → Handout Master chọn 6 trang/tờ + nhập “${seed.footerBrand}”, sau đó sang Xem lại tạo 2 Nhận xét.`,
        points: 20,
        solution: {
          steps: [
            'Mở thẻ Xem (View) → bấm chọn Handout Master.',
            `Chọn bố cục 6 trang chiếu mỗi tờ (6 Slides Per Page) và nhập “${seed.footerBrand}” vào ô Đầu trang.`,
            'Sang thẻ Xem lại (Review) → thêm tối thiểu 2 Nhận xét kiểm duyệt trên các trang chiếu.',
          ],
          formulaOrValue: seed.footerBrand,
          examTrap: 'Chọn đúng bố cục 6 trang/tờ trong Handout Master thay vì chỉnh trong Slide Master.',
          verifyTip: 'Handout Master lưu 6 slide/trang và toàn bài có từ 2 nhận xét kiểm duyệt trở lên.',
        },
        applySampleSolution: (sc) => {
          sc.presentation.handoutMaster = { slidesPerPage: 6, header: seed.footerBrand };
          if (sc.presentation.slides[0]) {
            sc.presentation.slides[0].comments = [
              { id: `${prefix}-c1`, author: 'Lead', text: 'Kiểm tra số liệu trang 3', createdAt: 1 },
              { id: `${prefix}-c2`, author: 'QA', text: 'Đã đối chiếu thương hiệu', createdAt: 2 },
            ];
          }
        },
        check: (sc) => {
          const hm = sc.presentation.handoutMaster;
          const hmOk = hm?.slidesPerPage === 6 && foldSlide(hm.header ?? '').includes(foldSlide(seed.footerBrand));
          const totalComments = sc.presentation.slides.reduce((sum, s) => sum + (s.comments?.length ?? 0), 0);
          return hmOk && totalComments >= 2
            ? { passed: true, detail: 'Đã cấu hình Handout Master 6 trang/tờ và gắn 2 nhận xét hội đồng.' }
            : { passed: false, detail: `Cần đặt Handout Master = 6 trang/tờ (đầu trang “${seed.footerBrand}”) và >= 2 Nhận xét.` };
        },
      };

  return [t1, t2, t3, t4, t5];
}

function buildGeneratedPptBank(): MosPptProject[] {
  const out: MosPptProject[] = [];
  const versions: MosVersion[] = ['2016', '2019', '365'];
  const exams: MosExamNumber[] = [1, 2, 3, 4, 5];

  for (let vIdx = 0; vIdx < versions.length; vIdx++) {
    const version = versions[vIdx];
    for (const examNumber of exams) {
      if (version === '365' && examNumber === 1) continue;
      const examSlot = vIdx * 5 + (examNumber - 1);
      const assocStart = (examSlot * 3) % PPT_SEEDS.length;
      const expStart = (examSlot * 5 + 1) % PPT_SEEDS.length;

      for (let order = 1; order <= 7; order++) {
        const seed = PPT_SEEDS[(assocStart + order - 1) % PPT_SEEDS.length];
        const variant = examSlot * 7 + (order - 1);
        const projId = `ppt-${version}-e${examNumber}-p${order}`;
        const difficulties = ['Cơ bản', 'Cơ bản', 'Trung bình', 'Trung bình', 'Trung bình', 'Nâng cao', 'Nâng cao'] as const;

        out.push({
          id: projId,
          track: 'powerpoint',
          version,
          examNumber,
          level: 'associate',
          kind: 'slide',
          order,
          title: seed.title,
          titleEn: seed.titleEn,
          fileName: seed.fileName,
          scenario: seed.scenario,
          scenarioEn: seed.scenarioEn,
          minutes: 7,
          difficulty: difficulties[order - 1],
          createStarter: () => buildStarterDeck(seed, projId),
          tasks: makePptAssocTasks(projId, version, variant, seed),
        });
      }

      for (let order = 1; order <= 5; order++) {
        const seed = PPT_SEEDS[(expStart + order - 1) % PPT_SEEDS.length];
        const projId = `ppt-exp-${version}-e${examNumber}-p${order}`;
        const stem = seed.fileName.replace(/\.pptx$/i, '');

        out.push({
          id: projId,
          track: 'powerpoint',
          version,
          examNumber,
          level: 'expert',
          kind: 'slide',
          order,
          title: `${seed.title} (Expert)`,
          titleEn: `${seed.titleEn} (Expert)`,
          fileName: `${stem}_Expert.pptx`,
          scenario: seed.scenario,
          scenarioEn: seed.scenarioEn,
          minutes: 10,
          difficulty: 'Nâng cao',
          createStarter: () => buildStarterDeck(seed, projId),
          tasks: makePptExpertTasks(projId, version, examSlot + order - 1, seed),
        });
      }
    }
  }
  return out;
}

export const MOS_GENERATED_PPT_PROJECTS: MosPptProject[] = buildGeneratedPptBank();
