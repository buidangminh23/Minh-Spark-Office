import type { JSONContent } from '@tiptap/react';
import { basePage, type DocContent } from '../storage';
import type { MosWordProject } from './types';

function collectNodes(node: JSONContent | null | undefined, out: JSONContent[] = []): JSONContent[] {
  if (!node || typeof node !== 'object') return out;
  out.push(node);
  if (Array.isArray(node.content)) {
    for (const child of node.content) collectNodes(child, out);
  }
  return out;
}

function nodeText(node: JSONContent | null | undefined): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  return node.content.map(nodeText).join('');
}

function fullDocText(content: DocContent): string {
  const raw: unknown = content.json;
  if (typeof raw === 'string') return raw.replace(/<[^>]+>/g, ' ');
  return collectNodes(content.json)
    .filter((item) => item.type === 'paragraph' || item.type === 'heading' || item.type === 'tableCell' || item.type === 'tableHeader')
    .map(nodeText)
    .join('\n');
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function para(text: string, attrs?: Record<string, unknown>, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>): JSONContent {
  const content = text ? [{ type: 'text', text, ...(marks ? { marks } : {}) }] : [];
  return { type: 'paragraph', ...(attrs ? { attrs } : {}), ...(content.length ? { content } : {}) };
}

function heading(level: 1 | 2 | 3, text: string, attrs?: Record<string, unknown>): JSONContent {
  return {
    type: 'heading',
    attrs: { level, ...(attrs ?? {}) },
    content: [{ type: 'text', text }],
  };
}

export const MOS_WORD_PROJECTS: MosWordProject[] = [
  {
    id: 'word-green-summit',
    track: 'word',
    level: 'associate',
    kind: 'doc',
    order: 1,
    title: 'Báo cáo Hội nghị Công nghệ Xanh',
    fileName: 'BaoCao_HoiNghi_Xanh.docx',
    scenario: 'Bạn đang hoàn thiện tài liệu giới thiệu Hội nghị Công nghệ Xanh 2026 trước khi gửi ban tổ chức duyệt in và phát hành.',
    minutes: 15,
    difficulty: 'Cơ bản',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), orientation: 'portrait', margins: { top: 96, right: 96, bottom: 96, left: 96 }, pageNumbers: true, watermark: '', properties: {} },
      comments: [],
      json: {
        type: 'doc',
        content: [
          para('Tổng quan chương trình'),
          para('Hội nghị Công nghệ Xanh 2026 quy tụ hơn 400 kỹ sư, nhà hoạch định chính sách và doanh nghiệp năng lượng sạch tại Việt Nam nhằm thảo luận lộ trình trung hoà carbon.'),
          heading(2, 'Mục tiêu chiến lược'),
          para('Tăng tỷ lệ ứng dụng điện mặt trời áp mái trong khu công nghiệp thêm 25% và triển khai hệ thống giám sát phát thải thời gian thực.'),
          heading(2, 'Lịch trình phiên thảo luận'),
          para('Phiên sáng tập trung vào hạ tầng lưới điện thông minh; phiên chiều trình diễn các giải pháp tiết kiệm năng lượng cho toà nhà văn phòng.'),
          heading(2, 'Danh sách diễn giả chính'),
          para('Đại diện Viện Năng lượng Quốc gia, nhóm phát triển nền tảng Office 23 và các chuyên gia hạ tầng đô thị.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'w1-t1',
        domainId: 'word-manage',
        title: 'Hướng giấy ngang và lề hẹp',
        instruction: 'Đổi hướng trang của toàn bộ tài liệu sang Ngang (Landscape) và đặt lề trang theo mẫu Hẹp (Narrow — 1,27 cm mỗi phía).',
        ribbonPath: 'Bố cục → Hướng → Ngang · Bố cục → Lề → Hẹp',
        hint: 'Mở thẻ Bố cục (Layout), chọn Hướng → Ngang. Tiếp đó bấm Lề → chọn Hẹp (1,27 cm mọi phía).',
        points: 20,
        check: (content) => {
          const isLandscape = content.page.orientation === 'landscape';
          const m = content.page.margins;
          const isNarrow = m.top <= 56 && m.bottom <= 56 && m.left <= 56 && m.right <= 56;
          if (isLandscape && isNarrow) return { passed: true, detail: 'Đã thiết lập hướng Ngang và lề Hẹp đúng chuẩn.' };
          const issues: string[] = [];
          if (!isLandscape) issues.push('hướng giấy vẫn đang là Dọc');
          if (!isNarrow) issues.push(`lề hiện tại chưa ở mức Hẹp (${Math.round(m.left / 37.8 * 100) / 100} cm)`);
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w1-t2',
        domainId: 'word-manage',
        title: 'Chèn hình mờ (Watermark)',
        instruction: 'Áp dụng hình mờ (Watermark) có chữ “BẢN NHÁP” hoặc “CONFIDENTIAL” cho toàn bộ tài liệu.',
        ribbonPath: 'Thiết kế → Hình mờ',
        hint: 'Mở thẻ Thiết kế (Design), bấm Hình mờ ở nhóm Nền trang rồi chọn BẢN NHÁP hoặc CONFIDENTIAL.',
        points: 20,
        check: (content) => {
          const wm = (content.page.watermark ?? '').trim();
          const norm = fold(wm);
          const ok = norm.includes('ban nhap') || norm.includes('confidential') || norm.includes('draft');
          return ok
            ? { passed: true, detail: `Đã gắn hình mờ “${wm}”.` }
            : { passed: false, detail: wm ? `Hình mờ hiện là “${wm}”, cần là BẢN NHÁP hoặc CONFIDENTIAL.` : 'Tài liệu chưa có hình mờ.' };
        },
      },
      {
        id: 'w1-t3',
        domainId: 'word-manage',
        title: 'Thêm thuộc tính tài liệu',
        instruction: 'Trong thông tin mô tả tài liệu, nhập Chủ đề (Subject) chứa “Hội nghị Xanh” và Từ khoá (Keywords) chứa “MOS”.',
        ribbonPath: 'Tệp → Thông tin → Thông tin mô tả',
        hint: 'Bấm nút Tệp ở góc trái thanh Ribbon → chọn mục Thông tin → điền ô Chủ đề và ô Từ khoá trong khung Thông tin mô tả.',
        points: 20,
        check: (content) => {
          const subject = content.page.properties?.subject ?? '';
          const keywords = content.page.properties?.keywords ?? '';
          const hasSubject = fold(subject).includes('hoi nghi xanh');
          const hasKeyword = fold(keywords).includes('mos');
          if (hasSubject && hasKeyword) return { passed: true, detail: `Đã cập nhật Chủ đề (“${subject}”) và Từ khoá (“${keywords}”).` };
          const missing: string[] = [];
          if (!hasSubject) missing.push('Chủ đề chưa chứa “Hội nghị Xanh”');
          if (!hasKeyword) missing.push('Từ khoá chưa chứa “MOS”');
          return { passed: false, detail: `Chưa đạt: ${missing.join('; ')}.` };
        },
      },
      {
        id: 'w1-t4',
        domainId: 'word-format',
        title: 'Áp dụng kiểu Heading 1 và căn giữa',
        instruction: 'Áp dụng kiểu Heading 1 cho dòng “Tổng quan chương trình” và căn giữa (Center) dòng tiêu đề này.',
        ribbonPath: 'Trang chủ → Kiểu → Heading 1 · Trang chủ → Căn giữa',
        hint: 'Đặt con trỏ vào dòng “Tổng quan chương trình”, vào thẻ Trang chủ, bấm kiểu Heading 1 trong nhóm Kiểu, sau đó bấm biểu tượng Căn giữa.',
        points: 20,
        check: (content) => {
          const nodes = collectNodes(content.json);
          const match = nodes.find((n) => n.type === 'heading' && Number(n.attrs?.level) === 1 && fold(nodeText(n)).includes('tong quan chuong trinh'));
          if (!match) return { passed: false, detail: 'Chưa thấy dòng “Tổng quan chương trình” ở kiểu Heading 1.' };
          const centered = match.attrs?.textAlign === 'center';
          return centered
            ? { passed: true, detail: 'Dòng “Tổng quan chương trình” đã là Heading 1 và căn giữa.' }
            : { passed: false, detail: 'Đã đổi sang Heading 1 nhưng tiêu đề chưa được căn giữa.' };
        },
      },
      {
        id: 'w1-t5',
        domainId: 'word-refs',
        title: 'Chèn mục lục tự động',
        instruction: 'Chèn một Mục lục tự động (Table of Contents) vào tài liệu để liệt kê toàn bộ các tiêu đề chính.',
        ribbonPath: 'Tham chiếu → Mục lục → Mục lục tự động 1',
        hint: 'Đặt con trỏ ở vị trí muốn hiển thị mục lục, mở thẻ Tham chiếu (References) → bấm Mục lục → chọn Mục lục tự động 1 hoặc 2.',
        points: 20,
        check: (content) => {
          const nodes = collectNodes(content.json);
          const hasToc = nodes.some((n) => n.type === 'tableOfContents');
          return hasToc
            ? { passed: true, detail: 'Đã chèn khối Mục lục tự động vào tài liệu.' }
            : { passed: false, detail: 'Chưa tìm thấy Mục lục tự động trong tài liệu.' };
        },
      },
    ],
  },
  {
    id: 'word-training-proposal',
    track: 'word',
    level: 'associate',
    kind: 'doc',
    order: 2,
    title: 'Đề xuất Đào tạo Nhân sự 2026',
    fileName: 'DeXuat_DaoTao_2026.docx',
    scenario: 'Phòng Nhân sự cần định dạng đề xuất chương trình đào tạo kỹ năng số với bố cục báo chí hai cột, bảng lịch trình và chú thích nguồn.',
    minutes: 15,
    difficulty: 'Trung bình',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), columns: 1, header: '', footer: '', pageNumbers: false, pageBorder: 'none', themeId: 'office' },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'Đề xuất Chương trình Đào tạo Kỹ năng Số 2026'),
          para('Chương trình nhằm nâng cao năng lực xử lý văn bản, phân tích bảng tính và thuyết trình cho toàn bộ nhân sự khối vận hành theo chuẩn quốc tế MOS.'),
          heading(2, 'Phạm vi triển khai'),
          para('Gồm 3 học phần trọng tâm: soạn thảo văn bản chuẩn hoá, xây dựng mô hình báo cáo tài chính bằng công thức động và thiết kế bài thuyết trình thuyết phục.'),
          heading(2, 'Lịch trình đào tạo dự kiến'),
          para('Vui lòng chèn bảng lịch trình chi tiết ngay dưới đoạn này trước khi trình ban giám đốc phê duyệt.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'w2-t1',
        domainId: 'word-manage',
        title: 'Chia bố cục hai cột',
        instruction: 'Thiết lập toàn bộ tài liệu hiển thị theo bố cục Hai cột (Two Columns).',
        ribbonPath: 'Bố cục → Cột → Hai cột',
        hint: 'Mở thẻ Bố cục (Layout), bấm nút Cột → chọn Hai cột ở mục Cả tài liệu.',
        points: 20,
        check: (content) => {
          const cols = content.page.columns ?? 1;
          const hasColSection = collectNodes(content.json).some((n) => n.type === 'columnSection' && Number(n.attrs?.columns) === 2);
          return cols === 2 || hasColSection
            ? { passed: true, detail: 'Đã áp dụng bố cục 2 cột.' }
            : { passed: false, detail: `Bố cục hiện tại đang là ${cols} cột, cần thiết lập 2 cột.` };
        },
      },
      {
        id: 'w2-t2',
        domainId: 'word-refs',
        title: 'Đầu trang và đánh số trang',
        instruction: 'Thiết lập Đầu trang (Header) chứa nội dung “Minh Spark Academy” và bật hiển thị Số trang.',
        ribbonPath: 'Bố cục → Đầu/chân trang',
        hint: 'Mở thẻ Bố cục → bấm Đầu/chân trang (hoặc thẻ Chèn → Đầu trang), nhập “Minh Spark Academy” vào ô Đầu trang và đánh dấu bật Số trang.',
        points: 20,
        check: (content) => {
          const header = content.page.header ?? '';
          const hasHeader = fold(header).includes('minh spark academy');
          const hasNum = Boolean(content.page.pageNumbers);
          if (hasHeader && hasNum) return { passed: true, detail: `Đầu trang “${header}” và số trang đã được bật.` };
          const issues: string[] = [];
          if (!hasHeader) issues.push('Đầu trang chưa chứa “Minh Spark Academy”');
          if (!hasNum) issues.push('chưa bật Số trang');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w2-t3',
        domainId: 'word-tables',
        title: 'Chèn bảng lịch trình 3 cột × 4 dòng',
        instruction: 'Chèn một bảng dữ liệu có tối thiểu 3 cột và 4 dòng vào tài liệu để trình bày lịch đào tạo.',
        ribbonPath: 'Chèn → Bảng',
        hint: 'Đặt con trỏ cuối tài liệu, mở thẻ Chèn (Insert) → bấm Bảng → kéo chọn vùng tối thiểu 3×4 hoặc bấm Chèn bảng… rồi nhập 3 cột, 4 dòng.',
        points: 20,
        check: (content) => {
          const tables = collectNodes(content.json).filter((n) => n.type === 'table');
          if (!tables.length) return { passed: false, detail: 'Tài liệu chưa có bảng dữ liệu nào.' };
          const best = tables.reduce((acc, tbl) => {
            const rows = (tbl.content ?? []).filter((r) => r.type === 'tableRow');
            const cols = rows.reduce((maxC, r) => Math.max(maxC, (r.content ?? []).length), 0);
            return rows.length * cols > acc.rows * acc.cols ? { rows: rows.length, cols } : acc;
          }, { rows: 0, cols: 0 });
          return best.rows >= 4 && best.cols >= 3
            ? { passed: true, detail: `Đã tìm thấy bảng ${best.cols} cột × ${best.rows} dòng.` }
            : { passed: false, detail: `Bảng hiện có ${best.cols} cột × ${best.rows} dòng, cần tối thiểu 3 cột × 4 dòng.` };
        },
      },
      {
        id: 'w2-t4',
        domainId: 'word-refs',
        title: 'Chèn chú thích cuối trang (Footnote)',
        instruction: 'Chèn ít nhất một Chú thích cuối trang (Footnote) giải thích về chuẩn chứng chỉ MOS.',
        ribbonPath: 'Tham chiếu → Chèn chú thích',
        hint: 'Đặt con trỏ sau cụm từ “chuẩn quốc tế MOS”, mở thẻ Tham chiếu (References) → bấm Chèn chú thích và nhập nội dung giải thích.',
        points: 20,
        check: (content) => {
          const notes = collectNodes(content.json).filter((n) => n.type === 'footnote' && String(n.attrs?.text ?? '').trim().length > 0);
          return notes.length > 0
            ? { passed: true, detail: `Đã chèn ${notes.length} chú thích vào tài liệu.` }
            : { passed: false, detail: 'Chưa có chú thích cuối trang nào được chèn.' };
        },
      },
      {
        id: 'w2-t5',
        domainId: 'word-format',
        title: 'Áp dụng Chủ đề và Viền trang',
        instruction: 'Đổi Chủ đề (Theme) tài liệu sang một chủ đề bất kỳ khác mặc định “Office” và bật Viền trang (Page Border).',
        ribbonPath: 'Thiết kế → Chủ đề · Thiết kế → Viền trang',
        hint: 'Mở thẻ Thiết kế (Design), bấm Chủ đề và chọn ví dụ Ion / Khía cạnh / Tích hợp; sau đó bấm Viền trang để chọn kiểu khung viền.',
        points: 20,
        check: (content) => {
          const themeOk = Boolean(content.page.themeId && content.page.themeId !== 'office');
          const borderOk = Boolean(content.page.pageBorder && content.page.pageBorder !== 'none');
          if (themeOk && borderOk) return { passed: true, detail: `Đã đổi chủ đề (${content.page.themeId}) và bật viền trang (${content.page.pageBorder}).` };
          const issues: string[] = [];
          if (!themeOk) issues.push('Chủ đề vẫn đang là mặc định Office');
          if (!borderOk) issues.push('chưa bật Viền trang');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
    ],
  },
  {
    id: 'word-security-policy',
    track: 'word',
    level: 'associate',
    kind: 'doc',
    order: 3,
    title: 'Quy chuẩn An toàn Thông tin',
    fileName: 'QuyChuan_AnToan_TT.docx',
    scenario: 'Tài liệu quy chuẩn bảo mật nội bộ cần rà soát thuật ngữ, phân trang, đánh số dòng, bổ sung danh sách quy trình và nhận xét kiểm duyệt.',
    minutes: 18,
    difficulty: 'Nâng cao',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), lineNumbers: false, citationStyle: 'apa', spacingId: 'none' },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'Quy chuẩn An toàn Thông tin Nội bộ'),
          para('Mọi nhân viên cũ và quản lý dự án phải tuân thủ quy định bảo mật dữ liệu khách hàng. Đây là yêu cầu bắt buộc khi truy cập hệ thống quản trị.'),
          para('Tất cả nhân viên cũ cần kích hoạt xác thực hai lớp trước ngày 30 hàng tháng.'),
          heading(2, 'Phần 2: Quy trình ứng phó sự cố'),
          para('Báo cáo ngay cho bộ phận vận hành khi phát hiện đăng nhập bất thường.'),
          para('Cô lập thiết bị nghi ngờ bị xâm nhập khỏi mạng nội bộ.'),
          para('Lập biên bản sự cố và cập nhật mật khẩu truy cập.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'w3-t1',
        domainId: 'word-manage',
        title: 'Ngắt trang và bật số dòng liên tục',
        instruction: 'Chèn ít nhất một Ngắt trang (Page Break) để tách Phần 2 sang trang mới, đồng thời bật Số dòng (Line Numbers) chế độ Liên tục.',
        ribbonPath: 'Bố cục → Ngắt → Trang · Bố cục → Số dòng → Liên tục',
        hint: 'Đặt con trỏ trước dòng “Phần 2: Quy trình ứng phó sự cố”, bấm Bố cục → Ngắt → Trang (hoặc Ctrl+Enter). Sau đó bấm Bố cục → Số dòng → Liên tục.',
        points: 20,
        check: (content) => {
          const hasBreak = collectNodes(content.json).some((n) => n.type === 'pageBreak');
          const hasLines = Boolean(content.page.lineNumbers);
          if (hasBreak && hasLines) return { passed: true, detail: 'Đã chèn ngắt trang và bật đánh số dòng.' };
          const issues: string[] = [];
          if (!hasBreak) issues.push('chưa chèn Ngắt trang');
          if (!hasLines) issues.push('chưa bật Số dòng');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w3-t2',
        domainId: 'word-format',
        title: 'Tìm và thay thế toàn văn',
        instruction: 'Thay thế toàn bộ cụm từ “nhân viên cũ” trong tài liệu thành “nhân sự mới”.',
        ribbonPath: 'Trang chủ → Thay thế (Ctrl+H)',
        hint: 'Nhấn Ctrl+H để mở hộp thoại Tìm & thay thế, nhập “nhân viên cũ” ở ô Tìm, nhập “nhân sự mới” ở ô Thay thế rồi bấm Thay tất cả.',
        points: 20,
        check: (content) => {
          const text = fold(fullDocText(content));
          const hasOld = text.includes('nhan vien cu');
          const hasNew = text.includes('nhan su moi');
          if (!hasOld && hasNew) return { passed: true, detail: 'Đã thay thế toàn bộ “nhân viên cũ” thành “nhân sự mới”.' };
          if (hasOld) return { passed: false, detail: 'Trong tài liệu vẫn còn tồn tại cụm từ “nhân viên cũ”.' };
          return { passed: false, detail: 'Chưa tìm thấy cụm từ thay thế “nhân sự mới” trong văn bản.' };
        },
      },
      {
        id: 'w3-t3',
        domainId: 'word-tables',
        title: 'Danh sách đánh số và tô sáng từ khoá',
        instruction: 'Chuyển 3 bước ứng phó sự cố thành Danh sách đánh số (1. 2. 3.) và tô sáng (Highlight) từ “bắt buộc”.',
        ribbonPath: 'Trang chủ → Đánh số · Trang chủ → Màu tô sáng chữ',
        hint: 'Bôi chọn 3 dòng quy trình ứng phó rồi bấm biểu tượng Đánh số (1. 2. 3.). Sau đó bôi chọn từ “bắt buộc” và chọn màu ở nút Màu tô sáng chữ.',
        points: 20,
        check: (content) => {
          const nodes = collectNodes(content.json);
          const hasOrdered = nodes.some((n) => n.type === 'orderedList' && (n.content?.length ?? 0) >= 3);
          const hasHighlight = nodes.some((n) => n.type === 'text' && Array.isArray(n.marks) && n.marks.some((m) => m.type === 'highlight') && fold(n.text ?? '').includes('bat buoc'));
          if (hasOrdered && hasHighlight) return { passed: true, detail: 'Đã tạo danh sách đánh số 3 mục và tô sáng từ “bắt buộc”.' };
          const issues: string[] = [];
          if (!hasOrdered) issues.push('chưa có danh sách đánh số tối thiểu 3 mục');
          if (!hasHighlight) issues.push('từ “bắt buộc” chưa được tô sáng');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w3-t4',
        domainId: 'word-refs',
        title: 'Thêm bình luận kiểm duyệt',
        instruction: 'Thêm ít nhất một Bình luận (Comment) vào tài liệu để gửi phản hồi cho nhóm biên soạn.',
        ribbonPath: 'Xem lại → Bình luận mới',
        hint: 'Mở thẻ Xem lại (Review), bấm Bình luận mới, nhập nội dung góp ý rồi bấm Đăng.',
        points: 20,
        check: (content) => {
          const count = (content.comments ?? []).length;
          return count > 0
            ? { passed: true, detail: `Đã thêm ${count} bình luận kiểm duyệt.` }
            : { passed: false, detail: 'Tài liệu chưa có bình luận nào.' };
        },
      },
      {
        id: 'w3-t5',
        domainId: 'word-format',
        title: 'Chuẩn trích dẫn IEEE và giãn đoạn thoáng',
        instruction: 'Chuyển Kiểu trích dẫn sang IEEE và chọn kiểu Giãn đoạn (Paragraph Spacing) là Thoáng (Open) hoặc Rộng rãi (Relaxed).',
        ribbonPath: 'Tham chiếu → Kiểu trích dẫn: IEEE · Thiết kế → Giãn đoạn',
        hint: 'Vào thẻ Tham chiếu, đổi ô chọn Kiểu trích dẫn từ APA sang IEEE. Tiếp theo vào thẻ Thiết kế → bấm Giãn đoạn → chọn Thoáng hoặc Rộng rãi.',
        points: 20,
        check: (content) => {
          const ieee = content.page.citationStyle === 'ieee';
          const spacing = content.page.spacingId === 'open' || content.page.spacingId === 'relaxed';
          if (ieee && spacing) return { passed: true, detail: `Đã đặt chuẩn IEEE và giãn đoạn ${content.page.spacingId}.` };
          const issues: string[] = [];
          if (!ieee) issues.push(`kiểu trích dẫn hiện là ${(content.page.citationStyle ?? 'apa').toUpperCase()}`);
          if (!spacing) issues.push('chưa chọn giãn đoạn Thoáng hoặc Rộng rãi');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
    ],
  },
  {
    id: 'word-expert-thesis',
    track: 'word',
    level: 'expert',
    kind: 'doc',
    order: 4,
    title: 'Luận văn & Tham chiếu Học thuật (Expert)',
    fileName: 'LuanVan_ChuyenSau.docx',
    scenario: 'Dự án cấp độ MOS Word Expert: xử lý tài liệu dài với trang đầu khác biệt, trích dẫn học thuật, thư mục tham khảo, chú thích cuối tài liệu, chỉ mục và hộp chữ nổi bật.',
    minutes: 20,
    difficulty: 'Nâng cao',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), differentFirstPage: false, header: '', sources: [], citationStyle: 'apa' },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'Nghiên cứu Ứng dụng Trí tuệ Nhân tạo trong Văn phòng Số'),
          para('Tác giả: Nghiên cứu sinh Bùi Minh · Khoa Hệ thống Thông tin.'),
          heading(2, 'Chương 1: Cơ sở lý thuyết'),
          para('Tự động hoá tài liệu giúp giảm 40% sai sót định dạng và nâng cao độ tin cậy dữ liệu báo cáo doanh nghiệp.'),
          heading(2, 'Chương 2: Phương pháp đánh giá hiệu năng'),
          para('Quá trình đo kiểm dựa trên chuẩn năng lực tin học văn phòng quốc tế và khảo sát thực nghiệm tại 12 đơn vị.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'w4-t1',
        domainId: 'word-manage',
        title: 'Bật Trang đầu khác và đầu trang nội dung',
        instruction: 'Bật tuỳ chọn Trang đầu khác (Different First Page) và thiết lập Đầu trang (Header) chứa “Luận văn 2026”.',
        ribbonPath: 'Bố cục → Đầu/chân trang → bật Trang đầu khác',
        hint: 'Vào thẻ Bố cục → Đầu/chân trang, đánh dấu ô Trang đầu khác và nhập “Luận văn 2026” vào trường Đầu trang.',
        points: 20,
        check: (content) => {
          const diff = Boolean(content.page.differentFirstPage);
          const hasHeader = fold(content.page.header ?? '').includes('luan van 2026');
          if (diff && hasHeader) return { passed: true, detail: 'Đã bật Trang đầu khác và thiết lập đầu trang “Luận văn 2026”.' };
          const issues: string[] = [];
          if (!diff) issues.push('chưa bật Trang đầu khác');
          if (!hasHeader) issues.push('Đầu trang chưa chứa “Luận văn 2026”');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w4-t2',
        domainId: 'word-refs',
        title: 'Thêm nguồn và chèn Thư mục tham khảo',
        instruction: 'Thêm ít nhất một Nguồn tài liệu tham khảo (Source) và chèn khối Thư mục (Bibliography) vào cuối luận văn.',
        ribbonPath: 'Tham chiếu → Quản lý nguồn · Tham chiếu → Thư mục',
        hint: 'Mở thẻ Tham chiếu → bấm Quản lý nguồn để thêm 1 nguồn sách/bài báo, sau đó bấm Thư mục → chọn Tài liệu tham khảo.',
        points: 20,
        check: (content) => {
          const hasSource = (content.page.sources?.length ?? 0) > 0;
          const hasBib = collectNodes(content.json).some((n) => n.type === 'bibliography');
          if (hasSource && hasBib) return { passed: true, detail: `Đã lưu ${content.page.sources?.length} nguồn và chèn Thư mục tham khảo.` };
          const issues: string[] = [];
          if (!hasSource) issues.push('chưa thêm nguồn tài liệu nào');
          if (!hasBib) issues.push('chưa chèn khối Thư mục tham khảo');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w4-t3',
        domainId: 'word-refs',
        title: 'Chèn Chú thích cuối tài liệu (Endnote)',
        instruction: 'Chèn ít nhất một Chú thích cuối tài liệu (Endnote) bổ sung ghi chú phương pháp nghiên cứu.',
        ribbonPath: 'Tham chiếu → Chèn chú thích cuối (Ctrl+Alt+D)',
        hint: 'Đặt con trỏ cuối đoạn Chương 2, mở thẻ Tham chiếu → bấm Chèn chú thích cuối và nhập nội dung.',
        points: 20,
        check: (content) => {
          const hasEndnote = collectNodes(content.json).some((n) => n.type === 'footnote' && n.attrs?.kind === 'end' && String(n.attrs?.text ?? '').trim().length > 0);
          return hasEndnote
            ? { passed: true, detail: 'Đã chèn chú thích cuối tài liệu (Endnote).' }
            : { passed: false, detail: 'Chưa thấy Endnote (chú thích cuối tài liệu) nào.' };
        },
      },
      {
        id: 'w4-t4',
        domainId: 'word-refs',
        title: 'Đánh dấu mục và chèn Chỉ mục (Index)',
        instruction: 'Đánh dấu ít nhất một thuật ngữ vào chỉ mục (Mark Entry) và chèn bảng Chỉ mục (Index) vào tài liệu.',
        ribbonPath: 'Tham chiếu → Đánh dấu mục · Tham chiếu → Chèn chỉ mục',
        hint: 'Bôi chọn một từ khoá (ví dụ “tự động hoá”), vào thẻ Tham chiếu → Đánh dấu mục, sau đó bấm Chèn chỉ mục ở cuối bài.',
        points: 20,
        check: (content) => {
          const nodes = collectNodes(content.json);
          const hasEntry = nodes.some((n) => n.type === 'indexEntry');
          const hasIndex = nodes.some((n) => n.type === 'docIndex');
          if (hasEntry && hasIndex) return { passed: true, detail: 'Đã đánh dấu mục từ khoá và chèn bảng Chỉ mục.' };
          const issues: string[] = [];
          if (!hasEntry) issues.push('chưa đánh dấu thuật ngữ chỉ mục');
          if (!hasIndex) issues.push('chưa chèn bảng Chỉ mục');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w4-t5',
        domainId: 'word-tables',
        title: 'Chèn Hộp chữ (Text Box) hoặc Dấu trang (Bookmark)',
        instruction: 'Chèn một Hộp chữ (Text Box) tóm tắt kết quả nổi bật hoặc gắn một Dấu trang (Bookmark) điều hướng nhanh.',
        ribbonPath: 'Chèn → Hộp chữ / Chèn → Dấu trang',
        hint: 'Mở thẻ Chèn (Insert) → chọn Hộp chữ hoặc Dấu trang để thêm đối tượng điều hướng/tóm tắt vào tài liệu.',
        points: 20,
        check: (content) => {
          const nodes = collectNodes(content.json);
          const hasBox = nodes.some((n) => n.type === 'textBox');
          const hasBookmark = nodes.some((n) => n.type === 'bookmark');
          return hasBox || hasBookmark
            ? { passed: true, detail: hasBox ? 'Đã chèn Hộp chữ nổi bật vào tài liệu.' : 'Đã gắn Dấu trang điều hướng trong tài liệu.' }
            : { passed: false, detail: 'Chưa thấy Hộp chữ (Text Box) hay Dấu trang (Bookmark) nào.' };
        },
      },
    ],
  },
];
