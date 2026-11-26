import { basePage, type DocContent } from '../storage';
import type { MosExamNumber, MosVersion, MosWordProject } from './types';
import { collectNodes, foldText, fullDocText, hasMarkOnText, heading, nodeText, para } from './wordHelpers';

type WordScenarioSeed = {
  slug: string;
  fileName: string;
  title: string;
  titleEn: string;
  scenario: string;
  scenarioEn: string;
  rawHeading: string;
  lead: string;
  oldTerm: string;
  newTerm: string;
  focusTerm: string;
  sec1: string;
  body1: string;
  sec2: string;
  body2: string;
  linkAnchor: string;
  linkUrl: string;
  sec3: string;
  body3: string;
  orgHeader: string;
  footerCode: string;
  subjectTag: string;
  keywordTag: string;
  bookmarkName: string;
  watermarkTag: string;
  calloutText: string;
  checkItemA: string;
  checkItemB: string;
  equationLatex: string;
};

const WORD_SCENARIO_SEEDS: WordScenarioSeed[] = [
  {
    slug: 'solar-grid',
    fileName: 'QuyHoach_DienMatTroi.docx',
    title: 'Đề án Điện Mặt Trời Áp Mái Khu Công Nghiệp',
    titleEn: 'Industrial Rooftop Solar Proposal',
    scenario: 'Hoàn thiện hồ sơ kỹ thuật lắp đặt hệ thống điện mặt trời áp mái cho khu công nghiệp trước khi trình hội đồng thẩm định.',
    scenarioEn: 'Finalize the rooftop solar technical proposal for the industrial park before submitting it to the review board.',
    rawHeading: 'Tổng quan dự án năng lượng sạch',
    lead: 'Hệ thống dự kiến vận hành tại khu vực nhà xưởng giai đoạn thử nghiệm với công suất lắp đặt 4,5 MWp và cơ chế giám sát tự động.',
    oldTerm: 'giai đoạn thử nghiệm',
    newTerm: 'giai đoạn thương mại',
    focusTerm: '4,5 MWp',
    sec1: 'Phạm vi lắp đặt thiết bị',
    body1: 'Triển khai tấm quang điện hiệu suất cao trên mái tôn tiêu chuẩn chống bão cấp 12 và hệ thống biến tần chuỗi đồng bộ.',
    sec2: 'Phương án đấu nối lưới nội bộ',
    body2: 'Kết nối trực tiếp tủ phân phối trung tâm và tra cứu thông số kỹ thuật trên Cổng Kỹ thuật Năng lượng của đơn vị vận hành.',
    linkAnchor: 'Cổng Kỹ thuật Năng lượng',
    linkUrl: 'https://office.minhspark.com/solar',
    sec3: 'Kế hoạch bảo trì định kỳ',
    body3: 'Vệ sinh bề mặt tấm pin mỗi quý, đo kiểm nhiệt ảnh hồng ngoại và lập biên bản đối chiếu sản lượng điện thực tế.',
    orgHeader: 'Viện Năng lượng Bền vững',
    footerCode: 'Mã hồ sơ: NL-2026',
    subjectTag: 'Điện mặt trời KCN',
    keywordTag: 'Solar, MOS',
    bookmarkName: 'PhuongAnDauNoi',
    watermarkTag: 'THẨM ĐỊNH',
    calloutText: 'Tiết kiệm 32% chi phí điện giờ cao điểm',
    checkItemA: 'Khảo sát kết cấu mái xưởng',
    checkItemB: 'Nghiệm thu tiếp địa an toàn',
    equationLatex: 'E = P \\cdot t \\cdot \\eta',
  },
  {
    slug: 'hospital-sop',
    fileName: 'QuyTrinh_KhamBenh_So.docx',
    title: 'Quy trình Tiếp đón & Bệnh án Điện tử',
    titleEn: 'Digital Outpatient Intake & EMR SOP',
    scenario: 'Chuẩn hoá tài liệu hướng dẫn quy trình tiếp nhận bệnh nhân không dùng giấy tờ cho các khoa khám bệnh ngoại trú.',
    scenarioEn: 'Standardize the paperless patient intake and electronic medical record operating procedure for outpatient clinics.',
    rawHeading: 'Hướng dẫn vận hành bệnh án điện tử',
    lead: 'Mọi quầy tiếp đón áp dụng xác thực thẻ căn cước gắn chip cho hồ sơ giấy cũ nhằm rút ngắn thời gian chờ xuống dưới 5 phút.',
    oldTerm: 'hồ sơ giấy cũ',
    newTerm: 'hồ sơ bệnh án số',
    focusTerm: 'dưới 5 phút',
    sec1: 'Quy trình phân luồng tự động',
    body1: 'Kiosk tự phục vụ cấp số thứ tự ưu tiên theo độ tuổi, lịch hẹn trực tuyến và chuyên khoa đăng ký ban đầu.',
    sec2: 'Bảo mật dữ liệu lâm sàng',
    body2: 'Bác sĩ ký số trực tiếp trên kết quả cận lâm sàng và tra cứu phác đồ chuẩn tại Thư viện Y khoa Nội bộ.',
    linkAnchor: 'Thư viện Y khoa Nội bộ',
    linkUrl: 'https://office.minhspark.com/med',
    sec3: 'Đối soát bảo hiểm y tế',
    body3: 'Hệ thống tự động kiểm tra thông tuyến và gửi dữ liệu thanh toán điện tử ngay sau khi hoàn tất toa thuốc.',
    orgHeader: 'Bệnh viện Đa khoa Trung tâm',
    footerCode: 'SOP-YTe-09',
    subjectTag: 'Bệnh án điện tử',
    keywordTag: 'EMR, YTe',
    bookmarkName: 'BaoMatLamSang',
    watermarkTag: 'LƯU HÀNH NỘI BỘ',
    calloutText: 'Bảo mật dữ liệu bệnh nhân theo chuẩn HL7',
    checkItemA: 'Xác thực chữ ký số bác sĩ',
    checkItemB: 'Đồng bộ kết quả xét nghiệm',
    equationLatex: 'BMI = \\frac{m}{h^2}',
  },
  {
    slug: 'logistics-hub',
    fileName: 'BaoCao_KhoVan_Lanh.docx',
    title: 'Báo cáo Vận hành Trung tâm Kho Lạnh',
    titleEn: 'Cold Chain Fulfillment Hub Report',
    scenario: 'Biên tập báo cáo kiểm định chuỗi cung ứng lạnh phục vụ xuất khẩu nông sản và thực phẩm chế biến.',
    scenarioEn: 'Format the cold-chain logistics inspection report for agricultural and processed food export operations.',
    rawHeading: 'Báo cáo chất lượng chuỗi kho lạnh',
    lead: 'Trung tâm điều phối duy trì dải nhiệt độ âm sâu ổn định cho lô hàng tạm trữ với cảm biến IoT cảnh báo tức thời.',
    oldTerm: 'lô hàng tạm trữ',
    newTerm: 'lô hàng xuất khẩu',
    focusTerm: 'cảm biến IoT',
    sec1: 'Tiêu chuẩn bảo quản theo phân khu',
    body1: 'Phân khu đông lạnh sâu giữ mức -22°C, phân khu mát duy trì từ 2°C đến 6°C kèm kiểm soát độ ẩm tự động.',
    sec2: 'Tối ưu luồng xuất nhập hàng',
    body2: ' Cửa xuất hàng trang bị đệm kín khí và đồng bộ lịch xe lạnh qua Hệ thống Điều vận Kho vận.',
    linkAnchor: 'Hệ thống Điều vận Kho vận',
    linkUrl: 'https://office.minhspark.com/coldchain',
    sec3: 'Đánh giá hao hụt vận chuyển',
    body3: 'Tỷ lệ hao hụt giảm còn 0,4% nhờ niêm phong nhiệt kế tự ghi trên toàn bộ container đường biển.',
    orgHeader: 'Chuỗi Cung ứng Mekong Logistics',
    footerCode: 'COLD-2026-VN',
    subjectTag: 'Chuỗi kho lạnh',
    keywordTag: 'Logistics, ColdChain',
    bookmarkName: 'LuongXuatNhap',
    watermarkTag: 'KIỂM ĐỊNH',
    calloutText: 'Đạt chuẩn HACCP & ISO 22000 toàn chuỗi',
    checkItemA: 'Hiệu chuẩn đầu đo nhiệt độ',
    checkItemB: 'Kiểm tra nguồn điện dự phòng UPS',
    equationLatex: 'Q = m \\cdot c \\cdot \\Delta T',
  },
  {
    slug: 'fintech-audit',
    fileName: 'KiemToan_ThanhToan_So.docx',
    title: 'Hồ sơ Kiểm toán Cổng Thanh toán Điện tử',
    titleEn: 'Digital Payment Gateway Audit Brief',
    scenario: 'Định dạng tài liệu đánh giá tuân thủ an toàn bảo mật PCI-DSS cho nền tảng ví điện tử và cổng thanh toán QR.',
    scenarioEn: 'Format the PCI-DSS security compliance audit report for the digital wallet and QR payment gateway.',
    rawHeading: 'Đánh giá tuân thủ bảo mật thanh toán',
    lead: 'Đợt rà soát định kỳ theo chuẩn PCI-DSS kiểm tra toàn diện kiến trúc mã hoá khoá đối xứng tại máy chủ thử nghiệm và luồng đối soát liên ngân hàng.',
    oldTerm: 'máy chủ thử nghiệm',
    newTerm: 'máy chủ giao dịch chính',
    focusTerm: 'PCI-DSS',
    sec1: 'Kiến trúc mã hoá và phân tách mạng',
    body1: 'Dữ liệu thẻ được mã hoá đầu cuối bằng chuẩn TLS 1.3 và lưu trữ token hoá tách biệt hoàn toàn khỏi môi trường ứng dụng.',
    sec2: 'Giám sát giao dịch bất thường',
    body2: 'Mô hình chấm điểm rủi ro chặn giao dịch giả mạo trong 80 mili-giây, xem báo cáo tại Trung tâm An ninh Thanh toán.',
    linkAnchor: 'Trung tâm An ninh Thanh toán',
    linkUrl: 'https://office.minhspark.com/fintech',
    sec3: 'Khuyến nghị khắc phục và nâng cấp',
    body3: 'Thực hiện xoay vòng khoá định kỳ 90 ngày và diễn tập ứng phó sự cố xâm nhập hai lần mỗi năm.',
    orgHeader: 'Khối Quản trị Rủi ro Công nghệ',
    footerCode: 'AUDIT-FIN-26',
    subjectTag: 'Kiểm toán thanh toán',
    keywordTag: 'Fintech, Security',
    bookmarkName: 'GiamSatGiaoDich',
    watermarkTag: 'CONFIDENTIAL',
    calloutText: '99,995% thời gian hoạt động liên tục không gián đoạn',
    checkItemA: 'Rà soát nhật ký truy cập đặc quyền',
    checkItemB: 'Kiểm thử xâm nhập ứng dụng di động',
    equationLatex: 'R = P \\times I',
  },
  {
    slug: 'university-accreditation',
    fileName: 'TuDanhGia_ChuongTrinh_DaoTao.docx',
    title: 'Báo cáo Tự đánh giá Kiểm định Đại học',
    titleEn: 'University Program Accreditation Report',
    scenario: 'Hoàn thiện báo cáo tự đánh giá chất lượng chương trình đào tạo ngành Khoa học Dữ liệu theo bộ tiêu chuẩn kiểm định quốc tế.',
    scenarioEn: 'Complete the self-assessment accreditation report for the Data Science undergraduate program.',
    rawHeading: 'Tổng hợp kết quả kiểm định chương trình',
    lead: 'Chương trình đào tạo cập nhật chuẩn đầu ra thực hành cho sinh viên dự thính cùng hệ thống phòng thí nghiệm tính toán hiệu năng cao.',
    oldTerm: 'sinh viên dự thính',
    newTerm: 'sinh viên chính quy',
    focusTerm: 'chuẩn đầu ra',
    sec1: 'Cấu trúc khung chương trình học',
    body1: 'Tổng khối lượng 132 tín chỉ bao gồm khối kiến thức toán ứng dụng, học máy thống kê và đồ án doanh nghiệp thực tế.',
    sec2: 'Đội ngũ giảng viên và công bố quốc tế',
    body2: 'Tỷ lệ giảng viên có học vị tiến sĩ đạt 78%, danh mục công bố lưu trữ tại Cổng Học liệu Khoa học Mở.',
    linkAnchor: 'Cổng Học liệu Khoa học Mở',
    linkUrl: 'https://office.minhspark.com/edu',
    sec3: 'Khảo sát việc làm sinh viên tốt nghiệp',
    body3: '94% sinh viên có việc làm đúng chuyên ngành trong vòng 6 tháng kể từ lễ trao bằng tốt nghiệp.',
    orgHeader: 'Hội đồng Đảm bảo Chất lượng Giáo dục',
    footerCode: 'QA-UNI-2026',
    subjectTag: 'Kiểm định đại học',
    keywordTag: 'Education, Accreditation',
    bookmarkName: 'DoiNguGiangVien',
    watermarkTag: 'BẢN NHÁP',
    calloutText: '94% sinh viên tốt nghiệp có việc làm đúng ngành',
    checkItemA: 'Đối chiếu minh chứng đề cương học phần',
    checkItemB: 'Tổng hợp phiếu khảo sát nhà tuyển dụng',
    equationLatex: '\\mu = \\frac{1}{n}\\sum x_i',
  },
  {
    slug: 'smart-city-traffic',
    fileName: 'DeAn_GiaoThong_ThongMinh.docx',
    title: 'Đề án Điều hành Giao thông Đô thị Thông minh',
    titleEn: 'Smart Urban Traffic Control Proposal',
    scenario: 'Trình bày phương án đồng bộ đèn tín hiệu thích ứng AI và camera giám sát lưu lượng cho các trục đường huyết mạch.',
    scenarioEn: 'Present the AI-adaptive traffic signal and volume monitoring proposal for major urban corridors.',
    rawHeading: 'Phương án điều phối giao thông thông minh',
    lead: 'Hệ thống điều khiển pha đèn theo mật độ phương tiện thực tế tại nút giao phụ nhằm giảm 22% thời gian dừng chờ giờ cao điểm.',
    oldTerm: 'nút giao phụ',
    newTerm: 'nút giao trọng điểm',
    focusTerm: 'giảm 22%',
    sec1: 'Hạ tầng cảm biến và camera nhận diện',
    body1: 'Lắp đặt 180 cụm camera phân tích lưu lượng theo làn và truyền dữ liệu qua mạng cáp quang chuyên dùng.',
    sec2: 'Trung tâm giám sát và điều hành tập trung',
    body2: 'Bản đồ số thời gian thực tích hợp cảnh báo ùn tắc tự động trên Chuyên trang Giao thông Đô thị.',
    linkAnchor: 'Chuyên trang Giao thông Đô thị',
    linkUrl: 'https://office.minhspark.com/traffic',
    sec3: 'Lộ trình đầu tư theo giai đoạn',
    body3: 'Giai đoạn 1 triển khai trên 6 tuyến trục chính nội đô; giai đoạn 2 mở rộng sang các tuyến vành đai kết nối liên vùng.',
    orgHeader: 'Sở Giao thông & Đô thị Số',
    footerCode: 'ITS-2026-CITY',
    subjectTag: 'Giao thông thông minh',
    keywordTag: 'SmartCity, ITS',
    bookmarkName: 'TrungTamDieuHanh',
    watermarkTag: 'DỰ THẢO',
    calloutText: 'Rút ngắn 22% thời gian di chuyển qua trục chính',
    checkItemA: 'Đấu nối tủ điều khiển tín hiệu',
    checkItemB: 'Kiểm định độ trễ truyền dẫn quang',
    equationLatex: 'q = k \\cdot v',
  },
  {
    slug: 'heritage-tourism',
    fileName: 'CamNang_DuLich_DiSan.docx',
    title: 'Cẩm nang Bảo tồn & Du lịch Di sản Bền vững',
    titleEn: 'Sustainable Heritage Tourism Handbook',
    scenario: 'Thiết kế ấn phẩm hướng dẫn du lịch xanh kết hợp bảo tồn kiến trúc cổ cho ban quản lý quần thể di sản văn hoá.',
    scenarioEn: 'Design a sustainable tourism and architectural conservation handbook for the heritage management board.',
    rawHeading: 'Cẩm nang du lịch di sản xanh',
    lead: 'Chương trình giới hạn sức chứa theo khung giờ tham quan tại khu vực ngoại vi và khuyến khích sử dụng phương tiện điện không phát thải.',
    oldTerm: 'khu vực ngoại vi',
    newTerm: 'khu vực lõi di sản',
    focusTerm: 'không phát thải',
    sec1: 'Quy tắc ứng xử tại điểm di tích',
    body1: 'Du khách giữ gìn cảnh quan cổ kính, không chạm tay lên hiện vật gỗ sơn son và hạn chế rác thải nhựa dùng một lần.',
    sec2: 'Tuyến thuyết minh đa ngôn ngữ số hoá',
    body2: 'Quét mã tại từng điểm dừng để nghe thuyết minh âm thanh trên Bản đồ Di sản Tương tác.',
    linkAnchor: 'Bản đồ Di sản Tương tác',
    linkUrl: 'https://office.minhspark.com/heritage',
    sec3: 'Hợp tác sinh kế cộng đồng bản địa',
    body3: 'Trích 15% doanh thu vé điện tử hỗ trợ các hộ nghệ nhân duy trì làng nghề thủ công truyền thống.',
    orgHeader: 'Trung tâm Bảo tồn Di sản Việt',
    footerCode: 'HERITAGE-26',
    subjectTag: 'Du lịch di sản',
    keywordTag: 'Tourism, Heritage',
    bookmarkName: 'ThuyetMinhSoHoa',
    watermarkTag: 'BẢN MẪU',
    calloutText: '100% tuyến xe điện nội khu vận hành bằng năng lượng sạch',
    checkItemA: 'Cập nhật bản thu âm 6 ngôn ngữ',
    checkItemB: 'Lắp đặt bảng chỉ dẫn gỗ thân thiện',
    equationLatex: 'C = A \\times R',
  },
  {
    slug: 'agro-export',
    fileName: 'TieuChuan_XuatKhau_CaPhe.docx',
    title: 'Hồ sơ Truy xuất Nguồn gốc Nông sản Xuất khẩu',
    titleEn: 'Export Coffee Traceability Dossier',
    scenario: 'Chuẩn bị bộ tài liệu chứng nhận vùng trồng cà phê không gây mất rừng đáp ứng quy định nhập khẩu châu Âu.',
    scenarioEn: 'Prepare the deforestation-free coffee plantation traceability dossier for European export compliance.',
    rawHeading: 'Hồ sơ truy xuất nguồn gốc vùng trồng',
    lead: 'Toàn bộ 1.200 nông hộ liên kết được định vị toạ độ đa giác vệ tinh cho lô thu mua lẻ và mã hoá nhật ký canh tác điện tử.',
    oldTerm: 'lô thu mua lẻ',
    newTerm: 'lô xuất khẩu chính ngạch',
    focusTerm: '1.200 nông hộ',
    sec1: 'Định danh bản đồ số từng lô canh tác',
    body1: 'Đối chiếu ảnh viễn thám nhiều thời điểm nhằm chứng minh diện tích canh tác ổn định và không xâm lấn rừng tự nhiên.',
    sec2: 'Quy trình chế biến ướt tiết kiệm nước',
    body2: 'Hệ thống tuần hoàn giảm 60% lượng nước tiêu thụ, dữ liệu lô hàng công khai tại Hệ thống Truy xuất Nông sản.',
    linkAnchor: 'Hệ thống Truy xuất Nông sản',
    linkUrl: 'https://office.minhspark.com/agro',
    sec3: 'Kiểm định dư lượng và thử nếm SCA',
    body3: 'Mỗi lô nhân xanh vượt qua 450 chỉ tiêu an toàn thực phẩm và đạt điểm cảm quan từ 83 điểm trở lên.',
    orgHeader: 'Hiệp hội Cà phê Đặc sản Cao Nguyên',
    footerCode: 'EUDR-AGRO-26',
    subjectTag: 'Truy xuất nông sản',
    keywordTag: 'Coffee, Traceability',
    bookmarkName: 'CheBienTietKiemNuoc',
    watermarkTag: 'CHỨNG NHẬN',
    calloutText: 'Đạt chuẩn truy xuất EUDR & điểm thử nếm SCA 83+',
    checkItemA: 'Xác minh toạ độ GPS vùng trồng',
    checkItemB: 'Lưu mẫu đối chứng từng container',
    equationLatex: 'Y = \\frac{M_{clean}}{M_{raw}}',
  },
  {
    slug: 'cloud-migration',
    fileName: 'KeHoach_ChuyenDoi_Cloud.docx',
    title: 'Kế hoạch Di chuyển Hạ tầng Điện toán Đám mây',
    titleEn: 'Enterprise Cloud Migration Playbook',
    scenario: 'Soạn thảo sổ tay chuyển đổi 45 dịch vụ cốt lõi từ phòng máy vật lý lên hạ tầng đám mây đa vùng không gián đoạn.',
    scenarioEn: 'Author the zero-downtime migration playbook for moving 45 core services to multi-zone cloud infrastructure.',
    rawHeading: 'Kế hoạch chuyển đổi hạ tầng đám mây',
    lead: 'Chiến lược dịch chuyển 45 dịch vụ theo từng cụm vi dịch vụ giúp thay thế cụm máy chủ cũ mà vẫn bảo toàn tính sẵn sàng giao dịch.',
    oldTerm: 'cụm máy chủ cũ',
    newTerm: 'kiến trúc đám mây đa vùng',
    focusTerm: '45 dịch vụ',
    sec1: 'Phân loại mức độ ưu tiên ứng dụng',
    body1: 'Nhóm hệ thống báo cáo chuyển đổi trước, tiếp theo là dịch vụ xác thực tập trung và cơ sở dữ liệu giao dịch lõi.',
    sec2: 'Cơ chế sao chép dữ liệu thời gian thực',
    body2: 'Đồng bộ nhật ký giao dịch độ trễ thấp và theo dõi trạng thái cắt chuyển trên Bảng Điều khiển Hạ tầng Số.',
    linkAnchor: 'Bảng Điều khiển Hạ tầng Số',
    linkUrl: 'https://office.minhspark.com/cloud',
    sec3: 'Kịch bản quay lui an toàn trong 5 phút',
    body3: 'Giữ nguyên nhánh dự phòng nóng trong 72 giờ sau cắt chuyển để sẵn sàng khôi phục tức thì nếu phát sinh biến động.',
    orgHeader: 'Trung tâm Kiến trúc Đám mây',
    footerCode: 'CLOUD-OPS-26',
    subjectTag: 'Chuyển đổi Cloud',
    keywordTag: 'Cloud, Migration',
    bookmarkName: 'SaoChepThoiGianThuc',
    watermarkTag: 'KỸ THUẬT',
    calloutText: 'RPO < 5 giây và RTO < 3 phút cho toàn bộ dịch vụ lõi',
    checkItemA: 'Kiểm tra băng thông kênh truyền riêng',
    checkItemB: 'Chạy thử kịch bản chuyển đổi dự phòng',
    equationLatex: 'A = \\frac{MTBF}{MTBF + MTTR}',
  },
  {
    slug: 'hr-onboarding',
    fileName: 'SoTay_HoiNhap_NhanSu.docx',
    title: 'Sổ tay Hội nhập Nhân sự Mới 2026',
    titleEn: 'New Hire Onboarding Handbook 2026',
    scenario: 'Trình bày tài liệu chào đón nhân viên mới với lộ trình 90 ngày đầu tiên, chính sách phúc lợi và quy chuẩn làm việc linh hoạt.',
    scenarioEn: 'Format the employee onboarding guide covering the first 90 days, benefits, and hybrid work standards.',
    rawHeading: 'Cẩm nang hội nhập văn hoá doanh nghiệp',
    lead: 'Chương trình đồng hành 90 ngày hỗ trợ cộng tác viên thử việc làm quen quy trình sản phẩm, công cụ số và người hướng dẫn trực tiếp.',
    oldTerm: 'cộng tác viên thử việc',
    newTerm: 'thành viên mới gia nhập',
    focusTerm: '90 ngày',
    sec1: 'Lộ trình mục tiêu 30 – 60 – 90 ngày',
    body1: 'Tháng đầu nắm vững quy trình và kiến trúc hệ thống; tháng thứ hai làm chủ đầu việc độc lập; tháng thứ ba đề xuất cải tiến.',
    sec2: 'Chế độ phúc lợi và đào tạo nội bộ',
    body2: 'Mỗi nhân sự được cấp ngân sách học tập hàng năm và đăng ký khoá học tại Học viện Đào tạo Nội bộ.',
    linkAnchor: 'Học viện Đào tạo Nội bộ',
    linkUrl: 'https://office.minhspark.com/academy',
    sec3: 'Quy định làm việc kết hợp linh hoạt',
    body3: 'Đăng ký lịch làm việc từ xa tối đa 2 ngày mỗi tuần và đồng bộ tiến độ hàng ngày cùng nhóm dự án.',
    orgHeader: 'Khối Phát triển Con người & Văn hoá',
    footerCode: 'HR-ONBOARD-26',
    subjectTag: 'Hội nhập nhân sự',
    keywordTag: 'HR, Onboarding',
    bookmarkName: 'PhucLoiDaoTao',
    watermarkTag: 'NỘI BỘ',
    calloutText: 'Ngân sách học tập & chứng chỉ quốc tế 12 triệu/năm',
    checkItemA: 'Kích hoạt tài khoản email & bảo mật 2 lớp',
    checkItemB: 'Hoàn tất buổi gặp gỡ người hướng dẫn',
    equationLatex: 'KPI = 0.6 \\cdot Q + 0.4 \\cdot P',
  },
  {
    slug: 'ev-charging',
    fileName: 'QuyChuan_TramSac_XeDien.docx',
    title: 'Quy chuẩn Lắp đặt Mạng lưới Trạm Sạc Xe Điện',
    titleEn: 'EV Fast-Charging Network Deployment Standard',
    scenario: 'Hoàn thiện tiêu chuẩn thiết kế kỹ thuật và an toàn phòng cháy cho chuỗi trạm sạc nhanh DC tại các trung tâm thương mại.',
    scenarioEn: 'Finalize technical design and fire-safety standards for commercial DC fast-charging stations.',
    rawHeading: 'Tiêu chuẩn kỹ thuật trạm sạc nhanh xe điện',
    lead: 'Mỗi cụm trạm trang bị trụ sạc công suất 180 kW tại bãi đỗ tạm với hệ thống cân bằng tải thông minh bảo vệ trạm biến áp.',
    oldTerm: 'bãi đỗ tạm',
    newTerm: 'khu đỗ xe chuyên dụng',
    focusTerm: '180 kW',
    sec1: 'Yêu cầu cấp nguồn và chống giật',
    body1: 'Lắp đặt thiết bị cắt lọc sét lan truyền, bảo vệ dòng rò loại B và nút dừng khẩn cấp dễ tiếp cận tại mọi trụ sạc.',
    sec2: 'Tích hợp thanh toán không tiền mặt',
    body2: 'Người dùng quét mã kích hoạt phiên sạc và tra cứu bản đồ trạm trống qua Cổng Dịch vụ Trạm Sạc Xanh.',
    linkAnchor: 'Cổng Dịch vụ Trạm Sạc Xanh',
    linkUrl: 'https://office.minhspark.com/ev',
    sec3: 'Phương án an toàn phòng cháy chữa cháy',
    body3: 'Trang bị chăn chống cháy chuyên dụng chịu nhiệt 1.200°C và camera nhiệt giám sát liên tục 24/7.',
    orgHeader: 'Hạ tầng Giao thông Xanh Việt Nam',
    footerCode: 'EV-STD-2026',
    subjectTag: 'Trạm sạc xe điện',
    keywordTag: 'EV, Charging',
    bookmarkName: 'ThanhToanKhongTienMat',
    watermarkTag: 'TIÊU CHUẨN',
    calloutText: 'Sạc nhanh 20% lên 80% dung lượng pin trong 22 phút',
    checkItemA: 'Đo điện trở nối đất < 4 Ohm',
    checkItemB: 'Thử nghiệm ngắt khẩn cấp liên động',
    equationLatex: 'P = \\sqrt{3} \\cdot U \\cdot I \\cdot \\cos\\varphi',
  },
  {
    slug: 'pharma-gmp',
    fileName: 'HoSo_ThamDinh_NhaMay_GMP.docx',
    title: 'Hồ sơ Thẩm định Dây chuyền Dược phẩm GMP',
    titleEn: 'Pharmaceutical GMP Line Validation Dossier',
    scenario: 'Biên soạn tài liệu thẩm định phòng sạch cấp độ B và dây chuyền đóng gói vỉ thuốc tự động theo chuẩn EU-GMP.',
    scenarioEn: 'Compile the Grade-B cleanroom and automated blister-packaging validation dossier under EU-GMP standards.',
    rawHeading: 'Hồ sơ thẩm định dây chuyền sản xuất GMP',
    lead: 'Quá trình thẩm định vận hành theo chuẩn EU-GMP kiểm soát nghiêm ngặt chênh áp dương và mật độ tiểu phân trong khu vực pha chế thử.',
    oldTerm: 'khu vực pha chế thử',
    newTerm: 'khu vực phòng sạch vô trùng',
    focusTerm: 'EU-GMP',
    sec1: 'Kiểm soát vi khí hậu và lọc khí HEPA',
    body1: 'Màng lọc HEPA H14 loại bỏ 99,995% hạt bụi siêu mịn, duy trì chênh áp tối thiểu 15 Pascal giữa các cấp phòng.',
    sec2: 'Truy vết toàn vẹn dữ liệu điện tử',
    body2: 'Mọi thao tác cân phối liệu đều lưu vết kiểm toán bất biến trên Hệ thống Quản lý Chất lượng Dược.',
    linkAnchor: 'Hệ thống Quản lý Chất lượng Dược',
    linkUrl: 'https://office.minhspark.com/gmp',
    sec3: 'Kế hoạch tái thẩm định hàng năm',
    body3: 'Đánh giá độ đồng đều khối lượng viên nén và kiểm tra độ kín vỉ bằng buồng chân không định kỳ mỗi ca máy.',
    orgHeader: 'Khối Đảm bảo Chất lượng Dược phẩm',
    footerCode: 'GMP-VAL-2026',
    subjectTag: 'Thẩm định dược GMP',
    keywordTag: 'GMP, Pharma',
    bookmarkName: 'ToanVenDuLieu',
    watermarkTag: 'KIỂM SOÁT',
    calloutText: 'Đạt chuẩn toàn vẹn dữ liệu 21 CFR Part 11',
    checkItemA: 'Kiểm tra chênh áp phòng sạch 15 Pa',
    checkItemB: 'Hiệu chuẩn cân phân tích vi lượng',
    equationLatex: 'RSD = \\frac{s}{\\bar{x}} \\times 100\\%',
  },
];

const EXAM_SUITE_TITLES: Record<MosVersion, Record<MosExamNumber, { vi: string; en: string; subVi: string; subEn: string }>> = {
  '2016': {
    1: { vi: 'Đề số 1 · Hành chính & Vận hành Chuẩn 2016', en: 'Exam 1 · Core Business & Operations 2016', subVi: 'Bố cục trang, bảng biểu, danh sách & đầu chân trang cốt lõi', subEn: 'Core page setup, tables, lists, and headers/footers' },
    2: { vi: 'Đề số 2 · Ấn phẩm Truyền thông & Đào tạo', en: 'Exam 2 · Corporate Publishing & Training', subVi: 'Chia cột báo chí, chủ đề thiết kế, liên kết & chú thích chân trang', subEn: 'Newsletter columns, themes, hyperlinks, and footnotes' },
    3: { vi: 'Đề số 3 · Hồ sơ Kỹ thuật & Kiểm định', en: 'Exam 3 · Technical & Compliance Documentation', subVi: 'Tìm thay thế hàng loạt, số dòng, hình mờ & mục lục tự động', subEn: 'Bulk find/replace, line numbers, watermarks, and automatic TOC' },
    4: { vi: 'Đề số 4 · Thương mại & Dịch vụ Khách hàng', en: 'Exam 4 · Commercial & Client Services', subVi: 'Định dạng đoạn văn, dấu trang điều hướng & khung viền trang', subEn: 'Paragraph formatting, navigation bookmarks, and page borders' },
    5: { vi: 'Đề số 5 · Tổng duyệt Sát hạch 77-725 / 77-726', en: 'Exam 5 · Final Readiness Mock 77-725 / 77-726', subVi: 'Tổng hợp toàn diện 4 miền kỹ năng chuẩn phòng thi MOS 2016', subEn: 'Comprehensive 4-domain synthesis for MOS 2016 certification' },
  },
  '2019': {
    1: { vi: 'Đề số 1 · Quản trị Tài liệu Doanh nghiệp 2019', en: 'Exam 1 · Enterprise Document Governance 2019', subVi: 'Siêu dữ liệu tài liệu, bộ kiểu chữ, bảng biểu & tham chiếu', subEn: 'Document metadata, style sets, tables, and references' },
    2: { vi: 'Đề số 2 · Báo cáo Chiến lược & Kiểm toán', en: 'Exam 2 · Strategic Reporting & Audit', subVi: 'Giữ dòng tiêu đề, hộp chữ nổi bật, nhận xét & trích dẫn', subEn: 'Keep-with-next headings, callout text boxes, comments, and citations' },
    3: { vi: 'Đề số 3 · Học thuật & Xuất bản Chuyên khảo', en: 'Exam 3 · Academic & Monograph Publishing', subVi: 'Bảng màu chủ đề, danh mục hình, chú thích & mục lục', subEn: 'Theme palettes, figure lists, footnotes/endnotes, and TOC' },
    4: { vi: 'Đề số 4 · Quy trình Chuẩn hoá Dịch vụ Số', en: 'Exam 4 · Digital Service Standardization', subVi: 'Đa cột, trích dẫn nổi bật, siêu liên kết & kiểm duyệt nhóm', subEn: 'Multi-column layouts, blockquotes, hyperlinks, and team review' },
    5: { vi: 'Đề số 5 · Tổng duyệt Sát hạch MO-100 / MO-101', en: 'Exam 5 · Final Readiness Mock MO-100 / MO-101', subVi: 'Đề tổng hợp bám sát cấu trúc chấm điểm MO-100 / MO-101', subEn: 'Full-length readiness simulation aligned to MO-100 / MO-101' },
  },
  '365': {
    1: { vi: 'Đề số 1 · Bộ đề Chuẩn Quốc tế Microsoft 365', en: 'Exam 1 · Microsoft 365 Official Benchmark', subVi: 'Bộ dự án nền tảng 365 Apps: bố cục, bảng, tham chiếu & phương trình', subEn: 'Foundational 365 Apps projects: layout, tables, references & equations' },
    2: { vi: 'Đề số 2 · Cộng tác Đám mây & Văn phòng Xanh', en: 'Exam 2 · Cloud Collaboration & Green Office', subVi: 'Danh sách tác vụ, bình luận rà soát, Drop Cap & chuẩn hoá tài liệu', subEn: 'Task checklists, review comments, Drop Cap & document standardization' },
    3: { vi: 'Đề số 3 · Chuyển đổi Số Y tế & Tài chính', en: 'Exam 3 · Healthcare & Fintech Transformation', subVi: 'Công thức khoa học, bảo toàn phân trang, bảng dữ liệu & trích dẫn', subEn: 'Scientific equations, pagination control, data tables & citations' },
    4: { vi: 'Đề số 4 · Hạ tầng Thông minh & Chuỗi Cung ứng', en: 'Exam 4 · Smart Infrastructure & Supply Chain', subVi: 'Hiệu ứng đối tượng, ngắt từ tự động, hộp chữ & chỉ mục tra cứu', subEn: 'Object effects, auto hyphenation, callouts & reference indexes' },
    5: { vi: 'Đề số 5 · Tổng duyệt Sát hạch MO-110 / MO-111', en: 'Exam 5 · Final Readiness Mock MO-110 / MO-111', subVi: 'Đề thi tổng duyệt tốc độ cao chuẩn kỳ thi MO-110 / MO-111 mới nhất', subEn: 'Full-scale final mock exam for MO-110 / MO-111 certification' },
  },
};

export function wordExamSuiteMeta(version: MosVersion, examNumber: MosExamNumber) {
  return EXAM_SUITE_TITLES[version][examNumber];
}

function buildStarterDoc(seed: WordScenarioSeed): DocContent {
  return {
    kind: 'doc',
    page: {
      ...basePage(),
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 96, right: 96, bottom: 96, left: 96 },
      columns: 1,
      header: '',
      footer: '',
      headerEven: '',
      footerEven: '',
      pageNumbers: false,
      pageNumberStart: 1,
      pageNumberFormat: 'plain',
      watermark: '',
      pageColor: '',
      pageBorder: 'none',
      themeId: 'office',
      colorsId: 'office',
      fontsId: 'office',
      styleSet: 'office',
      spacingId: 'none',
      effect: 'none',
      lineNumbers: false,
      hyphenate: false,
      mirrorMargins: false,
      differentFirstPage: false,
      differentOddEven: false,
      citationStyle: 'apa',
      sources: [],
      properties: {},
    },
    comments: [],
    json: {
      type: 'doc',
      content: [
        para(seed.rawHeading),
        para(seed.lead),
        heading(2, seed.sec1),
        para(seed.body1),
        heading(2, seed.sec2),
        para(seed.body2),
        heading(2, seed.sec3),
        para(seed.body3),
      ],
    },
  };
}

function makeAssocSlot1(taskId: string, variant: number, seed: WordScenarioSeed): MosWordProject['tasks'][number] {
  const mode = variant % 4;
  if (mode === 0) {
    return {
      id: taskId,
      domainId: 'word-manage',
      title: 'Hướng giấy ngang và lề hẹp',
      titleEn: 'Landscape orientation & Narrow margins',
      instruction: 'Đổi hướng trang của toàn bộ tài liệu sang Ngang (Landscape) và đặt lề trang ở chế độ Hẹp (Narrow — 1,27 cm mỗi phía).',
      instructionEn: 'Set the document page orientation to Landscape and apply Narrow margins.',
      ribbonPath: 'Bố cục → Hướng → Ngang · Bố cục → Lề → Hẹp',
      hint: 'Mở thẻ Bố cục (Layout), chọn Hướng → Ngang và bấm Lề → chọn Hẹp.',
      points: 20,
      solution: {
        steps: [
          'Mở thẻ Bố cục (Layout) trên thanh Ribbon của 23 Docs.',
          'Bấm Hướng (Orientation) → chọn Ngang (Landscape).',
          'Bấm Lề (Margins) → chọn mẫu Hẹp (Narrow — 1,27 cm đều 4 cạnh).',
        ],
        shortcut: 'Alt + P → O / M',
        examTrap: 'Phải hoàn thành đủ cả 2 thao tác Hướng Ngang và Lề Hẹp mới được tính điểm tối đa.',
        verifyTip: 'Trang giấy xoay ngang và khoảng trắng 4 mép thu gọn sát 1,27 cm.',
      },
      applySampleSolution: (doc) => {
        doc.page.orientation = 'landscape';
        doc.page.margins = { top: 48, right: 48, bottom: 48, left: 48 };
      },
      check: (doc) => {
        const m = doc.page.margins;
        const ok = doc.page.orientation === 'landscape' && m.top <= 56 && m.right <= 56 && m.bottom <= 56 && m.left <= 56;
        return ok
          ? { passed: true, detail: 'Đã thiết lập hướng Ngang và lề Hẹp chuẩn xác.' }
          : { passed: false, detail: 'Cần đặt đồng thời Hướng trang = Ngang và Lề = Hẹp (1,27 cm).' };
      },
    };
  }
  if (mode === 1) {
    const colCount = variant % 2 === 1 ? 2 : 3;
    const labelVi = colCount === 2 ? 'Hai cột (Two Columns)' : 'Ba cột (Three Columns)';
    const labelEn = colCount === 2 ? 'Two columns' : 'Three columns';
    return {
      id: taskId,
      domainId: 'word-manage',
      title: `Chia bố cục văn bản thành ${colCount} cột`,
      titleEn: `Format page into ${labelEn}`,
      instruction: `Thiết lập bố cục trang hiển thị dạng ${labelVi} cho tài liệu “${seed.fileName}”.`,
      instructionEn: `Configure the document layout to display in ${labelEn}.`,
      ribbonPath: `Bố cục → Cột → ${colCount === 2 ? 'Hai cột' : 'Ba cột'}`,
      hint: `Mở thẻ Bố cục (Layout) → bấm Cột (Columns) → chọn ${colCount} cột.`,
      points: 20,
      solution: {
        steps: [
          'Chuyển sang thẻ Bố cục (Layout) trên thanh công cụ.',
          'Trong nhóm Thiết lập trang, bấm nút Cột (Columns).',
          `Chọn ${labelVi} để chia đều luồng văn bản trên trang.`,
        ],
        examTrap: 'Không kẻ bảng không viền để giả lập chia cột; hệ thống kiểm tra trực tiếp thuộc tính Columns.',
        verifyTip: `Văn bản tự động dàn thành ${colCount} cột song song trên mặt giấy.`,
      },
      applySampleSolution: (doc) => {
        doc.page.columns = colCount;
      },
      check: (doc) => {
        const cols = doc.page.columns ?? 1;
        const secOk = collectNodes(doc.json).some((n) => n.type === 'columnSection' && Number(n.attrs?.columns) === colCount);
        return cols === colCount || secOk
          ? { passed: true, detail: `Đã chia tài liệu thành ${colCount} cột.` }
          : { passed: false, detail: `Số cột hiện tại là ${cols}, cần thiết lập đúng ${colCount} cột.` };
      },
    };
  }
  if (mode === 2) {
    return {
      id: taskId,
      domainId: 'word-manage',
      title: 'Khổ giấy Letter và tô màu nền trang',
      titleEn: 'Letter paper size & Page background color',
      instruction: 'Đổi khổ giấy của tài liệu sang Letter và áp dụng một màu nền trang (Page Color) nhạt khác màu trắng mặc định.',
      instructionEn: 'Change the paper size to Letter and apply a non-white Page Color.',
      ribbonPath: 'Bố cục → Khổ giấy → Letter · Thiết kế → Màu trang',
      hint: 'Chọn Khổ giấy Letter trong thẻ Bố cục, sau đó sang thẻ Thiết kế → Màu trang chọn một tông màu nhẹ.',
      points: 20,
      solution: {
        steps: [
          'Mở thẻ Bố cục (Layout) → bấm Khổ giấy (Size) → chọn Letter.',
          'Chuyển sang thẻ Thiết kế (Design) trên thanh Ribbon.',
          'Bấm Màu trang (Page Color) và chọn một ô màu nền nhạt (ví dụ Xanh băng #f0f7ff).',
        ],
        examTrap: 'Chỉ tô nền đoạn văn (Shading) sẽ không làm thay đổi thuộc tính Page Color của trang.',
        verifyTip: 'Khổ trang chuyển sang Letter và toàn bộ nền tờ giấy có màu dịu.',
      },
      applySampleSolution: (doc) => {
        doc.page.size = 'Letter';
        doc.page.pageColor = '#f0f7ff';
      },
      check: (doc) => {
        const sizeOk = doc.page.size === 'Letter';
        const clr = (doc.page.pageColor ?? '').trim().toLowerCase();
        const colorOk = Boolean(clr && clr !== '#ffffff' && clr !== '#fff' && clr !== 'white' && clr !== 'transparent');
        return sizeOk && colorOk
          ? { passed: true, detail: `Đã đặt khổ Letter và màu trang ${doc.page.pageColor}.` }
          : { passed: false, detail: 'Cần đổi đồng thời Khổ giấy sang Letter và chọn Màu trang khác trắng.' };
      },
    };
  }
  return {
    id: taskId,
    domainId: 'word-manage',
    title: 'Chèn ngắt trang và bật đánh số dòng',
    titleEn: 'Insert Page Break and enable Line Numbers',
    instruction: `Chèn một Ngắt trang (Page Break) trước mục “${seed.sec2}” và bật hiển thị Số dòng (Line Numbers) liên tục cho tài liệu.`,
    instructionEn: `Insert a Page Break before “${seed.sec2}” and enable continuous Line Numbers.`,
    ribbonPath: 'Bố cục → Ngắt → Trang · Bố cục → Số dòng → Liên tục',
    hint: `Đặt con trỏ trước “${seed.sec2}”, nhấn Ctrl + Enter để ngắt trang, rồi vào Bố cục → Số dòng → Liên tục.`,
    points: 20,
    solution: {
      steps: [
        `Đặt con trỏ ngay đầu tiêu đề “${seed.sec2}”.`,
        'Nhấn Ctrl + Enter (hoặc Bố cục → Ngắt → Trang) để đẩy phần này sang trang mới.',
        'Mở thẻ Bố cục → bấm Số dòng (Line Numbers) → chọn Liên tục (Continuous).',
      ],
      shortcut: 'Ctrl + Enter',
      examTrap: 'Không dùng phím Enter nhiều lần để sang trang vì không tạo nút Page Break thật.',
      verifyTip: 'Tiêu đề sang đầu trang mới và lề trái xuất hiện dãy số thứ tự dòng.',
    },
    applySampleSolution: (doc) => {
      doc.page.lineNumbers = true;
      doc.json.content = [...(doc.json.content ?? []), { type: 'pageBreak', attrs: { kind: 'page' } }];
    },
    check: (doc) => {
      const hasBreak = collectNodes(doc.json).some((n) => n.type === 'pageBreak');
      const hasLines = Boolean(doc.page.lineNumbers);
      return hasBreak && hasLines
        ? { passed: true, detail: 'Đã chèn ngắt trang và bật đánh số dòng liên tục.' }
        : { passed: false, detail: 'Cần chèn cả Ngắt trang (Page Break) và bật Số dòng (Line Numbers).' };
    },
  };
}

function makeAssocSlot2(taskId: string, version: MosVersion, variant: number, seed: WordScenarioSeed): MosWordProject['tasks'][number] {
  const mode = version === '2016' ? (variant % 2) : version === '2019' ? (variant % 4) : (variant % 5);
  if (mode === 0) {
    return {
      id: taskId,
      domainId: 'word-manage',
      title: `Gắn hình mờ “${seed.watermarkTag}”`,
      titleEn: `Apply “${seed.watermarkTag}” watermark`,
      instruction: `Chèn hình mờ (Watermark) có nội dung “${seed.watermarkTag}” (hoặc “CONFIDENTIAL”) cho toàn bộ tài liệu.`,
      instructionEn: `Apply a “${seed.watermarkTag}” (or “CONFIDENTIAL”) watermark to the document.`,
      copyTokens: [seed.watermarkTag, 'CONFIDENTIAL'],
      ribbonPath: 'Thiết kế → Hình mờ',
      hint: `Mở thẻ Thiết kế → Hình mờ → chọn hoặc nhập chữ “${seed.watermarkTag}”.`,
      points: 20,
      solution: {
        steps: [
          'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
          'Bấm nút Hình mờ (Watermark) ở nhóm Nền trang.',
          `Nhập hoặc chọn mẫu chữ “${seed.watermarkTag}” (hoặc “CONFIDENTIAL”) rồi xác nhận.`,
        ],
        formulaOrValue: seed.watermarkTag,
        examTrap: 'Không chèn hộp chữ mờ vào đầu trang thay cho tính năng Watermark chuyên dụng.',
        verifyTip: `Chữ chìm “${seed.watermarkTag}” hiện chéo phía sau nội dung các trang.`,
      },
      applySampleSolution: (doc) => {
        doc.page.watermark = seed.watermarkTag;
      },
      check: (doc) => {
        const wm = foldText(doc.page.watermark ?? '');
        const target = foldText(seed.watermarkTag);
        return wm.includes(target) || wm.includes('confidential')
          ? { passed: true, detail: `Đã áp dụng hình mờ “${doc.page.watermark}”.` }
          : { passed: false, detail: `Hình mờ chưa khớp “${seed.watermarkTag}” hoặc “CONFIDENTIAL”.` };
      },
    };
  }
  if (mode === 1) {
    const themes = ['ion', 'facet', 'integral', 'retrospect', 'slice'] as const;
    const pickedTheme = themes[variant % themes.length];
    return {
      id: taskId,
      domainId: 'word-manage',
      title: 'Đổi Chủ đề thiết kế và kẻ Viền trang',
      titleEn: 'Change Document Theme and add Page Border',
      instruction: 'Đổi Chủ đề (Theme) tài liệu sang một mẫu khác “Office” mặc định và bật khung Viền trang (Page Border) đơn hoặc đôi.',
      instructionEn: 'Apply any non-default Document Theme and enable a single or double Page Border.',
      ribbonPath: 'Thiết kế → Chủ đề · Thiết kế → Viền trang',
      hint: 'Trong thẻ Thiết kế, chọn một Chủ đề bất kỳ khác Office (như Ion, Khía cạnh, Tích hợp) rồi bấm Viền trang chọn kiểu Đơn.',
      points: 20,
      solution: {
        steps: [
          'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
          'Bấm Chủ đề (Themes) ở bên trái và chọn mẫu mới (ví dụ Ion hoặc Tích hợp).',
          'Bấm Viền trang (Page Borders) ở bên phải → chọn kiểu Đơn (Single) hoặc Đôi (Double) rồi lưu.',
        ],
        examTrap: 'Giữ nguyên chủ đề “Office” mặc định sẽ bị tính chưa hoàn thành yêu cầu đổi Theme.',
        verifyTip: 'Màu tiêu đề đổi theo chủ đề mới và 4 cạnh trang có đường khung viền bao quanh.',
      },
      applySampleSolution: (doc) => {
        doc.page.themeId = pickedTheme;
        doc.page.pageBorder = 'single';
      },
      check: (doc) => {
        const themeOk = Boolean(doc.page.themeId && doc.page.themeId !== 'office');
        const borderOk = Boolean(doc.page.pageBorder && doc.page.pageBorder !== 'none');
        return themeOk && borderOk
          ? { passed: true, detail: `Đã áp dụng chủ đề “${doc.page.themeId}” và khung viền trang.` }
          : { passed: false, detail: 'Cần đổi cả Chủ đề (khác Office) và bật Viền trang (Page Border).' };
      },
    };
  }
  if (mode === 2) {
    return {
      id: taskId,
      domainId: 'word-manage',
      title: 'Cập nhật thuộc tính Chủ đề và Từ khoá',
      titleEn: 'Set Subject and Keywords document properties',
      instruction: `Trong phần Thông tin tài liệu, đặt Chủ đề (Subject) chứa “${seed.subjectTag}” và Từ khoá (Keywords) chứa “${seed.keywordTag.split(',')[0]}”.`,
      instructionEn: `Set the document Subject property to include “${seed.subjectTag}” and Keywords to include “${seed.keywordTag.split(',')[0]}”.`,
      copyTokens: [seed.subjectTag, seed.keywordTag],
      ribbonPath: 'Tệp → Thông tin → Thông tin mô tả',
      hint: 'Mở thẻ Tệp (File) → Thông tin → điền hai ô Chủ đề (Subject) và Từ khoá (Keywords).',
      points: 20,
      solution: {
        steps: [
          'Bấm nút Tệp (File) góc trái trên cùng của thanh công cụ.',
          'Chọn mục Thông tin (Info) để mở khung thuộc tính mô tả tài liệu.',
          `Sao chép “${seed.subjectTag}” vào ô Chủ đề và “${seed.keywordTag}” vào ô Từ khoá rồi đóng Backstage.`,
        ],
        formulaOrValue: `${seed.subjectTag} | ${seed.keywordTag}`,
        examTrap: 'Không gõ nhầm nội dung Subject vào dòng đầu văn bản; máy chấm đọc metadata ẩn trong File → Info.',
        verifyTip: 'Kiểm tra lại Tệp → Thông tin thấy cả hai ô Subject và Keywords đã lưu đủ chuỗi.',
      },
      applySampleSolution: (doc) => {
        doc.page.properties = { ...doc.page.properties, subject: seed.subjectTag, keywords: seed.keywordTag };
      },
      check: (doc) => {
        const sub = foldText(doc.page.properties?.subject ?? '');
        const kw = foldText(doc.page.properties?.keywords ?? '');
        const needSub = foldText(seed.subjectTag);
        const needKw = foldText(seed.keywordTag.split(',')[0]);
        return sub.includes(needSub) && kw.includes(needKw)
          ? { passed: true, detail: 'Đã điền đầy đủ thuộc tính Subject và Keywords.' }
          : { passed: false, detail: `Thuộc tính tài liệu chưa chứa đủ “${seed.subjectTag}” và “${seed.keywordTag.split(',')[0]}”.` };
      },
    };
  }
  if (mode === 3) {
    const sets = ['modern', 'report', 'classic', 'minimal'] as const;
    const chosenSet = sets[variant % sets.length];
    return {
      id: taskId,
      domainId: 'word-format',
      title: 'Áp dụng Bộ kiểu tài liệu và Giãn đoạn thoáng',
      titleEn: 'Apply Style Set and Paragraph Spacing preset',
      instruction: 'Trong thẻ Thiết kế, đổi Bộ kiểu (Style Set) khác mặc định và chuyển Khoảng cách đoạn (Paragraph Spacing) sang mức Thoáng (Open) hoặc Rộng rãi (Relaxed).',
      instructionEn: 'Apply a non-default Style Set and set Paragraph Spacing to Open or Relaxed.',
      ribbonPath: 'Thiết kế → Bộ kiểu · Thiết kế → Khoảng cách đoạn',
      hint: 'Mở thẻ Thiết kế → chọn Bộ kiểu Hiện đại / Báo cáo, sau đó bấm Khoảng cách đoạn → chọn Thoáng (Open) hoặc Rộng rãi (Relaxed).',
      points: 20,
      solution: {
        steps: [
          'Chuyển sang thẻ Thiết kế (Design) trên thanh Ribbon.',
          'Chọn một Bộ kiểu định dạng tài liệu (ví dụ Hiện đại hoặc Báo cáo).',
          'Bấm nút Khoảng cách đoạn (Paragraph Spacing) → chọn Thoáng (Open) hoặc Rộng rãi (Relaxed).',
        ],
        examTrap: 'Chỉnh giãn dòng cục bộ cho 1 đoạn văn sẽ không cập nhật thuộc tính Paragraph Spacing toàn tài liệu.',
        verifyTip: 'Hệ thống tiêu đề đổi phông đồng bộ và khoảng thoáng giữa các đoạn rộng hơn rõ rệt.',
      },
      applySampleSolution: (doc) => {
        doc.page.styleSet = chosenSet;
        doc.page.spacingId = 'open';
      },
      check: (doc) => {
        const setOk = Boolean(doc.page.styleSet && doc.page.styleSet !== 'office');
        const spOk = doc.page.spacingId === 'open' || doc.page.spacingId === 'relaxed' || doc.page.spacingId === 'tight' || doc.page.spacingId === 'compact';
        return setOk && spOk
          ? { passed: true, detail: `Đã áp dụng bộ kiểu “${doc.page.styleSet}” và giãn đoạn “${doc.page.spacingId}”.` }
          : { passed: false, detail: 'Cần chọn Bộ kiểu khác mặc định và thiết lập Khoảng cách đoạn trong thẻ Thiết kế.' };
      },
    };
  }
  return {
    id: taskId,
    domainId: 'word-manage',
    title: 'Hiệu ứng đối tượng và ngắt từ tự động',
    titleEn: 'Apply Object Effects and Auto Hyphenation',
    instruction: 'Bật tính năng Ngắt từ tự động (Automatic Hyphenation) ở thẻ Bố cục và chọn hiệu ứng đối tượng Đổ bóng (Shadow) hoặc Phát sáng (Glow) ở thẻ Thiết kế.',
    instructionEn: 'Enable Automatic Hyphenation in Layout and apply the Shadow or Glow effect preset in Design.',
    ribbonPath: 'Bố cục → Ngắt từ → Tự động · Thiết kế → Hiệu ứng',
    hint: 'Vào Bố cục → bật Ngắt từ tự động, sau đó qua Thiết kế → Hiệu ứng chọn Đổ bóng hoặc Phát sáng.',
    points: 20,
    solution: {
      steps: [
        'Mở thẻ Bố cục (Layout) → bấm Ngắt từ (Hyphenation) → chọn Tự động (Automatic).',
        'Chuyển sang thẻ Thiết kế (Design) trên thanh công cụ.',
        'Bấm Hiệu ứng (Effects) → chọn Đổ bóng (Shadow) hoặc Phát sáng (Glow).',
      ],
      examTrap: 'Không tự gõ dấu gạch ngang tay ở cuối dòng; phải bật chế độ Automatic Hyphenation.',
      verifyTip: 'Trạng thái Ngắt từ bật Tự động và Hiệu ứng thiết kế chuyển sang Đổ bóng/Phát sáng.',
    },
    applySampleSolution: (doc) => {
      doc.page.hyphenate = true;
      doc.page.effect = 'shadow';
    },
    check: (doc) => {
      const hyphOk = Boolean(doc.page.hyphenate || doc.page.hyphenMode === 'auto');
      const fxOk = Boolean(doc.page.effect && doc.page.effect !== 'none');
      return hyphOk && fxOk
        ? { passed: true, detail: 'Đã bật ngắt từ tự động và áp dụng hiệu ứng đối tượng.' }
        : { passed: false, detail: 'Cần bật đồng thời Ngắt từ tự động (Bố cục) và Hiệu ứng đối tượng (Thiết kế).' };
    },
  };
}

function makeAssocSlot3(taskId: string, version: MosVersion, variant: number, seed: WordScenarioSeed): MosWordProject['tasks'][number] {
  const mode = version === '2016' ? (variant % 3) : version === '2019' ? (variant % 4) : (variant % 5);
  if (mode === 0) {
    return {
      id: taskId,
      domainId: 'word-format',
      title: 'Gán kiểu Heading 1 và căn giữa tiêu đề chính',
      titleEn: 'Apply Heading 1 style and center main title',
      instruction: `Áp dụng kiểu Heading 1 cho dòng mở đầu “${seed.rawHeading}” và căn giữa (Center) tiêu đề này.`,
      instructionEn: `Apply Heading 1 to “${seed.rawHeading}” and center-align it.`,
      copyTokens: [seed.rawHeading],
      ribbonPath: 'Trang chủ → Kiểu → Heading 1 · Trang chủ → Căn giữa',
      hint: `Đặt con trỏ tại dòng “${seed.rawHeading}”, chọn Heading 1 rồi nhấn Ctrl + E.`,
      points: 20,
      solution: {
        steps: [
          `Đặt con trỏ vào dòng đầu tiên “${seed.rawHeading}”.`,
          'Trên thẻ Trang chủ (Home), bấm chọn kiểu Heading 1 trong thư viện Kiểu.',
          'Nhấn Ctrl + E hoặc bấm biểu tượng Căn giữa (Center).',
        ],
        shortcut: 'Ctrl + E',
        examTrap: 'Phải gán đúng Style Heading 1 thay vì chỉ tăng cỡ chữ thủ công.',
        verifyTip: 'Tiêu đề hiển thị kiểu Heading 1 và nằm cân đối chính giữa trang.',
      },
      applySampleSolution: (doc) => {
        const list = [...(doc.json.content ?? [])];
        list[0] = heading(1, seed.rawHeading, { textAlign: 'center' });
        doc.json.content = list;
      },
      check: (doc) => {
        const needle = foldText(seed.rawHeading);
        const h1 = collectNodes(doc.json).find((n) => n.type === 'heading' && Number(n.attrs?.level) === 1 && foldText(nodeText(n)).includes(needle));
        if (!h1) return { passed: false, detail: `Dòng “${seed.rawHeading}” chưa ở kiểu Heading 1.` };
        return h1.attrs?.textAlign === 'center'
          ? { passed: true, detail: 'Đã gán Heading 1 và căn giữa tiêu đề chính.' }
          : { passed: false, detail: 'Đã gán Heading 1 nhưng chưa căn giữa (Center).' };
      },
    };
  }
  if (mode === 1) {
    return {
      id: taskId,
      domainId: 'word-format',
      title: `Tìm và thay thế “${seed.oldTerm}”`,
      titleEn: `Find and replace “${seed.oldTerm}”`,
      instruction: `Dùng công cụ Tìm & Thay thế để đổi toàn bộ cụm từ “${seed.oldTerm}” thành “${seed.newTerm}” trong tài liệu.`,
      instructionEn: `Use Find and Replace to replace all instances of “${seed.oldTerm}” with “${seed.newTerm}”.`,
      copyTokens: [seed.oldTerm, seed.newTerm],
      ribbonPath: 'Trang chủ → Thay thế (Ctrl + H)',
      hint: `Nhấn Ctrl + H, tìm “${seed.oldTerm}”, thay bằng “${seed.newTerm}” và bấm Thay tất cả.`,
      points: 20,
      solution: {
        steps: [
          'Nhấn tổ hợp Ctrl + H để mở hộp thoại Tìm và Thay thế.',
          `Dán “${seed.oldTerm}” vào ô Tìm và “${seed.newTerm}” vào ô Thay bằng.`,
          'Bấm Thay tất cả (Replace All) để cập nhật toàn bộ văn bản.',
        ],
        formulaOrValue: `${seed.oldTerm} → ${seed.newTerm}`,
        shortcut: 'Ctrl + H',
        examTrap: 'Dùng nút Click-to-Copy để không sai dấu thanh tiếng Việt khi thay thế.',
        verifyTip: `Trong văn bản không còn cụm “${seed.oldTerm}” và đã xuất hiện “${seed.newTerm}”.`,
      },
      applySampleSolution: (doc) => {
        const raw = JSON.stringify(doc.json).split(seed.oldTerm).join(seed.newTerm);
        doc.json = JSON.parse(raw) as DocContent['json'];
      },
      check: (doc) => {
        const txt = foldText(fullDocText(doc));
        const gone = !txt.includes(foldText(seed.oldTerm));
        const present = txt.includes(foldText(seed.newTerm));
        return gone && present
          ? { passed: true, detail: `Đã thay thế toàn bộ sang “${seed.newTerm}”.` }
          : { passed: false, detail: `Vẫn còn cụm cũ hoặc chưa xuất hiện cụm “${seed.newTerm}”.` };
      },
    };
  }
  if (mode === 2) {
    const markType = variant % 2 === 0 ? 'bold' : 'highlight';
    const actionVi = markType === 'bold' ? 'in đậm (Bold)' : 'tô sáng màu vàng (Highlight)';
    const actionEn = markType === 'bold' ? 'Bold formatting' : 'Yellow Highlight';
    return {
      id: taskId,
      domainId: 'word-format',
      title: `Nhấn mạnh cụm số liệu “${seed.focusTerm}”`,
      titleEn: `Apply ${actionEn} to “${seed.focusTerm}”`,
      instruction: `Trong đoạn mở đầu, bôi chọn cụm “${seed.focusTerm}” và áp dụng định dạng ${actionVi}.`,
      instructionEn: `Select “${seed.focusTerm}” in the opening paragraph and apply ${actionEn}.`,
      copyTokens: [seed.focusTerm],
      ribbonPath: markType === 'bold' ? 'Trang chủ → Đậm (Ctrl + B)' : 'Trang chủ → Tô sáng văn bản',
      hint: `Quét chọn đúng cụm “${seed.focusTerm}” rồi bấm nút ${markType === 'bold' ? 'B (In đậm)' : 'Tô sáng (Highlight)'} trên thẻ Trang chủ.`,
      points: 20,
      solution: {
        steps: [
          `Tìm và bôi đen chính xác cụm “${seed.focusTerm}” ở đoạn giới thiệu.`,
          'Mở thẻ Trang chủ (Home) ở nhóm Phông chữ.',
          markType === 'bold' ? 'Nhấn Ctrl + B hoặc bấm biểu tượng chữ B.' : 'Bấm biểu tượng bút dạ quang Tô sáng (Text Highlight Color).',
        ],
        shortcut: markType === 'bold' ? 'Ctrl + B' : undefined,
        examTrap: 'Chỉ bôi chọn đúng cụm từ được yêu cầu, không tô toàn bộ cả đoạn văn.',
        verifyTip: `Cụm “${seed.focusTerm}” hiển thị ${actionVi} nổi bật so với câu xung quanh.`,
      },
      applySampleSolution: (doc) => {
        const list = [...(doc.json.content ?? [])];
        const parts = seed.lead.split(seed.focusTerm);
        if (parts.length >= 2) {
          list[1] = {
            type: 'paragraph',
            content: [
              { type: 'text', text: parts[0] },
              { type: 'text', text: seed.focusTerm, marks: [{ type: markType, ...(markType === 'highlight' ? { attrs: { color: '#fff59d' } } : {}) }] },
              { type: 'text', text: parts.slice(1).join(seed.focusTerm) },
            ],
          };
          doc.json.content = list;
        }
      },
      check: (doc) =>
        hasMarkOnText(doc, markType, seed.focusTerm)
          ? { passed: true, detail: `Đã định dạng ${actionVi} cho cụm “${seed.focusTerm}”.` }
          : { passed: false, detail: `Cụm “${seed.focusTerm}” chưa được gắn định dạng ${actionVi}.` },
    };
  }
  if (mode === 3) {
    return {
      id: taskId,
      domainId: 'word-format',
      title: 'Bật Giữ với đoạn sau (Keep with next) cho tiêu đề mục',
      titleEn: 'Enable Keep with next on section heading',
      instruction: `Cấu hình phân trang cho tiêu đề Heading 2 “${seed.sec2}” bật tuỳ chọn Giữ với đoạn sau (Keep with next) để không bị lẻ dòng cuối trang.`,
      instructionEn: `Enable the “Keep with next” pagination option on the Heading 2 “${seed.sec2}”.`,
      copyTokens: [seed.sec2],
      ribbonPath: 'Trang chủ → Hộp thoại Đoạn văn → Giữ với đoạn sau',
      hint: `Đặt con trỏ vào tiêu đề “${seed.sec2}”, mở tuỳ chọn Đoạn văn (Paragraph) và tích chọn Giữ với đoạn sau (Keep with next).`,
      points: 20,
      solution: {
        steps: [
          `Đặt con trỏ tại dòng tiêu đề “${seed.sec2}”.`,
          'Mở hộp thoại Đoạn văn (Paragraph) từ thẻ Trang chủ hoặc Bố cục.',
          'Đánh dấu bật tuỳ chọn Giữ với đoạn sau (Keep with next) rồi bấm Lưu.',
        ],
        examTrap: 'Không chèn ngắt trang thủ công; đề yêu cầu thuộc tính nối đoạn Keep with next.',
        verifyTip: 'Mở lại hộp thoại Đoạn văn tại tiêu đề thấy ô Giữ với đoạn sau đang được tích.',
      },
      applySampleSolution: (doc) => {
        for (const node of doc.json.content ?? []) {
          if (node.type === 'heading' && foldText(nodeText(node)).includes(foldText(seed.sec2))) {
            node.attrs = { ...(node.attrs ?? {}), keepNext: true };
          }
        }
      },
      check: (doc) => {
        const found = collectNodes(doc.json).some(
          (n) => n.type === 'heading' && foldText(nodeText(n)).includes(foldText(seed.sec2)) && Boolean(n.attrs?.keepNext),
        );
        return found
          ? { passed: true, detail: `Tiêu đề “${seed.sec2}” đã bật Giữ với đoạn sau.` }
          : { passed: false, detail: `Chưa bật thuộc tính Keep with next cho tiêu đề “${seed.sec2}”.` };
      },
    };
  }
  return {
    id: taskId,
    domainId: 'word-format',
    title: 'Chèn chữ cái lớn đầu đoạn (Drop Cap) và công thức toán',
    titleEn: 'Apply Drop Cap and insert a mathematical equation',
    instruction: `Tạo chữ hoa lớn đầu đoạn (Drop Cap) cho đoạn văn mở đầu và chèn một khối Công thức toán học (ví dụ “${seed.equationLatex}”) vào cuối tài liệu.`,
    instructionEn: `Apply a Drop Cap to the opening paragraph and insert an Equation block at the end of the document.`,
    copyTokens: [seed.equationLatex],
    ribbonPath: 'Chèn → Drop Cap · Chèn → Phương trình',
    hint: 'Đặt con trỏ vào đoạn mở đầu, vào Chèn → Drop Cap; tiếp đó đặt con trỏ cuối bài, bấm Chèn → Phương trình.',
    points: 20,
    solution: {
      steps: [
        'Đặt con trỏ vào đoạn giới thiệu đầu bài, mở thẻ Chèn (Insert) → bấm Drop Cap → chọn Rớt dòng (Dropped).',
        'Di chuyển con trỏ xuống cuối tài liệu.',
        `Mở thẻ Chèn → bấm Phương trình (Equation) và nhập công thức “${seed.equationLatex}” rồi chèn.`,
      ],
      formulaOrValue: seed.equationLatex,
      examTrap: 'Không phóng to ký tự đầu tiên bằng cỡ chữ thủ công vì sẽ không gắn thuộc tính Drop Cap.',
      verifyTip: 'Chữ cái đầu đoạn mở rộng nhiều dòng và cuối trang hiển thị khối phương trình chuẩn KaTeX.',
    },
    applySampleSolution: (doc) => {
      const list = [...(doc.json.content ?? [])];
      if (list[1]) list[1] = { ...list[1], attrs: { ...(list[1].attrs ?? {}), dropCap: 'dropped' } };
      list.push({ type: 'paragraph', content: [{ type: 'equation', attrs: { latex: seed.equationLatex } }] });
      doc.json.content = list;
    },
    check: (doc) => {
      const nodes = collectNodes(doc.json);
      const hasDrop = nodes.some((n) => n.type === 'paragraph' && Boolean(n.attrs?.dropCap));
      const hasEq = nodes.some((n) => n.type === 'equation' && String(n.attrs?.latex ?? '').trim().length > 0);
      return hasDrop && hasEq
        ? { passed: true, detail: 'Đã tạo Drop Cap và chèn khối phương trình toán học.' }
        : { passed: false, detail: 'Cần thực hiện đủ cả Drop Cap cho đoạn văn và chèn Phương trình toán học.' };
    },
  };
}

function makeAssocSlot4(taskId: string, version: MosVersion, variant: number, seed: WordScenarioSeed): MosWordProject['tasks'][number] {
  const mode = version === '2016' ? (variant % 3) : version === '2019' ? (variant % 4) : (variant % 5);
  if (mode === 0) {
    const cols = (variant % 2) + 3;
    const rows = (variant % 3) + 3;
    return {
      id: taskId,
      domainId: 'word-tables',
      title: `Chèn bảng tổng hợp ${cols} cột × ${rows} dòng`,
      titleEn: `Insert a ${cols}×${rows} summary table`,
      instruction: `Cuối tài liệu, chèn một Bảng (Table) có tối thiểu ${cols} cột và ${rows} dòng để lập biểu theo dõi thực hiện.`,
      instructionEn: `At the end of the document, insert a Table with at least ${cols} columns and ${rows} rows.`,
      ribbonPath: `Chèn → Bảng → ${cols}×${rows}`,
      hint: `Đặt con trỏ cuối tài liệu, mở thẻ Chèn → Bảng và quét lưới ${cols} cột × ${rows} dòng.`,
      points: 20,
      solution: {
        steps: [
          'Đặt con trỏ soạn thảo tại dòng trống cuối tài liệu.',
          'Mở thẻ Chèn (Insert) → bấm biểu tượng Bảng (Table).',
          `Chọn kích thước lưới tối thiểu ${cols} cột ngang × ${rows} hàng dọc để chèn bảng.`,
        ],
        examTrap: `Kiểm tra kỹ số cột (${cols}) và số dòng (${rows}) tránh chọn ngược chiều.`,
        verifyTip: `Bảng mới xuất hiện với đủ tối thiểu ${cols} cột và ${rows} hàng.`,
      },
      applySampleSolution: (doc) => {
        doc.json.content = [
          ...(doc.json.content ?? []),
          {
            type: 'table',
            content: Array.from({ length: rows }, () => ({
              type: 'tableRow',
              content: Array.from({ length: cols }, () => ({
                type: 'tableCell',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'OK' }] }],
              })),
            })),
          },
        ];
      },
      check: (doc) => {
        const ok = collectNodes(doc.json)
          .filter((n) => n.type === 'table')
          .some((tbl) => {
            const r = (tbl.content ?? []).filter((x) => x.type === 'tableRow');
            const c = r[0]?.content?.length ?? 0;
            return r.length >= rows && c >= cols;
          });
        return ok
          ? { passed: true, detail: `Đã chèn bảng đạt kích thước tối thiểu ${cols}×${rows}.` }
          : { passed: false, detail: `Chưa thấy bảng nào có đủ ${cols} cột và ${rows} dòng.` };
      },
    };
  }
  if (mode === 1) {
    const ordered = variant % 2 === 0;
    const listType = ordered ? 'orderedList' : 'bulletList';
    const labelVi = ordered ? 'danh sách đánh số (Numbered List)' : 'danh sách hoa thị (Bulleted List)';
    const labelEn = ordered ? 'Numbered List' : 'Bulleted List';
    return {
      id: taskId,
      domainId: 'word-tables',
      title: `Tạo ${labelVi} tối thiểu 3 mục`,
      titleEn: `Create a 3-item ${labelEn}`,
      instruction: `Bổ sung một ${labelVi} gồm ít nhất 3 mục triển khai chi tiết ở phần cuối tài liệu.`,
      instructionEn: `Insert a ${labelEn} containing at least 3 action items.`,
      ribbonPath: ordered ? 'Trang chủ → Danh sách đánh số' : 'Trang chủ → Danh sách dấu đầu dòng',
      hint: `Mở thẻ Trang chủ → bấm nút ${ordered ? 'Đánh số (1, 2, 3)' : 'Hoa thị (Bullets)'} và nhập tối thiểu 3 dòng mục.`,
      points: 20,
      solution: {
        steps: [
          'Đặt con trỏ ở cuối phần nội dung cần liệt kê.',
          `Trên thẻ Trang chủ (Home), bấm biểu tượng ${ordered ? 'Danh sách đánh số' : 'Danh sách dấu đầu dòng'}.`,
          'Nhập lần lượt tối thiểu 3 mục nội dung, nhấn Enter để tách từng mục.',
        ],
        examTrap: 'Không tự gõ dấu gạch đầu dòng hoặc số “1.” bằng tay vì không tạo cấu trúc List tự động.',
        verifyTip: `Danh sách có đúng cấu trúc ${labelEn} với từ 3 mục trở lên.`,
      },
      applySampleSolution: (doc) => {
        doc.json.content = [
          ...(doc.json.content ?? []),
          {
            type: listType,
            content: ['Hạng mục 1', 'Hạng mục 2', 'Hạng mục 3'].map((txt) => ({
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: txt }] }],
            })),
          },
        ];
      },
      check: (doc) => {
        const ok = collectNodes(doc.json).some((n) => n.type === listType && (n.content?.length ?? 0) >= 3);
        return ok
          ? { passed: true, detail: `Đã tạo ${labelVi} đủ tối thiểu 3 mục.` }
          : { passed: false, detail: `Chưa tìm thấy ${labelVi} có từ 3 mục trở lên.` };
      },
    };
  }
  if (mode === 2) {
    return {
      id: taskId,
      domainId: 'word-tables',
      title: 'Gắn siêu liên kết (Hyperlink) điều hướng web',
      titleEn: 'Insert external web Hyperlink',
      instruction: `Gắn siêu liên kết có địa chỉ “${seed.linkUrl}” vào cụm chữ “${seed.linkAnchor}” trong mục 2.`,
      instructionEn: `Attach the hyperlink “${seed.linkUrl}” to the phrase “${seed.linkAnchor}”.`,
      copyTokens: [seed.linkUrl, seed.linkAnchor],
      ribbonPath: 'Chèn → Liên kết (Ctrl + K)',
      hint: `Bôi chọn cụm “${seed.linkAnchor}”, nhấn Ctrl + K và dán URL “${seed.linkUrl}”.`,
      points: 20,
      solution: {
        steps: [
          `Tìm và quét chọn cụm từ “${seed.linkAnchor}” trong phần nội dung mục 2.`,
          'Nhấn Ctrl + K (hoặc vào thẻ Chèn → Liên kết).',
          `Dán chính xác địa chỉ “${seed.linkUrl}” vào ô URL rồi bấm Áp dụng.`,
        ],
        formulaOrValue: seed.linkUrl,
        shortcut: 'Ctrl + K',
        examTrap: 'Không dán trực tiếp URL thô ra ngoài câu văn; liên kết phải gắn trên cụm chữ neo được chỉ định.',
        verifyTip: `Cụm “${seed.linkAnchor}” chuyển màu xanh gạch chân và trỏ đúng tới ${seed.linkUrl}.`,
      },
      applySampleSolution: (doc) => {
        const list = [...(doc.json.content ?? [])];
        const parts = seed.body2.split(seed.linkAnchor);
        if (parts.length >= 2) {
          list[5] = {
            type: 'paragraph',
            content: [
              { type: 'text', text: parts[0] },
              { type: 'text', text: seed.linkAnchor, marks: [{ type: 'link', attrs: { href: seed.linkUrl } }] },
              { type: 'text', text: parts.slice(1).join(seed.linkAnchor) },
            ],
          };
          doc.json.content = list;
        }
      },
      check: (doc) => {
        const host = seed.linkUrl.replace(/^https?:\/\//, '').toLowerCase();
        const ok = collectNodes(doc.json).some(
          (n) =>
            n.type === 'text' &&
            foldText(n.text ?? '').includes(foldText(seed.linkAnchor)) &&
            (n.marks ?? []).some((m) => m.type === 'link' && String(m.attrs?.href ?? '').toLowerCase().includes(host)),
        );
        return ok
          ? { passed: true, detail: `Đã gắn liên kết ${seed.linkUrl} vào “${seed.linkAnchor}”.` }
          : { passed: false, detail: `Cụm “${seed.linkAnchor}” chưa gắn đúng liên kết “${seed.linkUrl}”.` };
      },
    };
  }
  if (mode === 3) {
    return {
      id: taskId,
      domainId: 'word-tables',
      title: 'Chèn Hộp chữ (Text Box) tóm tắt chỉ số chính',
      titleEn: 'Insert a summary Callout Text Box',
      instruction: `Chèn một Hộp chữ (Text Box) có chứa nội dung “${seed.calloutText}” để làm nổi bật thông điệp trọng tâm.`,
      instructionEn: `Insert a Text Box containing “${seed.calloutText}”.`,
      copyTokens: [seed.calloutText],
      ribbonPath: 'Chèn → Hộp chữ (Text Box)',
      hint: `Mở thẻ Chèn → Hộp chữ, sau đó dán nội dung “${seed.calloutText}” vào bên trong hộp chữ.`,
      points: 20,
      solution: {
        steps: [
          'Đặt con trỏ tại vị trí cần đặt khung điểm nhấn.',
          'Mở thẻ Chèn (Insert) → bấm nút Hộp chữ (Text Box).',
          `Sử dụng nút Click-to-Copy để dán chính xác câu “${seed.calloutText}” vào hộp chữ.`,
        ],
        formulaOrValue: seed.calloutText,
        examTrap: 'Phải dùng đối tượng Text Box thật thay vì gõ đoạn văn thông thường.',
        verifyTip: `Khung Hộp chữ xuất hiện rõ ràng và chứa đúng thông điệp “${seed.calloutText}”.`,
      },
      applySampleSolution: (doc) => {
        doc.json.content = [
          ...(doc.json.content ?? []),
          { type: 'textBox', content: [{ type: 'paragraph', content: [{ type: 'text', text: seed.calloutText }] }] },
        ];
      },
      check: (doc) => {
        const boxes = collectNodes(doc.json).filter((n) => n.type === 'textBox');
        const keyWord = foldText(seed.calloutText).slice(0, 14);
        const ok = boxes.some((b) => foldText(nodeText(b)).includes(keyWord));
        return ok
          ? { passed: true, detail: 'Đã chèn Hộp chữ tóm tắt đúng nội dung yêu cầu.' }
          : { passed: false, detail: `Chưa tìm thấy Hộp chữ chứa nội dung “${seed.calloutText}”.` };
      },
    };
  }
  return {
    id: taskId,
    domainId: 'word-tables',
    title: 'Chèn danh sách kiểm việc (Checklist) 2 hạng mục',
    titleEn: 'Insert a 2-item interactive Task Checklist',
    instruction: `Cuối tài liệu, chèn danh sách công việc có ô tích (Task List) gồm tối thiểu 2 mục kiểm tra (ví dụ: “${seed.checkItemA}” và “${seed.checkItemB}”).`,
    instructionEn: `Insert a Task Checklist with at least 2 items at the end of the document.`,
    copyTokens: [seed.checkItemA, seed.checkItemB],
    ribbonPath: 'Trang chủ → Danh sách kiểm việc (Task List)',
    hint: 'Đặt con trỏ cuối tài liệu, bấm biểu tượng Danh sách tác vụ (ô vuông tích) trên thẻ Trang chủ và nhập ít nhất 2 mục.',
    points: 20,
    solution: {
      steps: [
        'Di chuyển con trỏ xuống dòng trống cuối văn bản.',
        'Trên thẻ Trang chủ (Home), bấm nút Danh sách kiểm việc (Task List).',
        `Nhập ít nhất 2 đầu việc như “${seed.checkItemA}” và “${seed.checkItemB}”.`,
      ],
      examTrap: 'Danh sách kiểm việc khác với danh sách dấu chấm tròn thông thường.',
      verifyTip: 'Hai dòng hạng mục có ô vuông checkbox tương tác ở đầu dòng.',
    },
    applySampleSolution: (doc) => {
      doc.json.content = [
        ...(doc.json.content ?? []),
        {
          type: 'taskList',
          content: [seed.checkItemA, seed.checkItemB].map((item) => ({
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
          })),
        },
      ];
    },
    check: (doc) => {
      const ok = collectNodes(doc.json).some((n) => n.type === 'taskList' && (n.content?.length ?? 0) >= 2);
      return ok
        ? { passed: true, detail: 'Đã chèn danh sách kiểm việc tối thiểu 2 hạng mục.' }
        : { passed: false, detail: 'Chưa thấy danh sách Task List có từ 2 mục trở lên.' };
    },
  };
}

function makeAssocSlot5(taskId: string, version: MosVersion, variant: number, seed: WordScenarioSeed): MosWordProject['tasks'][number] {
  const mode = version === '2016' ? (variant % 4) : (variant % 5);
  if (mode === 0) {
    return {
      id: taskId,
      domainId: 'word-refs',
      title: 'Đầu trang đơn vị và bật Số trang',
      titleEn: 'Add organization Header and enable Page Numbers',
      instruction: `Thiết lập Đầu trang (Header) chứa “${seed.orgHeader}” và bật hiển thị Số trang cho tài liệu.`,
      instructionEn: `Set the document Header to include “${seed.orgHeader}” and turn on Page Numbers.`,
      copyTokens: [seed.orgHeader],
      ribbonPath: 'Bố cục → Đầu/chân trang',
      hint: `Mở Bố cục → Đầu/chân trang, dán “${seed.orgHeader}” vào Đầu trang và bật Số trang.`,
      points: 20,
      solution: {
        steps: [
          'Mở thẻ Bố cục (Layout) → bấm Đầu/chân trang (Header & Footer).',
          `Dán chuỗi “${seed.orgHeader}” vào ô Đầu trang (Header).`,
          'Tích bật tuỳ chọn Hiện số trang (Page Numbers) rồi bấm Lưu.',
        ],
        formulaOrValue: seed.orgHeader,
        examTrap: 'Phải bật cả công tắc Số trang bên cạnh việc điền chữ ở Đầu trang.',
        verifyTip: `Đầu trang hiện “${seed.orgHeader}” và chân trang có số thứ tự trang.`,
      },
      applySampleSolution: (doc) => {
        doc.page.header = seed.orgHeader;
        doc.page.pageNumbers = true;
      },
      check: (doc) => {
        const hdrOk = foldText(doc.page.header ?? '').includes(foldText(seed.orgHeader));
        const numOk = Boolean(doc.page.pageNumbers);
        return hdrOk && numOk
          ? { passed: true, detail: `Đã gắn đầu trang “${doc.page.header}” và bật số trang.` }
          : { passed: false, detail: `Cần nhập Đầu trang chứa “${seed.orgHeader}” và bật Số trang.` };
      },
    };
  }
  if (mode === 1) {
    return {
      id: taskId,
      domainId: 'word-refs',
      title: 'Chân trang mã hồ sơ và số trang La Mã',
      titleEn: 'Add document code Footer and Roman page numbers',
      instruction: `Nhập Chân trang (Footer) chứa “${seed.footerCode}”, bật Số trang và chọn định dạng số La Mã (Roman: i, ii, iii).`,
      instructionEn: `Set the Footer to include “${seed.footerCode}”, enable Page Numbers, and format them as Roman numerals.`,
      copyTokens: [seed.footerCode],
      ribbonPath: 'Bố cục → Đầu/chân trang → Định dạng số trang La Mã',
      hint: `Vào Bố cục → Đầu/chân trang, nhập “${seed.footerCode}” vào Chân trang, bật Số trang và chọn kiểu La Mã.`,
      points: 20,
      solution: {
        steps: [
          'Mở hộp thoại Đầu/chân trang từ thẻ Bố cục hoặc Chèn.',
          `Dán mã “${seed.footerCode}” vào ô Chân trang (Footer).`,
          'Bật Số trang và đổi Định dạng số trang sang chữ số La Mã (i, ii, iii) rồi lưu.',
        ],
        formulaOrValue: seed.footerCode,
        examTrap: 'Đừng để nguyên định dạng số 1, 2, 3 mặc định khi đề yêu cầu chữ số La Mã.',
        verifyTip: `Chân trang hiển thị mã “${seed.footerCode}” kèm số trang kiểu La Mã.`,
      },
      applySampleSolution: (doc) => {
        doc.page.footer = seed.footerCode;
        doc.page.pageNumbers = true;
        doc.page.pageNumberFormat = 'roman';
      },
      check: (doc) => {
        const ftrOk = foldText(doc.page.footer ?? '').includes(foldText(seed.footerCode));
        const romOk = doc.page.pageNumberFormat === 'roman';
        return ftrOk && romOk
          ? { passed: true, detail: 'Đã thiết lập chân trang mã hồ sơ và số trang La Mã.' }
          : { passed: false, detail: `Cần điền Chân trang “${seed.footerCode}” và chọn định dạng số La Mã.` };
      },
    };
  }
  if (mode === 2) {
    return {
      id: taskId,
      domainId: 'word-refs',
      title: 'Chèn Mục lục tự động (Table of Contents)',
      titleEn: 'Insert an Automatic Table of Contents',
      instruction: 'Chèn một khối Mục lục tự động (Automatic Table of Contents) để tổng hợp toàn bộ các đề mục trong tài liệu.',
      instructionEn: 'Insert an Automatic Table of Contents into the document.',
      ribbonPath: 'Tham chiếu → Mục lục → Mục lục tự động 1',
      hint: 'Mở thẻ Tham chiếu (References) → Mục lục → chọn Mục lục tự động 1 hoặc 2.',
      points: 20,
      solution: {
        steps: [
          'Đặt con trỏ tại đầu tài liệu ngay dưới tiêu đề hoặc cuối bài.',
          'Mở thẻ Tham chiếu (References) trên thanh công cụ.',
          'Bấm nút Mục lục (Table of Contents) → chọn Mục lục tự động 1.',
        ],
        examTrap: 'Tuyệt đối không gõ tay danh sách đề mục và dấu chấm nối trang.',
        verifyTip: 'Khối Mục lục tự động xuất hiện và liệt kê đúng các tiêu đề Heading 2.',
      },
      applySampleSolution: (doc) => {
        doc.json.content = [...(doc.json.content ?? []), { type: 'tableOfContents', attrs: { levels: 3, showPages: true } }];
      },
      check: (doc) =>
        collectNodes(doc.json).some((n) => n.type === 'tableOfContents')
          ? { passed: true, detail: 'Đã chèn Mục lục tự động thành công.' }
          : { passed: false, detail: 'Tài liệu chưa có khối Mục lục tự động (Table of Contents).' },
    };
  }
  if (mode === 3) {
    return {
      id: taskId,
      domainId: 'word-refs',
      title: `Gắn Dấu trang “${seed.bookmarkName}” và Chú thích chân trang`,
      titleEn: `Insert Bookmark “${seed.bookmarkName}” and a Footnote`,
      instruction: `Tạo một Dấu trang (Bookmark) đặt tên chính xác là “${seed.bookmarkName}” và chèn ít nhất một Chú thích chân trang (Footnote).`,
      instructionEn: `Add a Bookmark named “${seed.bookmarkName}” and insert a Footnote.`,
      copyTokens: [seed.bookmarkName],
      ribbonPath: 'Chèn → Dấu trang · Tham chiếu → Chèn chú thích chân trang',
      hint: `Vào Chèn → Dấu trang đặt tên “${seed.bookmarkName}”, sau đó vào Tham chiếu → Chèn chú thích chân trang.`,
      points: 20,
      solution: {
        steps: [
          `Đặt con trỏ tại mục 2, mở thẻ Chèn → Dấu trang (Bookmark) và nhập tên không dấu cách “${seed.bookmarkName}”.`,
          'Chuyển sang thẻ Tham chiếu (References).',
          'Bấm Chèn chú thích chân trang (Insert Footnote) và nhập nội dung giải thích thuật ngữ.',
        ],
        formulaOrValue: seed.bookmarkName,
        shortcut: 'Ctrl + Alt + F',
        examTrap: 'Tên Bookmark không được chứa khoảng trắng và phải chọn đúng Footnote (không phải Endnote).',
        verifyTip: `Dấu trang “${seed.bookmarkName}” đã lưu và cuối trang xuất hiện chú thích Footnote.`,
      },
      applySampleSolution: (doc) => {
        doc.json.content = [
          ...(doc.json.content ?? []),
          { type: 'paragraph', content: [{ type: 'bookmark', attrs: { name: seed.bookmarkName } }] },
          { type: 'paragraph', content: [{ type: 'footnote', attrs: { text: seed.orgHeader, kind: 'foot' } }] },
        ];
      },
      check: (doc) => {
        const nodes = collectNodes(doc.json);
        const bmOk = nodes.some((n) => n.type === 'bookmark' && foldText(String(n.attrs?.name ?? '')) === foldText(seed.bookmarkName));
        const fnOk = nodes.some((n) => n.type === 'footnote' && (n.attrs?.kind ?? 'foot') !== 'end' && String(n.attrs?.text ?? '').trim().length > 0);
        return bmOk && fnOk
          ? { passed: true, detail: `Đã gắn dấu trang “${seed.bookmarkName}” và chú thích chân trang.` }
          : { passed: false, detail: `Cần tạo đủ Bookmark tên “${seed.bookmarkName}” và 1 Footnote.` };
      },
    };
  }
  const citeStyle = variant % 2 === 0 ? 'ieee' : 'chicago';
  return {
    id: taskId,
    domainId: 'word-refs',
    title: `Thêm Nhận xét kiểm duyệt và đổi chuẩn trích dẫn ${citeStyle.toUpperCase()}`,
    titleEn: `Add a Review Comment and set ${citeStyle.toUpperCase()} citation style`,
    instruction: `Đổi kiểu trích dẫn tài liệu (Citation Style) sang chuẩn ${citeStyle.toUpperCase()} và gắn ít nhất 1 Nhận xét (Comment) rà soát nội dung.`,
    instructionEn: `Change the Citation Style to ${citeStyle.toUpperCase()} and insert at least one Review Comment.`,
    ribbonPath: `Tham chiếu → Kiểu trích dẫn (${citeStyle.toUpperCase()}) · Xem lại → Nhận xét mới`,
    hint: `Mở thẻ Tham chiếu chọn kiểu ${citeStyle.toUpperCase()}, sau đó sang thẻ Xem lại (Review) → bấm Nhận xét mới.`,
    points: 20,
    solution: {
      steps: [
        `Mở thẻ Tham chiếu (References) → tại mục Kiểu trích dẫn, chọn ${citeStyle.toUpperCase()}.`,
        'Bôi chọn một cụm từ cần lưu ý, chuyển sang thẻ Xem lại (Review).',
        'Bấm Nhận xét mới (New Comment), nhập nội dung góp ý rồi lưu.',
      ],
      examTrap: 'Mặc định tài liệu đang ở chuẩn APA; đừng quên đổi sang đúng chuẩn trích dẫn đề yêu cầu.',
      verifyTip: `Kiểu trích dẫn hiển thị ${citeStyle.toUpperCase()} và khung Nhận xét bên phải có tối thiểu 1 mục.`,
    },
    applySampleSolution: (doc) => {
      doc.page.citationStyle = citeStyle;
      doc.comments = [{ id: `c-${taskId}`, author: 'Reviewer', text: 'Đã kiểm tra nội dung', createdAt: 1, resolved: false }];
    },
    check: (doc) => {
      const styleOk = doc.page.citationStyle === citeStyle;
      const cmtOk = (doc.comments?.length ?? 0) >= 1;
      return styleOk && cmtOk
        ? { passed: true, detail: `Đã chuyển chuẩn trích dẫn ${citeStyle.toUpperCase()} và thêm nhận xét.` }
        : { passed: false, detail: `Cần đổi kiểu trích dẫn sang ${citeStyle.toUpperCase()} và thêm ít nhất 1 Nhận xét.` };
    },
  };
}

function makeExpertTasks(prefix: string, version: MosVersion, orderIndex: number, seed: WordScenarioSeed): MosWordProject['tasks'] {
  const startPage = [3, 5, 2, 4, 7][orderIndex % 5];
  const citeStyles = ['ieee', 'chicago', 'mla', 'vancouver'] as const;
  const pickedCite = citeStyles[orderIndex % citeStyles.length];

  const t1: MosWordProject['tasks'][number] = orderIndex % 2 === 0
    ? {
        id: `${prefix}-t1`,
        domainId: 'word-manage',
        title: 'Lề đối xứng (Mirrored) và đầu trang Chẵn/Lẻ khác biệt',
        titleEn: 'Mirrored Margins & Different Odd/Even Headers',
        instruction: `Thiết lập lề Đối xứng (Mirrored Margins), bật Trang chẵn/lẻ khác nhau và điền đầu trang chẵn chứa “${seed.orgHeader}”.`,
        instructionEn: `Enable Mirrored Margins, turn on Different Odd & Even pages, and set the Even Page Header to include “${seed.orgHeader}”.`,
        copyTokens: [seed.orgHeader],
        ribbonPath: 'Bố cục → Lề → Đối xứng · Bố cục → Đầu/chân trang → Chẵn/lẻ khác nhau',
        hint: `Chọn Lề Đối xứng trong Bố cục, rồi mở Đầu/chân trang tích chọn Chẵn/lẻ khác nhau và nhập “${seed.orgHeader}” vào Đầu trang chẵn.`,
        points: 20,
        solution: {
          steps: [
            'Mở thẻ Bố cục (Layout) → Lề (Margins) → chọn Đối xứng (Mirrored).',
            'Bấm Đầu/chân trang (Header & Footer) → tích bật Trang chẵn/lẻ khác nhau (Different Odd & Even).',
            `Nhập “${seed.orgHeader}” vào ô Đầu trang chẵn rồi bấm Lưu.`,
          ],
          formulaOrValue: seed.orgHeader,
          examTrap: 'Nhập nhầm vào Đầu trang thường thay vì ô Đầu trang chẵn sẽ không đạt điểm câu Expert này.',
          verifyTip: 'Trang bật chế độ lề đóng gáy và ô Đầu trang chẵn lưu đúng tên đơn vị.',
        },
        applySampleSolution: (doc) => {
          doc.page.mirrorMargins = true;
          doc.page.differentOddEven = true;
          doc.page.headerEven = seed.orgHeader;
        },
        check: (doc) => {
          const ok = Boolean(doc.page.mirrorMargins && doc.page.differentOddEven && foldText(doc.page.headerEven ?? '').includes(foldText(seed.orgHeader)));
          return ok
            ? { passed: true, detail: 'Đã thiết lập lề đối xứng và đầu trang chẵn chuẩn in hai mặt.' }
            : { passed: false, detail: `Cần bật đủ Lề đối xứng, Chẵn/lẻ khác nhau và điền Đầu trang chẵn “${seed.orgHeader}”.` };
        },
      }
    : {
        id: `${prefix}-t1`,
        domainId: 'word-manage',
        title: `Trang đầu khác biệt và đánh số trang bắt đầu từ ${startPage}`,
        titleEn: `Different First Page & Start page numbering at ${startPage}`,
        instruction: `Bật tuỳ chọn Trang đầu khác (Different First Page), điền đầu trang nội dung “${seed.orgHeader}” và cho đánh số trang bắt đầu từ ${startPage}.`,
        instructionEn: `Enable Different First Page, set Header to “${seed.orgHeader}”, and start page numbering at ${startPage}.`,
        copyTokens: [seed.orgHeader],
        ribbonPath: `Bố cục → Đầu/chân trang → Trang đầu khác & Bắt đầu từ ${startPage}`,
        hint: `Trong hộp thoại Đầu/chân trang, bật Trang đầu khác, bật Số trang bắt đầu từ ${startPage} và nhập “${seed.orgHeader}”.`,
        points: 20,
        solution: {
          steps: [
            'Mở Bố cục → Đầu/chân trang (Header & Footer).',
            `Tích chọn Trang đầu khác (Different First Page) và nhập “${seed.orgHeader}” vào ô Đầu trang chính.`,
            `Bật Số trang và đổi ô Bắt đầu từ (Start at) thành ${startPage} rồi lưu.`,
          ],
          formulaOrValue: `${seed.orgHeader} | Start: ${startPage}`,
          examTrap: `Nhớ đổi giá trị Start at sang ${startPage} thay vì để mặc định là 1.`,
          verifyTip: `Trang bìa ẩn tiêu đề đầu trang và số thứ tự trang bắt đầu từ ${startPage}.`,
        },
        applySampleSolution: (doc) => {
          doc.page.differentFirstPage = true;
          doc.page.header = seed.orgHeader;
          doc.page.pageNumbers = true;
          doc.page.pageNumberStart = startPage;
        },
        check: (doc) => {
          const ok = Boolean(
            doc.page.differentFirstPage &&
            foldText(doc.page.header ?? '').includes(foldText(seed.orgHeader)) &&
            Number(doc.page.pageNumberStart ?? 1) === startPage,
          );
          return ok
            ? { passed: true, detail: `Đã bật Trang đầu khác và đánh số bắt đầu từ ${startPage}.` }
            : { passed: false, detail: `Cần bật Trang đầu khác, điền Đầu trang “${seed.orgHeader}” và đặt số bắt đầu = ${startPage}.` };
        },
      };

  const t2: MosWordProject['tasks'][number] = {
    id: `${prefix}-t2`,
    domainId: 'word-refs',
    title: `Quản lý nguồn trích dẫn (${pickedCite.toUpperCase()}) & Thư mục tham khảo`,
    titleEn: `Add Bibliographic Source (${pickedCite.toUpperCase()}) & Insert Bibliography`,
    instruction: `Đổi chuẩn trích dẫn sang ${pickedCite.toUpperCase()}, thêm ít nhất 1 Nguồn tài liệu (Source) và chèn khối Thư mục tham khảo (Bibliography) vào cuối bài.`,
    instructionEn: `Set citation style to ${pickedCite.toUpperCase()}, add at least one Source, and insert a Bibliography block.`,
    ribbonPath: 'Tham chiếu → Kiểu trích dẫn · Quản lý nguồn · Thư mục',
    hint: `Ở thẻ Tham chiếu, chọn kiểu ${pickedCite.toUpperCase()}, bấm Quản lý nguồn thêm 1 tài liệu, rồi bấm Thư mục chèn danh mục tham khảo.`,
    points: 20,
    solution: {
      steps: [
        `Mở thẻ Tham chiếu (References) → đổi Kiểu trích dẫn sang ${pickedCite.toUpperCase()}.`,
        'Bấm Quản lý nguồn (Manage Sources) → thêm mới 1 nguồn tài liệu (tác giả, tiêu đề, năm).',
        'Đặt con trỏ cuối tài liệu, bấm Thư mục (Bibliography) để chèn danh mục tham khảo tự động.',
      ],
      examTrap: 'Nếu chỉ chèn khối Thư mục mà chưa thêm Nguồn trong Quản lý nguồn thì danh mục sẽ rỗng và không đạt điểm.',
      verifyTip: `Đã có ít nhất 1 nguồn lưu trữ theo chuẩn ${pickedCite.toUpperCase()} và khối Thư mục hiện ở cuối bài.`,
    },
    applySampleSolution: (doc) => {
      doc.page.citationStyle = pickedCite;
      doc.page.sources = [{ id: `src-${prefix}`, type: 'report', authors: seed.orgHeader, title: seed.title, year: '2026' }];
      doc.json.content = [...(doc.json.content ?? []), { type: 'bibliography', attrs: {} }];
    },
    check: (doc) => {
      const styleOk = doc.page.citationStyle === pickedCite;
      const srcOk = (doc.page.sources?.length ?? 0) >= 1;
      const bibOk = collectNodes(doc.json).some((n) => n.type === 'bibliography');
      return styleOk && srcOk && bibOk
        ? { passed: true, detail: `Đã thiết lập nguồn ${pickedCite.toUpperCase()} và chèn Thư mục tham khảo.` }
        : { passed: false, detail: `Cần đủ 3 bước: chuẩn ${pickedCite.toUpperCase()}, tối thiểu 1 Nguồn và khối Thư mục.` };
    },
  };

  const t3: MosWordProject['tasks'][number] = orderIndex % 2 === 0
    ? {
        id: `${prefix}-t3`,
        domainId: 'word-refs',
        title: 'Đánh dấu thuật ngữ và xuất bảng Chỉ mục (Index)',
        titleEn: 'Mark Index Entry & Insert Index Table',
        instruction: `Đánh dấu thuật ngữ “${seed.focusTerm}” làm mục chỉ mục (Index Entry) và chèn bảng Chỉ mục (Index) kèm 1 Chú thích cuối tài liệu (Endnote).`,
        instructionEn: `Mark “${seed.focusTerm}” as an Index Entry, insert an Index table, and add an Endnote.`,
        copyTokens: [seed.focusTerm],
        ribbonPath: 'Tham chiếu → Đánh dấu mục · Chèn chỉ mục · Chèn chú thích cuối',
        hint: 'Trong thẻ Tham chiếu, thực hiện Đánh dấu mục (Mark Entry), Chèn chỉ mục (Insert Index) và Chèn chú thích cuối (Endnote).',
        points: 20,
        solution: {
          steps: [
            `Chọn cụm “${seed.focusTerm}”, vào Tham chiếu → Đánh dấu mục (Mark Entry).`,
            'Đặt con trỏ cuối bài, bấm Chèn chỉ mục (Insert Index).',
            'Tiếp tục bấm Chèn chú thích cuối (Insert Endnote — Ctrl+Alt+D) và nhập ghi chú chuyên môn.',
          ],
          shortcut: 'Ctrl + Alt + D',
          examTrap: 'Phân biệt rõ Endnote (chú thích cuối tài liệu) với Footnote (chú thích cuối trang).',
          verifyTip: 'Tài liệu có đủ thẻ đánh dấu chỉ mục, bảng Chỉ mục và chú thích cuối Endnote.',
        },
        applySampleSolution: (doc) => {
          doc.json.content = [
            ...(doc.json.content ?? []),
            { type: 'paragraph', content: [{ type: 'indexEntry', attrs: { term: seed.focusTerm } }] },
            { type: 'docIndex', attrs: {} },
            { type: 'paragraph', content: [{ type: 'footnote', attrs: { text: seed.calloutText, kind: 'end' } }] },
          ];
        },
        check: (doc) => {
          const nodes = collectNodes(doc.json);
          const hasEntry = nodes.some((n) => n.type === 'indexEntry');
          const hasIdx = nodes.some((n) => n.type === 'docIndex');
          const hasEnd = nodes.some((n) => n.type === 'footnote' && n.attrs?.kind === 'end');
          return hasEntry && hasIdx && hasEnd
            ? { passed: true, detail: 'Đã đánh dấu thuật ngữ, chèn bảng Chỉ mục và Endnote.' }
            : { passed: false, detail: 'Cần đủ 3 thành phần: Đánh dấu mục (Index Entry), Bảng Chỉ mục và Endnote.' };
        },
      }
    : {
        id: `${prefix}-t3`,
        domainId: 'word-refs',
        title: 'Chèn Mục lục tự động và Danh mục hình biểu (Table of Figures)',
        titleEn: 'Insert Automatic TOC & Table of Figures',
        instruction: 'Chèn cả khối Mục lục tự động (Table of Contents) ở đầu bài và khối Danh mục hình minh hoạ (Table of Figures) ở cuối bài.',
        instructionEn: 'Insert both an Automatic Table of Contents and a Table of Figures.',
        ribbonPath: 'Tham chiếu → Mục lục · Tham chiếu → Chèn danh mục hình',
        hint: 'Mở thẻ Tham chiếu, chèn Mục lục tự động và bấm Chèn danh mục hình (Table of Figures).',
        points: 20,
        solution: {
          steps: [
            'Đặt con trỏ dưới dòng tiêu đề chính, mở Tham chiếu → Mục lục → chọn Mục lục tự động.',
            'Di chuyển con trỏ xuống cuối văn bản.',
            'Trong thẻ Tham chiếu → bấm Chèn danh mục hình (Table of Figures) để tổng hợp danh mục minh hoạ.',
          ],
          examTrap: 'Hai bảng Mục lục đề mục và Danh mục hình là hai đối tượng hoàn toàn tách biệt trong thẻ Tham chiếu.',
          verifyTip: 'Tài liệu có mặt cả khối Table of Contents lẫn khối Table of Figures.',
        },
        applySampleSolution: (doc) => {
          doc.json.content = [
            { type: 'tableOfContents', attrs: { levels: 3, showPages: true } },
            ...(doc.json.content ?? []),
            { type: 'figureList', attrs: {} },
          ];
        },
        check: (doc) => {
          const nodes = collectNodes(doc.json);
          const tocOk = nodes.some((n) => n.type === 'tableOfContents');
          const figOk = nodes.some((n) => n.type === 'figureList');
          return tocOk && figOk
            ? { passed: true, detail: 'Đã chèn đầy đủ Mục lục tự động và Danh mục hình.' }
            : { passed: false, detail: 'Cần chèn cả Mục lục tự động (TOC) và Danh mục hình (Table of Figures).' };
        },
      };

  const t4: MosWordProject['tasks'][number] = version === '365'
    ? {
        id: `${prefix}-t4`,
        domainId: 'word-format',
        title: 'Phương trình chuyên sâu, thay thế thuật ngữ & ngắt trang mục',
        titleEn: 'Equation block, bulk term replacement & Page Break Before',
        instruction: `Thay thế toàn bộ cụm “${seed.oldTerm}” thành “${seed.newTerm}”, bật Ngắt trang trước (Page break before) cho tiêu đề “${seed.sec2}” và chèn phương trình “${seed.equationLatex}”.`,
        instructionEn: `Replace all “${seed.oldTerm}” with “${seed.newTerm}”, set Page break before on “${seed.sec2}”, and insert equation “${seed.equationLatex}”.`,
        copyTokens: [seed.oldTerm, seed.newTerm, seed.equationLatex],
        ribbonPath: 'Ctrl + H · Đoạn văn → Ngắt trang trước · Chèn → Phương trình',
        hint: `Dùng Ctrl+H thay “${seed.oldTerm}” → “${seed.newTerm}”, bật Ngắt trang trước cho “${seed.sec2}” và chèn phương trình “${seed.equationLatex}”.`,
        points: 20,
        solution: {
          steps: [
            `Nhấn Ctrl + H thay tất cả “${seed.oldTerm}” bằng “${seed.newTerm}”.`,
            `Đặt con trỏ tại tiêu đề “${seed.sec2}”, mở hộp thoại Đoạn văn → tích chọn Ngắt trang trước (Page break before).`,
            `Vào thẻ Chèn → Phương trình → dán “${seed.equationLatex}” và xác nhận.`,
          ],
          formulaOrValue: seed.equationLatex,
          shortcut: 'Ctrl + H',
          examTrap: 'Phải tích thuộc tính Page break before của đoạn tiêu đề thay vì gõ Enter thủ công.',
          verifyTip: 'Thuật ngữ được cập nhật đồng loạt, mục 2 tự sang trang và phương trình hiển thị rõ nét.',
        },
        applySampleSolution: (doc) => {
          const replaced = JSON.parse(JSON.stringify(doc.json).split(seed.oldTerm).join(seed.newTerm)) as DocContent['json'];
          for (const node of replaced.content ?? []) {
            if (node.type === 'heading' && foldText(nodeText(node)).includes(foldText(seed.sec2))) {
              node.attrs = { ...(node.attrs ?? {}), pageBreakBefore: true };
            }
          }
          replaced.content = [...(replaced.content ?? []), { type: 'paragraph', content: [{ type: 'equation', attrs: { latex: seed.equationLatex } }] }];
          doc.json = replaced;
        },
        check: (doc) => {
          const txt = foldText(fullDocText(doc));
          const repOk = !txt.includes(foldText(seed.oldTerm)) && txt.includes(foldText(seed.newTerm));
          const nodes = collectNodes(doc.json);
          const brkOk = nodes.some((n) => n.type === 'heading' && foldText(nodeText(n)).includes(foldText(seed.sec2)) && Boolean(n.attrs?.pageBreakBefore));
          const eqOk = nodes.some((n) => n.type === 'equation');
          return repOk && brkOk && eqOk
            ? { passed: true, detail: 'Đã hoàn tất thay thế thuật ngữ, ngắt trang tự động và chèn phương trình.' }
            : { passed: false, detail: 'Chưa đủ cả 3 yêu cầu: Thay thế thuật ngữ, Page break before trên mục 2 và Phương trình.' };
        },
      }
    : {
        id: `${prefix}-t4`,
        domainId: 'word-format',
        title: 'Chuẩn hoá thuật ngữ, ngắt trang tiêu đề & thiết lập bảo mật trang',
        titleEn: 'Standardize terminology, Page Break Before & Watermark',
        instruction: `Thay thế toàn bộ “${seed.oldTerm}” thành “${seed.newTerm}”, bật Ngắt trang trước (Page break before) cho “${seed.sec2}” và gắn hình mờ “${seed.watermarkTag}”.`,
        instructionEn: `Replace all “${seed.oldTerm}” with “${seed.newTerm}”, enable Page break before on “${seed.sec2}”, and set Watermark to “${seed.watermarkTag}”.`,
        copyTokens: [seed.oldTerm, seed.newTerm, seed.watermarkTag],
        ribbonPath: 'Ctrl + H · Đoạn văn → Ngắt trang trước · Thiết kế → Hình mờ',
        hint: `Dùng Ctrl+H đổi cụm từ, bật Ngắt trang trước trên “${seed.sec2}” và gắn hình mờ “${seed.watermarkTag}”.`,
        points: 20,
        solution: {
          steps: [
            `Nhấn Ctrl + H, thay tất cả “${seed.oldTerm}” thành “${seed.newTerm}”.`,
            `Đặt con trỏ vào dòng tiêu đề “${seed.sec2}”, mở hộp thoại Đoạn văn → bật Ngắt trang trước (Page break before).`,
            `Sang thẻ Thiết kế → Hình mờ → gắn nhãn “${seed.watermarkTag}”.`,
          ],
          formulaOrValue: seed.watermarkTag,
          examTrap: 'Kiểm tra không để sót từ khoá cũ bằng cách dùng Thay tất cả (Replace All).',
          verifyTip: 'Văn bản sạch cụm từ cũ, mục 2 tự nhảy đầu trang và nền trang hiện chữ mờ.',
        },
        applySampleSolution: (doc) => {
          const replaced = JSON.parse(JSON.stringify(doc.json).split(seed.oldTerm).join(seed.newTerm)) as DocContent['json'];
          for (const node of replaced.content ?? []) {
            if (node.type === 'heading' && foldText(nodeText(node)).includes(foldText(seed.sec2))) {
              node.attrs = { ...(node.attrs ?? {}), pageBreakBefore: true };
            }
          }
          doc.json = replaced;
          doc.page.watermark = seed.watermarkTag;
        },
        check: (doc) => {
          const txt = foldText(fullDocText(doc));
          const repOk = !txt.includes(foldText(seed.oldTerm)) && txt.includes(foldText(seed.newTerm));
          const brkOk = collectNodes(doc.json).some((n) => n.type === 'heading' && foldText(nodeText(n)).includes(foldText(seed.sec2)) && Boolean(n.attrs?.pageBreakBefore));
          const wmOk = foldText(doc.page.watermark ?? '').includes(foldText(seed.watermarkTag)) || foldText(doc.page.watermark ?? '').includes('confidential');
          return repOk && brkOk && wmOk
            ? { passed: true, detail: 'Đã chuẩn hoá thuật ngữ, phân trang tiêu đề và gắn hình mờ bảo mật.' }
            : { passed: false, detail: 'Cần hoàn tất đủ: Thay thế thuật ngữ, Ngắt trang trước mục 2 và Hình mờ.' };
        },
      };

  const t5: MosWordProject['tasks'][number] = {
    id: `${prefix}-t5`,
    domainId: 'word-tables',
    title: 'Bảng đối chiếu 4×4, Dấu trang & 2 Nhận xét hội đồng',
    titleEn: '4×4 Audit Table, Bookmark & 2 Review Comments',
    instruction: `Chèn bảng 4 cột × 4 dòng, gắn Dấu trang tên “${seed.bookmarkName}” và tạo ít nhất 2 Nhận xét (Comments) phản biện độc lập.`,
    instructionEn: `Insert a 4×4 table, add a Bookmark named “${seed.bookmarkName}”, and attach at least 2 Review Comments.`,
    copyTokens: [seed.bookmarkName],
    ribbonPath: 'Chèn → Bảng 4×4 · Chèn → Dấu trang · Xem lại → Nhận xét mới (×2)',
    hint: `Chèn bảng 4×4, thêm Dấu trang “${seed.bookmarkName}” và tạo 2 Nhận xét trong thẻ Xem lại.`,
    points: 20,
    solution: {
      steps: [
        'Mở thẻ Chèn (Insert) → Bảng → chọn kích thước 4 cột × 4 dòng.',
        `Tiếp tục trên thẻ Chèn → Dấu trang (Bookmark) → nhập chính xác “${seed.bookmarkName}” rồi lưu.`,
        'Chuyển sang thẻ Xem lại (Review) → bấm Nhận xét mới (New Comment) 2 lần cho hai đoạn cần rà soát.',
      ],
      formulaOrValue: seed.bookmarkName,
      examTrap: 'Đề Expert yêu cầu tối thiểu 2 bình luận độc lập (1 bình luận duy nhất sẽ chưa đủ điểm).',
      verifyTip: `Có bảng 4×4, dấu trang “${seed.bookmarkName}” và danh sách Nhận xét có từ 2 mục trở lên.`,
    },
    applySampleSolution: (doc) => {
      doc.json.content = [
        ...(doc.json.content ?? []),
        {
          type: 'table',
          content: Array.from({ length: 4 }, () => ({
            type: 'tableRow',
            content: Array.from({ length: 4 }, () => ({
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Đạt' }] }],
            })),
          })),
        },
        { type: 'paragraph', content: [{ type: 'bookmark', attrs: { name: seed.bookmarkName } }] },
      ];
      doc.comments = [
        { id: `${prefix}-c1`, author: 'Reviewer 1', text: 'Rà soát mục 1', createdAt: 1, resolved: false },
        { id: `${prefix}-c2`, author: 'Reviewer 2', text: 'Rà soát mục 2', createdAt: 2, resolved: false },
      ];
    },
    check: (doc) => {
      const nodes = collectNodes(doc.json);
      const tblOk = nodes
        .filter((n) => n.type === 'table')
        .some((t) => {
          const rows = (t.content ?? []).filter((r) => r.type === 'tableRow');
          return rows.length >= 4 && (rows[0]?.content?.length ?? 0) >= 4;
        });
      const bmOk = nodes.some((n) => n.type === 'bookmark' && foldText(String(n.attrs?.name ?? '')) === foldText(seed.bookmarkName));
      const cmtOk = (doc.comments?.length ?? 0) >= 2;
      return tblOk && bmOk && cmtOk
        ? { passed: true, detail: 'Đã hoàn thiện bảng 4×4, dấu trang và 2 nhận xét kiểm duyệt.' }
        : { passed: false, detail: `Cần đủ Bảng 4×4, Bookmark “${seed.bookmarkName}” và tối thiểu 2 Nhận xét.` };
    },
  };

  return [t1, t2, t3, t4, t5];
}

function buildGeneratedWordBank(): MosWordProject[] {
  const out: MosWordProject[] = [];
  const versions: MosVersion[] = ['2016', '2019', '365'];
  const exams: MosExamNumber[] = [1, 2, 3, 4, 5];

  for (let vIdx = 0; vIdx < versions.length; vIdx++) {
    const version = versions[vIdx];
    for (const examNumber of exams) {
      if (version === '365' && examNumber === 1) continue;
      const examSlot = vIdx * 5 + (examNumber - 1);
      const assocStart = (examSlot * 5) % WORD_SCENARIO_SEEDS.length;
      const expStart = (examSlot * 7 + 3) % WORD_SCENARIO_SEEDS.length;

      for (let order = 1; order <= 7; order++) {
        const base = WORD_SCENARIO_SEEDS[(assocStart + order - 1) % WORD_SCENARIO_SEEDS.length];
        const variant = examSlot * 7 + (order - 1);
        const projId = `word-${version}-e${examNumber}-p${order}`;
        const difficulties = ['Cơ bản', 'Cơ bản', 'Trung bình', 'Trung bình', 'Trung bình', 'Nâng cao', 'Nâng cao'] as const;

        out.push({
          id: projId,
          track: 'word',
          version,
          examNumber,
          level: 'associate',
          kind: 'doc',
          order,
          title: base.title,
          titleEn: base.titleEn,
          fileName: base.fileName,
          scenario: base.scenario,
          scenarioEn: base.scenarioEn,
          minutes: 7,
          difficulty: difficulties[order - 1],
          createStarter: () => buildStarterDoc(base),
          tasks: [
            makeAssocSlot1(`${projId}-t1`, variant, base),
            makeAssocSlot2(`${projId}-t2`, version, variant, base),
            makeAssocSlot3(`${projId}-t3`, version, variant, base),
            makeAssocSlot4(`${projId}-t4`, version, variant, base),
            makeAssocSlot5(`${projId}-t5`, version, variant, base),
          ],
        });
      }

      for (let order = 1; order <= 5; order++) {
        const base = WORD_SCENARIO_SEEDS[(expStart + order - 1) % WORD_SCENARIO_SEEDS.length];
        const projId = `word-exp-${version}-e${examNumber}-p${order}`;
        const fileStem = base.fileName.replace(/\.docx$/i, '');

        out.push({
          id: projId,
          track: 'word',
          version,
          examNumber,
          level: 'expert',
          kind: 'doc',
          order,
          title: `${base.title} (Expert)`,
          titleEn: `${base.titleEn} (Expert)`,
          fileName: `${fileStem}_Expert.docx`,
          scenario: base.scenario,
          scenarioEn: base.scenarioEn,
          minutes: 10,
          difficulty: 'Nâng cao',
          createStarter: () => buildStarterDoc(base),
          tasks: makeExpertTasks(projId, version, examSlot + order - 1, base),
        });
      }
    }
  }
  return out;
}

export const MOS_GENERATED_WORD_PROJECTS: MosWordProject[] = buildGeneratedWordBank();
