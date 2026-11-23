import type { PresentationData } from '../slideTypes';
import type { SlideContent } from '../storage';
import { baseSlide, countAnimations, foldSlide, hasAnyLink, slideText } from './pptHelpers';
import type { MosPptProject } from './types';

function buildEdtechStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'RaMat_NenTang_So.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('p1-s1', 'title', 'NỀN TẢNG HỌC TẬP SỐ 2026', 'Giải pháp chuyển đổi số giáo dục toàn diện'),
      baseSlide('p1-s2', 'title-content', 'Thách thức hiện tại', '• Học liệu phân tán trên nhiều công cụ rời rạc\n• Khó theo dõi tiến độ thực hành của từng học viên\n• Thiếu môi trường luyện thi sát thực tế'),
      baseSlide('p1-s3', 'title-content', 'Gói triển khai theo trường học', 'Chèn bảng so sánh các gói dịch vụ tại trang chiếu này.'),
      baseSlide('p1-s4', 'title-content', 'Lộ trình triển khai', '• Quý I: Thử nghiệm tại 15 trung tâm đối tác\n• Quý II: Mở rộng toàn quốc\n• Quý III: Tích hợp chấm điểm tự động chuẩn MOS'),
    ],
  };
  return { kind: 'slide', presentation };
}

function buildFinanceStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'BaoCao_TaiChinh_2026.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('p2-s1', 'title', 'BÁO CÁO TÀI CHÍNH & TĂNG TRƯỞNG', 'Tổng kết hoạt động năm tài chính 2026'),
      baseSlide('p2-s2', 'title-content', 'Biểu đồ tăng trưởng doanh thu', 'Minh hoạ doanh thu 4 quý bằng biểu đồ trực quan.'),
      baseSlide('p2-s3', 'title-content', 'Quy trình kiểm soát chi phí', 'Thể hiện 3 bước kiểm soát chi phí bằng sơ đồ SmartArt.'),
      baseSlide('p2-s4', 'title-content', 'Phụ lục nội bộ (Ẩn khi trình chiếu)', '• Ghi chú kiểm toán nội bộ\n• Số liệu tham khảo phòng Tài chính'),
    ],
  };
  return { kind: 'slide', presentation };
}

function buildGreenCampaignStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'ChienDich_MoiTruong.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('p3-s1', 'title', 'CHIẾN DỊCH VĂN PHÒNG XANH', 'Giảm 50% rác thải nhựa trong 12 tháng'),
      baseSlide('p3-s2', 'title-content', 'Các trụ cột hành động', '• Tiết kiệm điện năng thiết bị văn phòng\n• Chuyển đổi 100% sang tài liệu số'),
      baseSlide('p3-s3', 'title-content', 'Kết luận & Hành động', '• Cam kết từ từng phòng ban\n• Đánh giá chỉ số xanh định kỳ hàng tháng'),
      baseSlide('p3-s4', 'title-content', 'Số liệu tiêu thụ hiện tại', '• Trung bình 12.000 tờ giấy A4 mỗi tháng\n• Tỷ lệ tái chế đạt 38% trong quý II'),
    ],
  };
  return { kind: 'slide', presentation };
}

function buildCoffeeBrandStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'ThuongHieu_CaPhe_Viet.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('p4-s1', 'title', 'CÀ PHÊ ĐẶC SẢN CAO NGUYÊN', 'Hồ sơ giới thiệu thương hiệu xuất khẩu 2026'),
      baseSlide('p4-s2', 'title-content', 'Vùng nguyên liệu chủ lực', '• Thu hoạch thủ công trái chín 100% tại độ cao 1.500m\n• Sơ chế mật ong và phơi giàn tiêu chuẩn SCA'),
      baseSlide('p4-s3', 'title-content', 'Hệ thống phân phối', '• 18 cửa hàng rang xay tại chỗ\n• Kênh đối tác khách sạn và xuất khẩu sang Nhật Bản'),
      baseSlide('p4-s4', 'title-content', 'Trang nháp cần xoá', 'Nội dung thử nghiệm nội bộ — cần xoá trang này trước khi phát hành.'),
      baseSlide('p4-s5', 'title-content', 'Thông tin liên hệ', 'Email: hello@caonguyencoffee.vn · Hotline: 1900 2306'),
    ],
  };
  return { kind: 'slide', presentation };
}

function buildTravelTourStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'DuLich_MienTrung_2026.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('p5-s1', 'title', 'KHÁM PHÁ DI SẢN MIỀN TRUNG', 'Hành trình 4 ngày 3 đêm: Huế · Đà Nẵng · Phố cổ'),
      baseSlide('p5-s2', 'title-content', 'Lịch trình ngày 1 & 2', '• Tham quan Đại Nội Huế và chùa Thiên Mụ\n• Vượt đèo Hải Vân và nghỉ dưỡng tại bán đảo Sơn Trà'),
      baseSlide('p5-s3', 'title-content', 'Điểm nhấn ẩm thực & văn hoá', '• Thưởng thức ẩm thực cung đình và thả đèn hoa đăng\n• Trải nghiệm làng nghề gốm truyền thống'),
      baseSlide('p5-s4', 'title-content', 'Dịch vụ bao gồm', '• Khách sạn 4 sao trung tâm\n• Xe đưa đón đời mới và hướng dẫn viên song ngữ'),
    ],
  };
  return { kind: 'slide', presentation };
}

function buildCampusStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'DinhHuong_TanSinhVien.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('p6-s1', 'title', 'CHÀO ĐÓN TÂN SINH VIÊN 2026', 'Tuần lễ sinh hoạt công dân & kỹ năng học tập đại học'),
      baseSlide('p6-s2', 'title-content', 'Lịch tuần lễ định hướng', 'Chèn bảng lịch các buổi hội thảo theo ngày tại trang này.'),
      baseSlide('p6-s3', 'title-content', 'Quy trình nhập học', 'Minh hoạ 3 bước hoàn tất hồ sơ bằng sơ đồ SmartArt.'),
      baseSlide('p6-s4', 'title-content', 'Câu lạc bộ & Hỗ trợ sinh viên', '• Hơn 35 câu lạc bộ học thuật, công nghệ và nghệ thuật\n• Trung tâm tư vấn học vụ mở cửa từ thứ Hai đến thứ Sáu'),
    ],
    sections: [],
  };
  return { kind: 'slide', presentation };
}

function buildStartupPitchStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'GoiVon_Startup_AI.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('p7-s1', 'title', 'SPARKFLOW AI · PITCH DECK', 'Tự động hoá vận hành tài liệu cho doanh nghiệp vừa và nhỏ'),
      baseSlide('p7-s2', 'title-content', 'Vấn đề thị trường', '• 68% thời gian nhân sự văn phòng dành cho nhập liệu lặp lại\n• Dữ liệu rời rạc giữa văn bản, bảng tính và PDF'),
      baseSlide('p7-s3', 'title-content', 'Tăng trưởng ARR 4 quý', 'Chèn biểu đồ tăng trưởng doanh thu định kỳ tại trang này.'),
      baseSlide('p7-s4', 'title-content', 'Đội ngũ sáng lập', '• 10+ năm kinh nghiệm xây dựng sản phẩm phần mềm năng suất\n• Cố vấn từ các quỹ đầu tư công nghệ khu vực'),
      baseSlide('p7-s5', 'title-content', 'Phụ lục định giá (Ẩn khi gọi vốn)', 'Chi tiết mô hình dòng tiền DCF 5 năm — chỉ mở khi nhà đầu tư hỏi.'),
    ],
  };
  return { kind: 'slide', presentation };
}

export const MOS_PPT_ASSOCIATE_PROJECTS: MosPptProject[] = [
  {
    id: 'ppt-edtech-launch',
    track: 'powerpoint',
    level: 'associate',
    kind: 'slide',
    order: 1,
    title: 'Ra mắt Nền tảng Học tập Số',
    titleEn: 'Digital Learning Platform Launch',
    fileName: 'RaMat_NenTang_So.pptx',
    scenario: 'Bạn chuẩn bị bộ trang chiếu giới thiệu sản phẩm giáo dục số cho hội thảo đối tác, yêu cầu đồng bộ chủ đề, bảng so sánh, hiệu ứng chuyển trang và chân trang.',
    scenarioEn: 'You are preparing a partner presentation for a digital learning platform requiring a consistent theme, comparison table, slide transitions, and footer.',
    minutes: 8,
    difficulty: 'Cơ bản',
    createStarter: buildEdtechStarter,
    tasks: [
      {
        id: 'p1-t1',
        domainId: 'ppt-manage',
        title: 'Đổi chủ đề bài thuyết trình',
        titleEn: 'Apply presentation theme',
        instruction: 'Áp dụng chủ đề (Theme) “Sapphire Modern” hoặc “Emerald Executive” cho toàn bài thuyết trình.',
        instructionEn: 'Apply the “Sapphire Modern” or “Emerald Executive” theme to the entire presentation.',
        ribbonPath: 'Thiết kế → Chủ đề',
        hint: 'Mở thẻ Thiết kế (Design), bấm chọn chủ đề Sapphire Modern hoặc Emerald Executive trong thư viện Chủ đề.',
        points: 20,
        check: (content) => {
          const themeId = content.presentation.themeId;
          const ok = themeId === 'sapphire-modern' || themeId === 'emerald-executive';
          return ok
            ? { passed: true, detail: `Đã áp dụng chủ đề ${themeId}.` }
            : { passed: false, detail: `Chủ đề hiện tại là “${themeId}”, cần chọn Sapphire Modern hoặc Emerald Executive.` };
        },
      },
      {
        id: 'p1-t2',
        domainId: 'ppt-manage',
        title: 'Thêm trang chiếu bố cục So sánh / Hai nội dung',
        titleEn: 'Insert Two Content or Comparison slide',
        instruction: 'Chèn thêm ít nhất một trang chiếu mới có bố cục Hai nội dung (Two Content) hoặc So sánh (Comparison).',
        instructionEn: 'Insert at least one new slide using the Two Content or Comparison layout.',
        ribbonPath: 'Trang đầu → Trang chiếu mới → Hai nội dung / So sánh',
        hint: 'Vào thẻ Trang đầu → bấm mũi tên ở nút Trang chiếu mới → chọn bố cục Hai nội dung hoặc So sánh.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const hasLayout = slides.some((s) => s.layout === 'two-content' || s.layout === 'comparison');
          return slides.length >= 5 && hasLayout
            ? { passed: true, detail: `Đã thêm trang chiếu mới với bố cục phù hợp (tổng ${slides.length} trang).` }
            : { passed: false, detail: 'Chưa có trang chiếu mới dùng bố cục Hai nội dung hoặc So sánh.' };
        },
      },
      {
        id: 'p1-t3',
        domainId: 'ppt-content',
        title: 'Chèn bảng so sánh gói triển khai',
        titleEn: 'Insert comparison table',
        instruction: 'Chèn một Bảng (Table) vào trang chiếu “Gói triển khai theo trường học” (hoặc bất kỳ trang chiếu nội dung nào).',
        instructionEn: 'Insert a Table on the “Gói triển khai theo trường học” slide (or any content slide).',
        ribbonPath: 'Chèn → Bảng',
        hint: 'Chọn Slide 3, mở thẻ Chèn (Insert) → bấm Bảng và chọn kích thước bảng mong muốn.',
        points: 20,
        check: (content) => {
          const hasTable = content.presentation.slides.some((s) => s.elements.some((el) => el.type === 'table'));
          return hasTable
            ? { passed: true, detail: 'Đã chèn bảng dữ liệu vào bài thuyết trình.' }
            : { passed: false, detail: 'Chưa tìm thấy bảng dữ liệu nào trong các trang chiếu.' };
        },
      },
      {
        id: 'p1-t4',
        domainId: 'ppt-motion',
        title: 'Chuyển cảnh Fade/Push cho tất cả trang chiếu',
        titleEn: 'Apply Fade/Push transition to all slides',
        instruction: 'Áp dụng hiệu ứng chuyển tiếp Mờ dần (Fade) hoặc Đẩy (Push) với thời lượng từ 1 giây trở lên cho toàn bộ các trang chiếu.',
        instructionEn: 'Apply the Fade or Push transition with a duration of at least 1.0 second to all slides.',
        ribbonPath: 'Chuyển tiếp → Mờ dần / Đẩy → Thời lượng >= 1s → Áp dụng cho tất cả',
        hint: 'Mở thẻ Chuyển tiếp (Transitions), chọn Mờ dần (Fade) hoặc Đẩy (Push), chỉnh Thời lượng lên 1,0 giây rồi bấm Áp dụng cho tất cả.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const okCount = slides.filter((s) => (s.transition.type === 'fade' || s.transition.type === 'push') && (s.transition.duration ?? 0) >= 1).length;
          return slides.length > 0 && okCount === slides.length
            ? { passed: true, detail: `Toàn bộ ${slides.length} trang chiếu đã có hiệu ứng chuyển tiếp và thời lượng >= 1s.` }
            : { passed: false, detail: `Mới có ${okCount}/${slides.length} trang chiếu đạt hiệu ứng Fade/Push với thời lượng >= 1 giây.` };
        },
      },
      {
        id: 'p1-t5',
        domainId: 'ppt-deliver',
        title: 'Bật số trang và chân trang chiếu',
        titleEn: 'Enable slide numbers and footer',
        instruction: 'Bật hiển thị Số trang chiếu (Slide Number) và đặt nội dung Chân trang (Footer) chứa “Office 23 MOS”.',
        instructionEn: 'Display Slide Numbers and set the Footer text to include “Office 23 MOS”.',
        copyTokens: ['Office 23 MOS'],
        ribbonPath: 'Chèn → Đầu trang & Chân trang (hoặc Xem → Slide Master)',
        hint: 'Mở hộp thoại Đầu trang & Chân trang (thẻ Chèn) hoặc Slide Master (thẻ Xem), bật Số trang chiếu và nhập “Office 23 MOS” vào ô Chân trang.',
        points: 20,
        check: (content) => {
          const hf = content.presentation.headerFooter;
          const sm = content.presentation.slideMaster;
          const numOk = Boolean(hf?.showSlideNumber || (sm?.enabled && sm?.showSlideNumber));
          const footerText = hf?.showFooter ? (hf.footerText ?? '') : sm?.enabled ? (sm.footerText ?? '') : (hf?.footerText ?? sm?.footerText ?? '');
          const footerOk = foldSlide(footerText).includes('office 23 mos');
          if (numOk && footerOk) return { passed: true, detail: `Đã bật số trang và chân trang “${footerText}”.` };
          const issues: string[] = [];
          if (!numOk) issues.push('chưa bật Số trang chiếu');
          if (!footerOk) issues.push('Chân trang chưa chứa “Office 23 MOS”');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
    ],
  },
  {
    id: 'ppt-finance-report',
    track: 'powerpoint',
    level: 'associate',
    kind: 'slide',
    order: 2,
    title: 'Báo cáo Tài chính & Tăng trưởng',
    titleEn: 'Financial & Growth Report',
    fileName: 'BaoCao_TaiChinh_2026.pptx',
    scenario: 'Ban Tài chính yêu cầu chuyển đổi khung hình sang máy chiếu chuẩn 4:3, bổ sung biểu đồ, sơ đồ quy trình SmartArt, hoạt ảnh và ẩn trang phụ lục nội bộ.',
    scenarioEn: 'Finance requested converting the slide size to Standard 4:3, adding a chart and SmartArt graphic, animating an element, and hiding the internal appendix slide.',
    minutes: 7,
    difficulty: 'Trung bình',
    createStarter: buildFinanceStarter,
    tasks: [
      {
        id: 'p2-t1',
        domainId: 'ppt-manage',
        title: 'Đổi kích thước trang chiếu sang chuẩn 4:3',
        titleEn: 'Change slide size to Standard 4:3',
        instruction: 'Chuyển tỷ lệ trang chiếu của toàn bài thuyết trình từ Màn hình rộng (16:9) sang Chuẩn (4:3).',
        instructionEn: 'Change the presentation slide size from Widescreen (16:9) to Standard (4:3).',
        ribbonPath: 'Thiết kế → Kích thước trang chiếu → Chuẩn (4:3)',
        hint: 'Mở thẻ Thiết kế (Design) → bấm Kích thước trang chiếu → chọn Chuẩn (4:3).',
        points: 20,
        check: (content) =>
          content.presentation.aspectRatio === '4:3'
            ? { passed: true, detail: 'Đã chuyển tỷ lệ bài thuyết trình sang 4:3.' }
            : { passed: false, detail: `Tỷ lệ hiện tại là ${content.presentation.aspectRatio}, cần đổi sang 4:3.` },
      },
      {
        id: 'p2-t2',
        domainId: 'ppt-content',
        title: 'Chèn biểu đồ trên Slide 2',
        titleEn: 'Insert chart on Slide 2',
        instruction: 'Trên Slide 2 (“Biểu đồ tăng trưởng doanh thu”), chèn một Biểu đồ (Chart) bất kỳ.',
        instructionEn: 'On Slide 2 (“Biểu đồ tăng trưởng doanh thu”), insert a Chart.',
        ribbonPath: 'Chèn → Biểu đồ',
        hint: 'Chọn Slide 2 ở cột bên trái, mở thẻ Chèn (Insert) → bấm Biểu đồ để chèn biểu đồ vào trang.',
        points: 20,
        check: (content) => {
          const slide = content.presentation.slides[1];
          return slide?.elements.some((el) => el.type === 'chart')
            ? { passed: true, detail: 'Đã chèn biểu đồ trực quan trên Slide 2.' }
            : { passed: false, detail: 'Slide 2 chưa có đối tượng Biểu đồ nào.' };
        },
      },
      {
        id: 'p2-t3',
        domainId: 'ppt-content',
        title: 'Chèn sơ đồ SmartArt trên Slide 3',
        titleEn: 'Insert SmartArt on Slide 3',
        instruction: 'Trên Slide 3 (“Quy trình kiểm soát chi phí”), chèn một sơ đồ SmartArt (Quy trình, Chu trình hoặc Kim tự tháp).',
        instructionEn: 'On Slide 3 (“Quy trình kiểm soát chi phí”), insert a SmartArt graphic.',
        ribbonPath: 'Chèn → SmartArt',
        hint: 'Chọn Slide 3, mở thẻ Chèn (Insert) → bấm SmartArt và chọn một kiểu sơ đồ.',
        points: 20,
        check: (content) => {
          const slide = content.presentation.slides[2];
          return slide?.elements.some((el) => el.type === 'smartart')
            ? { passed: true, detail: 'Đã chèn sơ đồ SmartArt trên Slide 3.' }
            : { passed: false, detail: 'Slide 3 chưa có sơ đồ SmartArt nào.' };
        },
      },
      {
        id: 'p2-t4',
        domainId: 'ppt-motion',
        title: 'Áp dụng hoạt ảnh cho đối tượng',
        titleEn: 'Apply object animation',
        instruction: 'Gắn ít nhất một hiệu ứng Hoạt hình (Animation) cho một đối tượng trên Slide 1 hoặc Slide 2.',
        instructionEn: 'Apply at least one Animation effect to any object on Slide 1 or Slide 2.',
        ribbonPath: 'Chọn đối tượng → Hoạt hình → chọn hiệu ứng',
        hint: 'Bấm chọn khung tiêu đề trên Slide 1 (hoặc biểu đồ trên Slide 2), vào thẻ Hoạt hình (Animations) và chọn một hiệu ứng khác “Không có”.',
        points: 20,
        check: (content) => {
          const count = content.presentation.slides.slice(0, 2).reduce((sum, s) => sum + countAnimations(s.elements), 0);
          return count > 0
            ? { passed: true, detail: 'Đã gắn hiệu ứng hoạt hình cho đối tượng.' }
            : { passed: false, detail: 'Chưa có đối tượng nào trên Slide 1 hoặc Slide 2 được gắn hoạt hình.' };
        },
      },
      {
        id: 'p2-t5',
        domainId: 'ppt-deliver',
        title: 'Thêm ghi chú diễn giả và ẩn trang phụ lục',
        titleEn: 'Add speaker notes and hide final slide',
        instruction: 'Nhập Ghi chú diễn giả (Speaker Notes) dài ít nhất 10 ký tự cho Slide 1, và đánh dấu Ẩn (Hide) trang chiếu cuối cùng.',
        instructionEn: 'Add Speaker Notes (at least 10 characters) to Slide 1 and hide the last slide.',
        ribbonPath: 'Khung Ghi chú dưới Slide 1 · Chọn Slide cuối → Trình chiếu → Ẩn trang chiếu',
        hint: 'Ở Slide 1, mở vùng Ghi chú diễn giả phía dưới canvas và gõ lời dẫn. Tiếp đó chọn trang chiếu cuối cùng, vào thẻ Trình chiếu → bấm Ẩn trang chiếu.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const firstNotes = (slides[0]?.notes ?? '').trim();
          const lastHidden = Boolean(slides[slides.length - 1]?.hidden);
          if (firstNotes.length >= 10 && lastHidden) return { passed: true, detail: 'Đã thêm ghi chú diễn giả cho Slide 1 và ẩn trang chiếu cuối.' };
          const issues: string[] = [];
          if (firstNotes.length < 10) issues.push('Ghi chú diễn giả Slide 1 chưa đủ 10 ký tự');
          if (!lastHidden) issues.push('trang chiếu cuối cùng chưa được ẩn');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
    ],
  },
  {
    id: 'ppt-green-office',
    track: 'powerpoint',
    level: 'associate',
    kind: 'slide',
    order: 3,
    title: 'Chiến dịch Văn phòng Xanh',
    titleEn: 'Green Office Campaign',
    fileName: 'ChienDich_MoiTruong.pptx',
    scenario: 'Bộ slide truyền thông nội bộ bị đảo thứ tự trang kết luận và cần bổ sung hình khối minh hoạ, liên kết tham chiếu, chế độ chiếu lặp tại quầy lễ tân và bình luận rà soát.',
    scenarioEn: 'The internal campaign deck has a misplaced conclusion slide and needs an illustration shape, a hyperlink, loop playback for the lobby display, and a review comment.',
    minutes: 7,
    difficulty: 'Trung bình',
    createStarter: buildGreenCampaignStarter,
    tasks: [
      {
        id: 'p3-t1',
        domainId: 'ppt-manage',
        title: 'Đưa trang Kết luận xuống cuối cùng',
        titleEn: 'Move conclusion slide to the end',
        instruction: 'Di chuyển trang chiếu có tiêu đề “Kết luận & Hành động” xuống vị trí cuối cùng của bài thuyết trình.',
        instructionEn: 'Move the slide titled “Kết luận & Hành động” to the last position in the presentation.',
        ribbonPath: 'Kéo thả hình thu nhỏ Slide 3 xuống sau Slide 4 ở cột bên trái',
        hint: 'Ở cột danh sách trang chiếu bên trái, giữ và kéo trang “Kết luận & Hành động” xuống vị trí cuối cùng.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const last = slides[slides.length - 1];
          return last && foldSlide(slideText(last)).includes('ket luan')
            ? { passed: true, detail: 'Trang “Kết luận & Hành động” đã nằm ở vị trí cuối cùng.' }
            : { passed: false, detail: 'Trang chiếu cuối cùng hiện chưa phải là “Kết luận & Hành động”.' };
        },
      },
      {
        id: 'p3-t2',
        domainId: 'ppt-content',
        title: 'Chèn hình dạng minh hoạ trên Slide 2',
        titleEn: 'Insert shape on Slide 2',
        instruction: 'Trên Slide 2 (“Các trụ cột hành động”), chèn ít nhất một Hình dạng (Shape) như hình chữ nhật bo góc, mũi tên hoặc ngôi sao.',
        instructionEn: 'On Slide 2 (“Các trụ cột hành động”), insert at least one Shape.',
        ribbonPath: 'Chèn → Hình dạng',
        hint: 'Chọn Slide 2, mở thẻ Chèn (Insert) → bấm Hình dạng và chọn một hình khối bất kỳ để chèn vào slide.',
        points: 20,
        check: (content) => {
          const slide = content.presentation.slides[1];
          return slide?.elements.some((el) => el.type === 'shape')
            ? { passed: true, detail: 'Đã chèn hình dạng minh hoạ trên Slide 2.' }
            : { passed: false, detail: 'Slide 2 chưa có đối tượng Hình dạng nào.' };
        },
      },
      {
        id: 'p3-t3',
        domainId: 'ppt-content',
        title: 'Gắn siêu liên kết cho đối tượng',
        titleEn: 'Add hyperlink to an object',
        instruction: 'Gắn một Siêu liên kết (Hyperlink) tới đường dẫn web “https://office.minhspark.com” hoặc liên kết tới trang chiếu khác cho bất kỳ đối tượng nào.',
        instructionEn: 'Add a Hyperlink to “https://office.minhspark.com” or to another slide on any object.',
        copyTokens: ['https://office.minhspark.com'],
        ribbonPath: 'Chọn đối tượng → Chèn → Liên kết',
        hint: 'Bấm chọn một khung chữ hoặc hình khối, mở thẻ Chèn (Insert) → bấm Liên kết → nhập URL hoặc chọn trang chiếu đích rồi lưu.',
        points: 20,
        check: (content) =>
          hasAnyLink(content.presentation.slides)
            ? { passed: true, detail: 'Đã gắn siêu liên kết trên bài thuyết trình.' }
            : { passed: false, detail: 'Chưa phát hiện đối tượng nào có siêu liên kết.' },
      },
      {
        id: 'p3-t4',
        domainId: 'ppt-deliver',
        title: 'Bật trình chiếu lặp liên tục',
        titleEn: 'Enable loop continuously until Esc',
        instruction: 'Thiết lập chế độ trình chiếu lặp liên tục cho đến khi nhấn Esc (Loop continuously until Esc).',
        instructionEn: 'Configure the slide show to loop continuously until Esc is pressed.',
        ribbonPath: 'Trình chiếu → Thiết lập trình chiếu → Lặp liên tục cho đến khi nhấn Esc',
        hint: 'Mở thẻ Trình chiếu (Slide Show) → bấm Thiết lập trình chiếu → đánh dấu chọn Lặp liên tục cho đến khi nhấn Esc rồi bấm Lưu.',
        points: 20,
        check: (content) =>
          content.presentation.showSettings?.loop
            ? { passed: true, detail: 'Đã bật chế độ trình chiếu lặp liên tục.' }
            : { passed: false, detail: 'Chưa bật tuỳ chọn Lặp liên tục trong Thiết lập trình chiếu.' },
      },
      {
        id: 'p3-t5',
        domainId: 'ppt-deliver',
        title: 'Thêm bình luận rà soát nội dung',
        titleEn: 'Add review comment',
        instruction: 'Thêm ít nhất một Bình luận (Comment) vào bài thuyết trình để ghi chú kiểm duyệt.',
        instructionEn: 'Insert at least one Comment in the presentation for editorial review.',
        ribbonPath: 'Xem lại → Bình luận mới',
        hint: 'Mở thẻ Xem lại (Review) → bấm Bình luận mới (hoặc Ctrl+Alt+M) → nhập nội dung nhận xét và gửi.',
        points: 20,
        check: (content) => {
          const slideComments = content.presentation.slides.reduce((sum, s) => sum + (s.comments?.length ?? 0), 0);
          const total = slideComments + (content.comments?.length ?? 0);
          return total > 0
            ? { passed: true, detail: `Đã ghi nhận ${total} bình luận rà soát.` }
            : { passed: false, detail: 'Chưa có bình luận nào được thêm vào bài thuyết trình.' };
        },
      },
    ],
  },
  {
    id: 'ppt-coffee-brand',
    track: 'powerpoint',
    level: 'associate',
    kind: 'slide',
    order: 4,
    title: 'Hồ sơ Thương hiệu Cà phê Cao Nguyên',
    titleEn: 'Highland Specialty Coffee Brand Deck',
    fileName: 'ThuongHieu_CaPhe_Viet.pptx',
    scenario: 'Bạn chỉnh sửa hồ sơ giới thiệu thương hiệu cà phê xuất khẩu: đổi chủ đề ấm áp, xoá trang nháp dư thừa, bổ sung giống cà phê chủ lực, đồng bộ chuyển trang và hiển thị ngày.',
    scenarioEn: 'Finalize the specialty coffee brand deck by applying a warm theme, removing the draft slide, adding the flagship bean origin, setting uniform transitions, and showing dates.',
    minutes: 7,
    difficulty: 'Cơ bản',
    createStarter: buildCoffeeBrandStarter,
    tasks: [
      {
        id: 'p4-t1',
        domainId: 'ppt-manage',
        title: 'Áp dụng chủ đề Sunset Horizon hoặc Minimalist Ivory',
        titleEn: 'Apply Sunset Horizon or Minimalist Ivory theme',
        instruction: 'Đổi chủ đề bài thuyết trình sang “Sunset Horizon” hoặc “Minimalist Ivory”.',
        instructionEn: 'Apply the “Sunset Horizon” or “Minimalist Ivory” theme to the presentation.',
        ribbonPath: 'Thiết kế → Chủ đề',
        hint: 'Vào thẻ Thiết kế (Design), chọn chủ đề Sunset Horizon hoặc Minimalist Ivory.',
        points: 20,
        check: (content) => {
          const id = content.presentation.themeId;
          return id === 'sunset-gradient' || id === 'minimalist-ivory'
            ? { passed: true, detail: `Đã áp dụng chủ đề ${id}.` }
            : { passed: false, detail: `Chủ đề hiện tại là “${id}”, cần đổi sang Sunset Horizon hoặc Minimalist Ivory.` };
        },
      },
      {
        id: 'p4-t2',
        domainId: 'ppt-manage',
        title: 'Xoá trang chiếu nháp dư thừa',
        titleEn: 'Delete draft slide',
        instruction: 'Xoá trang chiếu có tiêu đề “Trang nháp cần xoá” khỏi bài thuyết trình.',
        instructionEn: 'Delete the slide titled “Trang nháp cần xoá” from the presentation.',
        ribbonPath: 'Chọn Slide 4 → bấm phím Delete hoặc chuột phải → Xoá trang chiếu',
        hint: 'Ở cột trang chiếu bên trái, chọn Slide 4 (“Trang nháp cần xoá”) rồi bấm xoá trang.',
        points: 20,
        check: (content) => {
          const hasDraft = content.presentation.slides.some((s) => foldSlide(slideText(s)).includes('trang nhap can xoa'));
          return !hasDraft && content.presentation.slides.length <= 4
            ? { passed: true, detail: 'Đã xoá hoàn toàn trang chiếu nháp.' }
            : { passed: false, detail: 'Vẫn còn trang chiếu “Trang nháp cần xoá” trong bài thuyết trình.' };
        },
      },
      {
        id: 'p4-t3',
        domainId: 'ppt-content',
        title: 'Bổ sung tên vùng nguyên liệu trên Slide 2',
        titleEn: 'Add origin text on Slide 2',
        instruction: 'Trên Slide 2 (“Vùng nguyên liệu chủ lực”), bổ sung cụm từ “Arabica Đà Lạt” vào nội dung hoặc một hộp văn bản mới.',
        instructionEn: 'On Slide 2 (“Vùng nguyên liệu chủ lực”), add the text “Arabica Đà Lạt” to the content or a new text box.',
        copyTokens: ['Arabica Đà Lạt'],
        ribbonPath: 'Slide 2 → sửa khung nội dung hoặc Chèn → Hộp văn bản',
        hint: 'Chọn Slide 2, gõ thêm dòng “Arabica Đà Lạt” vào khung văn bản hiện có hoặc chèn thêm hộp văn bản mới.',
        points: 20,
        check: (content) => {
          const slide = content.presentation.slides[1];
          return slide && foldSlide(slideText(slide)).includes('arabica da lat')
            ? { passed: true, detail: 'Đã bổ sung thông tin “Arabica Đà Lạt” trên Slide 2.' }
            : { passed: false, detail: 'Slide 2 chưa chứa cụm từ “Arabica Đà Lạt”.' };
        },
      },
      {
        id: 'p4-t4',
        domainId: 'ppt-motion',
        title: 'Áp dụng chuyển trang Wipe/Split đồng loạt',
        titleEn: 'Apply Wipe or Split transition to all slides',
        instruction: 'Áp dụng hiệu ứng chuyển tiếp Quét (Wipe) hoặc Tách (Split) cho tất cả các trang chiếu.',
        instructionEn: 'Apply the Wipe or Split transition to all slides in the presentation.',
        ribbonPath: 'Chuyển tiếp → Quét (Wipe) / Tách (Split) → Áp dụng cho tất cả',
        hint: 'Mở thẻ Chuyển tiếp, chọn Wipe hoặc Split rồi bấm Áp dụng cho tất cả.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const count = slides.filter((s) => s.transition.type === 'wipe' || s.transition.type === 'split').length;
          return slides.length > 0 && count === slides.length
            ? { passed: true, detail: `Toàn bộ ${slides.length} trang chiếu đã áp dụng chuyển tiếp Wipe/Split.` }
            : { passed: false, detail: `Mới có ${count}/${slides.length} trang chiếu dùng chuyển tiếp Wipe hoặc Split.` };
        },
      },
      {
        id: 'p4-t5',
        domainId: 'ppt-deliver',
        title: 'Hiển thị ngày và ẩn trên trang tiêu đề',
        titleEn: 'Show date and hide on title slide',
        instruction: 'Trong Đầu trang & Chân trang, bật hiển thị Ngày giờ (Date and Time) và tích chọn Không hiển thị trên trang tiêu đề (Hide on title slide).',
        instructionEn: 'In Header & Footer, enable Date and Time and check Don’t show on title slide.',
        ribbonPath: 'Chèn → Đầu trang & Chân trang',
        hint: 'Mở hộp thoại Đầu trang & Chân trang (thẻ Chèn), bật Ngày giờ và bật tuỳ chọn Không hiển thị trên trang tiêu đề rồi lưu.',
        points: 20,
        check: (content) => {
          const hf = content.presentation.headerFooter;
          if (hf?.showDate && hf?.hideOnTitle) return { passed: true, detail: 'Đã bật ngày giờ và ẩn đầu/chân trang trên trang tiêu đề.' };
          const issues: string[] = [];
          if (!hf?.showDate) issues.push('chưa bật Ngày giờ');
          if (!hf?.hideOnTitle) issues.push('chưa bật Không hiển thị trên trang tiêu đề');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
    ],
  },
  {
    id: 'ppt-travel-tour',
    track: 'powerpoint',
    level: 'associate',
    kind: 'slide',
    order: 5,
    title: 'Giới thiệu Tour Di sản Miền Trung',
    titleEn: 'Central Vietnam Heritage Tour',
    fileName: 'DuLich_MienTrung_2026.pptx',
    scenario: 'Công ty lữ hành cần hoàn thiện bài thuyết trình giới thiệu tour du lịch với trang tiêu đề phần, nền trang bìa nổi bật, hình khối minh hoạ, chuyển trang mượt và ghi chú diễn giả.',
    scenarioEn: 'Complete the heritage tour deck by inserting a Section Header slide, styling Slide 1 background, adding illustration shapes, configuring a transition, and adding speaker notes.',
    minutes: 7,
    difficulty: 'Trung bình',
    createStarter: buildTravelTourStarter,
    tasks: [
      {
        id: 'p5-t1',
        domainId: 'ppt-manage',
        title: 'Chèn trang chiếu bố cục Tiêu đề phần (Section Header)',
        titleEn: 'Insert Section Header slide',
        instruction: 'Thêm ít nhất một trang chiếu mới có bố cục Tiêu đề phần (Section Header).',
        instructionEn: 'Insert at least one new slide using the Section Header layout.',
        ribbonPath: 'Trang đầu → Trang chiếu mới → Tiêu đề phần',
        hint: 'Vào thẻ Trang đầu → bấm mũi tên Trang chiếu mới → chọn bố cục Tiêu đề phần (Section).',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          return slides.length >= 5 && slides.some((s) => s.layout === 'section')
            ? { passed: true, detail: 'Đã chèn trang chiếu bố cục Tiêu đề phần.' }
            : { passed: false, detail: 'Chưa có trang chiếu mới dùng bố cục Tiêu đề phần (Section).' };
        },
      },
      {
        id: 'p5-t2',
        domainId: 'ppt-manage',
        title: 'Đổi màu nền cho Slide 1',
        titleEn: 'Format Slide 1 background',
        instruction: 'Đổi nền của Slide 1 (trang tiêu đề) từ màu trắng mặc định sang một màu nền khác hoặc dải màu chuyển sắc (Gradient).',
        instructionEn: 'Change Slide 1 background from plain white to another solid color or a Gradient fill.',
        ribbonPath: 'Chọn Slide 1 → Thiết kế → Định dạng nền',
        hint: 'Chọn Slide 1, mở thẻ Thiết kế (Design) → Định dạng nền → chọn màu khác trắng hoặc chuyển sang kiểu Gradient.',
        points: 20,
        check: (content) => {
          const bg = content.presentation.slides[0]?.background;
          const ok = Boolean(bg && (bg.type !== 'solid' || bg.value.toUpperCase() !== '#FFFFFF'));
          return ok
            ? { passed: true, detail: `Đã thay đổi nền Slide 1 (${bg?.type}).` }
            : { passed: false, detail: 'Nền Slide 1 vẫn đang là màu trắng mặc định #FFFFFF.' };
        },
      },
      {
        id: 'p5-t3',
        domainId: 'ppt-content',
        title: 'Chèn tối thiểu 2 hình dạng minh hoạ',
        titleEn: 'Insert at least two shapes',
        instruction: 'Chèn tổng cộng ít nhất 2 Hình dạng (Shape) minh hoạ vào các trang chiếu nội dung.',
        instructionEn: 'Insert at least 2 Shapes across the presentation slides.',
        ribbonPath: 'Chèn → Hình dạng',
        hint: 'Mở thẻ Chèn (Insert) → Hình dạng và chèn ít nhất 2 hình khối (ví dụ mũi tên lịch trình, thẻ điểm đến).',
        points: 20,
        check: (content) => {
          const count = content.presentation.slides.reduce((sum, s) => sum + s.elements.filter((el) => el.type === 'shape').length, 0);
          return count >= 2
            ? { passed: true, detail: `Đã chèn ${count} hình dạng minh hoạ.` }
            : { passed: false, detail: `Mới có ${count} hình dạng, cần tối thiểu 2 hình dạng.` };
        },
      },
      {
        id: 'p5-t4',
        domainId: 'ppt-motion',
        title: 'Áp dụng chuyển cảnh Reveal/Uncover/Cover >= 1,2s',
        titleEn: 'Apply Reveal/Uncover/Cover transition >= 1.2s',
        instruction: 'Trên Slide 2 (hoặc toàn bộ bài thuyết trình), đặt hiệu ứng chuyển tiếp Reveal, Uncover hoặc Cover với thời lượng từ 1,2 giây trở lên.',
        instructionEn: 'Apply a Reveal, Uncover, or Cover transition with duration >= 1.2s on Slide 2 (or all slides).',
        ribbonPath: 'Chọn Slide 2 → Chuyển tiếp → Reveal / Uncover / Cover → Thời lượng >= 1,2s',
        hint: 'Chọn Slide 2, vào thẻ Chuyển tiếp, chọn Reveal, Uncover hoặc Cover và tăng thời lượng lên ít nhất 1,2 giây.',
        points: 20,
        check: (content) => {
          const slide = content.presentation.slides[1];
          const ok = Boolean(slide && ['reveal', 'uncover', 'cover'].includes(slide.transition.type) && (slide.transition.duration ?? 0) >= 1.2);
          return ok
            ? { passed: true, detail: `Slide 2 đã dùng chuyển tiếp ${slide?.transition.type} (${slide?.transition.duration}s).` }
            : { passed: false, detail: 'Slide 2 chưa áp dụng chuyển tiếp Reveal/Uncover/Cover với thời lượng >= 1,2 giây.' };
        },
      },
      {
        id: 'p5-t5',
        domainId: 'ppt-deliver',
        title: 'Thêm ghi chú diễn giả nhắc tới Hội An',
        titleEn: 'Add speaker notes mentioning Hoi An',
        instruction: 'Thêm Ghi chú diễn giả có chứa cụm từ “Hội An” vào Slide 2 hoặc Slide 3.',
        instructionEn: 'Add Speaker Notes containing “Hội An” to Slide 2 or Slide 3.',
        copyTokens: ['Hội An'],
        ribbonPath: 'Chọn Slide 2 hoặc Slide 3 → khung Ghi chú diễn giả bên dưới',
        hint: 'Mở khung Ghi chú phía dưới Slide 2 hoặc Slide 3 và nhập câu nhắc lịch trình có chứa “Hội An”.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides.slice(1, 3);
          const ok = slides.some((s) => foldSlide(s.notes ?? '').includes('hoi an'));
          return ok
            ? { passed: true, detail: 'Đã thêm ghi chú diễn giả có nhắc tới “Hội An”.' }
            : { passed: false, detail: 'Ghi chú diễn giả trên Slide 2 và Slide 3 chưa chứa cụm từ “Hội An”.' };
        },
      },
    ],
  },
  {
    id: 'ppt-campus-orientation',
    track: 'powerpoint',
    level: 'associate',
    kind: 'slide',
    order: 6,
    title: 'Định hướng Tân Sinh viên 2026',
    titleEn: 'Freshman Orientation 2026',
    fileName: 'DinhHuong_TanSinhVien.pptx',
    scenario: 'Phòng Công tác Sinh viên giao bạn hoàn thiện slide chào đón tân sinh viên với chủ đề hiện đại, phân phần, bảng lịch, sơ đồ quy trình, hoạt hình và chân trang khoá học.',
    scenarioEn: 'Prepare the freshman orientation deck with a fresh theme, slide section, schedule table, SmartArt process diagram, slide animations, and a cohort footer.',
    minutes: 7,
    difficulty: 'Trung bình',
    createStarter: buildCampusStarter,
    tasks: [
      {
        id: 'p6-t1',
        domainId: 'ppt-manage',
        title: 'Đổi chủ đề Nordic Steel hoặc Coral Vibrant',
        titleEn: 'Apply Nordic Steel or Coral Vibrant theme',
        instruction: 'Áp dụng chủ đề “Nordic Steel” hoặc “Coral Vibrant” cho bài thuyết trình.',
        instructionEn: 'Apply the “Nordic Steel” or “Coral Vibrant” theme to the presentation.',
        ribbonPath: 'Thiết kế → Chủ đề',
        hint: 'Mở thẻ Thiết kế (Design) và chọn chủ đề Nordic Steel hoặc Coral Vibrant.',
        points: 20,
        check: (content) => {
          const id = content.presentation.themeId;
          return id === 'nordic-steel' || id === 'coral-vibrant'
            ? { passed: true, detail: `Đã áp dụng chủ đề ${id}.` }
            : { passed: false, detail: `Chủ đề hiện là “${id}”, cần chọn Nordic Steel hoặc Coral Vibrant.` };
        },
      },
      {
        id: 'p6-t2',
        domainId: 'ppt-manage',
        title: 'Tạo ít nhất 1 Phần (Section)',
        titleEn: 'Add presentation section',
        instruction: 'Thêm ít nhất một Phần (Section) để phân nhóm các trang chiếu trong bài thuyết trình.',
        instructionEn: 'Create at least one Section to organize slides in the presentation.',
        ribbonPath: 'Trang đầu → Phần (Section) → Thêm phần',
        hint: 'Vào thẻ Trang đầu (Home) → bấm nút Phần (Section) → chọn Thêm phần.',
        points: 20,
        check: (content) => {
          const count = content.presentation.sections?.length ?? 0;
          return count > 0
            ? { passed: true, detail: `Đã tạo ${count} phần quản lý trang chiếu.` }
            : { passed: false, detail: 'Bài thuyết trình chưa có Phần (Section) nào.' };
        },
      },
      {
        id: 'p6-t3',
        domainId: 'ppt-content',
        title: 'Chèn Bảng trên Slide 2 và SmartArt trên Slide 3',
        titleEn: 'Insert Table on Slide 2 & SmartArt on Slide 3',
        instruction: 'Chèn một Bảng (Table) vào Slide 2 (“Lịch tuần lễ định hướng”) và một sơ đồ SmartArt vào Slide 3 (“Quy trình nhập học”).',
        instructionEn: 'Insert a Table on Slide 2 and a SmartArt graphic on Slide 3.',
        ribbonPath: 'Slide 2 → Chèn → Bảng · Slide 3 → Chèn → SmartArt',
        hint: 'Chọn Slide 2 để chèn Bảng, sau đó chuyển sang Slide 3 để chèn một sơ đồ SmartArt.',
        points: 20,
        check: (content) => {
          const hasTable = Boolean(content.presentation.slides[1]?.elements.some((el) => el.type === 'table'));
          const hasSmart = Boolean(content.presentation.slides[2]?.elements.some((el) => el.type === 'smartart'));
          if (hasTable && hasSmart) return { passed: true, detail: 'Đã có đủ Bảng trên Slide 2 và SmartArt trên Slide 3.' };
          const issues: string[] = [];
          if (!hasTable) issues.push('Slide 2 chưa có Bảng');
          if (!hasSmart) issues.push('Slide 3 chưa có SmartArt');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'p6-t4',
        domainId: 'ppt-motion',
        title: 'Gắn hoạt hình cho Slide 2 và Slide 3',
        titleEn: 'Animate elements on Slide 2 & Slide 3',
        instruction: 'Gắn ít nhất một hiệu ứng Hoạt hình (Animation) cho đối tượng trên Slide 2 và ít nhất một hiệu ứng trên Slide 3.',
        instructionEn: 'Apply at least one Animation effect on Slide 2 and at least one on Slide 3.',
        ribbonPath: 'Chọn đối tượng trên Slide 2 & Slide 3 → Hoạt hình',
        hint: 'Lần lượt chọn một đối tượng trên Slide 2 và một đối tượng trên Slide 3 rồi gắn hiệu ứng trong thẻ Hoạt hình.',
        points: 20,
        check: (content) => {
          const c2 = countAnimations(content.presentation.slides[1]?.elements ?? []);
          const c3 = countAnimations(content.presentation.slides[2]?.elements ?? []);
          if (c2 > 0 && c3 > 0) return { passed: true, detail: 'Cả Slide 2 và Slide 3 đều đã có hiệu ứng hoạt hình.' };
          return { passed: false, detail: `Slide 2 có ${c2} hiệu ứng, Slide 3 có ${c3} hiệu ứng (cần >= 1 mỗi trang).` };
        },
      },
      {
        id: 'p6-t5',
        domainId: 'ppt-deliver',
        title: 'Đặt chân trang “Khóa 2026”',
        titleEn: 'Set cohort footer text',
        instruction: 'Đặt nội dung Chân trang (Footer) chứa cụm từ “Khóa 2026” qua hộp thoại Đầu trang & Chân trang hoặc Slide Master.',
        instructionEn: 'Set the presentation Footer text to contain “Khóa 2026” via Header & Footer or Slide Master.',
        copyTokens: ['Khóa 2026'],
        ribbonPath: 'Chèn → Đầu trang & Chân trang (hoặc Xem → Slide Master)',
        hint: 'Mở Đầu trang & Chân trang, bật Chân trang và nhập “Khóa 2026” rồi bấm Áp dụng cho tất cả.',
        points: 20,
        check: (content) => {
          const hf = content.presentation.headerFooter;
          const sm = content.presentation.slideMaster;
          const text = hf?.showFooter ? (hf.footerText ?? '') : sm?.enabled ? (sm.footerText ?? '') : (hf?.footerText ?? sm?.footerText ?? '');
          return foldSlide(text).includes('khoa 2026')
            ? { passed: true, detail: `Đã thiết lập chân trang “${text}”.` }
            : { passed: false, detail: 'Chân trang hiện chưa chứa cụm từ “Khóa 2026”.' };
        },
      },
    ],
  },
  {
    id: 'ppt-startup-pitch',
    track: 'powerpoint',
    level: 'associate',
    kind: 'slide',
    order: 7,
    title: 'Pitch Deck Gọi vốn Startup AI',
    titleEn: 'AI Startup Fundraising Pitch Deck',
    fileName: 'GoiVon_Startup_AI.pptx',
    scenario: 'Trước buổi thuyết trình với quỹ đầu tư, hãy hoàn thiện bộ slide nền tối, đưa trang đội ngũ lên vị trí số 2, chèn biểu đồ tăng trưởng, chuyển cảnh Morph/Zoom và ẩn phụ lục.',
    scenarioEn: 'Polish the investor pitch deck with a dark theme, reorder the Founding Team slide to Slide 2, add an ARR chart, apply Morph/Zoom transitions, comment, and hide the valuation appendix.',
    minutes: 8,
    difficulty: 'Nâng cao',
    createStarter: buildStartupPitchStarter,
    tasks: [
      {
        id: 'p7-t1',
        domainId: 'ppt-manage',
        title: 'Áp dụng chủ đề nền tối Midnight Dark / Sapphire Modern',
        titleEn: 'Apply dark theme',
        instruction: 'Áp dụng chủ đề “Midnight Dark” hoặc “Sapphire Modern” cho toàn bài thuyết trình.',
        instructionEn: 'Apply the “Midnight Dark” or “Sapphire Modern” theme to the presentation.',
        ribbonPath: 'Thiết kế → Chủ đề',
        hint: 'Mở thẻ Thiết kế (Design) → chọn chủ đề Midnight Dark hoặc Sapphire Modern.',
        points: 20,
        check: (content) => {
          const id = content.presentation.themeId;
          return id === 'midnight-dark' || id === 'sapphire-modern'
            ? { passed: true, detail: `Đã chuyển sang chủ đề nền tối ${id}.` }
            : { passed: false, detail: `Chủ đề hiện tại là “${id}”, cần chọn Midnight Dark hoặc Sapphire Modern.` };
        },
      },
      {
        id: 'p7-t2',
        domainId: 'ppt-manage',
        title: 'Đưa trang “Đội ngũ sáng lập” lên vị trí Slide 2',
        titleEn: 'Move Founding Team slide to Slide 2',
        instruction: 'Di chuyển trang chiếu “Đội ngũ sáng lập” lên vị trí ngay sau trang bìa (vị trí Slide 2).',
        instructionEn: 'Reorder slides so that “Đội ngũ sáng lập” appears immediately after Slide 1 (as Slide 2).',
        ribbonPath: 'Kéo thả hình thu nhỏ “Đội ngũ sáng lập” lên vị trí số 2 ở cột bên trái',
        hint: 'Ở danh sách trang chiếu bên trái, kéo trang “Đội ngũ sáng lập” lên nằm ngay dưới Slide 1.',
        points: 20,
        check: (content) => {
          const slide2 = content.presentation.slides[1];
          return slide2 && foldSlide(slideText(slide2)).includes('doi ngu sang lap')
            ? { passed: true, detail: 'Trang “Đội ngũ sáng lập” đã ở đúng vị trí Slide 2.' }
            : { passed: false, detail: 'Slide 2 hiện chưa phải là trang “Đội ngũ sáng lập”.' };
        },
      },
      {
        id: 'p7-t3',
        domainId: 'ppt-content',
        title: 'Chèn biểu đồ trên trang “Tăng trưởng ARR”',
        titleEn: 'Insert ARR growth chart',
        instruction: 'Chèn một Biểu đồ (Chart) vào trang chiếu có tiêu đề “Tăng trưởng ARR 4 quý”.',
        instructionEn: 'Insert a Chart onto the “Tăng trưởng ARR 4 quý” slide.',
        ribbonPath: 'Chọn trang “Tăng trưởng ARR 4 quý” → Chèn → Biểu đồ',
        hint: 'Chọn trang chiếu “Tăng trưởng ARR 4 quý”, vào thẻ Chèn → bấm Biểu đồ.',
        points: 20,
        check: (content) => {
          const target = content.presentation.slides.find((s) => foldSlide(slideText(s)).includes('tang truong arr'));
          return target?.elements.some((el) => el.type === 'chart')
            ? { passed: true, detail: 'Đã chèn biểu đồ tăng trưởng ARR đúng trang.' }
            : { passed: false, detail: 'Trang “Tăng trưởng ARR 4 quý” chưa có biểu đồ.' };
        },
      },
      {
        id: 'p7-t4',
        domainId: 'ppt-motion',
        title: 'Áp dụng chuyển cảnh Morph hoặc Zoom',
        titleEn: 'Apply Morph or Zoom transitions',
        instruction: 'Áp dụng hiệu ứng chuyển tiếp Morph hoặc Zoom cho ít nhất 2 trang chiếu.',
        instructionEn: 'Apply a Morph or Zoom transition to at least 2 slides.',
        ribbonPath: 'Chuyển tiếp → Morph / Zoom',
        hint: 'Mở thẻ Chuyển tiếp (Transitions), chọn Morph hoặc Zoom cho ít nhất 2 slide (hoặc Áp dụng cho tất cả).',
        points: 20,
        check: (content) => {
          const count = content.presentation.slides.filter((s) => s.transition.type === 'morph' || s.transition.type === 'zoom').length;
          return count >= 2
            ? { passed: true, detail: `Đã áp dụng chuyển tiếp Morph/Zoom cho ${count} trang chiếu.` }
            : { passed: false, detail: `Mới có ${count} trang chiếu dùng Morph hoặc Zoom, cần ít nhất 2 trang.` };
        },
      },
      {
        id: 'p7-t5',
        domainId: 'ppt-deliver',
        title: 'Ẩn trang Phụ lục định giá và thêm bình luận',
        titleEn: 'Hide appendix slide & insert comment',
        instruction: 'Đánh dấu Ẩn (Hide) trang chiếu cuối cùng (“Phụ lục định giá”) và thêm ít nhất một Bình luận (Comment) vào bài thuyết trình.',
        instructionEn: 'Hide the final slide (“Phụ lục định giá”) and insert at least one Comment in the presentation.',
        copyTokens: ['Series A'],
        ribbonPath: 'Slide cuối → Trình chiếu → Ẩn trang chiếu · Xem lại → Bình luận mới',
        hint: 'Chọn trang cuối cùng và bấm Ẩn trang chiếu ở thẻ Trình chiếu, sau đó vào thẻ Xem lại bấm Bình luận mới.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const hidden = Boolean(slides[slides.length - 1]?.hidden);
          const comments = slides.reduce((sum, s) => sum + (s.comments?.length ?? 0), 0) + (content.comments?.length ?? 0);
          if (hidden && comments > 0) return { passed: true, detail: 'Đã ẩn trang phụ lục và thêm bình luận kiểm duyệt.' };
          const issues: string[] = [];
          if (!hidden) issues.push('chưa ẩn trang cuối cùng');
          if (comments === 0) issues.push('chưa thêm bình luận nào');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
    ],
  },
];
