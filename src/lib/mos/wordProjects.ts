import { basePage, type DocContent } from '../storage';
import type { MosWordProject } from './types';
import { collectNodes, foldText, fullDocText, hasMarkOnText, heading, nodeText, para } from './wordHelpers';

export const MOS_WORD_ASSOCIATE_PROJECTS: MosWordProject[] = [
  {
    id: 'word-green-summit',
    track: 'word',
    level: 'associate',
    kind: 'doc',
    order: 1,
    title: 'Báo cáo Hội nghị Công nghệ Xanh',
    titleEn: 'Green Tech Summit Report',
    fileName: 'BaoCao_HoiNghi_Xanh.docx',
    scenario: 'Bạn đang hoàn thiện tài liệu giới thiệu Hội nghị Công nghệ Xanh 2026 trước khi gửi ban tổ chức duyệt in và phát hành.',
    scenarioEn: 'You are finalizing the Green Tech Summit 2026 overview brochure before submitting it to the organizing committee.',
    minutes: 8,
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
        titleEn: 'Landscape orientation & Narrow margins',
        instruction: 'Đổi hướng trang của toàn bộ tài liệu sang Ngang (Landscape) và đặt lề trang theo mẫu Hẹp (Narrow — 1,27 cm mỗi phía).',
        instructionEn: 'Change the page orientation of the entire document to Landscape and apply Narrow page margins.',
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
          if (!isNarrow) issues.push(`lề hiện tại chưa ở mức Hẹp (${Math.round((m.left / 37.8) * 100) / 100} cm)`);
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w1-t2',
        domainId: 'word-manage',
        title: 'Chèn hình mờ (Watermark)',
        titleEn: 'Insert document watermark',
        instruction: 'Áp dụng hình mờ (Watermark) có chữ “BẢN NHÁP” hoặc “CONFIDENTIAL” cho toàn bộ tài liệu.',
        instructionEn: 'Apply a “BẢN NHÁP” or “CONFIDENTIAL” watermark across the document.',
        copyTokens: ['CONFIDENTIAL', 'BẢN NHÁP'],
        ribbonPath: 'Thiết kế → Hình mờ',
        hint: 'Mở thẻ Thiết kế (Design), bấm Hình mờ ở nhóm Nền trang rồi chọn BẢN NHÁP hoặc CONFIDENTIAL.',
        points: 20,
        check: (content) => {
          const wm = (content.page.watermark ?? '').trim();
          const norm = foldText(wm);
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
        titleEn: 'Add document properties',
        instruction: 'Trong thông tin mô tả tài liệu, nhập Chủ đề (Subject) chứa “Hội nghị Xanh” và Từ khoá (Keywords) chứa “MOS”.',
        instructionEn: 'Set the document Subject property to include “Hội nghị Xanh” and Keywords to include “MOS”.',
        copyTokens: ['Hội nghị Xanh', 'MOS'],
        ribbonPath: 'Tệp → Thông tin → Thông tin mô tả',
        hint: 'Bấm nút Tệp ở góc trái thanh Ribbon → chọn mục Thông tin → điền ô Chủ đề và ô Từ khoá.',
        points: 20,
        check: (content) => {
          const subject = content.page.properties?.subject ?? '';
          const keywords = content.page.properties?.keywords ?? '';
          const hasSubject = foldText(subject).includes('hoi nghi xanh');
          const hasKeyword = foldText(keywords).includes('mos');
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
        titleEn: 'Apply Heading 1 style and center align',
        instruction: 'Áp dụng kiểu Heading 1 cho dòng “Tổng quan chương trình” và căn giữa (Center) dòng tiêu đề này.',
        instructionEn: 'Apply the Heading 1 style to “Tổng quan chương trình” and center-align the heading.',
        ribbonPath: 'Trang chủ → Kiểu → Heading 1 · Trang chủ → Căn giữa',
        hint: 'Đặt con trỏ vào dòng “Tổng quan chương trình”, vào thẻ Trang chủ, bấm kiểu Heading 1, sau đó bấm biểu tượng Căn giữa.',
        points: 20,
        check: (content) => {
          const match = collectNodes(content.json).find(
            (n) => n.type === 'heading' && Number(n.attrs?.level) === 1 && foldText(nodeText(n)).includes('tong quan chuong trinh'),
          );
          if (!match) return { passed: false, detail: 'Chưa thấy dòng “Tổng quan chương trình” ở kiểu Heading 1.' };
          return match.attrs?.textAlign === 'center'
            ? { passed: true, detail: 'Dòng “Tổng quan chương trình” đã là Heading 1 và căn giữa.' }
            : { passed: false, detail: 'Đã đổi sang Heading 1 nhưng tiêu đề chưa được căn giữa.' };
        },
      },
      {
        id: 'w1-t5',
        domainId: 'word-refs',
        title: 'Chèn mục lục tự động',
        titleEn: 'Insert an automatic Table of Contents',
        instruction: 'Chèn một Mục lục tự động (Table of Contents) vào tài liệu để liệt kê toàn bộ các tiêu đề chính.',
        instructionEn: 'Insert an Automatic Table of Contents into the document.',
        ribbonPath: 'Tham chiếu → Mục lục → Mục lục tự động 1',
        hint: 'Mở thẻ Tham chiếu (References) → bấm Mục lục → chọn Mục lục tự động 1 hoặc 2.',
        points: 20,
        check: (content) =>
          collectNodes(content.json).some((n) => n.type === 'tableOfContents')
            ? { passed: true, detail: 'Đã chèn khối Mục lục tự động vào tài liệu.' }
            : { passed: false, detail: 'Chưa tìm thấy Mục lục tự động trong tài liệu.' },
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
    titleEn: '2026 Staff Training Proposal',
    fileName: 'DeXuat_DaoTao_2026.docx',
    scenario: 'Phòng Nhân sự cần định dạng đề xuất chương trình đào tạo kỹ năng số với bố cục hai cột, bảng lịch trình và chú thích nguồn.',
    scenarioEn: 'HR needs the digital skills training proposal formatted into two columns with a schedule table, header, footnote, theme, and page border.',
    minutes: 7,
    difficulty: 'Cơ bản',
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
        titleEn: 'Format document into two columns',
        instruction: 'Thiết lập toàn bộ tài liệu hiển thị theo bố cục Hai cột (Two Columns).',
        instructionEn: 'Configure the page layout to display in Two columns.',
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
        titleEn: 'Add header and enable page numbering',
        instruction: 'Thiết lập Đầu trang (Header) chứa nội dung “Minh Spark Academy” và bật hiển thị Số trang.',
        instructionEn: 'Add “Minh Spark Academy” to the document Header and turn on Page Numbers.',
        copyTokens: ['Minh Spark Academy'],
        ribbonPath: 'Bố cục → Đầu/chân trang',
        hint: 'Mở thẻ Bố cục → bấm Đầu/chân trang, nhập “Minh Spark Academy” vào ô Đầu trang và đánh dấu bật Số trang.',
        points: 20,
        check: (content) => {
          const header = content.page.header ?? '';
          const hasHeader = foldText(header).includes('minh spark academy');
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
        titleEn: 'Insert a 3×4 schedule table',
        instruction: 'Chèn một bảng dữ liệu có tối thiểu 3 cột và 4 dòng vào tài liệu để trình bày lịch đào tạo.',
        instructionEn: 'Insert a table with at least 3 columns and 4 rows for the training schedule.',
        ribbonPath: 'Chèn → Bảng',
        hint: 'Đặt con trỏ cuối tài liệu, mở thẻ Chèn (Insert) → bấm Bảng → chọn kích thước tối thiểu 3 cột × 4 dòng.',
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
        titleEn: 'Insert a Footnote',
        instruction: 'Chèn ít nhất một Chú thích cuối trang (Footnote) giải thích về chuẩn chứng chỉ MOS.',
        instructionEn: 'Insert at least one Footnote explaining the MOS certification standard.',
        ribbonPath: 'Tham chiếu → Chèn chú thích',
        hint: 'Mở thẻ Tham chiếu (References) → bấm Chèn chú thích và nhập nội dung giải thích.',
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
        titleEn: 'Apply Theme and Page Border',
        instruction: 'Đổi Chủ đề (Theme) tài liệu sang một chủ đề bất kỳ khác mặc định “Office” và bật Viền trang (Page Border).',
        instructionEn: 'Change the document Theme to any theme other than Office and enable a Page Border.',
        ribbonPath: 'Thiết kế → Chủ đề · Thiết kế → Viền trang',
        hint: 'Mở thẻ Thiết kế (Design), chọn một Chủ đề mới (ví dụ Ion / Khía cạnh), sau đó bấm Viền trang để chọn kiểu khung.',
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
    titleEn: 'Information Security Standard',
    fileName: 'QuyChuan_AnToan_TT.docx',
    scenario: 'Tài liệu quy chuẩn bảo mật nội bộ cần rà soát thuật ngữ, phân trang, đánh số dòng, bổ sung danh sách quy trình và nhận xét kiểm duyệt.',
    scenarioEn: 'Review the internal security policy by inserting a page break, line numbers, find-and-replace, numbered steps, highlight, comment, and IEEE citations.',
    minutes: 8,
    difficulty: 'Trung bình',
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
        titleEn: 'Insert Page Break and Continuous Line Numbers',
        instruction: 'Chèn ít nhất một Ngắt trang (Page Break) để tách Phần 2 sang trang mới, đồng thời bật Số dòng (Line Numbers) chế độ Liên tục.',
        instructionEn: 'Insert a Page Break before Part 2 and turn on Continuous Line Numbers.',
        ribbonPath: 'Bố cục → Ngắt → Trang · Bố cục → Số dòng → Liên tục',
        hint: 'Đặt con trỏ trước dòng “Phần 2”, bấm Bố cục → Ngắt → Trang (hoặc Ctrl+Enter). Sau đó bấm Bố cục → Số dòng → Liên tục.',
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
        titleEn: 'Find and Replace all occurrences',
        instruction: 'Thay thế toàn bộ cụm từ “nhân viên cũ” trong tài liệu thành “nhân sự mới”.',
        instructionEn: 'Replace all instances of “nhân viên cũ” with “nhân sự mới” throughout the document.',
        copyTokens: ['nhân viên cũ', 'nhân sự mới'],
        ribbonPath: 'Trang chủ → Thay thế (Ctrl+H)',
        hint: 'Nhấn Ctrl+H, nhập “nhân viên cũ” ở ô Tìm, nhập “nhân sự mới” ở ô Thay thế rồi bấm Thay tất cả.',
        points: 20,
        check: (content) => {
          const text = foldText(fullDocText(content));
          if (!text.includes('nhan vien cu') && text.includes('nhan su moi')) return { passed: true, detail: 'Đã thay thế toàn bộ “nhân viên cũ” thành “nhân sự mới”.' };
          return text.includes('nhan vien cu')
            ? { passed: false, detail: 'Trong tài liệu vẫn còn tồn tại cụm từ “nhân viên cũ”.' }
            : { passed: false, detail: 'Chưa tìm thấy cụm từ thay thế “nhân sự mới” trong văn bản.' };
        },
      },
      {
        id: 'w3-t3',
        domainId: 'word-tables',
        title: 'Danh sách đánh số và tô sáng từ khoá',
        titleEn: 'Create numbered list and highlight keyword',
        instruction: 'Chuyển 3 bước ứng phó sự cố thành Danh sách đánh số (1. 2. 3.) và tô sáng (Highlight) từ “bắt buộc”.',
        instructionEn: 'Convert the 3 incident response steps into a Numbered List and highlight the phrase “bắt buộc”.',
        ribbonPath: 'Trang chủ → Đánh số · Trang chủ → Màu tô sáng chữ',
        hint: 'Bôi chọn 3 dòng quy trình ứng phó rồi bấm Đánh số. Bôi chọn từ “bắt buộc” rồi chọn màu ở Màu tô sáng chữ.',
        points: 20,
        check: (content) => {
          const nodes = collectNodes(content.json);
          const hasOrdered = nodes.some((n) => n.type === 'orderedList' && (n.content?.length ?? 0) >= 3);
          const hasHighlight = hasMarkOnText(content, 'highlight', 'bat buoc');
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
        titleEn: 'Insert a review comment',
        instruction: 'Thêm ít nhất một Bình luận (Comment) vào tài liệu để gửi phản hồi cho nhóm biên soạn.',
        instructionEn: 'Add at least one review Comment to the document.',
        ribbonPath: 'Xem lại → Bình luận mới',
        hint: 'Mở thẻ Xem lại (Review), bấm Bình luận mới, nhập nội dung góp ý rồi bấm Đăng.',
        points: 20,
        check: (content) =>
          (content.comments ?? []).length > 0
            ? { passed: true, detail: `Đã thêm ${content.comments?.length} bình luận kiểm duyệt.` }
            : { passed: false, detail: 'Tài liệu chưa có bình luận nào.' },
      },
      {
        id: 'w3-t5',
        domainId: 'word-format',
        title: 'Chuẩn trích dẫn IEEE và giãn đoạn thoáng',
        titleEn: 'Set IEEE citation style and Open/Relaxed paragraph spacing',
        instruction: 'Chuyển Kiểu trích dẫn sang IEEE và chọn kiểu Giãn đoạn (Paragraph Spacing) là Thoáng (Open) hoặc Rộng rãi (Relaxed).',
        instructionEn: 'Switch Citation Style to IEEE and apply Open or Relaxed Document Paragraph Spacing.',
        ribbonPath: 'Tham chiếu → Kiểu trích dẫn: IEEE · Thiết kế → Giãn đoạn',
        hint: 'Vào thẻ Tham chiếu đổi Kiểu trích dẫn sang IEEE. Vào thẻ Thiết kế → Giãn đoạn → chọn Thoáng hoặc Rộng rãi.',
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
    id: 'word-product-brochure',
    track: 'word',
    level: 'associate',
    kind: 'doc',
    order: 4,
    title: 'Tờ rơi Giới thiệu Sản phẩm SmartHome',
    titleEn: 'SmartHome Product Brochure',
    fileName: 'ToRoi_SmartHome.docx',
    scenario: 'Nhóm Marketing cần thiết kế tờ rơi sản phẩm nhà thông minh khổ Letter với màu nền trang nhẹ, danh sách dấu đầu dòng, trích dẫn khách hàng và chân trang liên hệ.',
    scenarioEn: 'Prepare the SmartHome product brochure on Letter paper with a tinted page color, bullet list, customer quote block, bold emphasis, and contact footer.',
    minutes: 7,
    difficulty: 'Cơ bản',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), size: 'A4', pageColor: '', footer: '', pageNumbers: true },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'Bộ Giải pháp Nhà thông minh SmartHome 2026'),
          para('Điều khiển toàn bộ hệ thống chiếu sáng, điều hoà và an ninh ngay trên điện thoại với công nghệ tiết kiệm điện vượt trội.'),
          heading(2, 'Tính năng nổi bật'),
          para('Tự động bật tắt đèn theo cảm biến chuyển động.'),
          para('Cảnh báo rò rỉ nước và khói tức thì qua ứng dụng.'),
          para('Hỗ trợ điều khiển giọng nói tiếng Việt tự nhiên.'),
          para('Khách hàng chia sẻ: Gia đình tôi giảm được 28% hoá đơn tiền điện ngay tháng đầu sử dụng.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'w4a-t1',
        domainId: 'word-manage',
        title: 'Đổi khổ giấy sang Letter',
        titleEn: 'Change paper size to Letter',
        instruction: 'Đổi khổ giấy (Paper Size) của tài liệu từ A4 sang Letter.',
        instructionEn: 'Change the document paper size from A4 to Letter.',
        ribbonPath: 'Bố cục → Khổ → Letter',
        hint: 'Mở thẻ Bố cục (Layout) → bấm nút Khổ → chọn Letter.',
        points: 20,
        check: (content) =>
          content.page.size === 'Letter'
            ? { passed: true, detail: 'Đã chuyển khổ giấy sang Letter.' }
            : { passed: false, detail: `Khổ giấy hiện là ${content.page.size}, cần chuyển sang Letter.` },
      },
      {
        id: 'w4a-t2',
        domainId: 'word-manage',
        title: 'Tô màu nền trang (Page Color)',
        titleEn: 'Apply Page Color',
        instruction: 'Áp dụng một Màu trang (Page Color) dịu mắt bất kỳ (khác màu trắng mặc định) cho tờ rơi.',
        instructionEn: 'Apply any non-white Page Color to the brochure.',
        ribbonPath: 'Thiết kế → Màu trang',
        hint: 'Mở thẻ Thiết kế (Design) → bấm Màu trang → chọn một ô màu nhạt (ví dụ xanh nhạt hoặc kem).',
        points: 20,
        check: (content) => {
          const color = (content.page.pageColor ?? '').trim().toLowerCase();
          return color && color !== '#ffffff' && color !== '#fff' && color !== 'white'
            ? { passed: true, detail: `Đã đặt màu trang ${color}.` }
            : { passed: false, detail: 'Trang giấy vẫn đang là màu trắng mặc định.' };
        },
      },
      {
        id: 'w4a-t3',
        domainId: 'word-tables',
        title: 'Tạo danh sách dấu đầu dòng (Bullet List)',
        titleEn: 'Create a 3-item bulleted list',
        instruction: 'Chuyển 3 dòng tính năng nổi bật thành Danh sách dấu đầu dòng (Bullet List) gồm ít nhất 3 mục.',
        instructionEn: 'Convert the three key feature lines into a Bulleted List with at least 3 items.',
        ribbonPath: 'Trang chủ → Dấu đầu dòng',
        hint: 'Bôi chọn 3 dòng tính năng nổi bật rồi bấm biểu tượng Dấu đầu dòng (Bullet List) trên thẻ Trang chủ.',
        points: 20,
        check: (content) => {
          const ok = collectNodes(content.json).some((n) => n.type === 'bulletList' && (n.content?.length ?? 0) >= 3);
          return ok
            ? { passed: true, detail: 'Đã tạo danh sách dấu đầu dòng từ 3 mục trở lên.' }
            : { passed: false, detail: 'Chưa có danh sách dấu đầu dòng tối thiểu 3 mục.' };
        },
      },
      {
        id: 'w4a-t4',
        domainId: 'word-format',
        title: 'Định dạng khối Trích dẫn & in đậm cụm từ',
        titleEn: 'Format customer quote as Blockquote and bold 28%',
        instruction: 'Chuyển câu chia sẻ của khách hàng thành khối Trích dẫn (Blockquote) và in đậm (Bold) con số “28%”.',
        instructionEn: 'Format the customer testimonial paragraph as a Blockquote and apply Bold to “28%”.',
        ribbonPath: 'Trang chủ → Trích dẫn · Trang chủ → Đậm (Ctrl+B)',
        hint: 'Đặt con trỏ vào dòng “Khách hàng chia sẻ…” bấm nút Trích dẫn. Bôi chọn “28%” rồi nhấn Ctrl+B.',
        points: 20,
        check: (content) => {
          const hasQuote = collectNodes(content.json).some((n) => n.type === 'blockquote');
          const hasBold = hasMarkOnText(content, 'bold', '28%');
          if (hasQuote && hasBold) return { passed: true, detail: 'Đã tạo khối Trích dẫn và in đậm con số 28%.' };
          const issues: string[] = [];
          if (!hasQuote) issues.push('chưa định dạng khối Trích dẫn');
          if (!hasBold) issues.push('chưa in đậm “28%”');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w4a-t5',
        domainId: 'word-refs',
        title: 'Thêm chân trang liên hệ',
        titleEn: 'Add contact Footer',
        instruction: 'Thêm Chân trang (Footer) chứa nội dung “Hotline 1900 2026”.',
        instructionEn: 'Insert a document Footer containing “Hotline 1900 2026”.',
        copyTokens: ['Hotline 1900 2026'],
        ribbonPath: 'Bố cục → Đầu/chân trang → Chân trang',
        hint: 'Vào Bố cục → Đầu/chân trang, nhập “Hotline 1900 2026” vào ô Chân trang rồi bấm Lưu.',
        points: 20,
        check: (content) =>
          foldText(content.page.footer ?? '').includes('1900 2026')
            ? { passed: true, detail: `Đã thiết lập chân trang “${content.page.footer}”.` }
            : { passed: false, detail: 'Chân trang chưa chứa “Hotline 1900 2026”.' },
      },
    ],
  },
  {
    id: 'word-event-agenda',
    track: 'word',
    level: 'associate',
    kind: 'doc',
    order: 5,
    title: 'Kịch bản Sự kiện Ngày hội Việc làm',
    titleEn: 'Career Fair Event Agenda',
    fileName: 'KichBan_NgayHoi_ViecLam.docx',
    scenario: 'Ban Tổ chức Ngày hội Việc làm cần chuẩn hoá lịch sự kiện với đường kẻ phân tách, siêu liên kết đăng ký, hộp chữ lưu ý, giãn dòng 1.5 và đánh số đề mục.',
    scenarioEn: 'Standardize the Career Fair agenda with a horizontal divider, registration hyperlink, callout text box, 1.5 line spacing, and numbered headings.',
    minutes: 7,
    difficulty: 'Trung bình',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), headingNumbers: 'none', styleSet: 'office' },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'Ngày hội Việc làm Công nghệ 2026'),
          para('Sự kiện kết nối trực tiếp hơn 60 doanh nghiệp công nghệ với sinh viên năm cuối và kỹ sư trẻ.'),
          heading(2, 'Đăng ký tham dự'),
          para('Ứng viên đăng ký trực tuyến tại cổng thông tin Career Portal trước ngày 15/12 để nhận mã vào cửa.'),
          heading(2, 'Hoạt động phỏng vấn nhanh'),
          para('Mỗi ứng viên có 15 phút trao đổi trực tiếp với trưởng nhóm tuyển dụng ngay tại gian hàng.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'w5a-t1',
        domainId: 'word-format',
        title: 'Chuyển bộ kiểu (Style Set) tài liệu',
        titleEn: 'Change Document Style Set',
        instruction: 'Áp dụng một Bộ kiểu tài liệu (Style Set) khác mặc định (ví dụ Hiện đại, Báo cáo hoặc Hành chính Việt Nam).',
        instructionEn: 'Apply any Document Style Set other than the default Office set.',
        ribbonPath: 'Thiết kế → Bộ kiểu tài liệu',
        hint: 'Mở thẻ Thiết kế (Design), chọn một bộ kiểu mới trong thư viện Bộ kiểu tài liệu ở nhóm Định dạng tài liệu.',
        points: 20,
        check: (content) =>
          content.page.styleSet && content.page.styleSet !== 'office'
            ? { passed: true, detail: `Đã chuyển sang bộ kiểu “${content.page.styleSet}”.` }
            : { passed: false, detail: 'Tài liệu vẫn đang dùng bộ kiểu mặc định.' },
      },
      {
        id: 'w5a-t2',
        domainId: 'word-format',
        title: 'Giãn dòng 1.5 và căn đều đoạn mô tả',
        titleEn: 'Apply 1.5 line spacing and Justify alignment',
        instruction: 'Đặt căn đều hai bên (Justify) và giãn dòng từ 1.5 trở lên cho đoạn văn bắt đầu bằng “Sự kiện kết nối trực tiếp”.',
        instructionEn: 'Justify-align and set line spacing to at least 1.5 for the paragraph starting with “Sự kiện kết nối trực tiếp”.',
        ribbonPath: 'Trang chủ → Căn đều (Ctrl+J) · Trang chủ → Giãn dòng → 1.5',
        hint: 'Đặt con trỏ vào đoạn “Sự kiện kết nối trực tiếp…”, bấm Căn đều (Ctrl+J) rồi bấm biểu tượng Giãn dòng (↕) chọn 1.5.',
        points: 20,
        check: (content) => {
          const target = collectNodes(content.json).find((n) => n.type === 'paragraph' && foldText(nodeText(n)).includes('su kien ket noi'));
          if (!target) return { passed: false, detail: 'Không tìm thấy đoạn văn “Sự kiện kết nối trực tiếp…”.' };
          const justified = target.attrs?.textAlign === 'justify';
          const spaced = Number(target.attrs?.lineHeight ?? 0) >= 1.5;
          if (justified && spaced) return { passed: true, detail: 'Đoạn văn đã căn đều và giãn dòng >= 1.5.' };
          const issues: string[] = [];
          if (!justified) issues.push('chưa căn đều hai bên');
          if (!spaced) issues.push('giãn dòng chưa đạt >= 1.5');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w5a-t3',
        domainId: 'word-refs',
        title: 'Chèn siêu liên kết (Hyperlink)',
        titleEn: 'Insert a Hyperlink',
        instruction: 'Gắn một Siêu liên kết (Link) tới đường dẫn “https://office.minhspark.com” cho cụm từ “Career Portal” hoặc bất kỳ văn bản nào.',
        instructionEn: 'Insert a Hyperlink pointing to “https://office.minhspark.com”.',
        copyTokens: ['https://office.minhspark.com'],
        ribbonPath: 'Chèn → Liên kết (Ctrl+K)',
        hint: 'Bôi chọn “Career Portal”, mở thẻ Chèn → Liên kết (hoặc Ctrl+K) → dán https://office.minhspark.com rồi lưu.',
        points: 20,
        check: (content) => {
          const hasLink = collectNodes(content.json).some(
            (n) => n.type === 'text' && Array.isArray(n.marks) && n.marks.some((m) => m.type === 'link' && String(m.attrs?.href ?? '').includes('minhspark')),
          );
          return hasLink
            ? { passed: true, detail: 'Đã gắn siêu liên kết tới office.minhspark.com.' }
            : { passed: false, detail: 'Chưa thấy siêu liên kết chứa địa chỉ minhspark trong tài liệu.' };
        },
      },
      {
        id: 'w5a-t4',
        domainId: 'word-tables',
        title: 'Chèn đường kẻ ngang và Hộp chữ lưu ý',
        titleEn: 'Insert Horizontal Rule and Text Box',
        instruction: 'Chèn một Đường kẻ ngang (Horizontal Rule) để tách phần nội dung và chèn một Hộp chữ (Text Box) ghi chú lưu ý cho ứng viên.',
        instructionEn: 'Insert both a Horizontal Line and a Text Box callout into the agenda.',
        ribbonPath: 'Chèn → Đường kẻ · Chèn → Hộp chữ',
        hint: 'Mở thẻ Chèn (Insert), bấm Đường kẻ ở nhóm Minh hoạ, sau đó bấm Hộp chữ ở nhóm Văn bản.',
        points: 20,
        check: (content) => {
          const nodes = collectNodes(content.json);
          const hasHr = nodes.some((n) => n.type === 'horizontalRule');
          const hasBox = nodes.some((n) => n.type === 'textBox');
          if (hasHr && hasBox) return { passed: true, detail: 'Đã chèn đường kẻ ngang và hộp chữ lưu ý.' };
          const issues: string[] = [];
          if (!hasHr) issues.push('chưa có đường kẻ ngang');
          if (!hasBox) issues.push('chưa có Hộp chữ');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w5a-t5',
        domainId: 'word-tables',
        title: 'Thêm danh sách kiểm tra (Task List)',
        titleEn: 'Insert a Checklist (Task List)',
        instruction: 'Chèn một Danh sách việc cần làm (Checklist / Task List) có tối thiểu 2 đầu mục chuẩn bị hồ sơ phỏng vấn.',
        instructionEn: 'Insert a Task Checklist with at least 2 preparation items.',
        ribbonPath: 'Trang chủ → Danh sách việc cần làm',
        hint: 'Đặt con trỏ cuối tài liệu, trên thẻ Trang chủ bấm biểu tượng Danh sách việc cần làm (ô tick) và gõ ít nhất 2 mục.',
        points: 20,
        check: (content) => {
          const ok = collectNodes(content.json).some((n) => n.type === 'taskList' && (n.content?.length ?? 0) >= 2);
          return ok
            ? { passed: true, detail: 'Đã thêm danh sách kiểm tra gồm từ 2 mục trở lên.' }
            : { passed: false, detail: 'Chưa có danh sách việc cần làm (Task List) tối thiểu 2 mục.' };
        },
      },
    ],
  },
  {
    id: 'word-newsletter-q4',
    track: 'word',
    level: 'associate',
    kind: 'doc',
    order: 6,
    title: 'Bản tin Nội bộ Quý IV',
    titleEn: 'Q4 Internal Newsletter',
    fileName: 'BanTin_NoiBo_Q4.docx',
    scenario: 'Bạn phụ trách biên tập bản tin nội bộ phát hành toàn công ty: cần thiết lập lề hành chính, chữ cái lớn đầu đoạn (Drop Cap), dấu trang, chữ in nghiêng và tác giả tài liệu.',
    scenarioEn: 'Edit the Q4 company newsletter with custom margins, a Drop Cap paragraph, a Bookmark, italic emphasis, and Author/Company metadata.',
    minutes: 7,
    difficulty: 'Trung bình',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), margins: { top: 96, right: 96, bottom: 96, left: 96 }, properties: {}, hyphenate: false, hyphenMode: 'none' },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'Bản tin Nội bộ Minh Spark · Số Quý IV'),
          para('Quý IV ghi nhận cột mốc ra mắt thành công bộ công cụ Office 23 đa nền tảng cùng hàng loạt tính năng xử lý tài liệu ngoại tuyến.'),
          heading(2, 'Gương mặt tiêu biểu'),
          para('Nhóm kỹ thuật đã hoàn thiện công cụ chuyển đổi 22 định dạng tài liệu với tốc độ xử lý vượt kỳ vọng.'),
          heading(2, 'Sự kiện cuối năm'),
          para('Tiệc tổng kết năm sẽ diễn ra vào ngày 26/12 tại Hội trường A với nhiều phần thưởng hấp dẫn.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'w6a-t1',
        domainId: 'word-format',
        title: 'Tạo chữ cái lớn đầu đoạn (Drop Cap)',
        titleEn: 'Apply Drop Cap to opening paragraph',
        instruction: 'Áp dụng kiểu Chữ lớn đầu đoạn (Drop Cap) cho đoạn mở đầu bắt đầu bằng “Quý IV ghi nhận”.',
        instructionEn: 'Apply a Drop Cap to the opening paragraph starting with “Quý IV ghi nhận”.',
        ribbonPath: 'Chèn → Chữ lớn đầu đoạn (Drop Cap)',
        hint: 'Đặt con trỏ trong đoạn “Quý IV ghi nhận…”, mở thẻ Chèn → Chữ lớn đầu đoạn → chọn Thả trong đoạn (Dropped) hoặc Ra lề.',
        points: 20,
        check: (content) => {
          const ok = collectNodes(content.json).some((n) => n.type === 'paragraph' && Boolean(n.attrs?.dropCap));
          return ok
            ? { passed: true, detail: 'Đã áp dụng Drop Cap cho đoạn mở đầu.' }
            : { passed: false, detail: 'Chưa có đoạn văn nào được bật Chữ lớn đầu đoạn (Drop Cap).' };
        },
      },
      {
        id: 'w6a-t2',
        domainId: 'word-refs',
        title: 'Gắn Dấu trang (Bookmark) điều hướng',
        titleEn: 'Insert a Bookmark',
        instruction: 'Chèn ít nhất một Dấu trang (Bookmark) tại mục “Sự kiện cuối năm” để người đọc nhảy nhanh.',
        instructionEn: 'Insert a Bookmark at the “Sự kiện cuối năm” section.',
        copyTokens: ['SuKienCuoiNam'],
        ribbonPath: 'Chèn → Dấu trang',
        hint: 'Đặt con trỏ tại tiêu đề “Sự kiện cuối năm”, mở thẻ Chèn → Dấu trang → nhập tên dấu trang (ví dụ SuKienCuoiNam) rồi lưu.',
        points: 20,
        check: (content) =>
          collectNodes(content.json).some((n) => n.type === 'bookmark')
            ? { passed: true, detail: 'Đã gắn Dấu trang (Bookmark) trong tài liệu.' }
            : { passed: false, detail: 'Chưa thấy Dấu trang (Bookmark) nào trong tài liệu.' },
      },
      {
        id: 'w6a-t3',
        domainId: 'word-manage',
        title: 'Điền Tác giả và Đơn vị trong thuộc tính tệp',
        titleEn: 'Set Author and Company properties',
        instruction: 'Trong Thông tin mô tả tệp, điền Tác giả (Author) chứa “Ban Truyền thông” và Đơn vị (Company) chứa “Minh Spark”.',
        instructionEn: 'Set Author to include “Ban Truyền thông” and Company to include “Minh Spark”.',
        copyTokens: ['Ban Truyền thông', 'Minh Spark'],
        ribbonPath: 'Tệp → Thông tin → Thông tin mô tả',
        hint: 'Mở thẻ Tệp → Thông tin, điền “Ban Truyền thông” vào ô Tác giả và “Minh Spark” vào ô Đơn vị.',
        points: 20,
        check: (content) => {
          const a = foldText(content.page.properties?.author ?? '').includes('ban truyen thong');
          const c = foldText(content.page.properties?.company ?? '').includes('minh spark');
          if (a && c) return { passed: true, detail: 'Đã điền đúng Tác giả và Đơn vị.' };
          const issues: string[] = [];
          if (!a) issues.push('Tác giả chưa chứa “Ban Truyền thông”');
          if (!c) issues.push('Đơn vị chưa chứa “Minh Spark”');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w6a-t4',
        domainId: 'word-format',
        title: 'In nghiêng và đổi màu chữ cụm từ nổi bật',
        titleEn: 'Italicize and recolor Office 23',
        instruction: 'Áp dụng kiểu In nghiêng (Italic) cho cụm từ “Office 23” trong đoạn mở đầu.',
        instructionEn: 'Apply Italic formatting to “Office 23” in the opening paragraph.',
        ribbonPath: 'Trang chủ → Nghiêng (Ctrl+I)',
        hint: 'Bôi chọn cụm từ “Office 23” rồi nhấn Ctrl+I hoặc bấm nút Nghiêng (I) trên thẻ Trang chủ.',
        points: 20,
        check: (content) =>
          hasMarkOnText(content, 'italic', 'office 23')
            ? { passed: true, detail: 'Đã định dạng in nghiêng cụm từ “Office 23”.' }
            : { passed: false, detail: 'Cụm từ “Office 23” chưa được in nghiêng.' },
      },
      {
        id: 'w6a-t5',
        domainId: 'word-manage',
        title: 'Bật tự động ngắt từ cuối dòng (Hyphenation)',
        titleEn: 'Enable Automatic Hyphenation',
        instruction: 'Bật chế độ Ngắt từ cuối dòng (Hyphenation) sang Tự động (Automatic).',
        instructionEn: 'Enable Automatic Hyphenation for the document.',
        ribbonPath: 'Bố cục → Ngắt từ → Tự động',
        hint: 'Mở thẻ Bố cục (Layout) → bấm Ngắt từ → chọn Tự động.',
        points: 20,
        check: (content) =>
          content.page.hyphenate || content.page.hyphenMode === 'auto'
            ? { passed: true, detail: 'Đã bật Ngắt từ tự động.' }
            : { passed: false, detail: 'Chưa bật chế độ Ngắt từ tự động.' },
      },
    ],
  },
  {
    id: 'word-science-summary',
    track: 'word',
    level: 'associate',
    kind: 'doc',
    order: 7,
    title: 'Tóm tắt Báo cáo Khoa học & Công thức',
    titleEn: 'Science Summary & Equations Report',
    fileName: 'TomTat_KhoaHoc.docx',
    scenario: 'Tài liệu nghiên cứu khoa học cần bổ sung công thức toán học, chỉ số trên/dưới, đánh số trang dạng La Mã, bảng màu Xanh dương và giữ tiêu đề liền đoạn.',
    scenarioEn: 'Complete the scientific report with a mathematical equation, superscript/subscript notation, Roman page numbering, Blue color palette, and Keep With Next.',
    minutes: 8,
    difficulty: 'Nâng cao',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), pageNumberFormat: 'plain', pageNumbers: true, colorsId: 'office', fontsId: 'office' },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'Tóm tắt Thí nghiệm Năng lượng Sạch'),
          para('Phản ứng tạo nước tinh khiết từ khí hydro và oxy theo công thức H2O giải phóng năng lượng sạch không phát thải CO2.'),
          heading(2, 'Công thức tính công suất điện'),
          para('Chèn công thức toán học chuẩn ngay dưới mục này và giữ tiêu đề luôn đi liền đoạn nội dung.'),
          heading(2, 'Kết luận thực nghiệm'),
          para('Hiệu suất chuyển đổi đạt 94% trong điều kiện nhiệt độ tiêu chuẩn 25°C.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'w7a-t1',
        domainId: 'word-tables',
        title: 'Chèn công thức toán học (Equation)',
        titleEn: 'Insert a Math Equation',
        instruction: 'Chèn ít nhất một Công thức toán học (Equation) dựng sẵn hoặc tự nhập vào tài liệu.',
        instructionEn: 'Insert at least one Mathematical Equation object into the document.',
        ribbonPath: 'Chèn → Công thức (Alt+=)',
        hint: 'Mở thẻ Chèn (Insert) → bấm Công thức → chọn một công thức dựng sẵn hoặc nhập công thức mới rồi chèn.',
        points: 20,
        check: (content) =>
          collectNodes(content.json).some((n) => n.type === 'equation')
            ? { passed: true, detail: 'Đã chèn đối tượng Công thức toán học.' }
            : { passed: false, detail: 'Chưa thấy công thức toán học nào được chèn.' },
      },
      {
        id: 'w7a-t2',
        domainId: 'word-format',
        title: 'Định dạng chỉ số dưới (Subscript) cho số 2',
        titleEn: 'Apply Subscript to chemical formula digit',
        instruction: 'Định dạng Chỉ số dưới (Subscript) cho số “2” trong công thức H2O hoặc CO2.',
        instructionEn: 'Format the digit “2” in H2O or CO2 as Subscript.',
        ribbonPath: 'Trang chủ → Chỉ số dưới (Ctrl+,)',
        hint: 'Bôi chọn chữ số “2” trong H2O hoặc CO2 rồi bấm biểu tượng x₂ (Chỉ số dưới) trên thẻ Trang chủ.',
        points: 20,
        check: (content) =>
          hasMarkOnText(content, 'subscript', '2')
            ? { passed: true, detail: 'Đã áp dụng chỉ số dưới cho số 2 trong công thức hoá học.' }
            : { passed: false, detail: 'Chưa thấy chữ số “2” nào được định dạng Chỉ số dưới (Subscript).' },
      },
      {
        id: 'w7a-t3',
        domainId: 'word-manage',
        title: 'Đổi Bảng màu và Cặp phông tài liệu',
        titleEn: 'Change Document Color Palette and Font Pair',
        instruction: 'Trong thẻ Thiết kế, đổi Bảng màu (Colors) khác mặc định và đổi Cặp phông (Fonts) khác mặc định.',
        instructionEn: 'Change both the Document Colors palette and Fonts pair to non-default selections.',
        ribbonPath: 'Thiết kế → Màu · Thiết kế → Phông',
        hint: 'Mở thẻ Thiết kế (Design), bấm Màu chọn một bảng màu mới (ví dụ Xanh dương), rồi bấm Phông chọn một cặp phông mới.',
        points: 20,
        check: (content) => {
          const cOk = Boolean(content.page.colorsId && content.page.colorsId !== 'office');
          const fOk = Boolean(content.page.fontsId && content.page.fontsId !== 'office');
          if (cOk && fOk) return { passed: true, detail: `Đã đổi bảng màu (${content.page.colorsId}) và cặp phông (${content.page.fontsId}).` };
          const issues: string[] = [];
          if (!cOk) issues.push('chưa đổi Bảng màu');
          if (!fOk) issues.push('chưa đổi Cặp phông');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'w7a-t4',
        domainId: 'word-refs',
        title: 'Đổi định dạng số trang sang chữ số La Mã',
        titleEn: 'Format page numbers as Roman numerals',
        instruction: 'Đổi kiểu hiển thị Số trang sang định dạng La Mã (Roman) trong hộp thoại Đầu/chân trang.',
        instructionEn: 'Change the Page Number format to Roman numerals.',
        ribbonPath: 'Bố cục → Đầu/chân trang → Kiểu số trang: La Mã',
        hint: 'Mở Bố cục → Đầu/chân trang, chọn Kiểu số trang là La Mã (i, ii, iii) và lưu.',
        points: 20,
        check: (content) =>
          content.page.pageNumberFormat === 'roman'
            ? { passed: true, detail: 'Đã đổi số trang sang định dạng La Mã.' }
            : { passed: false, detail: `Định dạng số trang hiện là “${content.page.pageNumberFormat ?? 'plain'}”, cần chọn Roman (La Mã).` },
      },
      {
        id: 'w7a-t5',
        domainId: 'word-format',
        title: 'Giữ tiêu đề liền với đoạn sau (Keep with next)',
        titleEn: 'Enable Keep With Next on heading',
        instruction: 'Bật tuỳ chọn Giữ với đoạn sau (Keep with next) cho tiêu đề “Công thức tính công suất điện”.',
        instructionEn: 'Enable Keep With Next on the “Công thức tính công suất điện” heading.',
        ribbonPath: 'Bố cục → Giữ với đoạn sau',
        hint: 'Đặt con trỏ vào dòng “Công thức tính công suất điện”, mở thẻ Bố cục → bấm nút Giữ với đoạn sau ở nhóm Đoạn liền.',
        points: 20,
        check: (content) => {
          const ok = collectNodes(content.json).some((n) => (n.type === 'heading' || n.type === 'paragraph') && Boolean(n.attrs?.keepNext));
          return ok
            ? { passed: true, detail: 'Đã bật tuỳ chọn Giữ với đoạn sau (Keep with next).' }
            : { passed: false, detail: 'Chưa có tiêu đề hoặc đoạn văn nào bật Giữ với đoạn sau.' };
        },
      },
    ],
  },
];
