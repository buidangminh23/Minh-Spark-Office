import type { PresentationData } from '../slideTypes';
import type { SlideContent } from '../storage';
import { baseSlide, countAnimations, foldSlide, hasAnyLink } from './pptHelpers';
import type { MosPptProject } from './types';

function buildExpertKioskStarter(): SlideContent {
  const s2 = baseSlide(
    'px1-s2',
    'title-content',
    'Điểm nhấn sản phẩm chủ lực',
    '• Tự động hoá xử lý văn bản, bảng tính và PDF ngoại tuyến\n• Đồng bộ đám mây an toàn theo tài khoản riêng',
  );
  s2.elements.push({
    id: 'px1-s2-badge',
    type: 'shape',
    shapeType: 'rounded-rect',
    x: 68,
    y: 66,
    width: 24,
    height: 16,
    fill: '#EA580C',
    color: '#FFFFFF',
    text: 'Bản 2026 Mới',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  });
  const presentation: PresentationData = {
    title: 'Kiosk_TrienLam_2026.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('px1-s1', 'title', 'TRIỂN LÃM CÔNG NGHỆ QUỐC TẾ 2026', 'Trải nghiệm giải pháp Office 23 tại gian hàng A12'),
      s2,
      baseSlide('px1-s3', 'title-content', 'Lịch trình demo trực tiếp', '• 09:30: Trình diễn 23 Docs & 23 Sheets\n• 14:00: Thực hành chuyển đổi định dạng & OCR tiếng Việt'),
      baseSlide('px1-s4', 'title-content', 'Liên hệ đối tác', 'Website: https://office.minhspark.com · Gian hàng A12'),
    ],
    sections: [],
    customShows: [],
  };
  return { kind: 'slide', presentation };
}

function buildBoardroomStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'HopHoiDongQuanTri_Q4.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('px2-s1', 'title', 'BÁO CÁO HỘI ĐỒNG QUẢN TRỊ Q4/2026', 'Tài liệu trình bày nội bộ cấp lãnh đạo'),
      baseSlide('px2-s2', 'title-content', 'Biên lợi nhuận theo quý', 'Chèn biểu đồ so sánh biên lợi nhuận Q1–Q4 tại trang này.'),
      baseSlide('px2-s3', 'title-content', 'Phân bổ ngân sách 2027', 'Chèn bảng dự toán ngân sách theo khối nghiệp vụ.'),
      baseSlide('px2-s4', 'title-content', 'Kế hoạch mở rộng thị trường', '• Mục tiêu tăng trưởng 32% doanh thu khối doanh nghiệp\n• Mở văn phòng đại diện khu vực Đông Nam Á'),
    ],
    sections: [],
  };
  return { kind: 'slide', presentation };
}

function buildKeynoteStarter(): SlideContent {
  const s2 = baseSlide(
    'px3-s2',
    'title-content',
    'Kiến trúc thế hệ mới',
    '• Xử lý cục bộ tốc độ cao, không phụ thuộc kết nối\n• Xuất chuẩn OpenXML giữ nguyên định dạng',
  );
  s2.elements.push({
    id: 'px3-s2-pill',
    type: 'shape',
    shapeType: 'rounded-rect',
    x: 64,
    y: 66,
    width: 28,
    height: 15,
    fill: '#2563EB',
    color: '#FFFFFF',
    text: 'Hiệu năng 3x',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  });
  const presentation: PresentationData = {
    title: 'Keynote_SanPham_2027.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('px3-s1', 'title', 'OFFICE 23 · KEYNOTE 2027', 'Tái định nghĩa trải nghiệm làm việc văn phòng hiện đại'),
      s2,
      baseSlide('px3-s3', 'title-content', 'Lộ trình phát hành', '• Q1: Phiên bản desktop tối ưu bộ nhớ\n• Q2: Đồng bộ cộng tác thời gian thực'),
      baseSlide('px3-s4', 'title-content', 'Hỏi đáp & Trải nghiệm', 'Truy cập https://office.minhspark.com/keynote để tải bản thử nghiệm.'),
    ],
  };
  return { kind: 'slide', presentation };
}

function buildSecurityTrainingStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'KhoaHoc_AnToanMang.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('px4-s1', 'title', 'ĐÀO TẠO AN TOÀN THÔNG TIN DOANH NGHIỆP', 'Chương trình nhận thức an ninh mạng bắt buộc 2026'),
      baseSlide('px4-s2', 'title-content', 'Nhận diện email giả mạo (Phishing)', '• Kiểm tra tên miền người gửi và đường dẫn thực\n• Không nhập mật khẩu qua liên kết lạ'),
      baseSlide('px4-s3', 'title-content', 'Đáp án tình huống 1 (Ẩn khi giảng)', 'Đáp án: Email giả mạo mượn tên miền tương tự — báo ngay cho đội SOC.'),
      baseSlide('px4-s4', 'title-content', 'Đáp án tình huống 2 (Ẩn khi giảng)', 'Đáp án: Từ chối cấp mã OTP qua điện thoại và xác minh kênh nội bộ.'),
    ],
    customShows: [],
  };
  return { kind: 'slide', presentation };
}

function buildEsgSummitStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'HoiNghi_ToanCau_ESG.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('px5-s1', 'title', 'HỘI NGHỊ PHÁT TRIỂN BỀN VỮNG ESG 2026', 'Cam kết giảm phát thải ròng bằng không vào năm 2035'),
      baseSlide('px5-s2', 'title-content', 'Bảng chỉ số phát thải theo nhà máy', 'Chèn bảng tổng hợp số liệu phát thải Scope 1 & 2 tại trang này.'),
      baseSlide('px5-s3', 'title-content', 'Biểu đồ tỷ trọng năng lượng tái tạo', 'Chèn biểu đồ tiến độ chuyển dịch sang điện mặt trời.'),
      baseSlide('px5-s4', 'title-content', 'Quy trình kiểm toán ESG độc lập', 'Chèn sơ đồ SmartArt mô tả 4 bước kiểm toán bền vững.'),
    ],
  };
  return { kind: 'slide', presentation };
}

export const MOS_PPT_EXPERT_PROJECTS: MosPptProject[] = [
  {
    id: 'ppt-expert-kiosk',
    track: 'powerpoint',
    level: 'expert',
    kind: 'slide',
    order: 1,
    title: 'Trình chiếu Kiosk & Slide Master (Chuyên sâu)',
    titleEn: 'Exhibition Kiosk & Slide Master',
    fileName: 'Kiosk_TrienLam_2026.pptx',
    scenario: 'Bài thuyết trình chạy tự động tại gian hàng triển lãm: cấu hình Slide Master, tự chuyển trang theo giây, trình chiếu tuỳ chỉnh (Custom Show), chuỗi hoạt hình và phân phần.',
    scenarioEn: 'Configure an unattended exhibition kiosk deck with Slide Master branding, timed slide advances, a VIP Custom Show, multi-object animations, and sections.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: buildExpertKioskStarter,
    tasks: [
      {
        id: 'px1-t1',
        domainId: 'ppt-deliver',
        title: 'Bật Slide Master với chân trang triển lãm',
        titleEn: 'Configure Slide Master footer & slide number',
        instruction: 'Mở Slide Master, bật áp dụng Slide Master, nhập chân trang chứa “Triển lãm 2026” và bật hiển thị Số trang.',
        instructionEn: 'Enable Slide Master, set the footer text to include “Triển lãm 2026”, and enable Slide Numbers.',
        copyTokens: ['Triển lãm 2026'],
        ribbonPath: 'Xem (View) → Slide Master',
        hint: 'Mở thẻ Xem → bấm Slide Master, bật kích hoạt Slide Master, nhập “Triển lãm 2026” vào chân trang và bật Số trang rồi lưu.',
        points: 20,
        check: (content) => {
          const sm = content.presentation.slideMaster;
          const ok = Boolean(sm?.enabled && sm?.showSlideNumber && foldSlide(sm?.footerText ?? '').includes('trien lam 2026'));
          return ok
            ? { passed: true, detail: `Slide Master đã bật với chân trang “${sm?.footerText}” và số trang.` }
            : { passed: false, detail: 'Chưa bật đủ Slide Master + Số trang + Chân trang chứa “Triển lãm 2026”.' };
        },
      },
      {
        id: 'px1-t2',
        domainId: 'ppt-motion',
        title: 'Tự động chuyển trang sau thời gian định sẵn',
        titleEn: 'Configure automatic timed slide advance',
        instruction: 'Bật tính năng tự động chuyển trang sau N giây (Advance After > 0) cho ít nhất 2 trang chiếu.',
        instructionEn: 'Set Advance Slide After > 0 seconds on at least 2 slides.',
        ribbonPath: 'Chuyển tiếp (Transitions) → Tự động chuyển sau (giây)',
        hint: 'Mở thẻ Chuyển tiếp, tích chọn chuyển trang tự động theo giây (> 0s) rồi bấm Áp dụng cho tất cả (hoặc thiết lập cho ít nhất 2 slide).',
        points: 20,
        check: (content) => {
          const timed = content.presentation.slides.filter((s) => (s.transition.advanceAfterSeconds ?? 0) > 0).length;
          return timed >= 2
            ? { passed: true, detail: `Đã thiết lập tự chuyển trang cho ${timed} trang chiếu.` }
            : { passed: false, detail: `Mới có ${timed} trang chiếu có thời gian tự chuyển trang, cần tối thiểu 2 trang.` };
        },
      },
      {
        id: 'px1-t3',
        domainId: 'ppt-deliver',
        title: 'Tạo Trình chiếu tuỳ chỉnh (Custom Show)',
        titleEn: 'Create a Custom Slide Show',
        instruction: 'Tạo ít nhất một Trình chiếu tuỳ chỉnh (Custom Show) chọn lọc tối thiểu 2 trang chiếu trọng tâm cho khách VIP.',
        instructionEn: 'Create at least one Custom Show containing at least 2 selected slides for VIP visitors.',
        ribbonPath: 'Trình chiếu (Slide Show) → Trình chiếu tuỳ chỉnh',
        hint: 'Mở thẻ Trình chiếu → bấm Trình chiếu tuỳ chỉnh → tạo một bộ chiếu mới, chọn ít nhất 2 trang chiếu và lưu.',
        points: 20,
        check: (content) => {
          const shows = content.presentation.customShows ?? [];
          return shows.some((show) => show.slideIds.length >= 2)
            ? { passed: true, detail: `Đã tạo ${shows.length} bộ Trình chiếu tuỳ chỉnh.` }
            : { passed: false, detail: 'Chưa tạo bộ Trình chiếu tuỳ chỉnh (Custom Show) nào có tối thiểu 2 slide.' };
        },
      },
      {
        id: 'px1-t4',
        domainId: 'ppt-motion',
        title: 'Gắn tối thiểu 2 hoạt hình trên Slide 2',
        titleEn: 'Apply at least two animations on Slide 2',
        instruction: 'Trên Slide 2 (“Điểm nhấn sản phẩm chủ lực”), gắn hiệu ứng Hoạt hình cho ít nhất 2 đối tượng khác nhau (hoặc 2 bước hoạt hình).',
        instructionEn: 'On Slide 2, attach Animation effects to at least 2 different objects (or 2 animation steps).',
        ribbonPath: 'Chọn đối tượng trên Slide 2 → Hoạt hình (Animations)',
        hint: 'Chuyển sang Slide 2, chọn lần lượt khung nội dung và thẻ hình “Bản 2026 Mới”, mỗi đối tượng gắn một hiệu ứng trong thẻ Hoạt hình.',
        points: 20,
        check: (content) => {
          const count = countAnimations(content.presentation.slides[1]?.elements ?? []);
          return count >= 2
            ? { passed: true, detail: `Đã gắn ${count} hiệu ứng hoạt hình trên Slide 2.` }
            : { passed: false, detail: `Slide 2 mới có ${count} hiệu ứng hoạt hình, cần tối thiểu 2.` };
        },
      },
      {
        id: 'px1-t5',
        domainId: 'ppt-manage',
        title: 'Phân nhóm bài thuyết trình bằng Phần (Section)',
        titleEn: 'Organize slides with Sections',
        instruction: 'Tạo ít nhất một Phần (Section) để tổ chức cấu trúc các trang chiếu trong bài thuyết trình.',
        instructionEn: 'Add at least one Section to structure the slides.',
        ribbonPath: 'Trang đầu (Home) → Phần (Section) → Thêm phần',
        hint: 'Mở thẻ Trang đầu → bấm nút Phần (Section) trong nhóm Trang chiếu → chọn Thêm phần.',
        points: 20,
        check: (content) => {
          const sections = content.presentation.sections ?? [];
          return sections.length > 0
            ? { passed: true, detail: `Đã tạo ${sections.length} phần tổ chức trang chiếu.` }
            : { passed: false, detail: 'Chưa tạo Phần (Section) nào trong bài thuyết trình.' };
        },
      },
    ],
  },
  {
    id: 'ppt-expert-boardroom',
    track: 'powerpoint',
    level: 'expert',
    kind: 'slide',
    order: 2,
    title: 'Báo cáo Hội đồng Quản trị Q4 (Chuyên sâu)',
    titleEn: 'Q4 Executive Boardroom Briefing',
    fileName: 'HopHoiDongQuanTri_Q4.pptx',
    scenario: 'Tài liệu mật trình bày trước Hội đồng Quản trị: phân chia ít nhất 2 phần, định chuẩn đầu/chân trang trên Slide Master, chèn biểu đồ & bảng ngân sách, đóng hình mờ bảo mật và cấu hình chế độ trình chiếu tự động.',
    scenarioEn: 'Prepare a confidential board deck with 2+ sections, Slide Master header & footer, financial chart and budget table, security watermark, and automated show settings.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: buildBoardroomStarter,
    tasks: [
      {
        id: 'px2-t1',
        domainId: 'ppt-manage',
        title: 'Tạo ít nhất 2 Phần (Section)',
        titleEn: 'Create at least two Sections',
        instruction: 'Phân tách bài thuyết trình thành ít nhất 2 Phần (Section) riêng biệt (ví dụ Tài chính và Chiến lược).',
        instructionEn: 'Divide the presentation into at least 2 distinct Sections.',
        ribbonPath: 'Trang đầu → Phần (Section) → Thêm phần',
        hint: 'Bấm Phần → Thêm phần tại Slide 1 và tại Slide 3 hoặc Slide 4 để tạo ít nhất 2 phần.',
        points: 20,
        check: (content) => {
          const count = content.presentation.sections?.length ?? 0;
          return count >= 2
            ? { passed: true, detail: `Đã phân chia ${count} phần rõ ràng.` }
            : { passed: false, detail: `Mới có ${count} phần, cần ít nhất 2 Phần (Section).` };
        },
      },
      {
        id: 'px2-t2',
        domainId: 'ppt-deliver',
        title: 'Định chuẩn đầu & chân trang trên Slide Master',
        titleEn: 'Configure Slide Master header and footer',
        instruction: 'Bật Slide Master, đặt Đầu trang (Header) chứa “HĐQT Q4” và Chân trang (Footer) chứa “Nội bộ”.',
        instructionEn: 'Enable Slide Master with Header containing “HĐQT Q4” and Footer containing “Nội bộ”.',
        copyTokens: ['HĐQT Q4', 'Nội bộ'],
        ribbonPath: 'Xem → Slide Master',
        hint: 'Mở thẻ Xem → Slide Master, bật kích hoạt và nhập “HĐQT Q4” ở Đầu trang, “Nội bộ” ở Chân trang.',
        points: 20,
        check: (content) => {
          const sm = content.presentation.slideMaster;
          const hOk = Boolean(sm?.enabled && foldSlide(sm.headerText ?? '').includes('hdqt q4'));
          const fOk = Boolean(sm?.enabled && foldSlide(sm.footerText ?? '').includes('noi bo'));
          if (hOk && fOk) return { passed: true, detail: 'Đã cấu hình đủ Đầu trang và Chân trang trên Slide Master.' };
          return { passed: false, detail: 'Slide Master cần được bật và có Header “HĐQT Q4” cùng Footer “Nội bộ”.' };
        },
      },
      {
        id: 'px2-t3',
        domainId: 'ppt-content',
        title: 'Chèn Biểu đồ Slide 2 và Bảng Slide 3',
        titleEn: 'Insert Chart on Slide 2 & Table on Slide 3',
        instruction: 'Chèn Biểu đồ (Chart) trên Slide 2 và Bảng dữ liệu (Table) trên Slide 3.',
        instructionEn: 'Insert a Chart on Slide 2 and a Table on Slide 3.',
        ribbonPath: 'Slide 2 → Chèn → Biểu đồ · Slide 3 → Chèn → Bảng',
        hint: 'Chọn Slide 2 để chèn Biểu đồ, tiếp theo chọn Slide 3 để chèn Bảng.',
        points: 20,
        check: (content) => {
          const hasChart = Boolean(content.presentation.slides[1]?.elements.some((el) => el.type === 'chart'));
          const hasTable = Boolean(content.presentation.slides[2]?.elements.some((el) => el.type === 'table'));
          if (hasChart && hasTable) return { passed: true, detail: 'Đã hoàn thiện Biểu đồ (Slide 2) và Bảng (Slide 3).' };
          return { passed: false, detail: `Còn thiếu: ${[!hasChart ? 'Biểu đồ Slide 2' : '', !hasTable ? 'Bảng Slide 3' : ''].filter(Boolean).join(', ')}.` };
        },
      },
      {
        id: 'px2-t4',
        domainId: 'ppt-deliver',
        title: 'Bật hình mờ bảo mật cho bài thuyết trình',
        titleEn: 'Enable confidential slide watermark',
        instruction: 'Bật Hình mờ (Watermark) cho bài thuyết trình với nội dung chứa “CONFIDENTIAL” hoặc “BẢO MẬT”.',
        instructionEn: 'Enable a presentation Watermark containing “CONFIDENTIAL” or “BẢO MẬT”.',
        copyTokens: ['CONFIDENTIAL', 'BẢO MẬT'],
        ribbonPath: 'Thiết kế → Hình mờ (Watermark)',
        hint: 'Mở thẻ Thiết kế → Hình mờ, kích hoạt và nhập chữ “CONFIDENTIAL” hoặc “BẢO MẬT”.',
        points: 20,
        check: (content) => {
          const wm = content.presentation.watermark;
          const norm = foldSlide(wm?.text ?? '');
          return wm?.enabled && (norm.includes('confidential') || norm.includes('bao mat'))
            ? { passed: true, detail: `Đã bật hình mờ “${wm?.text}”.` }
            : { passed: false, detail: 'Chưa bật hình mờ với nội dung CONFIDENTIAL hoặc BẢO MẬT.' };
        },
      },
      {
        id: 'px2-t5',
        domainId: 'ppt-deliver',
        title: 'Thiết lập trình chiếu Kiosk hoặc Lặp theo thời gian',
        titleEn: 'Configure Kiosk or timed looping show',
        instruction: 'Trong Thiết lập trình chiếu, chuyển sang chế độ Kiosk toàn màn hình HOẶC bật đồng thời Lặp liên tục và Dùng thời gian đã định (Use Timings).',
        instructionEn: 'In Set Up Slide Show, select Browsed at a kiosk OR enable both Loop continuously and Use timings.',
        ribbonPath: 'Trình chiếu → Thiết lập trình chiếu',
        hint: 'Mở thẻ Trình chiếu → Thiết lập trình chiếu → chọn kiểu Kiosk hoặc tích chọn Lặp liên tục + Dùng thời gian.',
        points: 20,
        check: (content) => {
          const ss = content.presentation.showSettings;
          const ok = ss?.showType === 'kiosk' || Boolean(ss?.loop && (ss?.useTimings || ss?.advance === 'timings'));
          return ok
            ? { passed: true, detail: 'Đã cấu hình chế độ trình chiếu tự động/Kiosk đúng yêu cầu.' }
            : { passed: false, detail: 'Chưa chọn chế độ Kiosk hoặc chưa bật đồng thời Lặp liên tục và Dùng thời gian.' };
        },
      },
    ],
  },
  {
    id: 'ppt-expert-product-keynote',
    track: 'powerpoint',
    level: 'expert',
    kind: 'slide',
    order: 3,
    title: 'Keynote Ra mắt Sản phẩm 2027 (Chuyên sâu)',
    titleEn: 'Product Launch Keynote 2027',
    fileName: 'Keynote_SanPham_2027.pptx',
    scenario: 'Bài thuyết trình sân khấu chính yêu cầu giao diện tối chuẩn màn hình 16:10/4:3, chuyển cảnh Morph toàn bộ, chuỗi hoạt hình tự chạy nối tiếp, siêu liên kết điều hướng và cấu hình bản in Handout/Notes Master.',
    scenarioEn: 'Build a stage keynote with Midnight Dark theme, non-16:9 slide ratio, Morph transitions across all slides, automatic chained animations, navigation hyperlink, and Handout/Notes Master settings.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: buildKeynoteStarter,
    tasks: [
      {
        id: 'px3-t1',
        domainId: 'ppt-manage',
        title: 'Áp dụng Midnight Dark và đổi tỷ lệ màn hình',
        titleEn: 'Apply Midnight Dark theme & resize slides',
        instruction: 'Áp dụng chủ đề “Midnight Dark” và đổi tỷ lệ trang chiếu sang 16:10 hoặc 4:3.',
        instructionEn: 'Apply the “Midnight Dark” theme and change the slide aspect ratio to 16:10 or 4:3.',
        ribbonPath: 'Thiết kế → Chủ đề (Midnight Dark) · Kích thước trang chiếu',
        hint: 'Trong thẻ Thiết kế, chọn chủ đề Midnight Dark rồi bấm Kích thước trang chiếu chọn 16:10 hoặc 4:3.',
        points: 20,
        check: (content) => {
          const themeOk = content.presentation.themeId === 'midnight-dark';
          const ratioOk = content.presentation.aspectRatio === '16:10' || content.presentation.aspectRatio === '4:3';
          if (themeOk && ratioOk) return { passed: true, detail: `Đã đổi sang Midnight Dark và tỷ lệ ${content.presentation.aspectRatio}.` };
          return { passed: false, detail: `Cần Midnight Dark (hiện là ${content.presentation.themeId}) và tỷ lệ 16:10 hoặc 4:3 (hiện là ${content.presentation.aspectRatio}).` };
        },
      },
      {
        id: 'px3-t2',
        domainId: 'ppt-motion',
        title: 'Áp dụng chuyển cảnh Morph >= 1s toàn bộ bài',
        titleEn: 'Apply Morph transition >= 1s to all slides',
        instruction: 'Áp dụng hiệu ứng chuyển tiếp Morph với thời lượng ít nhất 1,0 giây cho tất cả các trang chiếu.',
        instructionEn: 'Apply the Morph transition with duration >= 1.0s to every slide.',
        ribbonPath: 'Chuyển tiếp → Morph → Thời lượng >= 1s → Áp dụng cho tất cả',
        hint: 'Mở thẻ Chuyển tiếp, chọn Morph, chỉnh thời lượng >= 1,0 giây rồi bấm Áp dụng cho tất cả.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const okCount = slides.filter((s) => s.transition.type === 'morph' && (s.transition.duration ?? 0) >= 1).length;
          return slides.length > 0 && okCount === slides.length
            ? { passed: true, detail: `Tất cả ${slides.length} trang chiếu đã có Morph >= 1s.` }
            : { passed: false, detail: `Mới có ${okCount}/${slides.length} trang chiếu có Morph >= 1 giây.` };
        },
      },
      {
        id: 'px3-t3',
        domainId: 'ppt-motion',
        title: 'Hoạt hình chạy tự động nối tiếp trên Slide 2',
        titleEn: 'Chain automatic animation on Slide 2',
        instruction: 'Trên Slide 2, gắn ít nhất một hiệu ứng Hoạt hình có chế độ bắt đầu “Với hiệu ứng trước” (With Previous) hoặc “Sau hiệu ứng trước” (After Previous).',
        instructionEn: 'On Slide 2, attach an Animation whose start trigger is “With Previous” or “After Previous”.',
        ribbonPath: 'Chọn đối tượng trên Slide 2 → Hoạt hình → Bắt đầu: Với trước / Sau trước',
        hint: 'Chọn khung nội dung hoặc thẻ “Hiệu năng 3x” trên Slide 2, gắn hoạt hình và đổi mục Bắt đầu từ Khi bấm chuột sang Với hiệu ứng trước hoặc Sau hiệu ứng trước.',
        points: 20,
        check: (content) => {
          const els = content.presentation.slides[1]?.elements ?? [];
          const hasAuto = els.some((el) => {
            const list = el.animations && el.animations.length > 0 ? el.animations : el.animation ? [el.animation] : [];
            return list.some((a) => a.type !== 'none' && (a.trigger === 'with-previous' || a.trigger === 'after-previous'));
          });
          return hasAuto
            ? { passed: true, detail: 'Đã thiết lập hoạt hình tự chạy With/After Previous trên Slide 2.' }
            : { passed: false, detail: 'Slide 2 chưa có hiệu ứng hoạt hình nào đặt chế độ With Previous hoặc After Previous.' };
        },
      },
      {
        id: 'px3-t4',
        domainId: 'ppt-content',
        title: 'Gắn siêu liên kết điều hướng / trang đích',
        titleEn: 'Attach navigation or web hyperlink',
        instruction: 'Gắn một Siêu liên kết (Hyperlink) tới “https://office.minhspark.com/keynote” hoặc liên kết nhảy trực tiếp tới một trang chiếu khác.',
        instructionEn: 'Add a Hyperlink pointing to “https://office.minhspark.com/keynote” or linking to another slide.',
        copyTokens: ['https://office.minhspark.com/keynote'],
        ribbonPath: 'Chọn đối tượng → Chèn → Liên kết',
        hint: 'Chọn một khối chữ hoặc hình khối, mở thẻ Chèn → Liên kết để gắn URL hoặc trang chiếu đích.',
        points: 20,
        check: (content) =>
          hasAnyLink(content.presentation.slides)
            ? { passed: true, detail: 'Đã gắn siêu liên kết điều hướng trên bài thuyết trình.' }
            : { passed: false, detail: 'Chưa có siêu liên kết nào trong bài thuyết trình.' },
      },
      {
        id: 'px3-t5',
        domainId: 'ppt-deliver',
        title: 'Cấu hình Handout Master hoặc Notes Master',
        titleEn: 'Configure Handout Master or Notes Master',
        instruction: 'Mở Handout Master (đặt 4 hoặc 6 trang chiếu/trang in, hoặc thêm tiêu đề/chân trang bản phát) HOẶC cấu hình đầu/chân trang trong Notes Master.',
        instructionEn: 'Configure Handout Master (4 or 6 slides per page, or custom header/footer) OR set a header/footer in Notes Master.',
        copyTokens: ['Keynote 2027'],
        ribbonPath: 'Xem (View) → Handout Master / Notes Master',
        hint: 'Mở thẻ Xem → Handout Master (hoặc Notes Master), chỉnh số slide mỗi trang in hoặc nhập tiêu đề “Keynote 2027” rồi lưu.',
        points: 20,
        check: (content) => {
          const hm = content.presentation.handoutMaster;
          const nm = content.presentation.notesMaster;
          const hmOk = Boolean(hm && (hm.slidesPerPage === 4 || hm.slidesPerPage === 6 || (hm.header ?? '').trim().length > 0 || (hm.footer ?? '').trim().length > 0));
          const nmOk = Boolean(nm && ((nm.header ?? '').trim().length > 0 || (nm.footer ?? '').trim().length > 0));
          return hmOk || nmOk
            ? { passed: true, detail: 'Đã cấu hình mẫu in Handout/Notes Master.' }
            : { passed: false, detail: 'Chưa thay đổi thiết lập nào trong Handout Master hoặc Notes Master.' };
        },
      },
    ],
  },
  {
    id: 'ppt-expert-training-module',
    track: 'powerpoint',
    level: 'expert',
    kind: 'slide',
    order: 4,
    title: 'Học liệu Đào tạo An toàn Mạng (Chuyên sâu)',
    titleEn: 'Cybersecurity Training Module',
    fileName: 'KhoaHoc_AnToanMang.pptx',
    scenario: 'Giáo trình đào tạo nội bộ gồm cả slide học viên và slide đáp án giảng viên: cần bổ sung 2 trang bài tập, chèn SmartArt + hình liên kết, đặt thời gian tự chuyển, ẩn 2 trang đáp án, thêm ghi chú và tạo bộ Custom Show riêng.',
    scenarioEn: 'Enhance the internal security course with 2 new slides, a SmartArt diagram plus hyperlinked shape, timed transitions, hidden answer slides with speaker notes, and a 3+ slide Custom Show.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: buildSecurityTrainingStarter,
    tasks: [
      {
        id: 'px4-t1',
        domainId: 'ppt-manage',
        title: 'Thêm tối thiểu 2 trang chiếu mới với bố cục chuẩn',
        titleEn: 'Add at least two new structured slides',
        instruction: 'Chèn thêm ít nhất 2 trang chiếu mới (nâng tổng số lên >= 6 trang), trong đó có ít nhất một trang dùng bố cục So sánh, Hai nội dung hoặc Tiêu đề phần.',
        instructionEn: 'Insert at least 2 new slides (total >= 6), including at least one Comparison, Two Content, or Section Header layout.',
        ribbonPath: 'Trang đầu → Trang chiếu mới',
        hint: 'Thêm 2 trang chiếu mới ở thẻ Trang đầu, chọn ít nhất một trang có bố cục So sánh, Hai nội dung hoặc Tiêu đề phần.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const hasRich = slides.some((s) => s.layout === 'comparison' || s.layout === 'two-content' || s.layout === 'section');
          return slides.length >= 6 && hasRich
            ? { passed: true, detail: `Đã có ${slides.length} trang chiếu kèm bố cục chuyên biệt.` }
            : { passed: false, detail: `Hiện có ${slides.length} trang chiếu (cần >= 6 và có bố cục So sánh/Hai nội dung/Tiêu đề phần).` };
        },
      },
      {
        id: 'px4-t2',
        domainId: 'ppt-content',
        title: 'Chèn SmartArt và Hình dạng có liên kết',
        titleEn: 'Insert SmartArt and a hyperlinked shape',
        instruction: 'Chèn một sơ đồ SmartArt và một Hình dạng (Shape) có gắn Siêu liên kết (Hyperlink) vào bài thuyết trình.',
        instructionEn: 'Insert a SmartArt diagram and a Shape with a Hyperlink anywhere in the presentation.',
        copyTokens: ['https://office.minhspark.com/security'],
        ribbonPath: 'Chèn → SmartArt · Chèn → Hình dạng → Chèn → Liên kết',
        hint: 'Chèn một sơ đồ SmartArt, sau đó chèn một Hình dạng và gắn liên kết cho hình dạng đó.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const hasSmart = slides.some((s) => s.elements.some((el) => el.type === 'smartart'));
          const hasLinkedShape = slides.some((s) => s.elements.some((el) => el.type === 'shape' && Boolean(el.link || el.textLinks?.length)));
          if (hasSmart && hasLinkedShape) return { passed: true, detail: 'Đã chèn đủ SmartArt và Hình dạng có siêu liên kết.' };
          return { passed: false, detail: `Còn thiếu: ${[!hasSmart ? 'SmartArt' : '', !hasLinkedShape ? 'Hình dạng gắn liên kết' : ''].filter(Boolean).join(', ')}.` };
        },
      },
      {
        id: 'px4-t3',
        domainId: 'ppt-motion',
        title: 'Chuyển cảnh toàn bài và tự chuyển >= 3 giây',
        titleEn: 'Apply uniform transition & >= 3s auto-advance',
        instruction: 'Áp dụng hiệu ứng chuyển tiếp Fade, Push hoặc Wipe cho toàn bộ trang chiếu và bật tự chuyển trang >= 3 giây cho ít nhất 3 trang.',
        instructionEn: 'Apply Fade, Push, or Wipe transitions to all slides and set Advance After >= 3 seconds on at least 3 slides.',
        ribbonPath: 'Chuyển tiếp → Fade/Push/Wipe → Tự động chuyển sau >= 3s → Áp dụng cho tất cả',
        hint: 'Chọn Fade, Push hoặc Wipe, đặt Tự động chuyển sau 3 giây rồi bấm Áp dụng cho tất cả.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const transOk = slides.length > 0 && slides.every((s) => ['fade', 'push', 'wipe'].includes(s.transition.type));
          const timed = slides.filter((s) => (s.transition.advanceAfterSeconds ?? 0) >= 3).length;
          if (transOk && timed >= 3) return { passed: true, detail: `Toàn bài đã có chuyển tiếp đồng bộ và ${timed} trang tự chuyển >= 3s.` };
          return { passed: false, detail: `Cần chuyển tiếp Fade/Push/Wipe cho mọi slide và ít nhất 3 slide tự chuyển >= 3s (hiện ${timed}).` };
        },
      },
      {
        id: 'px4-t4',
        domainId: 'ppt-deliver',
        title: 'Ẩn 2 trang đáp án và thêm ghi chú giảng viên',
        titleEn: 'Hide 2 answer slides & add speaker notes',
        instruction: 'Đánh dấu Ẩn (Hide) ít nhất 2 trang chiếu (các trang đáp án) và nhập Ghi chú diễn giả (>= 15 ký tự) cho cả Slide 1 và Slide 2.',
        instructionEn: 'Hide at least 2 slides (the answer slides) and add Speaker Notes (>= 15 chars) to both Slide 1 and Slide 2.',
        ribbonPath: 'Trình chiếu → Ẩn trang chiếu · Khung Ghi chú ở Slide 1 & Slide 2',
        hint: 'Ẩn Slide 3 và Slide 4 trong thẻ Trình chiếu, sau đó nhập lời dẫn dài ít nhất 15 ký tự ở khung Ghi chú của Slide 1 và Slide 2.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const hiddenCount = slides.filter((s) => s.hidden).length;
          const n1 = (slides[0]?.notes ?? '').trim().length >= 15;
          const n2 = (slides[1]?.notes ?? '').trim().length >= 15;
          if (hiddenCount >= 2 && n1 && n2) return { passed: true, detail: `Đã ẩn ${hiddenCount} trang chiếu và ghi chú đầy đủ Slide 1 & 2.` };
          return { passed: false, detail: `Ẩn ${hiddenCount}/2 trang; ghi chú Slide 1 (${n1 ? 'đạt' : 'thiếu'}), Slide 2 (${n2 ? 'đạt' : 'thiếu'}).` };
        },
      },
      {
        id: 'px4-t5',
        domainId: 'ppt-deliver',
        title: 'Tạo bộ Trình chiếu tuỳ chỉnh (>= 3 trang)',
        titleEn: 'Create Custom Show with 3+ slides',
        instruction: 'Tạo một Trình chiếu tuỳ chỉnh (Custom Show) bao gồm tối thiểu 3 trang chiếu cho phiên rút gọn.',
        instructionEn: 'Create a Custom Show that includes at least 3 slides.',
        ribbonPath: 'Trình chiếu → Trình chiếu tuỳ chỉnh',
        hint: 'Mở thẻ Trình chiếu → Trình chiếu tuỳ chỉnh → tạo bộ mới, chọn ít nhất 3 slide rồi lưu.',
        points: 20,
        check: (content) => {
          const shows = content.presentation.customShows ?? [];
          return shows.some((show) => show.slideIds.length >= 3)
            ? { passed: true, detail: 'Đã tạo Trình chiếu tuỳ chỉnh >= 3 trang chiếu.' }
            : { passed: false, detail: 'Chưa có bộ Trình chiếu tuỳ chỉnh nào chứa ít nhất 3 trang chiếu.' };
        },
      },
    ],
  },
  {
    id: 'ppt-expert-global-summit',
    track: 'powerpoint',
    level: 'expert',
    kind: 'slide',
    order: 5,
    title: 'Hội nghị Toàn cầu ESG 2026 (Chuyên sâu)',
    titleEn: 'Global ESG Summit 2026',
    fileName: 'HoiNghi_ToanCau_ESG.pptx',
    scenario: 'Bài trình bày tổng hợp cấp quốc tế kết hợp đầy đủ các nhóm kỹ năng nâng cao: chủ đề Emerald Executive, nền trang bìa tuỳ chỉnh, bộ 3 trực quan (Bảng + Biểu đồ + SmartArt), chuỗi hoạt hình, Slide Master và quy trình rà soát.',
    scenarioEn: 'Deliver a comprehensive international ESG summit deck combining Emerald Executive theme, custom Slide 1 background, Table + Chart + SmartArt visuals, 3+ animations, Slide Master branding, looping timed show, and 2+ review comments.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: buildEsgSummitStarter,
    tasks: [
      {
        id: 'px5-t1',
        domainId: 'ppt-manage',
        title: 'Chủ đề Emerald Executive và nền Slide 1 nổi bật',
        titleEn: 'Emerald Executive theme & custom Slide 1 background',
        instruction: 'Áp dụng chủ đề “Emerald Executive” và đổi nền Slide 1 sang kiểu Gradient hoặc màu nền tuỳ chỉnh (khác màu trắng #FFFFFF).',
        instructionEn: 'Apply the “Emerald Executive” theme and set Slide 1 background to a Gradient or non-white custom color.',
        ribbonPath: 'Thiết kế → Chủ đề (Emerald Executive) · Định dạng nền',
        hint: 'Chọn chủ đề Emerald Executive trong thẻ Thiết kế, sau đó chọn Slide 1 và đổi nền bằng Định dạng nền.',
        points: 20,
        check: (content) => {
          const themeOk = content.presentation.themeId === 'emerald-executive';
          const bg = content.presentation.slides[0]?.background;
          const bgOk = Boolean(bg && (bg.type !== 'solid' || bg.value.toUpperCase() !== '#FFFFFF'));
          if (themeOk && bgOk) return { passed: true, detail: 'Đã áp dụng Emerald Executive và nền Slide 1 tuỳ chỉnh.' };
          return { passed: false, detail: `Cần chủ đề Emerald Executive (${themeOk ? 'đạt' : 'chưa'}) và nền Slide 1 khác trắng (${bgOk ? 'đạt' : 'chưa'}).` };
        },
      },
      {
        id: 'px5-t2',
        domainId: 'ppt-content',
        title: 'Hoàn thiện bộ 3 trực quan: Bảng, Biểu đồ, SmartArt',
        titleEn: 'Insert Table (S2), Chart (S3), and SmartArt (S4)',
        instruction: 'Chèn Bảng (Table) trên Slide 2, Biểu đồ (Chart) trên Slide 3 và sơ đồ SmartArt trên Slide 4.',
        instructionEn: 'Insert a Table on Slide 2, a Chart on Slide 3, and a SmartArt graphic on Slide 4.',
        ribbonPath: 'Slide 2 → Bảng · Slide 3 → Biểu đồ · Slide 4 → SmartArt',
        hint: 'Vào thẻ Chèn lần lượt trên Slide 2 (Bảng), Slide 3 (Biểu đồ) và Slide 4 (SmartArt).',
        points: 20,
        check: (content) => {
          const hasTable = Boolean(content.presentation.slides[1]?.elements.some((el) => el.type === 'table'));
          const hasChart = Boolean(content.presentation.slides[2]?.elements.some((el) => el.type === 'chart'));
          const hasSmart = Boolean(content.presentation.slides[3]?.elements.some((el) => el.type === 'smartart'));
          if (hasTable && hasChart && hasSmart) return { passed: true, detail: 'Đã đủ cả 3 đối tượng trực quan trên các trang chiếu.' };
          const missing = [!hasTable ? 'Bảng Slide 2' : '', !hasChart ? 'Biểu đồ Slide 3' : '', !hasSmart ? 'SmartArt Slide 4' : ''].filter(Boolean);
          return { passed: false, detail: `Còn thiếu: ${missing.join(', ')}.` };
        },
      },
      {
        id: 'px5-t3',
        domainId: 'ppt-motion',
        title: 'Gắn hoạt hình cho ít nhất 3 đối tượng toàn bài',
        titleEn: 'Animate at least three objects',
        instruction: 'Áp dụng hiệu ứng Hoạt hình (Animation) cho tổng cộng ít nhất 3 đối tượng trong bài thuyết trình.',
        instructionEn: 'Attach Animation effects to at least 3 objects across the presentation.',
        ribbonPath: 'Chọn đối tượng → Hoạt hình (Animations)',
        hint: 'Chọn ít nhất 3 đối tượng bất kỳ trên các slide và gắn hiệu ứng xuất hiện hoặc nhấn mạnh.',
        points: 20,
        check: (content) => {
          const total = content.presentation.slides.reduce((sum, s) => sum + countAnimations(s.elements), 0);
          return total >= 3
            ? { passed: true, detail: `Đã gắn tổng cộng ${total} hiệu ứng hoạt hình.` }
            : { passed: false, detail: `Mới có ${total} hiệu ứng hoạt hình, cần tối thiểu 3.` };
        },
      },
      {
        id: 'px5-t4',
        domainId: 'ppt-deliver',
        title: 'Bật Slide Master với chân trang “ESG 2026”',
        titleEn: 'Enable Slide Master with ESG 2026 footer',
        instruction: 'Bật Slide Master, hiển thị Số trang chiếu và đặt Chân trang chứa “ESG 2026”.',
        instructionEn: 'Enable Slide Master, turn on Slide Numbers, and set Footer text to contain “ESG 2026”.',
        copyTokens: ['ESG 2026'],
        ribbonPath: 'Xem → Slide Master',
        hint: 'Mở Slide Master ở thẻ Xem, bật kích hoạt, bật Số trang và nhập “ESG 2026” vào chân trang.',
        points: 20,
        check: (content) => {
          const sm = content.presentation.slideMaster;
          const ok = Boolean(sm?.enabled && sm?.showSlideNumber && foldSlide(sm.footerText ?? '').includes('esg 2026'));
          return ok
            ? { passed: true, detail: `Đã bật Slide Master với chân trang “${sm?.footerText}” và số trang.` }
            : { passed: false, detail: 'Slide Master cần bật kích hoạt, Số trang và Chân trang chứa “ESG 2026”.' };
        },
      },
      {
        id: 'px5-t5',
        domainId: 'ppt-deliver',
        title: 'Bật lặp liên tục và thêm tối thiểu 2 bình luận',
        titleEn: 'Enable loop playback & add 2+ review comments',
        instruction: 'Bật chế độ Lặp liên tục cho đến khi nhấn Esc (Loop) trong Thiết lập trình chiếu và thêm ít nhất 2 Bình luận rà soát.',
        instructionEn: 'Enable Loop continuously until Esc in Set Up Slide Show and add at least 2 review Comments.',
        ribbonPath: 'Trình chiếu → Thiết lập trình chiếu (Lặp) · Xem lại → Bình luận mới',
        hint: 'Bật Lặp liên tục trong Thiết lập trình chiếu, sau đó vào thẻ Xem lại thêm 2 bình luận góp ý.',
        points: 20,
        check: (content) => {
          const loop = Boolean(content.presentation.showSettings?.loop);
          const comments = content.presentation.slides.reduce((sum, s) => sum + (s.comments?.length ?? 0), 0) + (content.comments?.length ?? 0);
          if (loop && comments >= 2) return { passed: true, detail: `Đã bật trình chiếu lặp liên tục và có ${comments} bình luận.` };
          return { passed: false, detail: `Cần bật Lặp liên tục (${loop ? 'đạt' : 'chưa'}) và ít nhất 2 bình luận (hiện ${comments}).` };
        },
      },
    ],
  },
];
