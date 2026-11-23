import { basePage, type DocContent } from '../storage';
import type { MosWordProject } from './types';
import { collectNodes, foldText, fullDocText, heading, nodeText, para } from './wordHelpers';

export const MOS_WORD_EXPERT_PROJECTS: MosWordProject[] = [
  {
    id: 'word-expert-thesis',
    track: 'word',
    level: 'expert',
    kind: 'doc',
    order: 1,
    title: 'Luận văn & Tham chiếu Học thuật (Expert)',
    titleEn: 'Academic Thesis & References (Expert)',
    fileName: 'LuanVan_ChuyenSau.docx',
    scenario: 'Dự án MOS Word Expert: xử lý tài liệu dài với trang đầu khác biệt, nguồn trích dẫn học thuật, thư mục tham khảo, chú thích cuối tài liệu và chỉ mục.',
    scenarioEn: 'Configure a long academic thesis with Different First Page header, Bibliography source & list, Endnote, Index entry & table, and a callout Text Box.',
    minutes: 10,
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
        id: 'we1-t1',
        domainId: 'word-manage',
        title: 'Bật Trang đầu khác và đầu trang nội dung',
        titleEn: 'Enable Different First Page and Content Header',
        instruction: 'Bật tuỳ chọn Trang đầu khác (Different First Page) và thiết lập Đầu trang (Header) chứa “Luận văn 2026”.',
        instructionEn: 'Enable Different First Page and set the main Header to contain “Luận văn 2026”.',
        copyTokens: ['Luận văn 2026'],
        ribbonPath: 'Bố cục → Đầu/chân trang → bật Trang đầu khác',
        hint: 'Vào Bố cục → Đầu/chân trang, đánh dấu ô Trang đầu khác và nhập “Luận văn 2026” vào ô Đầu trang.',
        points: 20,
        check: (content) => {
          const diff = Boolean(content.page.differentFirstPage);
          const hasHeader = foldText(content.page.header ?? '').includes('luan van 2026');
          if (diff && hasHeader) return { passed: true, detail: 'Đã bật Trang đầu khác và thiết lập đầu trang “Luận văn 2026”.' };
          const issues: string[] = [];
          if (!diff) issues.push('chưa bật Trang đầu khác');
          if (!hasHeader) issues.push('Đầu trang chưa chứa “Luận văn 2026”');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'we1-t2',
        domainId: 'word-refs',
        title: 'Thêm nguồn và chèn Thư mục tham khảo',
        titleEn: 'Add Citation Source and Insert Bibliography',
        instruction: 'Thêm ít nhất một Nguồn tài liệu tham khảo (Source) và chèn khối Thư mục (Bibliography) vào cuối luận văn.',
        instructionEn: 'Add at least one bibliographic Source and insert a Bibliography block.',
        ribbonPath: 'Tham chiếu → Quản lý nguồn · Tham chiếu → Thư mục',
        hint: 'Mở thẻ Tham chiếu → Quản lý nguồn để thêm 1 nguồn sách/bài báo, sau đó bấm Thư mục → chọn Tài liệu tham khảo.',
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
        id: 'we1-t3',
        domainId: 'word-refs',
        title: 'Chèn Chú thích cuối tài liệu (Endnote)',
        titleEn: 'Insert an Endnote',
        instruction: 'Chèn ít nhất một Chú thích cuối tài liệu (Endnote) bổ sung ghi chú phương pháp nghiên cứu.',
        instructionEn: 'Insert an Endnote containing methodology notes.',
        ribbonPath: 'Tham chiếu → Chèn chú thích cuối (Ctrl+Alt+D)',
        hint: 'Đặt con trỏ cuối đoạn Chương 2, mở thẻ Tham chiếu → bấm Chèn chú thích cuối và nhập nội dung.',
        points: 20,
        check: (content) =>
          collectNodes(content.json).some((n) => n.type === 'footnote' && n.attrs?.kind === 'end' && String(n.attrs?.text ?? '').trim().length > 0)
            ? { passed: true, detail: 'Đã chèn chú thích cuối tài liệu (Endnote).' }
            : { passed: false, detail: 'Chưa thấy Endnote (chú thích cuối tài liệu) nào.' },
      },
      {
        id: 'we1-t4',
        domainId: 'word-refs',
        title: 'Đánh dấu mục và chèn Chỉ mục (Index)',
        titleEn: 'Mark Index Entry and Insert Index',
        instruction: 'Đánh dấu ít nhất một thuật ngữ vào chỉ mục (Mark Entry) và chèn bảng Chỉ mục (Index) vào tài liệu.',
        instructionEn: 'Mark at least one term as an Index Entry and insert an Index table.',
        ribbonPath: 'Tham chiếu → Đánh dấu mục · Tham chiếu → Chèn chỉ mục',
        hint: 'Bôi chọn một từ khoá, vào thẻ Tham chiếu → Đánh dấu mục, sau đó bấm Chèn chỉ mục ở cuối bài.',
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
        id: 'we1-t5',
        domainId: 'word-tables',
        title: 'Chèn Hộp chữ (Text Box) hoặc Dấu trang',
        titleEn: 'Insert a Text Box or Bookmark',
        instruction: 'Chèn một Hộp chữ (Text Box) tóm tắt kết quả nổi bật hoặc gắn một Dấu trang (Bookmark) điều hướng nhanh.',
        instructionEn: 'Insert a summary Text Box or navigation Bookmark.',
        ribbonPath: 'Chèn → Hộp chữ / Chèn → Dấu trang',
        hint: 'Mở thẻ Chèn (Insert) → chọn Hộp chữ hoặc Dấu trang.',
        points: 20,
        check: (content) => {
          const nodes = collectNodes(content.json);
          return nodes.some((n) => n.type === 'textBox' || n.type === 'bookmark')
            ? { passed: true, detail: 'Đã chèn Hộp chữ / Dấu trang vào tài liệu.' }
            : { passed: false, detail: 'Chưa thấy Hộp chữ (Text Box) hay Dấu trang (Bookmark) nào.' };
        },
      },
    ],
  },
  {
    id: 'word-expert-manual',
    track: 'word',
    level: 'expert',
    kind: 'doc',
    order: 2,
    title: 'Sổ tay Vận hành & In ấn 2 mặt (Expert)',
    titleEn: 'Operations Manual & Duplex Layout (Expert)',
    fileName: 'SoTay_VanHanh_Expert.docx',
    scenario: 'Tài liệu in đóng quyển 2 mặt đòi hỏi lề đối xứng (Mirrored Margins), đầu trang chẵn/lẻ khác biệt, đánh số trang bắt đầu từ 3, đánh số đề mục và mục lục tự động.',
    scenarioEn: 'Prepare a bound duplex manual with Mirrored margins, Different Odd & Even pages, page numbering starting at 3, custom heading numbering, and a Table of Contents.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), mirrorMargins: false, differentOddEven: false, pageNumberStart: 1, headingNumbers: 'none', pageNumbers: true },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'Sổ tay Quy trình Vận hành Hệ thống'),
          heading(2, 'Quy trình khởi động máy chủ'),
          para('Kiểm tra trạng thái nguồn điện dự phòng và nhật ký hệ thống trước khi mở kết nối.'),
          heading(2, 'Quy trình sao lưu định kỳ'),
          para('Thực hiện sao lưu mã hoá vào lúc 02:00 hàng ngày và xác minh chữ ký toàn vẹn.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'we2-t1',
        domainId: 'word-manage',
        title: 'Thiết lập lề Đối xứng (Mirrored Margins)',
        titleEn: 'Apply Mirrored Margins',
        instruction: 'Áp dụng mẫu lề Đối xứng (Mirrored Margins) để chuẩn bị in đóng gáy hai mặt.',
        instructionEn: 'Apply Mirrored Margins for two-sided book printing.',
        ribbonPath: 'Bố cục → Lề → Đối xứng',
        hint: 'Mở thẻ Bố cục (Layout) → bấm Lề → chọn Đối xứng (Mirrored).',
        points: 20,
        check: (content) =>
          content.page.mirrorMargins
            ? { passed: true, detail: 'Đã bật chế độ lề Đối xứng (Mirrored Margins).' }
            : { passed: false, detail: 'Chưa áp dụng lề Đối xứng.' },
      },
      {
        id: 'we2-t2',
        domainId: 'word-manage',
        title: 'Bật đầu/chân trang Chẵn – Lẻ khác nhau',
        titleEn: 'Enable Different Odd & Even Pages',
        instruction: 'Bật tuỳ chọn Trang chẵn/lẻ khác nhau (Different Odd & Even) và nhập đầu trang chẵn chứa “Sổ tay Vận hành”.',
        instructionEn: 'Enable Different Odd & Even pages and enter “Sổ tay Vận hành” in the Even page header.',
        copyTokens: ['Sổ tay Vận hành'],
        ribbonPath: 'Bố cục → Đầu/chân trang → Trang chẵn/lẻ khác nhau',
        hint: 'Mở hộp thoại Đầu/chân trang, tích chọn Trang chẵn/lẻ khác nhau rồi nhập “Sổ tay Vận hành” vào ô Đầu trang chẵn.',
        points: 20,
        check: (content) => {
          const oddEven = Boolean(content.page.differentOddEven);
          const evenHdr = foldText(content.page.headerEven ?? '').includes('so tay van hanh');
          if (oddEven && evenHdr) return { passed: true, detail: 'Đã bật Chẵn/Lẻ khác nhau và điền đầu trang chẵn.' };
          const issues: string[] = [];
          if (!oddEven) issues.push('chưa bật Trang chẵn/lẻ khác nhau');
          if (!evenHdr) issues.push('Đầu trang chẵn chưa chứa “Sổ tay Vận hành”');
          return { passed: false, detail: `Chưa đạt: ${issues.join('; ')}.` };
        },
      },
      {
        id: 'we2-t3',
        domainId: 'word-refs',
        title: 'Đặt số trang bắt đầu từ 3',
        titleEn: 'Start page numbering at 3',
        instruction: 'Cấu hình Số trang bắt đầu đánh số từ trang 3 thay vì 1.',
        instructionEn: 'Set the starting page number to 3.',
        ribbonPath: 'Bố cục → Đầu/chân trang → Bắt đầu từ: 3',
        hint: 'Trong hộp thoại Đầu/chân trang, đổi ô số trang bắt đầu từ 1 sang 3 rồi lưu.',
        points: 20,
        check: (content) =>
          Number(content.page.pageNumberStart ?? 1) === 3
            ? { passed: true, detail: 'Đã đặt số trang bắt đầu từ 3.' }
            : { passed: false, detail: `Số trang bắt đầu hiện là ${content.page.pageNumberStart ?? 1}, cần đặt là 3.` },
      },
      {
        id: 'we2-t4',
        domainId: 'word-refs',
        title: 'Chèn Mục lục tự động 2 cấp',
        titleEn: 'Insert Automatic Table of Contents',
        instruction: 'Chèn một Mục lục tự động vào đầu sổ tay để điều hướng toàn bộ các quy trình.',
        instructionEn: 'Insert an Automatic Table of Contents at the beginning of the manual.',
        ribbonPath: 'Tham chiếu → Mục lục',
        hint: 'Mở thẻ Tham chiếu → Mục lục → chọn Mục lục tự động 1 hoặc 2.',
        points: 20,
        check: (content) =>
          collectNodes(content.json).some((n) => n.type === 'tableOfContents')
            ? { passed: true, detail: 'Đã chèn Mục lục tự động.' }
            : { passed: false, detail: 'Chưa chèn Mục lục tự động.' },
      },
      {
        id: 'we2-t5',
        domainId: 'word-format',
        title: 'Ngắt trang trước đoạn (Page Break Before)',
        titleEn: 'Set Page Break Before on section heading',
        instruction: 'Bật thuộc tính Sang trang trước đoạn (Page Break Before) cho tiêu đề “Quy trình sao lưu định kỳ”.',
        instructionEn: 'Apply Page Break Before to the “Quy trình sao lưu định kỳ” heading.',
        ribbonPath: 'Bố cục → Sang trang trước đoạn',
        hint: 'Đặt con trỏ vào dòng “Quy trình sao lưu định kỳ”, vào thẻ Bố cục → bấm Sang trang trước đoạn.',
        points: 20,
        check: (content) =>
          collectNodes(content.json).some((n) => (n.type === 'heading' || n.type === 'paragraph') && Boolean(n.attrs?.pageBreakBefore))
            ? { passed: true, detail: 'Đã bật Sang trang trước đoạn.' }
            : { passed: false, detail: 'Chưa thấy tiêu đề hoặc đoạn nào bật Sang trang trước đoạn.' },
      },
    ],
  },
  {
    id: 'word-expert-contract',
    track: 'word',
    level: 'expert',
    kind: 'doc',
    order: 3,
    title: 'Hợp đồng Pháp lý & Bảo mật Tài liệu (Expert)',
    titleEn: 'Legal Agreement & Document Protection (Expert)',
    fileName: 'HopDong_PhapLy_Expert.docx',
    scenario: 'Hợp đồng mẫu cần gắn dấu MẬT, thay thế tên đối tác hàng loạt, chèn bảng điều khoản thanh toán, thêm bình luận pháp chế và chuyển kiểu trích dẫn Chicago.',
    scenarioEn: 'Finalize the legal contract with a confidential watermark, full-document party rename, payment terms table, legal comment, and Chicago citation format.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), watermark: '', citationStyle: 'apa', pageBorder: 'none', styles: {} },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'HỢP ĐỒNG CUNG CẤP DỊCH VỤ PHẦN MỀM'),
          para('Bên sử dụng dịch vụ: Công ty ABC Holdings. Đại diện pháp lý của Công ty ABC Holdings chịu trách nhiệm nghiệm thu từng giai đoạn.'),
          heading(2, 'Điều 1: Phạm vi bàn giao'),
          para('Bên cung cấp triển khai bộ ứng dụng văn phòng và đào tạo quản trị viên cho Công ty ABC Holdings.'),
          heading(2, 'Điều 2: Tiến độ thanh toán'),
          para('Chèn bảng tiến độ thanh toán 3 đợt tại đây.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'we3-t1',
        domainId: 'word-format',
        title: 'Thay thế hàng loạt tên đối tác',
        titleEn: 'Replace all instances of party name',
        instruction: 'Dùng Tìm & Thay thế (Ctrl+H) đổi toàn bộ “ABC Holdings” thành “Minh Spark Corp”.',
        instructionEn: 'Replace every occurrence of “ABC Holdings” with “Minh Spark Corp”.',
        copyTokens: ['ABC Holdings', 'Minh Spark Corp'],
        ribbonPath: 'Trang chủ → Thay thế (Ctrl+H)',
        hint: 'Nhấn Ctrl+H, tìm “ABC Holdings”, thay bằng “Minh Spark Corp” rồi bấm Thay tất cả.',
        points: 20,
        check: (content) => {
          const txt = foldText(fullDocText(content));
          return !txt.includes('abc holdings') && txt.includes('minh spark corp')
            ? { passed: true, detail: 'Đã thay toàn bộ “ABC Holdings” thành “Minh Spark Corp”.' }
            : { passed: false, detail: 'Chưa thay thế trọn vẹn “ABC Holdings” thành “Minh Spark Corp”.' };
        },
      },
      {
        id: 'we3-t2',
        domainId: 'word-manage',
        title: 'Gắn hình mờ MẬT / TUYỆT MẬT & Viền trang',
        titleEn: 'Insert Confidential Watermark and Page Border',
        instruction: 'Áp dụng hình mờ “MẬT” hoặc “TUYỆT MẬT” (hoặc “CONFIDENTIAL”) và bật Viền trang cho hợp đồng.',
        instructionEn: 'Apply a “MẬT”, “TUYỆT MẬT”, or “CONFIDENTIAL” watermark and add a Page Border.',
        copyTokens: ['MẬT', 'TUYỆT MẬT'],
        ribbonPath: 'Thiết kế → Hình mờ · Thiết kế → Viền trang',
        hint: 'Mở thẻ Thiết kế → Hình mờ chọn MẬT/CONFIDENTIAL, rồi bấm Viền trang để bật khung viền.',
        points: 20,
        check: (content) => {
          const wm = foldText(content.page.watermark ?? '');
          const wmOk = wm.includes('mat') || wm.includes('confidential');
          const bdOk = Boolean(content.page.pageBorder && content.page.pageBorder !== 'none');
          if (wmOk && bdOk) return { passed: true, detail: 'Đã gắn hình mờ bảo mật và viền trang.' };
          return { passed: false, detail: !wmOk ? 'Chưa gắn hình mờ MẬT / CONFIDENTIAL.' : 'Chưa bật Viền trang.' };
        },
      },
      {
        id: 'we3-t3',
        domainId: 'word-tables',
        title: 'Chèn bảng tiến độ 4 cột × 4 dòng',
        titleEn: 'Insert a 4×4 payment milestone table',
        instruction: 'Chèn bảng tiến độ thanh toán có tối thiểu 4 cột và 4 dòng tại Điều 2.',
        instructionEn: 'Insert a payment schedule table with at least 4 columns and 4 rows.',
        ribbonPath: 'Chèn → Bảng',
        hint: 'Vào thẻ Chèn → Bảng → tạo bảng tối thiểu 4 cột × 4 dòng.',
        points: 20,
        check: (content) => {
          const tables = collectNodes(content.json).filter((n) => n.type === 'table');
          const ok = tables.some((t) => {
            const rows = (t.content ?? []).filter((r) => r.type === 'tableRow');
            const cols = rows.reduce((m, r) => Math.max(m, (r.content ?? []).length), 0);
            return rows.length >= 4 && cols >= 4;
          });
          return ok
            ? { passed: true, detail: 'Đã chèn bảng tối thiểu 4 cột × 4 dòng.' }
            : { passed: false, detail: 'Chưa có bảng nào đạt kích thước tối thiểu 4 cột × 4 dòng.' };
        },
      },
      {
        id: 'we3-t4',
        domainId: 'word-refs',
        title: 'Thêm tối thiểu 2 bình luận pháp chế',
        titleEn: 'Add at least 2 legal review comments',
        instruction: 'Thêm ít nhất 2 Bình luận (Comments) rà soát điều khoản trong hợp đồng.',
        instructionEn: 'Insert at least 2 review Comments into the contract.',
        ribbonPath: 'Xem lại → Bình luận mới',
        hint: 'Mở thẻ Xem lại → bấm Bình luận mới và đăng ít nhất 2 bình luận khác nhau.',
        points: 20,
        check: (content) =>
          (content.comments ?? []).length >= 2
            ? { passed: true, detail: `Đã ghi nhận ${content.comments?.length} bình luận pháp chế.` }
            : { passed: false, detail: `Mới có ${(content.comments ?? []).length}/2 bình luận.` },
      },
      {
        id: 'we3-t5',
        domainId: 'word-refs',
        title: 'Đổi chuẩn trích dẫn sang Chicago',
        titleEn: 'Switch citation style to Chicago',
        instruction: 'Chuyển Kiểu trích dẫn (Citation Style) của tài liệu sang CHICAGO.',
        instructionEn: 'Set the Citation Style to Chicago.',
        ribbonPath: 'Tham chiếu → Kiểu trích dẫn → CHICAGO',
        hint: 'Mở thẻ Tham chiếu → đổi ô chọn Kiểu trích dẫn sang CHICAGO.',
        points: 20,
        check: (content) =>
          content.page.citationStyle === 'chicago'
            ? { passed: true, detail: 'Đã đặt kiểu trích dẫn CHICAGO.' }
            : { passed: false, detail: `Kiểu trích dẫn hiện là ${(content.page.citationStyle ?? 'apa').toUpperCase()}, cần chọn CHICAGO.` },
      },
    ],
  },
  {
    id: 'word-expert-journal',
    track: 'word',
    level: 'expert',
    kind: 'doc',
    order: 4,
    title: 'Bài báo Tạp chí 3 Cột & Danh mục Hình (Expert)',
    titleEn: '3-Column Journal Paper & Captions (Expert)',
    fileName: 'BaiBao_TapChi_Expert.docx',
    scenario: 'Định dạng bài báo khoa học 3 cột, đường phân cột, chú thích hình ảnh/bảng (Caption), công thức toán học và ngắt trang phần phụ lục.',
    scenarioEn: 'Format an academic journal paper into 3 columns with a column rule line, a Caption & Figure List, an Equation, and an Appendix page break.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), columns: 1, columnLine: false, orientation: 'portrait', spacingId: 'none' },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'Tối ưu hoá Mô hình Ngôn ngữ trên Thiết bị Cá nhân'),
          para('Bài viết phân tích kiến trúc lượng tử hoá mô hình chạy hoàn toàn trên máy trạm mà không phụ thuộc đám mây.'),
          heading(2, 'Mô hình toán học'),
          para('Các tham số trọng số được nén xuống 4-bit nhằm giảm 70% dung lượng bộ nhớ.'),
          heading(2, 'Phụ lục dữ liệu đo kiểm'),
          para('Bảng tổng hợp tốc độ suy luận trên 5 cấu hình phần cứng khác nhau.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'we4-t1',
        domainId: 'word-manage',
        title: 'Bố cục Ba cột khổ Ngang',
        titleEn: 'Set 3 Columns in Landscape orientation',
        instruction: 'Chuyển hướng trang sang Ngang (Landscape) và chia toàn tài liệu thành Ba cột (Three Columns).',
        instructionEn: 'Change page orientation to Landscape and set page layout to Three columns.',
        ribbonPath: 'Bố cục → Hướng → Ngang · Bố cục → Cột → Ba cột',
        hint: 'Mở thẻ Bố cục → Hướng → Ngang; tiếp tục bấm Cột → chọn Ba cột.',
        points: 20,
        check: (content) => {
          const land = content.page.orientation === 'landscape';
          const three = (content.page.columns ?? 1) === 3 || collectNodes(content.json).some((n) => n.type === 'columnSection' && Number(n.attrs?.columns) === 3);
          if (land && three) return { passed: true, detail: 'Đã đặt khổ Ngang và chia 3 cột.' };
          return { passed: false, detail: !land ? 'Chưa đổi sang hướng Ngang.' : 'Chưa chia bố cục 3 cột.' };
        },
      },
      {
        id: 'we4-t2',
        domainId: 'word-refs',
        title: 'Chèn Nhãn (Caption) hoặc Danh mục hình',
        titleEn: 'Insert a Caption or List of Figures',
        instruction: 'Chèn ít nhất một Nhãn (Caption) cho hình/bảng hoặc chèn khối Danh mục hình (Table of Figures).',
        instructionEn: 'Insert a Caption label or a Table of Figures block.',
        ribbonPath: 'Tham chiếu → Chèn nhãn / Chèn danh mục hình',
        hint: 'Mở thẻ Tham chiếu → bấm Chèn nhãn (hoặc Chèn danh mục hình) để đánh số tự động.',
        points: 20,
        check: (content) => {
          const nodes = collectNodes(content.json);
          const ok = nodes.some((n) => n.type === 'figureList' || Boolean(n.attrs?.captionKind));
          return ok
            ? { passed: true, detail: 'Đã chèn nhãn/danh mục hình bảng.' }
            : { passed: false, detail: 'Chưa thấy nhãn (Caption) hoặc Danh mục hình nào.' };
        },
      },
      {
        id: 'we4-t3',
        domainId: 'word-tables',
        title: 'Chèn Công thức toán học (Equation)',
        titleEn: 'Insert a Mathematical Equation',
        instruction: 'Chèn ít nhất một Công thức toán học (Equation) minh hoạ phương trình lượng tử hoá.',
        instructionEn: 'Insert at least one Equation into the paper.',
        ribbonPath: 'Chèn → Công thức',
        hint: 'Mở thẻ Chèn → bấm Công thức → chọn công thức dựng sẵn hoặc nhập LaTeX rồi chèn.',
        points: 20,
        check: (content) =>
          collectNodes(content.json).some((n) => n.type === 'equation')
            ? { passed: true, detail: 'Đã chèn công thức toán học.' }
            : { passed: false, detail: 'Chưa chèn công thức toán học.' },
      },
      {
        id: 'we4-t4',
        domainId: 'word-manage',
        title: 'Chèn Ngắt trang trước Phụ lục',
        titleEn: 'Insert Page Break before Appendix',
        instruction: 'Chèn ít nhất một Ngắt trang (Page Break) để tách phần Phụ lục sang trang riêng.',
        instructionEn: 'Insert a Page Break before the Appendix section.',
        ribbonPath: 'Bố cục → Ngắt → Trang (Ctrl+Enter)',
        hint: 'Đặt con trỏ trước “Phụ lục dữ liệu đo kiểm” và nhấn Ctrl+Enter.',
        points: 20,
        check: (content) =>
          collectNodes(content.json).some((n) => n.type === 'pageBreak')
            ? { passed: true, detail: 'Đã chèn ngắt trang tách Phụ lục.' }
            : { passed: false, detail: 'Chưa chèn ngắt trang.' },
      },
      {
        id: 'we4-t5',
        domainId: 'word-format',
        title: 'Áp dụng Giãn đoạn Gọn (Compact) hoặc Khít (Tight)',
        titleEn: 'Set Compact or Tight Paragraph Spacing',
        instruction: 'Đặt Giãn đoạn toàn tài liệu sang kiểu Gọn (Compact) hoặc Khít (Tight) cho bố cục tạp chí.',
        instructionEn: 'Apply Compact or Tight Document Paragraph Spacing.',
        ribbonPath: 'Thiết kế → Giãn đoạn → Gọn / Khít',
        hint: 'Mở thẻ Thiết kế → Giãn đoạn → chọn Gọn hoặc Khít.',
        points: 20,
        check: (content) =>
          content.page.spacingId === 'compact' || content.page.spacingId === 'tight'
            ? { passed: true, detail: `Đã áp dụng giãn đoạn ${content.page.spacingId}.` }
            : { passed: false, detail: 'Chưa chọn kiểu giãn đoạn Gọn hoặc Khít.' },
      },
    ],
  },
  {
    id: 'word-expert-executive-deck',
    track: 'word',
    level: 'expert',
    kind: 'doc',
    order: 5,
    title: 'Hồ sơ Năng lực Doanh nghiệp (Expert)',
    titleEn: 'Corporate Capability Dossier (Expert)',
    fileName: 'HoSo_NangLuc_Expert.docx',
    scenario: 'Hoàn thiện hồ sơ dự thầu chuẩn cấp cao gồm Trang bìa (Cover Page), hiệu ứng hình ảnh, bảng nhân sự chủ chốt, siêu liên kết hồ sơ và tuỳ biến kiểu Heading 1.',
    scenarioEn: 'Complete the executive tender dossier with a Cover Page, visual Effect, key staff table, portfolio hyperlink, and custom Heading 1 styling.',
    minutes: 10,
    difficulty: 'Nâng cao',
    createStarter: (): DocContent => ({
      kind: 'doc',
      page: { ...basePage(), effect: undefined, properties: {}, styles: {} },
      comments: [],
      json: {
        type: 'doc',
        content: [
          heading(1, 'HỒ SƠ NĂNG LỰC CÔNG TY MINH SPARK'),
          para('Giới thiệu kinh nghiệm triển khai hệ thống phần mềm doanh nghiệp và nền tảng chuyển đổi số.'),
          heading(2, 'Đội ngũ chuyên gia chủ chốt'),
          para('Chèn bảng danh sách nhân sự tại đây và gắn liên kết tới cổng thông tin doanh nghiệp.'),
        ],
      },
    }),
    tasks: [
      {
        id: 'we5-t1',
        domainId: 'word-manage',
        title: 'Chèn Trang bìa dựng sẵn (Cover Page)',
        titleEn: 'Insert a Built-in Cover Page',
        instruction: 'Chèn một Trang bìa dựng sẵn (Cover Page) ở đầu hồ sơ năng lực.',
        instructionEn: 'Insert a built-in Cover Page at the beginning of the dossier.',
        ribbonPath: 'Chèn → Trang bìa',
        hint: 'Mở thẻ Chèn (Insert) → bấm Trang bìa ở nhóm Trang → chọn một mẫu bìa bất kỳ.',
        points: 20,
        check: (content) => {
          const nodes = collectNodes(content.json);
          const hasCover = nodes.some((n) => n.type === 'pageBreak') && nodes.length > 6;
          return hasCover
            ? { passed: true, detail: 'Đã chèn trang bìa ở đầu tài liệu.' }
            : { passed: false, detail: 'Chưa phát hiện trang bìa dựng sẵn ở đầu tài liệu.' };
        },
      },
      {
        id: 'we5-t2',
        domainId: 'word-format',
        title: 'Bật Hiệu ứng tài liệu (Effects)',
        titleEn: 'Apply Document Effects',
        instruction: 'Chọn một kiểu Hiệu ứng (Effects) khác “Không hiệu ứng” trong thẻ Thiết kế.',
        instructionEn: 'Apply any Document Effect other than None in the Design tab.',
        ribbonPath: 'Thiết kế → Hiệu ứng',
        hint: 'Mở thẻ Thiết kế → bấm Hiệu ứng → chọn Đổ bóng, Nhẹ nhàng, hoặc Vát nổi.',
        points: 20,
        check: (content) =>
          content.page.effect && content.page.effect !== 'none'
            ? { passed: true, detail: `Đã áp dụng hiệu ứng tài liệu (${content.page.effect}).` }
            : { passed: false, detail: 'Chưa chọn hiệu ứng tài liệu.' },
      },
      {
        id: 'we5-t3',
        domainId: 'word-tables',
        title: 'Chèn bảng nhân sự chủ chốt 3×3',
        titleEn: 'Insert a 3×3 key personnel table',
        instruction: 'Chèn một bảng dữ liệu tối thiểu 3 cột × 3 dòng liệt kê đội ngũ chuyên gia.',
        instructionEn: 'Insert a key personnel table with at least 3 columns and 3 rows.',
        ribbonPath: 'Chèn → Bảng',
        hint: 'Vào thẻ Chèn → Bảng → chọn tối thiểu 3 cột × 3 dòng.',
        points: 20,
        check: (content) => {
          const ok = collectNodes(content.json).some((n) => {
            if (n.type !== 'table') return false;
            const rows = (n.content ?? []).filter((r) => r.type === 'tableRow');
            const cols = rows.reduce((m, r) => Math.max(m, (r.content ?? []).length), 0);
            return rows.length >= 3 && cols >= 3;
          });
          return ok
            ? { passed: true, detail: 'Đã chèn bảng nhân sự tối thiểu 3×3.' }
            : { passed: false, detail: 'Chưa có bảng nhân sự đạt tối thiểu 3 cột × 3 dòng.' };
        },
      },
      {
        id: 'we5-t4',
        domainId: 'word-refs',
        title: 'Gắn Siêu liên kết và Thuộc tính Từ khoá',
        titleEn: 'Add Hyperlink and Keywords property',
        instruction: 'Chèn một Siêu liên kết bất kỳ trong tài liệu và thêm Từ khoá (Keywords) chứa “HoSoNangLuc”.',
        instructionEn: 'Insert any Hyperlink in the document and set Keywords to include “HoSoNangLuc”.',
        copyTokens: ['HoSoNangLuc', 'https://office.minhspark.com'],
        ribbonPath: 'Chèn → Liên kết · Tệp → Thông tin → Từ khoá',
        hint: 'Chèn 1 siêu liên kết bằng Ctrl+K, sau đó vào Tệp → Thông tin nhập “HoSoNangLuc” vào ô Từ khoá.',
        points: 20,
        check: (content) => {
          const hasLink = collectNodes(content.json).some(
            (n) => n.type === 'text' && Array.isArray(n.marks) && n.marks.some((m) => m.type === 'link'),
          );
          const hasKw = foldText(content.page.properties?.keywords ?? '').includes('hosonangluc');
          if (hasLink && hasKw) return { passed: true, detail: 'Đã gắn siêu liên kết và thuộc tính Từ khoá.' };
          return { passed: false, detail: !hasLink ? 'Chưa chèn siêu liên kết nào.' : 'Từ khoá chưa chứa “HoSoNangLuc”.' };
        },
      },
      {
        id: 'we5-t5',
        domainId: 'word-format',
        title: 'Căn giữa tiêu đề chính HỒ SƠ NĂNG LỰC',
        titleEn: 'Center-align main Heading 1 title',
        instruction: 'Căn giữa (Center) dòng tiêu đề Heading 1 “HỒ SƠ NĂNG LỰC CÔNG TY MINH SPARK”.',
        instructionEn: 'Center-align the main Heading 1 “HỒ SƠ NĂNG LỰC CÔNG TY MINH SPARK”.',
        ribbonPath: 'Trang chủ → Căn giữa (Ctrl+E)',
        hint: 'Đặt con trỏ vào dòng “HỒ SƠ NĂNG LỰC CÔNG TY MINH SPARK” và bấm Căn giữa.',
        points: 20,
        check: (content) => {
          const ok = collectNodes(content.json).some(
            (n) => n.type === 'heading' && foldText(nodeText(n)).includes('ho so nang luc') && n.attrs?.textAlign === 'center',
          );
          return ok
            ? { passed: true, detail: 'Tiêu đề chính đã được căn giữa.' }
            : { passed: false, detail: 'Tiêu đề “HỒ SƠ NĂNG LỰC…” chưa được căn giữa.' };
        },
      },
    ],
  },
];
