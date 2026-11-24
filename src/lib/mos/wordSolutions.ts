export type RawSolutionEntry = {
  steps: string[];
  formulaOrValue?: string;
  shortcut?: string;
  examTrap?: string;
  verifyTip: string;
};

export const WORD_SOLUTIONS: Record<string, RawSolutionEntry> = {
  'w1-t1': {
    steps: [
      'Mở thẻ Bố cục (Layout) trên thanh Ribbon của 23 Docs.',
      'Trong nhóm Thiết lập trang (Page Setup), bấm Hướng (Orientation) → chọn Ngang (Landscape).',
      'Tiếp tục bấm Lề (Margins) → chọn mẫu Hẹp (Narrow — 1,27 cm cho cả 4 lề Trên, Dưới, Trái, Phải).',
    ],
    shortcut: 'Alt + P → O / M',
    examTrap: 'Đừng quên chỉnh đủ cả 2 yêu cầu Hướng Ngang và Lề Hẹp; bỏ sót 1 trong 2 sẽ không đạt điểm câu này.',
    verifyTip: 'Quan sát thước ngang dài hơn và lề giấy thu gọn sát mép ~1,27 cm đều 4 phía.',
  },
  'w1-t2': {
    steps: [
      'Chuyển sang thẻ Thiết kế (Design) trên thanh Ribbon.',
      'Tại nhóm Nền trang (Page Background), bấm nút Hình mờ (Watermark).',
      'Chọn mẫu dựng sẵn BẢN NHÁP hoặc CONFIDENTIAL (hoặc nhập đúng chuỗi trong hộp thoại Hình mờ tuỳ chỉnh) rồi xác nhận.',
    ],
    formulaOrValue: 'CONFIDENTIAL',
    examTrap: 'Không gõ chữ mờ thủ công vào Header; máy chấm MOS đọc trực tiếp thuộc tính Watermark của trang.',
    verifyTip: 'Thấy chữ mờ nghiêng “CONFIDENTIAL” hoặc “BẢN NHÁP” hiện đều phía sau văn bản.',
  },
  'w1-t3': {
    steps: [
      'Bấm thẻ Tệp (File) ở góc trên cùng bên trái để vào Backstage.',
      'Chọn mục Thông tin (Info) → mở khung Thông tin mô tả (Document Properties).',
      'Nhập “Hội nghị Xanh” vào ô Chủ đề (Subject) và “MOS” vào ô Từ khoá (Keywords), sau đó bấm Lưu.',
    ],
    formulaOrValue: 'Subject: Hội nghị Xanh | Keywords: MOS',
    examTrap: 'Điền đúng 2 trường Subject và Keywords riêng biệt, không gộp chung cả hai vào ô Title hoặc Comments.',
    verifyTip: 'Mở lại Tệp → Thông tin thấy đủ cả Subject chứa “Hội nghị Xanh” và Keywords chứa “MOS”.',
  },
  'w1-t4': {
    steps: [
      'Đặt con trỏ vào dòng đầu tiên “Tổng quan chương trình” (không cần bôi đen cả dòng).',
      'Ở thẻ Trang chủ (Home), trong thư viện Kiểu (Styles), bấm chọn Heading 1.',
      'Nhấn tổ hợp Ctrl + E hoặc bấm biểu tượng Căn giữa (Center) trong nhóm Đoạn văn.',
    ],
    shortcut: 'Ctrl + E',
    examTrap: 'Không tự phóng to chữ và tô đậm thủ công thay cho Style Heading 1 — Mục lục ở Task 5 cần đúng Heading 1.',
    verifyTip: 'Dòng “Tổng quan chương trình” nằm chính giữa trang và xuất hiện trong ngăn Điều hướng (Navigation).',
  },
  'w1-t5': {
    steps: [
      'Đặt con trỏ tại vị trí muốn đặt mục lục (thường ở đầu tài liệu ngay dưới tiêu đề chính).',
      'Mở thẻ Tham chiếu (References) trên thanh Ribbon.',
      'Bấm Mục lục (Table of Contents) → chọn Mục lục tự động 1 hoặc 2 để chèn khối mục lục động.',
    ],
    examTrap: 'Không gõ danh sách mục lục bằng tay; phải dùng khối Table of Contents tự động từ thẻ Tham chiếu.',
    verifyTip: 'Khối Mục lục tự động hiển thị danh sách tiêu đề Heading kèm số trang tương ứng.',
  },
  'w2-t1': {
    steps: [
      'Mở thẻ Bố cục (Layout) trên thanh Ribbon.',
      'Bấm nút Cột (Columns) trong nhóm Thiết lập trang.',
      'Chọn Hai cột (Two) để chia toàn văn bản thành 2 cột song song.',
    ],
    examTrap: 'Tránh dùng bảng 2 cột để giả lập chia cột báo chí; trình chấm kiểm tra thuộc tính Columns = 2.',
    verifyTip: 'Nội dung văn bản tự chảy thành 2 cột trái/phải rõ rệt trên trang giấy.',
  },
  'w2-t2': {
    steps: [
      'Mở thẻ Bố cục (Layout) → bấm Đầu/chân trang (Header & Footer).',
      'Nhập “Minh Spark Academy” vào ô Đầu trang (Header).',
      'Đánh dấu bật tuỳ chọn Hiện số trang (Page Numbers) rồi bấm Áp dụng / Lưu.',
    ],
    formulaOrValue: 'Minh Spark Academy',
    examTrap: 'Nhớ kiểm tra cả hai điều kiện: chuỗi “Minh Spark Academy” ở Header và công tắc Số trang đang bật.',
    verifyTip: 'Đầu trang hiển thị “Minh Spark Academy” và chân trang có đánh số trang.',
  },
  'w2-t3': {
    steps: [
      'Đặt con trỏ ở cuối tài liệu dưới mục lịch đào tạo.',
      'Mở thẻ Chèn (Insert) → bấm nút Bảng (Table).',
      'Kéo chọn lưới tối thiểu 3 cột × 4 dòng (hoặc nhập 3 cột, 4 dòng trong hộp thoại Chèn bảng) rồi xác nhận.',
    ],
    examTrap: 'Chú ý phân biệt đúng 3 cột (ngang) × 4 dòng (dọc), không chèn ngược thành 4×3 sẽ thiếu số dòng.',
    verifyTip: 'Đếm lại bảng có ít nhất 3 cột và 4 hàng ngang đầy đủ.',
  },
  'w2-t4': {
    steps: [
      'Đặt con trỏ ngay sau cụm từ “MOS” trong đoạn văn cần giải thích.',
      'Mở thẻ Tham chiếu (References) → bấm Chèn chú thích chân trang (Insert Footnote).',
      'Nhập nội dung giải thích (ví dụ: “Microsoft Office Specialist — Chứng chỉ tin học văn phòng quốc tế”) rồi bấm Lưu.',
    ],
    shortcut: 'Ctrl + Alt + F',
    examTrap: 'Chọn đúng Footnote (chú thích cuối trang), không bấm nhầm Endnote (chú thích cuối tài liệu).',
    verifyTip: 'Số mũ chú thích xuất hiện trong dòng văn bản và nội dung chú thích hiện cuối trang.',
  },
  'w2-t5': {
    steps: [
      'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
      'Bấm Chủ đề (Themes) ở góc trái và chọn một chủ đề khác mặc định “Office” (ví dụ Ion, Facet hoặc Slice).',
      'Trong nhóm Nền trang, bấm Viền trang (Page Borders) → chọn kiểu viền Đơn, Đôi hoặc Đổ bóng rồi xác nhận.',
    ],
    examTrap: 'Nếu để nguyên chủ đề “Office” mặc định sẽ bị tính chưa đổi Theme.',
    verifyTip: 'Tông màu/phông tài liệu thay đổi và khung viền trang bao quanh 4 cạnh tờ giấy.',
  },
  'w3-t1': {
    steps: [
      'Đặt con trỏ ngay trước dòng tiêu đề “Phần 2: Quy trình xử lý sự cố”.',
      'Mở thẻ Bố cục (Layout) → Ngắt (Breaks) → chọn Trang (Page Break), hoặc nhấn Ctrl + Enter.',
      'Tiếp tục trên thẻ Bố cục → bấm Số dòng (Line Numbers) → chọn Liên tục (Continuous).',
    ],
    shortcut: 'Ctrl + Enter',
    examTrap: 'Không nhấn Enter nhiều lần để đẩy xuống trang sau — bắt buộc chèn Page Break thật.',
    verifyTip: 'Phần 2 nhảy sang đầu trang 2 và cột số dòng hiện dọc bên lề trái.',
  },
  'w3-t2': {
    steps: [
      'Nhấn tổ hợp Ctrl + H (hoặc mở Trang chủ → Thay thế ở góc phải Ribbon).',
      'Nhập “nhân viên cũ” vào ô Tìm (Find what) và “nhân sự mới” vào ô Thay bằng (Replace with).',
      'Bấm Thay tất cả (Replace All) để thay trọn vẹn mọi lần xuất hiện trong tài liệu.',
    ],
    formulaOrValue: 'nhân viên cũ → nhân sự mới',
    shortcut: 'Ctrl + H',
    examTrap: 'Gõ đúng dấu tiếng Việt và dùng Replace All để không bỏ sót lần xuất hiện thứ 2, thứ 3.',
    verifyTip: 'Tìm lại từ “nhân viên cũ” báo 0 kết quả; cụm “nhân sự mới” xuất hiện đầy đủ.',
  },
  'w3-t3': {
    steps: [
      'Bôi đen cả 3 dòng bước ứng phó sự cố dưới Phần 2.',
      'Trên thẻ Trang chủ (Home), bấm nút Danh sách đánh số (Numbered List — 1. 2. 3.).',
      'Bôi chọn từ “bắt buộc” trong văn bản → bấm nút Tô sáng văn bản (Text Highlight Color) chọn màu vàng hoặc xanh nhạt.',
    ],
    examTrap: 'Phải dùng Danh sách đánh số (1. 2. 3.), không chọn nhầm Danh sách dấu đầu dòng (Bullet).',
    verifyTip: '3 bước hiển thị số thứ tự 1, 2, 3 tự động và từ “bắt buộc” có nền tô sáng nổi bật.',
  },
  'w3-t4': {
    steps: [
      'Bôi chọn một cụm từ hoặc đặt con trỏ tại đoạn cần góp ý kiểm duyệt.',
      'Mở thẻ Xem lại (Review) → bấm Bình luận mới (New Comment).',
      'Nhập nội dung nhận xét kiểm duyệt (ví dụ: “Đã rà soát đạt quy chuẩn an toàn”) rồi bấm Gửi.',
    ],
    shortcut: 'Ctrl + Alt + M',
    examTrap: 'Nhớ bấm nút Gửi/Lưu bình luận, tránh để trống hộp nhập chưa xác nhận.',
    verifyTip: 'Thẻ bình luận mới hiển thị trong ngăn Bình luận bên phải tài liệu.',
  },
  'w3-t5': {
    steps: [
      'Mở thẻ Tham chiếu (References) → tại mục Kiểu trích dẫn (Style), chọn IEEE.',
      'Chuyển sang thẻ Thiết kế (Design) → bấm Giãn đoạn (Paragraph Spacing).',
      'Chọn mẫu Thoáng (Open) hoặc Rộng rãi (Relaxed).',
    ],
    examTrap: 'Kiểu trích dẫn nằm ở thẻ Tham chiếu, còn Giãn đoạn toàn tài liệu nằm ở thẻ Thiết kế.',
    verifyTip: 'Ô Kiểu trích dẫn hiện IEEE và khoảng cách các đoạn văn giãn thoáng rõ rệt.',
  },
  'w4a-t1': {
    steps: [
      'Mở thẻ Bố cục (Layout) trên thanh Ribbon.',
      'Bấm nút Khổ (Size) trong nhóm Thiết lập trang.',
      'Chọn khổ giấy Letter (21,59 cm × 27,94 cm).',
    ],
    examTrap: 'Không để nguyên A4 mặc định; kiểm tra đúng chữ “Letter” được chọn.',
    verifyTip: 'Mục Khổ giấy đang chọn hiển thị Letter.',
  },
  'w4a-t2': {
    steps: [
      'Mở thẻ Thiết kế (Design) → nhóm Nền trang (Page Background).',
      'Bấm nút Màu trang (Page Color).',
      'Chọn một màu nền nhẹ khác trắng (ví dụ xanh nhạt #EFF6FF hoặc kem nhạt #FEFCE8).',
    ],
    examTrap: 'Không tô nền đoạn văn (Shading) thay cho Màu trang (Page Color).',
    verifyTip: 'Toàn bộ nền tờ giấy đổi màu đồng nhất khác màu trắng.',
  },
  'w4a-t3': {
    steps: [
      'Bôi đen cả 3 dòng tính năng nổi bật bên dưới tiêu đề “Tính năng nổi bật”.',
      'Mở thẻ Trang chủ (Home) → nhóm Đoạn văn.',
      'Bấm nút Dấu đầu dòng (Bullet List) để tạo danh sách 3 mục.',
    ],
    examTrap: 'Cần đủ tối thiểu 3 mục nằm trong cùng một Bullet List, không gõ ký tự dấu gạch ngang thủ công.',
    verifyTip: '3 dòng tính năng thụt lề kèm chấm tròn đầu dòng tự động.',
  },
  'w4a-t4': {
    steps: [
      'Đặt con trỏ vào dòng “Khách hàng chia sẻ: Gia đình tôi giảm được 28%…”.',
      'Trên thẻ Trang chủ (Home), bấm biểu tượng Trích dẫn (Blockquote) để định dạng khối trích dẫn.',
      'Bôi chọn chính xác chuỗi “28%” rồi nhấn Ctrl + B (hoặc bấm nút Đậm B).',
    ],
    shortcut: 'Ctrl + B',
    examTrap: 'Nhớ hoàn tất cả 2 vế: khối Blockquote cho đoạn chia sẻ và in đậm chữ số “28%”.',
    verifyTip: 'Đoạn khách hàng có thanh dọc trích dẫn bên trái và con số “28%” hiện in đậm.',
  },
  'w4a-t5': {
    steps: [
      'Mở thẻ Bố cục (Layout) → bấm Đầu/chân trang (Header & Footer).',
      'Nhập “Hotline 1900 2026” vào ô Chân trang (Footer).',
      'Bấm Lưu để áp dụng cho toàn bộ tài liệu.',
    ],
    formulaOrValue: 'Hotline 1900 2026',
    examTrap: 'Gõ đúng dãy số “1900 2026” có dấu cách giữa 1900 và 2026.',
    verifyTip: 'Cuối trang giấy hiển thị rõ dòng “Hotline 1900 2026”.',
  },
  'w5a-t1': {
    steps: [
      'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
      'Trong nhóm Định dạng tài liệu, mở danh sách Bộ kiểu tài liệu (Style Set).',
      'Chọn một bộ kiểu khác “Office” mặc định (ví dụ Hiện đại, Báo cáo hoặc Hành chính Việt Nam).',
    ],
    examTrap: 'Đổi Style Set trong thẻ Thiết kế, không chỉ đổi từng font chữ thủ công.',
    verifyTip: 'Kiểu tiêu đề và thân văn bản đồng loạt đổi theo Style Set mới.',
  },
  'w5a-t2': {
    steps: [
      'Đặt con trỏ vào đoạn bắt đầu bằng “Sự kiện kết nối trực tiếp…”.',
      'Trên thẻ Trang chủ (Home), bấm nút Căn đều hai bên (Justify) hoặc nhấn Ctrl + J.',
      'Bấm nút Giãn dòng (Line Spacing) ngay cạnh và chọn mức 1.5 (hoặc lớn hơn).',
    ],
    shortcut: 'Ctrl + J',
    examTrap: 'Phải áp dụng đúng cho đoạn “Sự kiện kết nối trực tiếp…”, không áp nhầm vào tiêu đề.',
    verifyTip: 'Hai mép trái/phải đoạn văn thẳng hàng và khoảng cách dòng giãn 1.5.',
  },
  'w5a-t3': {
    steps: [
      'Bôi chọn cụm từ “Career Portal” trong văn bản.',
      'Nhấn Ctrl + K hoặc mở thẻ Chèn (Insert) → Liên kết (Link).',
      'Nhập địa chỉ “https://office.minhspark.com” vào ô URL rồi bấm Áp dụng.',
    ],
    formulaOrValue: 'https://office.minhspark.com',
    shortcut: 'Ctrl + K',
    examTrap: 'Dùng nút Copy nhanh trên đề để tránh gõ sai chính tả tên miền minhspark.',
    verifyTip: 'Cụm từ “Career Portal” chuyển sang dạng siêu liên kết có gạch chân xanh.',
  },
  'w5a-t4': {
    steps: [
      'Đặt con trỏ vào vị trí cần ngăn cách hai mục nội dung.',
      'Mở thẻ Chèn (Insert) → bấm Đường kẻ (Horizontal Rule) để chèn đường phân tách ngang.',
      'Tiếp tục trên thẻ Chèn → bấm Hộp chữ (Text Box) và nhập nội dung lưu ý ngắn cho ứng viên.',
    ],
    examTrap: 'Không gõ nhiều dấu gạch dưới “_____” thay cho Đường kẻ ngang thật.',
    verifyTip: 'Tài liệu có đủ cả 1 đường kẻ ngang toàn chiều rộng và 1 khung Hộp chữ nổi bật.',
  },
  'w5a-t5': {
    steps: [
      'Đặt con trỏ xuống cuối tài liệu để thêm danh sách chuẩn bị hồ sơ.',
      'Mở thẻ Trang chủ (Home) → bấm biểu tượng Danh sách việc cần làm (Task List / Checklist).',
      'Nhập mục thứ nhất (ví dụ: “In 03 bản CV”), nhấn Enter và nhập mục thứ hai (“Chuẩn bị Portfolio”).',
    ],
    examTrap: 'Cần tạo ít nhất 2 mục checklist (Task Item), không dùng Bullet List thay thế.',
    verifyTip: 'Hiển thị ít nhất 2 dòng có ô checkbox đánh dấu được ở đầu dòng.',
  },
  'w6a-t1': {
    steps: [
      'Đặt con trỏ vào đoạn mở đầu bắt đầu bằng “Quý IV ghi nhận…”.',
      'Mở thẻ Chèn (Insert) → tìm nút Chữ lớn đầu đoạn (Drop Cap).',
      'Chọn kiểu Thả trong đoạn (Dropped) hoặc Ra lề (In margin).',
    ],
    examTrap: 'Không phóng to riêng chữ “Q” bằng cỡ chữ 48pt — phải bật đúng thuộc tính Drop Cap.',
    verifyTip: 'Chữ cái đầu đoạn “Q” phóng lớn thả xuống nhiều dòng chuẩn bố cục tạp chí.',
  },
  'w6a-t2': {
    steps: [
      'Đặt con trỏ tại tiêu đề “Sự kiện cuối năm”.',
      'Mở thẻ Chèn (Insert) → bấm Dấu trang (Bookmark).',
      'Nhập tên dấu trang không dấu, không khoảng trắng “SuKienCuoiNam” rồi bấm Thêm / Lưu.',
    ],
    formulaOrValue: 'SuKienCuoiNam',
    examTrap: 'Tên Bookmark chuẩn MOS không chứa dấu cách và không bắt đầu bằng chữ số.',
    verifyTip: 'Biểu tượng dấu trang xuất hiện tại mục “Sự kiện cuối năm”.',
  },
  'w6a-t3': {
    steps: [
      'Mở thẻ Tệp (File) → chọn Thông tin (Info) → Thông tin mô tả.',
      'Điền “Ban Truyền thông” vào trường Tác giả (Author).',
      'Điền “Minh Spark” vào trường Đơn vị / Công ty (Company) rồi bấm Lưu.',
    ],
    formulaOrValue: 'Author: Ban Truyền thông | Company: Minh Spark',
    examTrap: 'Điền đúng cả 2 trường Author và Company, kiểm tra chính tả từng chữ.',
    verifyTip: 'Mở lại Tệp → Thông tin thấy lưu đủ Tác giả và Đơn vị.',
  },
  'w6a-t4': {
    steps: [
      'Tìm cụm từ “Office 23” trong đoạn mở đầu của bản tin.',
      'Bôi chọn chính xác cụm từ “Office 23”.',
      'Nhấn Ctrl + I hoặc bấm biểu tượng Nghiêng (I) trên thẻ Trang chủ.',
    ],
    shortcut: 'Ctrl + I',
    examTrap: 'Đảm bảo bôi chọn trọn cụm “Office 23” chứ không chỉ một phần từ.',
    verifyTip: 'Cụm từ “Office 23” hiển thị rõ nét ở kiểu chữ in nghiêng.',
  },
  'w6a-t5': {
    steps: [
      'Mở thẻ Bố cục (Layout) trên thanh Ribbon.',
      'Trong nhóm Thiết lập trang, bấm nút Ngắt từ (Hyphenation).',
      'Chọn chế độ Tự động (Automatic).',
    ],
    examTrap: 'Không tự gõ dấu gạch nối thủ công cuối dòng.',
    verifyTip: 'Mục Ngắt từ hiển thị đang bật trạng thái Tự động.',
  },
  'w7a-t1': {
    steps: [
      'Đặt con trỏ bên dưới tiêu đề “Công thức tính công suất điện”.',
      'Mở thẻ Chèn (Insert) → bấm Công thức (Equation) hoặc nhấn Alt + =.',
      'Chọn một công thức dựng sẵn hoặc nhập biểu thức toán học (ví dụ P = U \\cdot I) rồi bấm Chèn.',
    ],
    shortcut: 'Alt + =',
    examTrap: 'Phải chèn đối tượng Equation thực sự, không gõ chữ thường “P = U * I”.',
    verifyTip: 'Công thức hiển thị trong khung công thức toán học chuẩn KaTeX/Math.',
  },
  'w7a-t2': {
    steps: [
      'Tìm công thức hoá học “H2O” hoặc “CO2” trong đoạn mở đầu.',
      'Bôi chọn duy nhất chữ số “2”.',
      'Trên thẻ Trang chủ (Home), bấm biểu tượng Chỉ số dưới (x₂) hoặc nhấn Ctrl + ,.',
    ],
    shortcut: 'Ctrl + ,',
    examTrap: 'Tránh bôi nhầm chữ “H” hoặc “O” cùng số “2”; cũng tránh bấm nhầm Chỉ số trên (x²).',
    verifyTip: 'Chữ số “2” hạ thấp nhỏ hơn nằm gọn dưới chân chữ H/C.',
  },
  'w7a-t3': {
    steps: [
      'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
      'Bấm nút Màu (Colors) và chọn một bảng màu khác “Office” (ví dụ Xanh dương).',
      'Bấm nút Phông (Fonts) ngay bên cạnh và chọn một cặp phông khác “Office”.',
    ],
    examTrap: 'Bắt buộc đổi cả 2 mục Colors và Fonts khác mặc định “Office”.',
    verifyTip: 'Cả Bảng màu và Cặp phông đều không còn ở trạng thái mặc định Office.',
  },
  'w7a-t4': {
    steps: [
      'Mở thẻ Bố cục (Layout) → bấm Đầu/chân trang (Header & Footer).',
      'Tại mục Kiểu số trang (Page Number Format), đổi sang La Mã (Roman — i, ii, iii).',
      'Bấm Lưu để áp dụng ngay cho số trang tài liệu.',
    ],
    examTrap: 'Không gõ chữ “i” thủ công vào chân trang; chọn đúng tuỳ chọn định dạng Roman.',
    verifyTip: 'Số trang hiển thị dưới dạng chữ số La Mã (i, ii…).',
  },
  'w7a-t5': {
    steps: [
      'Đặt con trỏ vào dòng tiêu đề “Công thức tính công suất điện”.',
      'Mở thẻ Bố cục (Layout) → tìm nhóm Đoạn liền / Phân trang.',
      'Bấm bật tuỳ chọn Giữ với đoạn sau (Keep with next).',
    ],
    examTrap: 'Phân biệt Keep with next (dính tiêu đề với đoạn ngay sau) với Page break before (đẩy sang trang mới).',
    verifyTip: 'Nút Giữ với đoạn sau hiển thị trạng thái đang kích hoạt khi đặt con trỏ tại tiêu đề.',
  },
  'we1-t1': {
    steps: [
      'Mở thẻ Bố cục (Layout) → bấm Đầu/chân trang (Header & Footer).',
      'Tích chọn ô Trang đầu khác (Different First Page).',
      'Nhập “Luận văn 2026” vào ô Đầu trang nội dung (Header) rồi bấm Lưu.',
    ],
    formulaOrValue: 'Luận văn 2026',
    examTrap: 'Trang bìa sẽ trống đầu trang còn từ trang 2 trở đi hiển thị “Luận văn 2026” đúng chuẩn luận văn.',
    verifyTip: 'Mở lại hộp thoại Đầu/chân trang thấy Trang đầu khác đã tick và Header chứa “Luận văn 2026”.',
  },
  'we1-t2': {
    steps: [
      'Mở thẻ Tham chiếu (References) → bấm Quản lý nguồn (Manage Sources).',
      'Bấm Thêm nguồn mới, điền thông tin tác giả, nhan đề, năm xuất bản rồi bấm Lưu nguồn.',
      'Đặt con trỏ ở cuối luận văn → bấm Thư mục (Bibliography) → chèn khối Tài liệu tham khảo.',
    ],
    examTrap: 'Phải tạo ít nhất 1 Source trong Quản lý nguồn trước khi chèn khối Bibliography.',
    verifyTip: 'Cuối tài liệu có khối Thư mục tham khảo tự động liệt kê nguồn vừa nhập.',
  },
  'we1-t3': {
    steps: [
      'Đặt con trỏ cuối đoạn Chương 2 của luận văn.',
      'Mở thẻ Tham chiếu (References) → bấm Chèn chú thích cuối (Insert Endnote).',
      'Nhập ghi chú phương pháp nghiên cứu (ví dụ: “Khảo sát thực hiện giai đoạn Q1–Q3/2026”) rồi lưu.',
    ],
    shortcut: 'Ctrl + Alt + D',
    examTrap: 'Không bấm nhầm Footnote (chú thích cuối trang); câu này yêu cầu đúng Endnote.',
    verifyTip: 'Chú thích cuối tài liệu hiển thị với ký hiệu số La Mã thường ở cuối văn bản.',
  },
  'we1-t4': {
    steps: [
      'Bôi chọn một thuật ngữ quan trọng (ví dụ “Trí tuệ Nhân tạo” hoặc “MOS”).',
      'Mở thẻ Tham chiếu (References) → bấm Đánh dấu mục (Mark Entry) và xác nhận.',
      'Đặt con trỏ cuối tài liệu → bấm Chèn chỉ mục (Insert Index) để sinh bảng chỉ mục tự động.',
    ],
    examTrap: 'Phải làm đủ 2 bước: Mark Entry trước rồi mới Insert Index.',
    verifyTip: 'Cuối tài liệu xuất hiện khối Chỉ mục (Index) kèm thuật ngữ đã đánh dấu.',
  },
  'we1-t5': {
    steps: [
      'Mở thẻ Chèn (Insert) trên thanh Ribbon.',
      'Bấm Hộp chữ (Text Box) ở nhóm Văn bản để chèn khung tóm tắt (hoặc bấm Dấu trang để gắn Bookmark).',
      'Nhập nội dung tóm tắt ngắn vào hộp chữ rồi lưu.',
    ],
    examTrap: 'Dùng đúng đối tượng Text Box hoặc Bookmark thay vì chỉ tô viền đoạn văn.',
    verifyTip: 'Khung Hộp chữ hoặc biểu tượng Dấu trang xuất hiện rõ trong tài liệu.',
  },
  'we2-t1': {
    steps: [
      'Mở thẻ Bố cục (Layout) trên thanh Ribbon.',
      'Bấm Lề (Margins) trong nhóm Thiết lập trang.',
      'Chọn mẫu Đối xứng (Mirrored Margins) cho in 2 mặt đóng gáy.',
    ],
    examTrap: 'Lề Đối xứng khác Lề Hẹp hay Lề Rộng — chọn chính xác mục Đối xứng.',
    verifyTip: 'Mục Lề hiển thị đang kích hoạt chế độ Đối xứng (Mirrored).',
  },
  'we2-t2': {
    steps: [
      'Mở thẻ Bố cục (Layout) → bấm Đầu/chân trang (Header & Footer).',
      'Đánh dấu chọn ô Trang chẵn/lẻ khác nhau (Different Odd & Even Pages).',
      'Nhập “Sổ tay Vận hành” vào ô Đầu trang chẵn (Even Header) rồi bấm Lưu.',
    ],
    formulaOrValue: 'Sổ tay Vận hành',
    examTrap: 'Nhập đúng vào ô Đầu trang CHẴN (Even Header), không nhập nhầm sang Đầu trang lẻ.',
    verifyTip: 'Mở lại hộp thoại thấy chế độ Chẵn/Lẻ đang bật và Đầu trang chẵn chứa “Sổ tay Vận hành”.',
  },
  'we2-t3': {
    steps: [
      'Mở thẻ Bố cục (Layout) → bấm Đầu/chân trang (Header & Footer).',
      'Tìm ô Số trang bắt đầu từ (Start at) và đổi từ 1 thành 3.',
      'Bấm Lưu để cập nhật cách đánh số trang.',
    ],
    formulaOrValue: '3',
    examTrap: 'Chắc chắn rằng tuỳ chọn Hiện số trang đang bật cùng giá trị bắt đầu là 3.',
    verifyTip: 'Trang đầu tiên của sổ tay hiển thị số trang là 3.',
  },
  'we2-t4': {
    steps: [
      'Đặt con trỏ ở đầu sổ tay phía dưới tiêu đề chính.',
      'Mở thẻ Tham chiếu (References) → bấm Mục lục (Table of Contents).',
      'Chọn mẫu Mục lục tự động để chèn danh mục các quy trình.',
    ],
    examTrap: 'Không gõ danh sách thủ công thay cho khối Mục lục tự động.',
    verifyTip: 'Mục lục liệt kê đủ các mục Heading 1 và Heading 2 của sổ tay.',
  },
  'we2-t5': {
    steps: [
      'Đặt con trỏ vào dòng tiêu đề “Quy trình sao lưu định kỳ”.',
      'Mở thẻ Bố cục (Layout) → nhóm Đoạn liền / Phân trang.',
      'Bấm bật thuộc tính Sang trang trước đoạn (Page Break Before).',
    ],
    examTrap: 'Đề yêu cầu thuộc tính Page Break Before gắn trên đoạn tiêu đề, không phải chèn Page Break rời.',
    verifyTip: 'Tiêu đề “Quy trình sao lưu định kỳ” tự động đẩy lên đầu trang mới khi bật Page Break Before.',
  },
  'we3-t1': {
    steps: [
      'Nhấn Ctrl + H để mở hộp thoại Tìm và Thay thế.',
      'Nhập “ABC Holdings” vào ô Tìm và “Minh Spark Corp” vào ô Thay bằng.',
      'Bấm Thay tất cả (Replace All) để đổi đồng loạt toàn bộ hợp đồng.',
    ],
    formulaOrValue: 'ABC Holdings → Minh Spark Corp',
    shortcut: 'Ctrl + H',
    examTrap: 'Phải dùng Replace All để không sót bất kỳ lần xuất hiện nào của “ABC Holdings”.',
    verifyTip: 'Tìm “ABC Holdings” còn 0 kết quả; “Minh Spark Corp” xuất hiện đầy đủ.',
  },
  'we3-t2': {
    steps: [
      'Mở thẻ Thiết kế (Design) → bấm Hình mờ (Watermark) → chọn “MẬT”, “TUYỆT MẬT” hoặc “CONFIDENTIAL”.',
      'Tiếp tục trong nhóm Nền trang → bấm Viền trang (Page Borders) và bật một kiểu viền khung.',
      'Xác nhận để áp dụng đồng thời cả hình mờ và viền trang.',
    ],
    formulaOrValue: 'MẬT',
    examTrap: 'Hoàn tất đủ cả 2 yêu cầu: Hình mờ bảo mật VÀ Viền trang.',
    verifyTip: 'Trang hợp đồng có chữ mờ “MẬT” ở giữa và khung viền quanh trang.',
  },
  'we3-t3': {
    steps: [
      'Đặt con trỏ dưới tiêu đề “Điều 2: Tiến độ thanh toán”.',
      'Mở thẻ Chèn (Insert) → bấm Bảng (Table).',
      'Chọn kích thước tối thiểu 4 cột × 4 dòng rồi bấm Chèn.',
    ],
    examTrap: 'Kiểm tra đủ ít nhất 4 cột và 4 hàng ngang.',
    verifyTip: 'Bảng tiến độ hiển thị đầy đủ 4 cột × 4 dòng trong Điều 2.',
  },
  'we3-t4': {
    steps: [
      'Mở thẻ Xem lại (Review) → bấm Bình luận mới (New Comment).',
      'Nhập bình luận pháp chế thứ nhất và bấm Gửi.',
      'Bấm Bình luận mới lần thứ hai, nhập góp ý khác và bấm Gửi.',
    ],
    shortcut: 'Ctrl + Alt + M',
    examTrap: 'Cần tạo ít nhất 2 bình luận độc lập (không chỉ 1 bình luận dài).',
    verifyTip: 'Ngăn Bình luận hiển thị từ 2 thẻ bình luận trở lên.',
  },
  'we3-t5': {
    steps: [
      'Mở thẻ Tham chiếu (References) trên thanh Ribbon.',
      'Mở danh sách chọn Kiểu trích dẫn (Citation Style).',
      'Chọn chuẩn CHICAGO.',
    ],
    formulaOrValue: 'CHICAGO',
    examTrap: 'Tránh chọn nhầm APA hay IEEE; kiểm tra đúng chữ CHICAGO.',
    verifyTip: 'Ô Kiểu trích dẫn đang hiển thị CHICAGO.',
  },
  'we4-t1': {
    steps: [
      'Mở thẻ Bố cục (Layout) → bấm Hướng (Orientation) → chọn Ngang (Landscape).',
      'Tiếp tục trên thẻ Bố cục → bấm Cột (Columns) → chọn Ba cột (Three).',
      'Kiểm tra bố cục 3 cột dàn đều trên trang khổ ngang.',
    ],
    examTrap: 'Nhớ thực hiện cả 2 bước Hướng Ngang và Chia 3 cột.',
    verifyTip: 'Trang giấy nằm ngang và nội dung chia làm 3 cột song song.',
  },
  'we4-t2': {
    steps: [
      'Mở thẻ Tham chiếu (References) trên thanh Ribbon.',
      'Bấm Chèn nhãn (Insert Caption) để gắn chú thích Hình/Bảng tự động, hoặc bấm Chèn danh mục hình (Table of Figures).',
      'Nhập nhãn mô tả ngắn rồi bấm Chèn.',
    ],
    examTrap: 'Không gõ “Hình 1:” bằng văn bản thường; phải dùng nút Caption / Danh mục hình trong thẻ Tham chiếu.',
    verifyTip: 'Xuất hiện khối Caption đánh số tự động hoặc Danh mục hình trong tài liệu.',
  },
  'we4-t3': {
    steps: [
      'Đặt con trỏ dưới mục “Mô hình toán học”.',
      'Mở thẻ Chèn (Insert) → bấm Công thức (Equation) hoặc nhấn Alt + =.',
      'Chọn công thức mẫu hoặc nhập biểu thức LaTeX rồi bấm Chèn.',
    ],
    shortcut: 'Alt + =',
    examTrap: 'Phải chèn đối tượng Equation thực sự.',
    verifyTip: 'Đối tượng công thức toán hiển thị ngay dưới phần Mô hình toán học.',
  },
  'we4-t4': {
    steps: [
      'Đặt con trỏ ngay đầu dòng tiêu đề “Phụ lục dữ liệu đo kiểm”.',
      'Nhấn tổ hợp Ctrl + Enter (hoặc mở Bố cục → Ngắt → Trang).',
      'Kiểm tra phần Phụ lục đã tách gọn sang đầu trang mới.',
    ],
    shortcut: 'Ctrl + Enter',
    examTrap: 'Không nhấn phím Enter nhiều lần để đẩy dòng.',
    verifyTip: 'Phần Phụ lục bắt đầu ngay dòng đầu của trang mới.',
  },
  'we4-t5': {
    steps: [
      'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
      'Bấm nút Giãn đoạn (Paragraph Spacing).',
      'Chọn mẫu Gọn (Compact) hoặc Khít (Tight).',
    ],
    examTrap: 'Tránh chọn nhầm Thoáng (Open) — bài báo 3 cột cần mật độ Compact hoặc Tight.',
    verifyTip: 'Mục Giãn đoạn hiển thị Gọn hoặc Khít và khoảng cách đoạn văn thu gọn.',
  },
  'we5-t1': {
    steps: [
      'Đặt con trỏ tại đầu tài liệu.',
      'Mở thẻ Chèn (Insert) → nhóm Trang → bấm Trang bìa (Cover Page).',
      'Chọn một mẫu trang bìa dựng sẵn để chèn lên đầu hồ sơ năng lực.',
    ],
    examTrap: 'Dùng đúng nút Trang bìa dựng sẵn (sẽ tự kèm bố cục bìa + ngắt trang sang trang 2).',
    verifyTip: 'Đầu tài liệu có trang bìa đầy đủ tách trang rõ ràng với nội dung chính.',
  },
  'we5-t2': {
    steps: [
      'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
      'Trong nhóm Định dạng tài liệu, bấm nút Hiệu ứng (Effects).',
      'Chọn một hiệu ứng bất kỳ khác “Không hiệu ứng” (ví dụ Đổ bóng, Nhẹ nhàng hoặc Vát nổi).',
    ],
    examTrap: 'Đừng nhầm Hiệu ứng tài liệu (Design → Effects) với Hiệu ứng chữ (Home → Text Effects).',
    verifyTip: 'Ô Hiệu ứng trong thẻ Thiết kế hiển thị kiểu đã chọn khác “Không hiệu ứng”.',
  },
  'we5-t3': {
    steps: [
      'Đặt con trỏ dưới mục “Đội ngũ chuyên gia chủ chốt”.',
      'Mở thẻ Chèn (Insert) → bấm Bảng (Table).',
      'Chọn kích thước tối thiểu 3 cột × 3 dòng rồi chèn vào tài liệu.',
    ],
    examTrap: 'Kiểm tra bảng đạt tối thiểu 3 cột và 3 dòng.',
    verifyTip: 'Bảng nhân sự 3×3 hiển thị rõ ràng dưới tiêu đề Đội ngũ chuyên gia.',
  },
  'we5-t4': {
    steps: [
      'Bôi chọn một cụm từ bất kỳ, nhấn Ctrl + K (Chèn → Liên kết) và nhập “https://office.minhspark.com”.',
      'Mở thẻ Tệp (File) → Thông tin (Info) → Thông tin mô tả.',
      'Nhập “HoSoNangLuc” vào ô Từ khoá (Keywords) rồi bấm Lưu.',
    ],
    formulaOrValue: 'Keywords: HoSoNangLuc | Link: https://office.minhspark.com',
    shortcut: 'Ctrl + K',
    examTrap: 'Phải đủ cả 2 phần: có siêu liên kết trong bài và có từ khoá “HoSoNangLuc” ở File → Info.',
    verifyTip: 'Văn bản có link xanh và Tệp → Thông tin lưu đúng từ khoá “HoSoNangLuc”.',
  },
  'we5-t5': {
    steps: [
      'Đặt con trỏ vào dòng tiêu đề Heading 1 “HỒ SƠ NĂNG LỰC CÔNG TY MINH SPARK”.',
      'Trên thẻ Trang chủ (Home), bấm nút Căn giữa (Center) hoặc nhấn Ctrl + E.',
      'Kiểm tra dòng tiêu đề vẫn giữ kiểu Heading 1 và nằm chính giữa trang.',
    ],
    shortcut: 'Ctrl + E',
    examTrap: 'Không dùng phím Space/Tab để đẩy chữ ra giữa — phải dùng nút Căn giữa (Ctrl + E).',
    verifyTip: 'Tiêu đề chính căn giữa hoàn hảo và nút Căn giữa sáng lên khi đặt con trỏ vào.',
  },
};
