import type { PresentationData, SlideData, SlideElement, SlideLayout } from './slideTypes';
import { SLIDE_THEMES } from './slideThemes';
import { getSettings } from './appSettings';
import { resolveThemeId } from './settings/slideOptions';

export function createSlideFromLayout(
  layout: SlideLayout,
  index: number,
  themeId = 'office-classic',
  customTitle?: string
): SlideData {
  const theme = SLIDE_THEMES[themeId] || SLIDE_THEMES['office-classic'];
  const slideId = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const elements: SlideElement[] = [];

  const titleFont = theme.titleFont;
  const bodyFont = theme.bodyFont;
  const titleColor = theme.titleColor;
  const textColor = theme.textColor;
  const primaryColor = theme.primaryColor;

  if (layout === 'title') {
    elements.push({
      id: `el-title-${Date.now()}-1`,
      type: 'text',
      x: 10,
      y: 30,
      width: 80,
      height: 25,
      text: customTitle || 'BÀI THUYẾT TRÌNH MỚI',
      fontSize: 44,
      fontFamily: titleFont,
      fontWeight: 'bold',
      color: primaryColor,
      textAlign: 'center',
      isTitle: true,
      placeholder: 'Bấm để thêm tiêu đề',
    });
    elements.push({
      id: `el-sub-${Date.now()}-2`,
      type: 'text',
      x: 15,
      y: 58,
      width: 70,
      height: 18,
      text: 'Office 23 · Nhập tiêu đề phụ hoặc tên người trình bày tại đây',
      fontSize: 20,
      fontFamily: bodyFont,
      color: textColor,
      textAlign: 'center',
      placeholder: 'Bấm để thêm phụ đề',
    });
  } else if (layout === 'title-content') {
    elements.push({
      id: `el-title-${Date.now()}-1`,
      type: 'text',
      x: 8,
      y: 8,
      width: 84,
      height: 14,
      text: customTitle || `Tiêu đề trang chiếu ${index + 1}`,
      fontSize: 32,
      fontFamily: titleFont,
      fontWeight: 'bold',
      color: titleColor,
      textAlign: 'left',
      isTitle: true,
      placeholder: 'Bấm để thêm tiêu đề',
    });
    elements.push({
      id: `el-content-${Date.now()}-2`,
      type: 'text',
      x: 8,
      y: 26,
      width: 84,
      height: 64,
      text: '• Nhập nội dung chính của trang chiếu tại đây\n• Bấm Enter để tạo mục dấu đầu dòng mới\n• Có thể tuỳ chỉnh cỡ chữ, màu sắc và kiểu phông chữ\n• Thêm hình ảnh, bảng biểu hoặc biểu đồ từ thanh công cụ',
      fontSize: 22,
      fontFamily: bodyFont,
      color: textColor,
      textAlign: 'left',
      lineHeight: 1.6,
      placeholder: 'Bấm để thêm nội dung văn bản',
    });
  } else if (layout === 'section') {
    elements.push({
      id: `el-sec-${Date.now()}-1`,
      type: 'text',
      x: 12,
      y: 36,
      width: 76,
      height: 20,
      text: customTitle || 'PHẦN NỘI DUNG MỚI',
      fontSize: 40,
      fontFamily: titleFont,
      fontWeight: 'bold',
      color: primaryColor,
      textAlign: 'center',
      isTitle: true,
    });
    elements.push({
      id: `el-desc-${Date.now()}-2`,
      type: 'text',
      x: 18,
      y: 58,
      width: 64,
      height: 16,
      text: 'Mô tả ngắn gọn mục tiêu và các nội dung chính trong phần này',
      fontSize: 20,
      fontFamily: bodyFont,
      color: textColor,
      textAlign: 'center',
    });
  } else if (layout === 'two-content') {
    elements.push({
      id: `el-title-${Date.now()}-1`,
      type: 'text',
      x: 8,
      y: 8,
      width: 84,
      height: 14,
      text: customTitle || 'So sánh hai nội dung',
      fontSize: 32,
      fontFamily: titleFont,
      fontWeight: 'bold',
      color: titleColor,
      textAlign: 'left',
      isTitle: true,
    });
    elements.push({
      id: `el-col1-${Date.now()}-2`,
      type: 'text',
      x: 8,
      y: 26,
      width: 40,
      height: 64,
      text: '• Khối nội dung thứ nhất\n• Các luận điểm quan trọng\n• Số liệu phân tích\n• Kết quả đạt được',
      fontSize: 20,
      fontFamily: bodyFont,
      color: textColor,
      lineHeight: 1.6,
    });
    elements.push({
      id: `el-col2-${Date.now()}-3`,
      type: 'text',
      x: 52,
      y: 26,
      width: 40,
      height: 64,
      text: '• Khối nội dung thứ hai\n• Định hướng tiếp theo\n• Đánh giá tiềm năng\n• Hành động cụ thể',
      fontSize: 20,
      fontFamily: bodyFont,
      color: textColor,
      lineHeight: 1.6,
    });
  } else if (layout === 'comparison') {
    elements.push({
      id: `el-title-${Date.now()}-1`,
      type: 'text',
      x: 8,
      y: 8,
      width: 84,
      height: 14,
      text: customTitle || 'Bảng so sánh phương án',
      fontSize: 32,
      fontFamily: titleFont,
      fontWeight: 'bold',
      color: titleColor,
      textAlign: 'left',
      isTitle: true,
    });
    // Header 1
    elements.push({
      id: `el-h1-${Date.now()}-2`,
      type: 'text',
      x: 8,
      y: 24,
      width: 40,
      height: 10,
      text: 'Phương án A (Hiện tại)',
      fontSize: 22,
      fontFamily: titleFont,
      fontWeight: 'bold',
      color: primaryColor,
      textAlign: 'center',
    });
    // Box 1
    elements.push({
      id: `el-c1-${Date.now()}-3`,
      type: 'text',
      x: 8,
      y: 36,
      width: 40,
      height: 54,
      text: '• Chi phí ban đầu thấp\n• Quy trình quen thuộc\n• Thời gian triển khai nhanh\n• Hạn chế về khả năng mở rộng',
      fontSize: 18,
      fontFamily: bodyFont,
      color: textColor,
      lineHeight: 1.6,
    });
    // Header 2
    elements.push({
      id: `el-h2-${Date.now()}-4`,
      type: 'text',
      x: 52,
      y: 24,
      width: 40,
      height: 10,
      text: 'Phương án B (Đề xuất)',
      fontSize: 22,
      fontFamily: titleFont,
      fontWeight: 'bold',
      color: '#10B981',
      textAlign: 'center',
    });
    // Box 2
    elements.push({
      id: `el-c2-${Date.now()}-5`,
      type: 'text',
      x: 52,
      y: 36,
      width: 40,
      height: 54,
      text: '• Tự động hoá 85% tác vụ\n• Tiết kiệm 40% chi phí dài hạn\n• Nâng cao năng suất toàn diện\n• Dễ dàng mở rộng toàn công ty',
      fontSize: 18,
      fontFamily: bodyFont,
      color: textColor,
      lineHeight: 1.6,
    });
  } else if (layout === 'title-only') {
    elements.push({
      id: `el-title-${Date.now()}-1`,
      type: 'text',
      x: 8,
      y: 8,
      width: 84,
      height: 14,
      text: customTitle || 'Tiêu đề trang',
      fontSize: 32,
      fontFamily: titleFont,
      fontWeight: 'bold',
      color: titleColor,
      textAlign: 'left',
      isTitle: true,
    });
  } else if (layout === 'content-caption') {
    elements.push({
      id: `el-title-${Date.now()}-1`,
      type: 'text',
      x: 8,
      y: 8,
      width: 84,
      height: 14,
      text: customTitle || 'Nội dung và chú thích',
      fontSize: 32,
      fontFamily: titleFont,
      fontWeight: 'bold',
      color: titleColor,
      textAlign: 'left',
      isTitle: true,
    });
    elements.push({
      id: `el-box-${Date.now()}-2`,
      type: 'shape',
      shapeType: 'rounded-rectangle',
      x: 8,
      y: 25,
      width: 54,
      height: 65,
      fill: theme.cardBackground,
      stroke: theme.accentColor,
      strokeWidth: 1,
      borderRadius: 12,
    });
    elements.push({
      id: `el-cap-${Date.now()}-3`,
      type: 'text',
      x: 66,
      y: 28,
      width: 26,
      height: 60,
      text: 'Chú thích chi tiết\n\nPhần diễn giải này giúp người xem nắm bắt ngữ cảnh và số liệu cụ thể được trình bày ở khung bên cạnh.',
      fontSize: 18,
      fontFamily: bodyFont,
      color: textColor,
      lineHeight: 1.6,
    });
  } else if (layout === 'picture-caption') {
    elements.push({
      id: `el-title-${Date.now()}-1`,
      type: 'text',
      x: 8,
      y: 8,
      width: 84,
      height: 14,
      text: customTitle || 'Hình ảnh & Minh hoạ',
      fontSize: 32,
      fontFamily: titleFont,
      fontWeight: 'bold',
      color: titleColor,
      textAlign: 'left',
      isTitle: true,
    });
    elements.push({
      id: `el-img-holder-${Date.now()}-2`,
      type: 'shape',
      shapeType: 'rounded-rectangle',
      x: 8,
      y: 25,
      width: 58,
      height: 65,
      fill: '#E2E8F0',
      stroke: '#CBD5E1',
      strokeWidth: 2,
      text: '📷 Bấm vào thẻ "Chèn" để thêm hình ảnh',
      color: '#64748B',
      borderRadius: 8,
    });
    elements.push({
      id: `el-caption-${Date.now()}-3`,
      type: 'text',
      x: 70,
      y: 28,
      width: 22,
      height: 58,
      text: 'Mô tả hình ảnh\n\nGhi chú nguồn gốc, thời gian chụp hoặc ý nghĩa của hình ảnh minh hoạ.',
      fontSize: 18,
      fontFamily: bodyFont,
      color: textColor,
      lineHeight: 1.5,
    });
  }

  return {
    id: slideId,
    layout,
    background: {
      type: 'solid',
      value: theme.backgroundColor,
    },
    elements,
    notes: '',
    transition: {
      type: 'none',
      duration: 0.5,
    },
  };
}

export function blankPresentation(): PresentationData {
  const settings = getSettings();
  const themeId = resolveThemeId(settings.slideNewTheme, SLIDE_THEMES);
  return {
    aspectRatio: settings.slideNewAspect === '4:3' ? '4:3' : '16:9',
    themeId,
    title: 'Bài thuyết trình mới',
    slides: [createSlideFromLayout('title', 0, themeId)],
  };
}

export function businessPitchPresentation(): PresentationData {
  const themeId = 'sapphire-modern';
  const theme = SLIDE_THEMES[themeId];

  // Slide 1: Cover
  const slide1: SlideData = {
    id: 'pitch-s1',
    layout: 'title',
    background: { type: 'solid', value: theme.backgroundColor },
    transition: { type: 'fade', duration: 0.5 },
    notes: 'Kính chào ban lãnh đạo và các nhà đầu tư. Hôm nay em xin đại diện nhóm trình bày chiến lược kinh doanh 2026.',
    elements: [
      {
        id: 'p1-t',
        type: 'text',
        x: 10,
        y: 28,
        width: 80,
        height: 24,
        text: 'CHIẾN LƯỢC KINH DOANH & TĂNG TRƯỞNG 2026',
        fontSize: 42,
        fontFamily: theme.titleFont,
        fontWeight: 'bold',
        color: '#38BDF8',
        textAlign: 'center',
        isTitle: true,
      },
      {
        id: 'p1-sub',
        type: 'text',
        x: 15,
        y: 56,
        width: 70,
        height: 16,
        text: 'CÔNG TY MINH SPARK · BÁO CÁO ĐỊNH HƯỚNG PHÁT TRIỂN NĂM 2026',
        fontSize: 20,
        fontFamily: theme.bodyFont,
        color: '#94A3B8',
        textAlign: 'center',
      },
      {
        id: 'p1-badge',
        type: 'shape',
        shapeType: 'rounded-rectangle',
        x: 40,
        y: 76,
        width: 20,
        height: 8,
        fill: '#0284C7',
        text: 'MẬT - NỘI BỘ',
        color: '#FFFFFF',
        borderRadius: 20,
      },
    ],
  };

  // Slide 2: KPI & Metrics (3 Stat cards)
  const slide2: SlideData = {
    id: 'pitch-s2',
    layout: 'title-only',
    background: { type: 'solid', value: theme.backgroundColor },
    transition: { type: 'push', duration: 0.6 },
    notes: 'Điểm lại kết quả nổi bật: doanh thu tăng 240%, đạt 150 tỷ VNĐ và mở rộng cộng đồng lên nửa triệu người dùng.',
    elements: [
      {
        id: 'p2-t',
        type: 'text',
        x: 8,
        y: 8,
        width: 84,
        height: 12,
        text: 'MỤC TIÊU VÀ KẾT QUẢ ĐẠT ĐƯỢC',
        fontSize: 32,
        fontFamily: theme.titleFont,
        fontWeight: 'bold',
        color: '#F8FAFC',
        isTitle: true,
      },
      // Card 1
      {
        id: 'p2-c1',
        type: 'shape',
        shapeType: 'rounded-rectangle',
        x: 8,
        y: 26,
        width: 26,
        height: 60,
        fill: 'rgba(30, 41, 59, 0.9)',
        stroke: '#0284C7',
        strokeWidth: 2,
        borderRadius: 16,
      },
      {
        id: 'p2-c1-num',
        type: 'text',
        x: 10,
        y: 35,
        width: 22,
        height: 18,
        text: '150 TỶ',
        fontSize: 36,
        fontWeight: 'bold',
        color: '#38BDF8',
        textAlign: 'center',
      },
      {
        id: 'p2-c1-desc',
        type: 'text',
        x: 10,
        y: 56,
        width: 22,
        height: 24,
        text: 'Doanh thu kế hoạch năm 2026 với biên lợi nhuận ròng 32%',
        fontSize: 16,
        color: '#CBD5E1',
        textAlign: 'center',
        lineHeight: 1.4,
      },
      // Card 2
      {
        id: 'p2-c2',
        type: 'shape',
        shapeType: 'rounded-rectangle',
        x: 37,
        y: 26,
        width: 26,
        height: 60,
        fill: 'rgba(30, 41, 59, 0.9)',
        stroke: '#10B981',
        strokeWidth: 2,
        borderRadius: 16,
      },
      {
        id: 'p2-c2-num',
        type: 'text',
        x: 39,
        y: 35,
        width: 22,
        height: 18,
        text: '+240%',
        fontSize: 36,
        fontWeight: 'bold',
        color: '#34D399',
        textAlign: 'center',
      },
      {
        id: 'p2-c2-desc',
        type: 'text',
        x: 39,
        y: 56,
        width: 22,
        height: 24,
        text: 'Tốc độ tăng trưởng so với cùng kỳ năm trước nhờ đẩy mạnh chuyển đổi số',
        fontSize: 16,
        color: '#CBD5E1',
        textAlign: 'center',
        lineHeight: 1.4,
      },
      // Card 3
      {
        id: 'p2-c3',
        type: 'shape',
        shapeType: 'rounded-rectangle',
        x: 66,
        y: 26,
        width: 26,
        height: 60,
        fill: 'rgba(30, 41, 59, 0.9)',
        stroke: '#F59E0B',
        strokeWidth: 2,
        borderRadius: 16,
      },
      {
        id: 'p2-c3-num',
        type: 'text',
        x: 68,
        y: 35,
        width: 22,
        height: 18,
        text: '500.000+',
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FBBF24',
        textAlign: 'center',
      },
      {
        id: 'p2-c3-desc',
        type: 'text',
        x: 68,
        y: 56,
        width: 22,
        height: 24,
        text: 'Người dùng doanh nghiệp và cá nhân tin tưởng sử dụng hàng ngày',
        fontSize: 16,
        color: '#CBD5E1',
        textAlign: 'center',
        lineHeight: 1.4,
      },
    ],
  };

  // Slide 3: Growth Chart
  const slide3: SlideData = {
    id: 'pitch-s3',
    layout: 'title-content',
    background: { type: 'solid', value: theme.backgroundColor },
    transition: { type: 'wipe', duration: 0.6 },
    notes: 'Biểu đồ phản ánh sự bứt phá mạnh mẽ từ Q2 đến Q4 sau khi ra mắt phiên bản mới.',
    elements: [
      {
        id: 'p3-t',
        type: 'text',
        x: 8,
        y: 8,
        width: 84,
        height: 12,
        text: 'DOANH THU THEO QUÝ NĂM 2026 (TỶ ĐỒNG)',
        fontSize: 30,
        fontFamily: theme.titleFont,
        fontWeight: 'bold',
        color: '#F8FAFC',
        isTitle: true,
      },
      {
        id: 'p3-chart',
        type: 'chart',
        chartType: 'column',
        chartTitle: 'Doanh thu thực tế vs Mục tiêu',
        chartCategories: ['Quý I', 'Quý II', 'Quý III', 'Quý IV'],
        chartSeries: [
          { name: 'Mục tiêu', values: [25, 35, 40, 50], color: '#64748B' },
          { name: 'Thực tế', values: [28, 42, 52, 65], color: '#0284C7' },
        ],
        x: 10,
        y: 25,
        width: 80,
        height: 65,
      },
    ],
  };

  // Slide 4: 4-step Process (SmartArt)
  const slide4: SlideData = {
    id: 'pitch-s4',
    layout: 'title-content',
    background: { type: 'solid', value: theme.backgroundColor },
    transition: { type: 'fade', duration: 0.5 },
    notes: 'Lộ trình hành động gồm 4 giai đoạn rõ ràng: Khảo sát, Phát triển, Triển khai và Mở rộng.',
    elements: [
      {
        id: 'p4-t',
        type: 'text',
        x: 8,
        y: 8,
        width: 84,
        height: 12,
        text: 'LỘ TRÌNH TRIỂN KHAI 4 BƯỚC',
        fontSize: 30,
        fontFamily: theme.titleFont,
        fontWeight: 'bold',
        color: '#F8FAFC',
        isTitle: true,
      },
      {
        id: 'p4-smartart',
        type: 'smartart',
        smartArtType: 'process',
        smartArtItems: [
          { title: 'Bước 1: Khảo sát', desc: 'Đánh giá nhu cầu người dùng và thị trường mục tiêu', color: '#0284C7' },
          { title: 'Bước 2: Phát triển', desc: 'Xây dựng tính năng cốt lõi với chuẩn bảo mật cao', color: '#059669' },
          { title: 'Bước 3: Ra mắt', desc: 'Chiến dịch truyền thông đa kênh toàn quốc', color: '#D97706' },
          { title: 'Bước 4: Mở rộng', desc: 'Tối ưu hoá doanh thu và mở rộng hệ sinh thái', color: '#7C3AED' },
        ],
        x: 6,
        y: 28,
        width: 88,
        height: 60,
      },
    ],
  };

  // Slide 5: Conclusion
  const slide5: SlideData = {
    id: 'pitch-s5',
    layout: 'title',
    background: { type: 'solid', value: theme.backgroundColor },
    transition: { type: 'zoom', duration: 0.6 },
    notes: 'Xin trân trọng cảm ơn quý vị đã lắng nghe. Rất mong nhận được câu hỏi và đóng góp.',
    elements: [
      {
        id: 'p5-t',
        type: 'text',
        x: 10,
        y: 32,
        width: 80,
        height: 22,
        text: 'XIN TRÂN TRỌNG CẢM ƠN!',
        fontSize: 44,
        fontFamily: theme.titleFont,
        fontWeight: 'bold',
        color: '#38BDF8',
        textAlign: 'center',
        isTitle: true,
      },
      {
        id: 'p5-sub',
        type: 'text',
        x: 15,
        y: 58,
        width: 70,
        height: 16,
        text: 'CÔNG TY MINH SPARK · SẴN SÀNG ĐỒNG HÀNH CÙNG PHÁT TRIỂN',
        fontSize: 20,
        fontFamily: theme.bodyFont,
        color: '#CBD5E1',
        textAlign: 'center',
      },
    ],
  };

  return {
    aspectRatio: '16:9',
    themeId,
    title: 'Kế hoạch phát triển & Báo cáo quý.pptx',
    slides: [slide1, slide2, slide3, slide4, slide5],
  };
}

export function productLaunchPresentation(): PresentationData {
  const themeId = 'office-classic';
  const theme = SLIDE_THEMES[themeId];

  const slide1: SlideData = {
    id: 'prod-s1',
    layout: 'title',
    background: { type: 'solid', value: '#FFF7ED' },
    transition: { type: 'fade', duration: 0.5 },
    notes: 'Buổi ra mắt sản phẩm giải pháp văn phòng đám mây thế hệ mới.',
    elements: [
      {
        id: 'pr-t',
        type: 'text',
        x: 10,
        y: 28,
        width: 80,
        height: 22,
        text: 'RA MẮT OFFICE 23',
        fontSize: 44,
        fontFamily: theme.titleFont,
        fontWeight: 'bold',
        color: '#D83B01',
        textAlign: 'center',
        isTitle: true,
      },
      {
        id: 'pr-sub',
        type: 'text',
        x: 15,
        y: 54,
        width: 70,
        height: 18,
        text: 'Hệ sinh thái Docs, Sheets, PDF & Slides hoàn hảo trên mọi nền tảng',
        fontSize: 22,
        fontFamily: theme.bodyFont,
        color: '#475569',
        textAlign: 'center',
      },
    ],
  };

  const slide2: SlideData = {
    id: 'prod-s2',
    layout: 'title-content',
    background: { type: 'solid', value: '#FFFFFF' },
    transition: { type: 'push', duration: 0.5 },
    notes: 'Bảng giá và các gói dịch vụ linh hoạt cho cá nhân và doanh nghiệp.',
    elements: [
      {
        id: 'pr-t2',
        type: 'text',
        x: 8,
        y: 8,
        width: 84,
        height: 12,
        text: 'CÁC GÓI TÍNH NĂNG VÀ BẢNG GIÁ',
        fontSize: 32,
        fontFamily: theme.titleFont,
        fontWeight: 'bold',
        color: '#1E293B',
        isTitle: true,
      },
      {
        id: 'pr-tbl',
        type: 'table',
        tableRows: 4,
        tableCols: 4,
        tableHeaderRow: true,
        tableHeaderColor: '#D83B01',
        tableHeaderTextColor: '#FFFFFF',
        tableData: [
          ['Tính năng', 'Cá nhân', 'Nhóm Pro', 'Doanh nghiệp'],
          ['Soạn thảo văn bản & bảng tính', 'Miễn phí', 'Không giới hạn', 'Tuỳ chỉnh cao cấp'],
          ['Bảo mật & Ký số văn bản', 'Cơ bản', 'Chữ ký điện tử', 'Ký số pháp lý HSM'],
          ['Đồng bộ đám mây', '5 GB', '50 GB', 'Không giới hạn'],
        ],
        x: 10,
        y: 25,
        width: 80,
        height: 60,
      },
    ],
  };

  return {
    aspectRatio: '16:9',
    themeId,
    title: 'Ra mắt sản phẩm mới.pptx',
    slides: [slide1, slide2],
  };
}
