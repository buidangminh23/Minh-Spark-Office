import type { PresentationData, SlideData } from '../slideTypes';
import type { SlideContent } from '../storage';
import type { MosPptProject } from './types';

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function slideText(slide: SlideData): string {
  return slide.elements.map((el) => el.text ?? '').join(' ');
}

function baseSlide(id: string, layout: SlideData['layout'], title: string, body?: string): SlideData {
  const elements: SlideData['elements'] = [
    {
      id: `${id}-title`,
      type: 'text',
      x: 8,
      y: layout === 'title' ? 30 : 8,
      width: 84,
      height: layout === 'title' ? 22 : 14,
      text: title,
      fontSize: layout === 'title' ? 42 : 30,
      fontFamily: "'Segoe UI', Roboto, sans-serif",
      fontWeight: 'bold',
      color: '#1E293B',
      textAlign: layout === 'title' ? 'center' : 'left',
      isTitle: true,
    },
  ];
  if (body) {
    elements.push({
      id: `${id}-body`,
      type: 'text',
      x: 8,
      y: layout === 'title' ? 56 : 26,
      width: 84,
      height: layout === 'title' ? 18 : 60,
      text: body,
      fontSize: layout === 'title' ? 20 : 20,
      fontFamily: "'Segoe UI', Roboto, sans-serif",
      color: '#475569',
      textAlign: layout === 'title' ? 'center' : 'left',
      lineHeight: 1.55,
    });
  }
  return {
    id,
    layout,
    background: { type: 'solid', value: '#FFFFFF' },
    elements,
    notes: '',
    transition: { type: 'none', duration: 0.5 },
    hidden: false,
    comments: [],
  };
}

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

function buildExpertKioskStarter(): SlideContent {
  const presentation: PresentationData = {
    title: 'Kiosk_TrienLam_2026.pptx',
    aspectRatio: '16:9',
    themeId: 'office-classic',
    slides: [
      baseSlide('p4-s1', 'title', 'TRIỂN LÃM CÔNG NGHỆ QUỐC TẾ 2026', 'Trải nghiệm giải pháp Office 23 tại gian hàng A12'),
      {
        ...baseSlide('p4-s2', 'title-content', 'Điểm nhấn sản phẩm chủ lực', '• Tự động hoá xử lý văn bản, bảng tính và PDF ngoại tuyến\n• Đồng bộ đám mây an toàn theo tài khoản riêng'),
        elements: [
          ...baseSlide('p4-s2', 'title-content', 'Điểm nhấn sản phẩm chủ lực', '• Tự động hoá xử lý văn bản, bảng tính và PDF ngoại tuyến\n• Đồng bộ đám mây an toàn theo tài khoản riêng').elements,
          {
            id: 'p4-s2-badge',
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
          },
        ],
      },
      baseSlide('p4-s3', 'title-content', 'Lịch trình demo trực tiếp', '• 09:30: Trình diễn 23 Docs & 23 Sheets\n• 14:00: Thực hành chuyển đổi định dạng & OCR tiếng Việt'),
      baseSlide('p4-s4', 'title-content', 'Liên hệ đối tác', 'Website: https://office.minhspark.com · Gian hàng A12'),
    ],
    sections: [],
    customShows: [],
  };
  return { kind: 'slide', presentation };
}

export const MOS_PPT_PROJECTS: MosPptProject[] = [
  {
    id: 'ppt-edtech-launch',
    track: 'powerpoint',
    level: 'associate',
    kind: 'slide',
    order: 1,
    title: 'Ra mắt Nền tảng Học tập Số',
    fileName: 'RaMat_NenTang_So.pptx',
    scenario: 'Bạn chuẩn bị bộ trang chiếu giới thiệu sản phẩm giáo dục số cho hội thảo đối tác, yêu cầu đồng bộ chủ đề, bảng so sánh, hiệu ứng chuyển trang và chân trang.',
    minutes: 15,
    difficulty: 'Cơ bản',
    createStarter: buildEdtechStarter,
    tasks: [
      {
        id: 'p1-t1',
        domainId: 'ppt-manage',
        title: 'Đổi chủ đề bài thuyết trình',
        instruction: 'Áp dụng chủ đề (Theme) “Sapphire Modern” hoặc “Emerald Executive” cho toàn bài thuyết trình.',
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
        instruction: 'Chèn thêm ít nhất một trang chiếu mới có bố cục Hai nội dung (Two Content) hoặc So sánh (Comparison).',
        ribbonPath: 'Trang đầu → Trang chiếu mới → chọn bố cục Hai nội dung / So sánh',
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
        instruction: 'Chèn một Bảng (Table) vào trang chiếu “Gói triển khai theo trường học” (hoặc bất kỳ trang chiếu nội dung nào).',
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
        instruction: 'Áp dụng hiệu ứng chuyển tiếp Mờ dần (Fade) hoặc Đẩy (Push) với thời lượng từ 1 giây trở lên cho toàn bộ các trang chiếu.',
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
        instruction: 'Bật hiển thị Số trang chiếu (Slide Number) và đặt nội dung Chân trang (Footer) chứa “Office 23 MOS”.',
        ribbonPath: 'Chèn → Đầu trang & Chân trang (hoặc Xem → Slide Master)',
        hint: 'Mở hộp thoại Đầu trang & Chân trang (thẻ Chèn) hoặc Slide Master (thẻ Xem), bật Số trang chiếu và nhập “Office 23 MOS” vào ô Chân trang.',
        points: 20,
        check: (content) => {
          const hf = content.presentation.headerFooter;
          const sm = content.presentation.slideMaster;
          const numOk = Boolean(hf?.showSlideNumber || (sm?.enabled && sm?.showSlideNumber));
          const footerText = hf?.showFooter ? (hf.footerText ?? '') : sm?.enabled ? (sm.footerText ?? '') : (hf?.footerText ?? sm?.footerText ?? '');
          const footerOk = fold(footerText).includes('office 23 mos');
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
    fileName: 'BaoCao_TaiChinh_2026.pptx',
    scenario: 'Ban Tài chính yêu cầu chuyển đổi khung hình sang máy chiếu chuẩn 4:3, bổ sung biểu đồ, sơ đồ quy trình SmartArt, hoạt ảnh và ẩn trang phụ lục nội bộ.',
    minutes: 15,
    difficulty: 'Trung bình',
    createStarter: buildFinanceStarter,
    tasks: [
      {
        id: 'p2-t1',
        domainId: 'ppt-manage',
        title: 'Đổi kích thước trang chiếu sang chuẩn 4:3',
        instruction: 'Chuyển tỷ lệ trang chiếu của toàn bài thuyết trình từ Màn hình rộng (16:9) sang Chuẩn (4:3).',
        ribbonPath: 'Thiết kế → Kích thước trang chiếu → Chuẩn (4:3)',
        hint: 'Mở thẻ Thiết kế (Design) → bấm Kích thước trang chiếu → chọn Chuẩn (4:3).',
        points: 20,
        check: (content) => {
          return content.presentation.aspectRatio === '4:3'
            ? { passed: true, detail: 'Đã chuyển tỷ lệ bài thuyết trình sang 4:3.' }
            : { passed: false, detail: `Tỷ lệ hiện tại là ${content.presentation.aspectRatio}, cần đổi sang 4:3.` };
        },
      },
      {
        id: 'p2-t2',
        domainId: 'ppt-content',
        title: 'Chèn biểu đồ trên Slide 2',
        instruction: 'Trên Slide 2 (“Biểu đồ tăng trưởng doanh thu”), chèn một Biểu đồ (Chart) bất kỳ.',
        ribbonPath: 'Chèn → Biểu đồ',
        hint: 'Chọn Slide 2 ở cột bên trái, mở thẻ Chèn (Insert) → bấm Biểu đồ để chèn biểu đồ vào trang.',
        points: 20,
        check: (content) => {
          const slide = content.presentation.slides[1];
          const hasChart = Boolean(slide?.elements.some((el) => el.type === 'chart'));
          return hasChart
            ? { passed: true, detail: 'Đã chèn biểu đồ trực quan trên Slide 2.' }
            : { passed: false, detail: 'Slide 2 chưa có đối tượng Biểu đồ nào.' };
        },
      },
      {
        id: 'p2-t3',
        domainId: 'ppt-content',
        title: 'Chèn sơ đồ SmartArt trên Slide 3',
        instruction: 'Trên Slide 3 (“Quy trình kiểm soát chi phí”), chèn một sơ đồ SmartArt (Quy trình, Chu trình hoặc Kim tự tháp).',
        ribbonPath: 'Chèn → SmartArt',
        hint: 'Chọn Slide 3, mở thẻ Chèn (Insert) → bấm SmartArt và chọn một kiểu sơ đồ.',
        points: 20,
        check: (content) => {
          const slide = content.presentation.slides[2];
          const hasSmartArt = Boolean(slide?.elements.some((el) => el.type === 'smartart'));
          return hasSmartArt
            ? { passed: true, detail: 'Đã chèn sơ đồ SmartArt trên Slide 3.' }
            : { passed: false, detail: 'Slide 3 chưa có sơ đồ SmartArt nào.' };
        },
      },
      {
        id: 'p2-t4',
        domainId: 'ppt-motion',
        title: 'Áp dụng hoạt ảnh cho đối tượng',
        instruction: 'Gắn ít nhất một hiệu ứng Hoạt hình (Animation) cho một đối tượng trên Slide 1 hoặc Slide 2.',
        ribbonPath: 'Chọn đối tượng → Hoạt hình → chọn hiệu ứng xuất hiện / nhấn mạnh',
        hint: 'Bấm chọn khung tiêu đề trên Slide 1 (hoặc biểu đồ trên Slide 2), vào thẻ Hoạt hình (Animations) và chọn một hiệu ứng khác “Không có”.',
        points: 20,
        check: (content) => {
          const targets = content.presentation.slides.slice(0, 2);
          const animated = targets.some((s) => s.elements.some((el) => (el.animation && el.animation.type !== 'none') || (el.animations && el.animations.some((a) => a.type !== 'none'))));
          return animated
            ? { passed: true, detail: 'Đã gắn hiệu ứng hoạt hình cho đối tượng.' }
            : { passed: false, detail: 'Chưa có đối tượng nào trên Slide 1 hoặc Slide 2 được gắn hoạt hình.' };
        },
      },
      {
        id: 'p2-t5',
        domainId: 'ppt-deliver',
        title: 'Thêm ghi chú diễn giả và ẩn trang phụ lục',
        instruction: 'Nhập Ghi chú diễn giả (Speaker Notes) dài ít nhất 10 ký tự cho Slide 1, và đánh dấu Ẩn (Hide) trang chiếu cuối cùng.',
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
    fileName: 'ChienDich_MoiTruong.pptx',
    scenario: 'Bộ slide truyền thông nội bộ bị đảo thứ tự trang kết luận và cần bổ sung hình khối minh hoạ, liên kết tham chiếu, chế độ chiếu lặp tại quầy lễ tân và bình luận rà soát.',
    minutes: 18,
    difficulty: 'Nâng cao',
    createStarter: buildGreenCampaignStarter,
    tasks: [
      {
        id: 'p3-t1',
        domainId: 'ppt-manage',
        title: 'Đưa trang Kết luận xuống cuối cùng',
        instruction: 'Di chuyển trang chiếu có tiêu đề “Kết luận & Hành động” xuống vị trí cuối cùng của bài thuyết trình.',
        ribbonPath: 'Kéo thả hình thu nhỏ Slide 3 xuống sau Slide 4 ở cột bên trái',
        hint: 'Ở cột danh sách trang chiếu bên trái, giữ và kéo trang “Kết luận & Hành động” xuống vị trí cuối cùng.',
        points: 20,
        check: (content) => {
          const slides = content.presentation.slides;
          const last = slides[slides.length - 1];
          const ok = Boolean(last && fold(slideText(last)).includes('ket luan'));
          return ok
            ? { passed: true, detail: 'Trang “Kết luận & Hành động” đã nằm ở vị trí cuối cùng.' }
            : { passed: false, detail: 'Trang chiếu cuối cùng hiện chưa phải là “Kết luận & Hành động”.' };
        },
      },
      {
        id: 'p3-t2',
        domainId: 'ppt-content',
        title: 'Chèn hình dạng minh hoạ trên Slide 2',
        instruction: 'Trên Slide 2 (“Các trụ cột hành động”), chèn ít nhất một Hình dạng (Shape) như hình chữ nhật bo góc, mũi tên hoặc ngôi sao.',
        ribbonPath: 'Chèn → Hình dạng',
        hint: 'Chọn Slide 2, mở thẻ Chèn (Insert) → bấm Hình dạng và chọn một hình khối bất kỳ để chèn vào slide.',
        points: 20,
        check: (content) => {
          const slide = content.presentation.slides[1];
          const hasShape = Boolean(slide?.elements.some((el) => el.type === 'shape'));
          return hasShape
            ? { passed: true, detail: 'Đã chèn hình dạng minh hoạ trên Slide 2.' }
            : { passed: false, detail: 'Slide 2 chưa có đối tượng Hình dạng nào.' };
        },
      },
      {
        id: 'p3-t3',
        domainId: 'ppt-content',
        title: 'Gắn siêu liên kết cho đối tượng',
        instruction: 'Gắn một Siêu liên kết (Hyperlink) tới đường dẫn web (ví dụ https://office.minhspark.com) hoặc liên kết tới trang chiếu khác cho bất kỳ đối tượng nào.',
        ribbonPath: 'Chọn đối tượng → Chèn → Liên kết',
        hint: 'Bấm chọn một khung chữ hoặc hình khối, mở thẻ Chèn (Insert) → bấm Liên kết → nhập URL hoặc chọn trang chiếu đích rồi lưu.',
        points: 20,
        check: (content) => {
          const hasLink = content.presentation.slides.some((s) => s.elements.some((el) => Boolean(el.link) || Boolean(el.textLinks && el.textLinks.length > 0)));
          return hasLink
            ? { passed: true, detail: 'Đã gắn siêu liên kết trên bài thuyết trình.' }
            : { passed: false, detail: 'Chưa phát hiện đối tượng nào có siêu liên kết.' };
        },
      },
      {
        id: 'p3-t4',
        domainId: 'ppt-deliver',
        title: 'Bật trình chiếu lặp liên tục',
        instruction: 'Thiết lập chế độ trình chiếu lặp liên tục cho đến khi nhấn Esc (Loop continuously until Esc).',
        ribbonPath: 'Trình chiếu → Thiết lập trình chiếu → Lặp liên tục cho đến khi nhấn Esc',
        hint: 'Mở thẻ Trình chiếu (Slide Show) → bấm Thiết lập trình chiếu → đánh dấu chọn Lặp liên tục cho đến khi nhấn Esc rồi bấm Lưu.',
        points: 20,
        check: (content) => {
          return content.presentation.showSettings?.loop
            ? { passed: true, detail: 'Đã bật chế độ trình chiếu lặp liên tục.' }
            : { passed: false, detail: 'Chưa bật tuỳ chọn Lặp liên tục trong Thiết lập trình chiếu.' };
        },
      },
      {
        id: 'p3-t5',
        domainId: 'ppt-deliver',
        title: 'Thêm bình luận rà soát nội dung',
        instruction: 'Thêm ít nhất một Bình luận (Comment) vào bài thuyết trình để ghi chú kiểm duyệt.',
        ribbonPath: 'Xem lại → Bình luận mới',
        hint: 'Mở thẻ Xem lại (Review) → bấm Bình luận mới (hoặc Ctrl+Alt+M) → nhập nội dung nhận xét và gửi.',
        points: 20,
        check: (content) => {
          const slideComments = content.presentation.slides.reduce((sum, s) => sum + (s.comments?.length ?? 0), 0);
          const rootComments = content.comments?.length ?? 0;
          const total = slideComments + rootComments;
          return total > 0
            ? { passed: true, detail: `Đã ghi nhận ${total} bình luận rà soát.` }
            : { passed: false, detail: 'Chưa có bình luận nào được thêm vào bài thuyết trình.' };
        },
      },
    ],
  },
  {
    id: 'ppt-expert-kiosk',
    track: 'powerpoint',
    level: 'expert',
    kind: 'slide',
    order: 4,
    title: 'Trình chiếu Kiosk & Slide Master (Chuyên sâu)',
    fileName: 'Kiosk_TrienLam_2026.pptx',
    scenario: 'Bài thuyết trình chạy tự động tại gian hàng triển lãm: cấu hình Slide Master, tự chuyển trang theo giây, trình chiếu tuỳ chỉnh (Custom Show), chuỗi hoạt hình và phân phần.',
    minutes: 20,
    difficulty: 'Nâng cao',
    createStarter: buildExpertKioskStarter,
    tasks: [
      {
        id: 'p4-t1',
        domainId: 'ppt-deliver',
        title: 'Bật Slide Master với chân trang triển lãm',
        instruction: 'Mở Slide Master, bật áp dụng Slide Master, nhập chân trang chứa “Triển lãm 2026” và bật hiển thị Số trang.',
        ribbonPath: 'Xem (View) → Slide Master',
        hint: 'Mở thẻ Xem → bấm Slide Master, bật kích hoạt Slide Master, nhập “Triển lãm 2026” vào chân trang và bật Số trang rồi lưu.',
        points: 20,
        check: (content) => {
          const sm = content.presentation.slideMaster;
          const ok = Boolean(sm?.enabled && sm?.showSlideNumber && fold(sm?.footerText ?? '').includes('trien lam 2026'));
          return ok
            ? { passed: true, detail: `Slide Master đã bật với chân trang “${sm?.footerText}” và số trang.` }
            : { passed: false, detail: 'Chưa bật đủ Slide Master + Số trang + Chân trang chứa “Triển lãm 2026”.' };
        },
      },
      {
        id: 'p4-t2',
        domainId: 'ppt-motion',
        title: 'Tự động chuyển trang sau thời gian định sẵn',
        instruction: 'Bật tính năng tự động chuyển trang sau N giây (Advance After > 0) cho ít nhất 2 trang chiếu.',
        ribbonPath: 'Chuyển tiếp (Transitions) → bật Tự động chuyển sau (giây)',
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
        id: 'p4-t3',
        domainId: 'ppt-deliver',
        title: 'Tạo Trình chiếu tuỳ chỉnh (Custom Show)',
        instruction: 'Tạo ít nhất một Trình chiếu tuỳ chỉnh (Custom Show) chọn lọc các trang chiếu trọng tâm cho khách VIP.',
        ribbonPath: 'Trình chiếu (Slide Show) → Trình chiếu tuỳ chỉnh',
        hint: 'Mở thẻ Trình chiếu → bấm Trình chiếu tuỳ chỉnh → tạo một bộ chiếu mới, chọn ít nhất 2 trang chiếu và lưu.',
        points: 20,
        check: (content) => {
          const shows = content.presentation.customShows ?? [];
          const valid = shows.some((show) => show.slideIds.length > 0);
          return valid
            ? { passed: true, detail: `Đã tạo ${shows.length} bộ Trình chiếu tuỳ chỉnh.` }
            : { passed: false, detail: 'Chưa tạo bộ Trình chiếu tuỳ chỉnh (Custom Show) nào.' };
        },
      },
      {
        id: 'p4-t4',
        domainId: 'ppt-motion',
        title: 'Gắn tối thiểu 2 hoạt hình trên Slide 2',
        instruction: 'Trên Slide 2 (“Điểm nhấn sản phẩm chủ lực”), gắn hiệu ứng Hoạt hình cho ít nhất 2 đối tượng khác nhau (hoặc 2 bước hoạt hình).',
        ribbonPath: 'Chọn đối tượng trên Slide 2 → Hoạt hình (Animations)',
        hint: 'Chuyển sang Slide 2, chọn lần lượt khung nội dung và thẻ hình “Bản 2026 Mới”, mỗi đối tượng gắn một hiệu ứng trong thẻ Hoạt hình.',
        points: 20,
        check: (content) => {
          const slide = content.presentation.slides[1];
          const count = (slide?.elements ?? []).reduce((sum, el) => {
            const multi = (el.animations ?? []).filter((a) => a.type !== 'none').length;
            if (multi > 0) return sum + multi;
            return sum + (el.animation && el.animation.type !== 'none' ? 1 : 0);
          }, 0);
          return count >= 2
            ? { passed: true, detail: `Đã gắn ${count} hiệu ứng hoạt hình trên Slide 2.` }
            : { passed: false, detail: `Slide 2 mới có ${count} hiệu ứng hoạt hình, cần tối thiểu 2.` };
        },
      },
      {
        id: 'p4-t5',
        domainId: 'ppt-manage',
        title: 'Phân nhóm bài thuyết trình bằng Phần (Section)',
        instruction: 'Tạo ít nhất một Phần (Section) để tổ chức cấu trúc các trang chiếu trong bài thuyết trình.',
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
];
