export type TipsApp = 'doc' | 'sheet' | 'slide';

export type Tip = {
  title: string;
  body: string;
  keys?: string[][];
};

export type TipSection = {
  id: string;
  title: string;
  tips: Tip[];
};

export const TIPS_APP_NAME: Record<TipsApp, string> = {
  doc: 'Minh Docs',
  sheet: 'Minh Sheets',
  slide: 'Minh Slides',
};

const DOC_TIPS: TipSection[] = [
  {
    id: 'quick',
    title: 'Gõ nhanh',
    tips: [
      { title: 'Menu chèn nhanh', body: 'Gõ / ở đầu dòng hoặc sau dấu cách để chèn tiêu đề, danh sách, bảng, ảnh, biểu đồ, mục lục, ngắt trang, công thức toán mà không cần mở ribbon.', keys: [['/']] },
      { title: 'Chèn ngày, trạng thái, người', body: 'Gõ @ để chèn ngày hôm nay, trạng thái (Bản nháp, Đang làm, Chờ ký duyệt, Đã duyệt), người hoặc địa điểm.', keys: [['@']] },
      { title: 'Bảng lệnh', body: 'Gõ tên lệnh để tìm và chạy, không cần nhớ lệnh nằm ở tab nào.', keys: [['Alt', 'Q']] },
      { title: 'Xem mọi phím tắt', body: 'Mở danh sách đầy đủ phím tắt của Minh Docs.', keys: [['Ctrl', '/']] },
      { title: 'Chèn công thức toán', body: 'Mở trình soạn công thức ngay tại con trỏ.', keys: [['Alt', '=']] },
      { title: 'Chèn ngày hoặc giờ hiện tại', body: 'Alt+Shift+D chèn ngày, Alt+Shift+T chèn giờ.', keys: [['Alt', 'Shift', 'D'], ['Alt', 'Shift', 'T']] },
    ],
  },
  {
    id: 'format',
    title: 'Định dạng',
    tips: [
      { title: 'Lặp lại thao tác vừa làm', body: 'Áp lại đúng thao tác vừa làm (định dạng, chèn chữ…) cho chỗ đang chọn.', keys: [['F4']] },
      { title: 'Đổi chữ hoa, thường', body: 'Bấm liên tiếp để đổi vòng: CHỮ HOA, chữ thường, Hoa Đầu Từ.', keys: [['Shift', 'F3']] },
      { title: 'Sao chép định dạng', body: 'Đặt con trỏ vào chữ mẫu, bấm phím tắt rồi quét chọn chữ cần áp định dạng đó.', keys: [['Ctrl', 'Shift', 'C']] },
      { title: 'Xoá định dạng ký tự', body: 'Bỏ đậm, nghiêng, màu, cỡ chữ của đoạn đang chọn.', keys: [['Ctrl', 'Space'], ['Ctrl', '\\']] },
      { title: 'Xoá định dạng đoạn', body: 'Đưa thụt lề, giãn dòng, căn lề, khoảng cách đoạn về mặc định.', keys: [['Ctrl', 'Q']] },
      { title: 'Giãn dòng', body: 'Ctrl+1 dòng đơn, Ctrl+5 dòng 1,5, Ctrl+2 dòng đôi.', keys: [['Ctrl', '1'], ['Ctrl', '5'], ['Ctrl', '2']] },
      { title: 'Thụt lề', body: 'Ctrl+M thụt vào, Ctrl+Shift+M thụt ra. Ctrl+T tạo thụt treo.', keys: [['Ctrl', 'M'], ['Ctrl', 'Shift', 'M'], ['Ctrl', 'T']] },
      { title: 'Kiểu Bình thường', body: 'Đưa đoạn đang chọn về kiểu Bình thường.', keys: [['Ctrl', 'Shift', 'N']] },
      { title: 'Hộp thoại phông chữ', body: 'Chỉnh phông, cỡ, hiệu ứng chữ trong một hộp thoại.', keys: [['Ctrl', 'D']] },
    ],
  },
  {
    id: 'navigate',
    title: 'Bố cục và di chuyển',
    tips: [
      { title: 'Di chuyển cả đoạn', body: 'Đẩy đoạn đang đứng lên trên hoặc xuống dưới, không cần cắt dán.', keys: [['Alt', 'Shift', '↑'], ['Alt', 'Shift', '↓']] },
      { title: 'Nâng hoặc hạ cấp tiêu đề', body: 'Alt+Shift+← nâng cấp (Tiêu đề 2 thành Tiêu đề 1), Alt+Shift+→ hạ cấp.', keys: [['Alt', 'Shift', '←'], ['Alt', 'Shift', '→']] },
      { title: 'Quay lại chỗ vừa sửa', body: 'Nhảy về vị trí sửa gần nhất trong tài liệu.', keys: [['Shift', 'F5']] },
      { title: 'Đi tới trang', body: 'Nhảy tới một trang, tiêu đề hoặc dấu trang.', keys: [['Ctrl', 'G']] },
      { title: 'Tìm và thay', body: 'Ctrl+F tìm, Ctrl+H tìm và thay.', keys: [['Ctrl', 'F'], ['Ctrl', 'H']] },
      { title: 'Phóng to, thu nhỏ', body: 'Đổi mức thu phóng trang.', keys: [['Ctrl', '='], ['Ctrl', '-']] },
      { title: 'Ẩn hoặc hiện ribbon', body: 'Thu gọn ribbon để có thêm chỗ soạn thảo.', keys: [['Ctrl', 'F1']] },
      { title: 'Đổi chế độ xem', body: 'Ctrl+Alt+P bố cục in, Ctrl+Alt+O dàn ý, Ctrl+Alt+N bản nháp, Ctrl+Alt+S chia đôi màn hình.', keys: [['Ctrl', 'Alt', 'P'], ['Ctrl', 'Alt', 'O'], ['Ctrl', 'Alt', 'N'], ['Ctrl', 'Alt', 'S']] },
    ],
  },
  {
    id: 'review',
    title: 'Soát lỗi và cộng tác',
    tips: [
      { title: 'Soát chính tả', body: 'Kiểm tra chính tả và ngữ pháp cả tài liệu.', keys: [['F7']] },
      { title: 'Từ đồng nghĩa', body: 'Mở bảng từ đồng nghĩa cho từ đang chọn.', keys: [['Shift', 'F7']] },
      { title: 'Chế độ đề xuất', body: 'Bật hoặc tắt chế độ đề xuất: mọi chỗ sửa được ghi lại để người khác chấp nhận hoặc từ chối.', keys: [['Ctrl', 'Shift', 'E']] },
      { title: 'Thêm bình luận', body: 'Gắn bình luận vào đoạn đang chọn.', keys: [['Ctrl', 'Alt', 'M']] },
      { title: 'Chú thích', body: 'Ctrl+Alt+F chèn chú thích cuối trang, Ctrl+Alt+D chèn chú thích cuối tài liệu.', keys: [['Ctrl', 'Alt', 'F'], ['Ctrl', 'Alt', 'D']] },
      { title: 'Đếm từ', body: 'Xem số từ, ký tự, đoạn và trang.', keys: [['Ctrl', 'Shift', 'G']] },
      { title: 'Cập nhật mục lục và số trang', body: 'Cập nhật lại các trường, mục lục và số trang sau khi sửa nhiều.', keys: [['F9']] },
    ],
  },
  {
    id: 'ai',
    title: 'AI, giọng nói và lưu',
    tips: [
      { title: 'Minh AI', body: 'Bấm Minh AI ở tab Trang chủ để viết lại, tóm tắt, dịch hoặc viết tiếp đoạn đang chọn. Chưa chọn gì thì áp dụng cho cả tài liệu.' },
      { title: 'Thanh công cụ nhỏ', body: 'Chọn một đoạn chữ là hiện thanh công cụ nhỏ ngay cạnh, có cả nút AI. Tắt được trong Cài đặt.' },
      { title: 'Đọc chính tả', body: 'Bấm Đọc chính tả ở nhóm Giọng nói rồi nói tiếng Việt để nhập chữ.' },
      { title: 'Đọc to', body: 'Đọc to đoạn đang chọn, hoặc cả tài liệu khi không chọn gì.', keys: [['Ctrl', 'Alt', 'Space']] },
      { title: 'Lưu và in', body: 'Ctrl+S lưu ngay, Ctrl+P mở hộp thoại in.', keys: [['Ctrl', 'S'], ['Ctrl', 'P']] },
    ],
  },
];

const SHEET_TIPS: TipSection[] = [
  {
    id: 'entry',
    title: 'Nhập liệu nhanh',
    tips: [
      { title: 'Tự cộng', body: 'Chèn hàm SUM cho vùng số liền kề với ô đang chọn.', keys: [['Alt', '=']] },
      { title: 'Điền xuống, điền sang phải', body: 'Chọn vùng gồm ô có dữ liệu ở trên cùng (hoặc bên trái), bấm Ctrl+D để chép xuống, Ctrl+R để chép sang phải.', keys: [['Ctrl', 'D'], ['Ctrl', 'R']] },
      { title: 'Tự điền theo mẫu', body: 'Gõ vài ô làm mẫu (ví dụ tách họ ra khỏi họ tên), bấm Ctrl+E để điền phần còn lại theo cùng kiểu.', keys: [['Ctrl', 'E']] },
      { title: 'Chèn ngày hôm nay', body: 'Ghi ngày hôm nay vào ô đang chọn.', keys: [['Ctrl', ';']] },
      { title: 'Cột tự nới cho vừa chữ', body: 'Gõ xong bấm Tab hoặc Enter, cột tự nới cho hiện đủ nội dung. Cột đã kéo rộng thì không bị thu hẹp.', keys: [['Tab'], ['Enter']] },
    ],
  },
  {
    id: 'view',
    title: 'Định dạng và xem',
    tips: [
      { title: 'Định dạng ô', body: 'Mở hộp thoại định dạng số, căn lề, viền, tô nền cho vùng đang chọn.', keys: [['Ctrl', '1']] },
      { title: 'Hiện công thức', body: 'Hiện công thức thay cho kết quả trong mọi ô, bấm lại để tắt.', keys: [['Ctrl', '`']] },
      { title: 'Cửa sổ theo dõi ô', body: 'Theo dõi giá trị của các ô quan trọng trong khi sửa ở chỗ khác.', keys: [['Ctrl', 'Shift', 'W']] },
      { title: 'Đi tới ô hoặc vùng đặt tên', body: 'Nhập địa chỉ ô hoặc tên vùng để nhảy tới.', keys: [['Ctrl', 'G']] },
      { title: 'Tìm và thay', body: 'Tìm hoặc thay chữ, số, công thức trong trang tính.', keys: [['Ctrl', 'F'], ['Ctrl', 'H']] },
      { title: 'Thiết lập trang in', body: 'Chọn khổ giấy, hướng giấy, lề và vùng in.', keys: [['Ctrl', 'P']] },
    ],
  },
  {
    id: 'ai',
    title: 'Phân tích và AI',
    tips: [
      { title: 'Minh AI phân tích dữ liệu', body: 'Bấm Minh AI ở tab Home để tóm tắt, tìm xu hướng và gợi ý biểu đồ cho trang tính.' },
      { title: 'Soát lỗi bằng AI', body: 'Ở tab Review, Soát lỗi bằng AI tìm công thức sai logic và số liệu bất thường.' },
      { title: 'Python Sandbox', body: 'Mở menu Tính năng, chọn Python Sandbox để chạy pandas, numpy trên bảng tính và xuất kết quả ra trang mới.' },
    ],
  },
  {
    id: 'automate',
    title: 'Tự động hoá và lưu',
    tips: [
      { title: 'Ghi macro', body: 'Ở tab Automate, bấm Ghi macro, làm các bước một lần, sau đó chạy lại macro để lặp lại toàn bộ.' },
      { title: 'Tệp có macro', body: 'Tệp .xlsm mở ra vẫn giữ macro VBA để chạy tiếp trong Minh Sheets.' },
      { title: 'Lưu', body: 'Lưu ngay thay vì chờ tự động lưu.', keys: [['Ctrl', 'S']] },
    ],
  },
];

const SLIDE_TIPS: TipSection[] = [
  {
    id: 'edit',
    title: 'Soạn trang chiếu',
    tips: [
      { title: 'Nhân bản đối tượng', body: 'Tạo bản sao của hình, ô chữ hoặc ảnh đang chọn.', keys: [['Ctrl', 'D']] },
      { title: 'Nhóm và bỏ nhóm', body: 'Chọn nhiều đối tượng rồi bấm Ctrl+G để nhóm, Ctrl+Shift+G để bỏ nhóm.', keys: [['Ctrl', 'G'], ['Ctrl', 'Shift', 'G']] },
      { title: 'Hoàn tác, làm lại', body: 'Ctrl+Z hoàn tác, Ctrl+Y (hoặc Ctrl+Shift+Z) làm lại.', keys: [['Ctrl', 'Z'], ['Ctrl', 'Y']] },
      { title: 'Tìm và thay', body: 'Tìm hoặc thay chữ trên mọi trang chiếu.', keys: [['Ctrl', 'F']] },
      { title: 'Trang theo mẫu', body: 'Bấm Mẫu ở nhóm Công cụ để chèn trang có sẵn bố cục: tiêu đề, hai nội dung, so sánh, ảnh kèm chú thích.' },
      { title: 'Dịch cả bài', body: 'Bấm Dịch ở nhóm Công cụ để dịch song song văn bản trong bài.' },
      { title: 'Lưu, xuất PDF', body: 'Ctrl+S lưu ngay, Ctrl+P mở hộp xuất PDF và in.', keys: [['Ctrl', 'S'], ['Ctrl', 'P']] },
    ],
  },
  {
    id: 'show',
    title: 'Trình chiếu',
    tips: [
      { title: 'Bắt đầu trình chiếu', body: 'F5 chiếu từ trang đầu, Shift+F5 chiếu từ trang đang mở.', keys: [['F5'], ['Shift', 'F5']] },
      { title: 'Chuyển trang', body: 'Mũi tên phải, Space, Enter hoặc Page Down để sang trang. Mũi tên trái, Page Up hoặc Backspace để lùi.', keys: [['→'], ['←']] },
      { title: 'Bút laser, đèn rọi, kính lúp', body: 'L bật bút laser, S bật đèn rọi, Z bật kính lúp. Bấm lại để tắt.', keys: [['L'], ['S'], ['Z']] },
      { title: 'Màn đen, màn trắng', body: 'B làm tối màn hình, W làm trắng màn hình để khán giả tập trung vào người nói.', keys: [['B'], ['W']] },
      { title: 'Vẽ lên trang', body: 'P bút vẽ, I bút dạ quang, E tẩy, C xoá hết nét vẽ.', keys: [['P'], ['I'], ['E'], ['C']] },
      { title: 'Âm thanh minh hoạ', body: 'Phím 1 vỗ tay, 2 tiếng chuông, 3 trống cuộn, 4 kèn chào mừng.', keys: [['1'], ['2'], ['3'], ['4']] },
      { title: 'Thoát trình chiếu', body: 'Quay về màn hình soạn thảo.', keys: [['Esc']] },
    ],
  },
  {
    id: 'ai',
    title: 'AI, giọng nói và quay video',
    tips: [
      { title: 'AI tạo slide', body: 'Bấm AI tạo slide ở nhóm Công cụ, nhập chủ đề, AI dựng trang bìa, các trang nội dung và ghi chú diễn giả.' },
      { title: 'Đọc chính tả', body: 'Chọn một ô chữ, bấm Đọc chính tả ở nhóm Giọng nói rồi nói để nhập chữ.' },
      { title: 'Quay video bài giảng', body: 'Tab Record quay bài thuyết trình kèm camera. Bong bóng camera kéo đi chỗ khác và đổi cỡ được.' },
    ],
  },
];

export const TIPS: Record<TipsApp, TipSection[]> = {
  doc: DOC_TIPS,
  sheet: SHEET_TIPS,
  slide: SLIDE_TIPS,
};
