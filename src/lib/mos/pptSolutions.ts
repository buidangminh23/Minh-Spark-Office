import type { RawSolutionEntry } from './wordSolutions';

export const PPT_SOLUTIONS: Record<string, RawSolutionEntry> = {
  'p1-t1': {
    steps: [
      'Mở thẻ Thiết kế (Design) trên thanh Ribbon của 23 Slides.',
      'Trong thư viện Chủ đề (Themes), chọn “Sapphire Modern” hoặc “Emerald Executive”.',
      'Kiểm tra màu nền và phông chữ đồng bộ toàn bài thuyết trình.',
    ],
    examTrap: 'Không tự tô màu nền từng slide riêng lẻ thay cho áp dụng Theme.',
    verifyTip: 'Thanh trạng thái phía dưới hiển thị Chủ đề: Sapphire Modern hoặc Emerald Executive.',
  },
  'p1-t2': {
    steps: [
      'Mở thẻ Trang đầu (Home) → bấm mũi tên thả xuống của nút Trang mới (New Slide).',
      'Chọn bố cục Hai nội dung (Two Content) hoặc So sánh (Comparison).',
      'Kiểm tra tổng số trang chiếu tăng lên ít nhất 5 trang.',
    ],
    examTrap: 'Bấm trực tiếp nút Trang mới không chọn bố cục sẽ chỉ thêm trang Title & Content thông thường.',
    verifyTip: 'Danh sách bên trái có ít nhất 5 trang, trong đó có 1 trang dùng bố cục Hai nội dung hoặc So sánh.',
  },
  'p1-t3': {
    steps: [
      'Nhấp chọn Slide 3 (“Gói triển khai theo trường học”) ở cột bên trái.',
      'Mở thẻ Chèn (Insert) → bấm nút Bảng (Table).',
      'Chọn số hàng và số cột mong muốn để chèn bảng so sánh lên trang chiếu.',
    ],
    examTrap: 'Không vẽ hình chữ nhật ghép lại thay cho đối tượng Bảng thật.',
    verifyTip: 'Trên trang chiếu hiển thị bảng dữ liệu có thể chỉnh sửa từng ô.',
  },
  'p1-t4': {
    steps: [
      'Mở thẻ Chuyển tiếp (Transitions) trên thanh Ribbon.',
      'Chọn hiệu ứng Mờ dần (Fade) hoặc Đẩy (Push).',
      'Chỉnh ô Thời lượng (Duration) lên 1,0 giây trở lên, sau đó BẮT BUỘC bấm nút Áp dụng cho tất cả (Apply To All).',
    ],
    examTrap: 'Lỗi mất điểm kinh điển ở MOS PowerPoint: quên bấm “Áp dụng cho tất cả” khiến chỉ 1 slide có hiệu ứng.',
    verifyTip: 'Mọi trang chiếu trong cột bên trái đều có biểu tượng chuyển tiếp Fade/Push và thời lượng >= 1,0s.',
  },
  'p1-t5': {
    steps: [
      'Mở thẻ Chèn (Insert) → bấm Đầu trang & Chân trang (Header & Footer) (hoặc Xem → Slide Master).',
      'Đánh dấu bật Số trang chiếu (Slide Number) và bật Chân trang (Footer).',
      'Nhập “Office 23 MOS” vào ô Chân trang rồi bấm Áp dụng cho tất cả.',
    ],
    formulaOrValue: 'Office 23 MOS',
    examTrap: 'Bật đủ cả Số trang chiếu lẫn nội dung Chân trang “Office 23 MOS”.',
    verifyTip: 'Chân trang của các slide hiển thị “Office 23 MOS” kèm số trang.',
  },
  'p2-t1': {
    steps: [
      'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
      'Bấm nút Kích thước trang chiếu (Slide Size).',
      'Chọn tỷ lệ Chuẩn (4:3).',
    ],
    examTrap: 'Đừng nhầm tỷ lệ 4:3 với 16:9 màn hình rộng mặc định.',
    verifyTip: 'Khung trang chiếu thu gọn lại đúng tỷ lệ vuông hơn 4:3.',
  },
  'p2-t2': {
    steps: [
      'Chọn Slide 2 (“Biểu đồ tăng trưởng doanh thu”) ở cột bên trái.',
      'Mở thẻ Chèn (Insert) → bấm Biểu đồ (Chart).',
      'Chọn kiểu biểu đồ cột hoặc đường để chèn vào Slide 2.',
    ],
    examTrap: 'Kiểm tra đúng Slide 2 đang được chọn trước khi chèn.',
    verifyTip: 'Slide 2 hiển thị đối tượng Biểu đồ dữ liệu trực quan.',
  },
  'p2-t3': {
    steps: [
      'Chọn Slide 3 (“Quy trình kiểm soát chi phí”).',
      'Mở thẻ Chèn (Insert) → bấm SmartArt.',
      'Chọn một mẫu sơ đồ (Quy trình, Chu trình hoặc Kim tự tháp) để chèn lên Slide 3.',
    ],
    examTrap: 'Dùng đúng đối tượng SmartArt, không tự vẽ các hình khối rời rạc.',
    verifyTip: 'Sơ đồ SmartArt xuất hiện trên Slide 3.',
  },
  'p2-t4': {
    steps: [
      'Chọn Slide 1 hoặc Slide 2, sau đó nhấp chọn một đối tượng (ví dụ khung tiêu đề hoặc biểu đồ).',
      'Mở thẻ Hoạt hình (Animations) trên thanh Ribbon.',
      'Chọn một hiệu ứng xuất hiện/nhấn mạnh khác “Không có” (ví dụ Fade In, Fly In).',
    ],
    examTrap: 'Phân biệt Hoạt hình (Animations — gắn cho đối tượng) với Chuyển tiếp (Transitions — gắn cho cả slide).',
    verifyTip: 'Đối tượng trên Slide 1 hoặc Slide 2 có hiệu ứng hoạt hình được gán.',
  },
  'p2-t5': {
    steps: [
      'Chọn Slide 1, nhấp vào khung Ghi chú của Diễn giả phía dưới màn hình và gõ lời dẫn dài ít nhất 10 ký tự.',
      'Chọn trang chiếu cuối cùng (Slide 4 — Phụ lục nội bộ).',
      'Mở thẻ Trình chiếu (Slide Show) → bấm Ẩn trang chiếu (Hide Slide).',
    ],
    examTrap: 'Hide Slide chỉ ẩn khi chiếu, KHÔNG được xoá trang chiếu cuối cùng.',
    verifyTip: 'Slide 1 có ghi chú diễn giả và hình thu nhỏ Slide 4 có biểu tượng gạch chéo ẩn.',
  },
  'p3-t1': {
    steps: [
      'Ở cột danh sách trang chiếu bên trái, tìm Slide 3 (“Kết luận & Hành động”).',
      'Nhấp giữ và kéo thả hình thu nhỏ trang này xuống vị trí cuối cùng sau Slide 4.',
      'Kiểm tra thứ tự trang cuối cùng hiện là “Kết luận & Hành động”.',
    ],
    examTrap: 'Kéo đúng trang “Kết luận & Hành động” xuống cuối mà không xoá nội dung trang.',
    verifyTip: 'Slide số 4 (cuối cùng) hiển thị tiêu đề “Kết luận & Hành động”.',
  },
  'p3-t2': {
    steps: [
      'Chọn Slide 2 (“Các trụ cột hành động”).',
      'Mở thẻ Chèn (Insert) → bấm Hình dạng (Shapes).',
      'Chọn một hình khối (hình chữ nhật bo góc, mũi tên, ngôi sao…) để chèn lên Slide 2.',
    ],
    examTrap: 'Đảm bảo hình dạng nằm trên Slide 2 chứ không phải Slide 1.',
    verifyTip: 'Xuất hiện ít nhất một hình dạng trên Slide 2.',
  },
  'p3-t3': {
    steps: [
      'Nhấp chọn một khung chữ hoặc hình khối bất kỳ trên trang chiếu.',
      'Mở thẻ Chèn (Insert) → bấm Liên kết (Link) hoặc nhấn Ctrl + K.',
      'Nhập URL “https://office.minhspark.com” (hoặc chọn liên kết tới slide khác) rồi bấm Lưu.',
    ],
    formulaOrValue: 'https://office.minhspark.com',
    shortcut: 'Ctrl + K',
    examTrap: 'Chọn đối tượng trước rồi mới bấm Chèn → Liên kết.',
    verifyTip: 'Đối tượng đã được gắn siêu liên kết hợp lệ.',
  },
  'p3-t4': {
    steps: [
      'Mở thẻ Trình chiếu (Slide Show) trên thanh Ribbon.',
      'Bấm Thiết lập trình chiếu (Set Up Slide Show).',
      'Tích chọn Lặp liên tục cho đến khi nhấn Esc (Loop continuously until Esc) rồi bấm Lưu.',
    ],
    examTrap: 'Bấm Lưu để đóng hộp thoại Thiết lập trình chiếu.',
    verifyTip: 'Mở lại Thiết lập trình chiếu thấy ô Lặp liên tục đang được đánh dấu.',
  },
  'p3-t5': {
    steps: [
      'Mở thẻ Xem lại (Review) trên thanh Ribbon.',
      'Bấm Bình luận mới (New Comment).',
      'Nhập nội dung góp ý rà soát và bấm Gửi.',
    ],
    shortcut: 'Ctrl + Alt + M',
    examTrap: 'Đừng quên bấm Gửi sau khi gõ bình luận.',
    verifyTip: 'Bài thuyết trình hiển thị ít nhất 1 bình luận trong khung Xem lại.',
  },
  'p4-t1': {
    steps: [
      'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
      'Chọn chủ đề “Sunset Horizon” hoặc “Minimalist Ivory” trong danh sách Chủ đề.',
      'Kiểm tra toàn bài chuyển sang bảng màu ấm tinh tế.',
    ],
    examTrap: 'Chọn đúng một trong hai chủ đề yêu cầu.',
    verifyTip: 'Thanh trạng thái phía dưới hiển thị Chủ đề mới đã áp dụng.',
  },
  'p4-t2': {
    steps: [
      'Ở cột trang chiếu bên trái, chọn Slide 4 (“Trang nháp cần xoá”).',
      'Bấm phím Delete hoặc chuột phải chọn Xoá trang chiếu (Delete Slide).',
      'Kiểm tra tổng số trang chiếu còn lại 4 trang và không còn trang nháp.',
    ],
    shortcut: 'Delete',
    examTrap: 'Đề yêu cầu XOÁ hoàn toàn trang nháp chứ không phải Ẩn (Hide).',
    verifyTip: 'Bài thuyết trình còn 4 slide sạch sẽ, không còn “Trang nháp cần xoá”.',
  },
  'p4-t3': {
    steps: [
      'Chọn Slide 2 (“Vùng nguyên liệu chủ lực”).',
      'Nhấp đúp vào khung nội dung (hoặc Chèn → Hộp văn bản mới).',
      'Nhập chính xác cụm từ “Arabica Đà Lạt” rồi bấm ra ngoài để lưu.',
    ],
    formulaOrValue: 'Arabica Đà Lạt',
    examTrap: 'Gõ đúng dấu tiếng Việt “Đà Lạt”.',
    verifyTip: 'Slide 2 hiển thị rõ cụm từ “Arabica Đà Lạt”.',
  },
  'p4-t4': {
    steps: [
      'Mở thẻ Chuyển tiếp (Transitions).',
      'Chọn hiệu ứng Quét (Wipe) hoặc Tách (Split).',
      'Bấm nút Áp dụng cho tất cả (Apply To All) để đồng bộ mọi slide.',
    ],
    examTrap: 'Quên bấm Áp dụng cho tất cả sẽ làm thiếu các slide còn lại.',
    verifyTip: 'Tất cả 4 trang chiếu đều mang chuyển tiếp Wipe hoặc Split.',
  },
  'p4-t5': {
    steps: [
      'Mở thẻ Chèn (Insert) → bấm Đầu trang & Chân trang (Header & Footer).',
      'Tích bật Ngày giờ (Date and Time) và tích bật Không hiển thị trên trang tiêu đề (Hide on title slide).',
      'Bấm Áp dụng cho tất cả để lưu.',
    ],
    examTrap: 'Phải tích đủ cả 2 tuỳ chọn Ngày giờ VÀ Không hiển thị trên trang tiêu đề.',
    verifyTip: 'Ngày giờ hiển thị từ Slide 2 trở đi, riêng Slide 1 sạch gọn.',
  },
  'p5-t1': {
    steps: [
      'Mở thẻ Trang đầu (Home) → bấm mũi tên cạnh Trang mới (New Slide).',
      'Chọn bố cục Tiêu đề phần (Section Header).',
      'Kiểm tra bài thuyết trình có tối thiểu 5 trang chiếu.',
    ],
    examTrap: 'Chọn đúng layout Section Header (khác với Title Slide).',
    verifyTip: 'Trang chiếu mới mang bố cục Tiêu đề phần xuất hiện trong danh sách.',
  },
  'p5-t2': {
    steps: [
      'Chọn Slide 1 (trang bìa).',
      'Mở thẻ Thiết kế (Design) → bấm Định dạng nền (Format Background).',
      'Chọn một màu nền khác trắng #FFFFFF hoặc chuyển sang kiểu Gradient chuyển sắc.',
    ],
    examTrap: 'Đảm bảo đang chọn đúng Slide 1 khi đổi nền.',
    verifyTip: 'Trang bìa Slide 1 có nền màu/gradient nổi bật thay vì nền trắng.',
  },
  'p5-t3': {
    steps: [
      'Mở thẻ Chèn (Insert) → bấm Hình dạng (Shapes).',
      'Chèn hình dạng thứ nhất lên một trang nội dung.',
      'Tiếp tục bấm Hình dạng để chèn thêm ít nhất hình dạng thứ hai.',
    ],
    examTrap: 'Cần tổng cộng ít nhất 2 đối tượng Hình dạng (Shape) trở lên.',
    verifyTip: 'Đếm đủ ít nhất 2 hình dạng trên các trang chiếu.',
  },
  'p5-t4': {
    steps: [
      'Chọn Slide 2 ở cột bên trái.',
      'Mở thẻ Chuyển tiếp (Transitions) → chọn Reveal, Uncover hoặc Cover.',
      'Tăng ô Thời lượng (Duration) lên 1,2 giây trở lên (ví dụ 1,5s).',
    ],
    examTrap: 'Kiểm tra cả đúng tên hiệu ứng và thời lượng >= 1,2 giây.',
    verifyTip: 'Slide 2 hiển thị chuyển tiếp Reveal/Uncover/Cover với thời lượng >= 1,2s.',
  },
  'p5-t5': {
    steps: [
      'Chọn Slide 2 hoặc Slide 3.',
      'Nhấp vào khung Ghi chú của Diễn giả bên dưới trang chiếu.',
      'Nhập câu ghi chú có chứa chính xác cụm từ “Hội An”.',
    ],
    formulaOrValue: 'Hội An',
    examTrap: 'Nhập vào khung Ghi chú diễn giả bên dưới, không nhập nhầm lên trên trang chiếu.',
    verifyTip: 'Khung Ghi chú Slide 2 hoặc Slide 3 chứa “Hội An”.',
  },
  'p6-t1': {
    steps: [
      'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
      'Chọn chủ đề “Nordic Steel” hoặc “Coral Vibrant”.',
      'Kiểm tra toàn bài đã đổi chủ đề.',
    ],
    examTrap: 'Không để nguyên chủ đề mặc định Office Classic.',
    verifyTip: 'Thanh trạng thái hiển thị Nordic Steel hoặc Coral Vibrant.',
  },
  'p6-t2': {
    steps: [
      'Mở thẻ Trang đầu (Home) → nhóm Trang chiếu → bấm nút Phần (Section).',
      'Chọn Thêm phần (Add Section) và đặt tên nhóm trang chiếu.',
      'Xác nhận để tạo ít nhất 1 phần tổ chức.',
    ],
    examTrap: 'Phân biệt Phần (Section — nhóm slide ở thẻ Trang đầu) với bố cục Section Header.',
    verifyTip: 'Thanh tiêu đề phần hiển thị ngay phía trên nhóm slide ở cột trái.',
  },
  'p6-t3': {
    steps: [
      'Chọn Slide 2 (“Lịch tuần lễ định hướng”) → thẻ Chèn → bấm Bảng (Table) để chèn bảng.',
      'Chuyển sang Slide 3 (“Quy trình nhập học”) → thẻ Chèn → bấm SmartArt để chèn sơ đồ.',
      'Kiểm tra đủ mỗi trang đúng loại đối tượng yêu cầu.',
    ],
    examTrap: 'Không đảo ngược Bảng sang Slide 3 và SmartArt sang Slide 2.',
    verifyTip: 'Slide 2 có Bảng và Slide 3 có sơ đồ SmartArt.',
  },
  'p6-t4': {
    steps: [
      'Trên Slide 2, chọn một đối tượng bất kỳ → thẻ Hoạt hình (Animations) → chọn 1 hiệu ứng.',
      'Chuyển sang Slide 3, chọn một đối tượng → thẻ Hoạt hình → chọn 1 hiệu ứng.',
      'Kiểm tra cả Slide 2 và Slide 3 đều có hoạt hình.',
    ],
    examTrap: 'Thiếu hoạt hình ở 1 trong 2 slide sẽ chưa đạt.',
    verifyTip: 'Mỗi trang Slide 2 và Slide 3 có ít nhất 1 đối tượng gắn hoạt hình.',
  },
  'p6-t5': {
    steps: [
      'Mở thẻ Chèn → Đầu trang & Chân trang (hoặc Xem → Slide Master).',
      'Bật Chân trang (Footer) và nhập “Khóa 2026”.',
      'Bấm Áp dụng cho tất cả.',
    ],
    formulaOrValue: 'Khóa 2026',
    examTrap: 'Dùng Click-to-Copy để tránh gõ sai chính tả “Khóa 2026”.',
    verifyTip: 'Chân trang bài thuyết trình hiển thị “Khóa 2026”.',
  },
  'p7-t1': {
    steps: [
      'Mở thẻ Thiết kế (Design) trên thanh Ribbon.',
      'Chọn chủ đề nền tối “Midnight Dark” hoặc “Sapphire Modern”.',
      'Kiểm tra nền toàn bài chuyển sang tông tối hiện đại.',
    ],
    examTrap: 'Chọn đúng Midnight Dark hoặc Sapphire Modern.',
    verifyTip: 'Chủ đề ở thanh trạng thái đổi sang Midnight Dark / Sapphire Modern.',
  },
  'p7-t2': {
    steps: [
      'Ở cột hình thu nhỏ bên trái, tìm Slide 4 (“Đội ngũ sáng lập”).',
      'Kéo thả hình thu nhỏ đó lên ngay bên dưới Slide 1 để trở thành Slide 2.',
      'Kiểm tra vị trí mới: Slide 1 là bìa, Slide 2 là “Đội ngũ sáng lập”.',
    ],
    examTrap: 'Đưa chính xác lên vị trí thứ 2 (sau Slide 1), không kéo lên đầu thành Slide 1.',
    verifyTip: 'Slide 2 hiển thị tiêu đề “Đội ngũ sáng lập”.',
  },
  'p7-t3': {
    steps: [
      'Chọn trang chiếu có tiêu đề “Tăng trưởng ARR 4 quý” (sau khi đảo ở Task 2, trang này nằm ở Slide 4).',
      'Mở thẻ Chèn (Insert) → bấm Biểu đồ (Chart).',
      'Chọn kiểu biểu đồ đường hoặc cột để minh hoạ tăng trưởng ARR.',
    ],
    examTrap: 'Chú ý tìm đúng theo tiêu đề “Tăng trưởng ARR 4 quý” sau khi đã thay đổi thứ tự slide ở Task 2.',
    verifyTip: 'Trang “Tăng trưởng ARR 4 quý” có đối tượng Biểu đồ.',
  },
  'p7-t4': {
    steps: [
      'Mở thẻ Chuyển tiếp (Transitions).',
      'Chọn hiệu ứng Morph hoặc Zoom.',
      'Áp dụng cho ít nhất 2 trang chiếu (hoặc bấm Áp dụng cho tất cả).',
    ],
    examTrap: 'Kiểm tra có từ 2 slide trở lên dùng Morph/Zoom.',
    verifyTip: 'Ít nhất 2 slide mang chuyển tiếp Morph hoặc Zoom.',
  },
  'p7-t5': {
    steps: [
      'Chọn trang cuối cùng (“Phụ lục định giá”) → thẻ Trình chiếu → bấm Ẩn trang chiếu (Hide Slide).',
      'Mở thẻ Xem lại (Review) → bấm Bình luận mới → nhập nhận xét (ví dụ “Chuẩn bị vòng Series A”) rồi bấm Gửi.',
      'Kiểm tra đủ cả 2 yêu cầu.',
    ],
    formulaOrValue: 'Series A',
    examTrap: 'Ẩn trang cuối cùng chứ không xoá bỏ.',
    verifyTip: 'Trang cuối có trạng thái Ẩn và có ít nhất 1 bình luận kiểm duyệt.',
  },
  'px1-t1': {
    steps: [
      'Mở thẻ Xem (View) → bấm Slide Master.',
      'Bật công tắc kích hoạt Slide Master và bật Hiển thị Số trang chiếu.',
      'Nhập “Triển lãm 2026” vào ô Chân trang (Footer) rồi bấm Lưu.',
    ],
    formulaOrValue: 'Triển lãm 2026',
    examTrap: 'Phải bật cả công tắc Slide Master, công tắc Số trang và nhập đúng “Triển lãm 2026”.',
    verifyTip: 'Mọi slide hiển thị chân trang “Triển lãm 2026” kèm số trang từ Slide Master.',
  },
  'px1-t2': {
    steps: [
      'Mở thẻ Chuyển tiếp (Transitions) trên thanh Ribbon.',
      'Bật tuỳ chọn Tự động chuyển sau (Advance Slide After) và nhập số giây > 0 (ví dụ 5 giây).',
      'Bấm Áp dụng cho tất cả (hoặc thiết lập cho ít nhất 2 trang chiếu).',
    ],
    examTrap: 'Đừng nhầm Thời lượng hiệu ứng (Duration) với Tự động chuyển sau (Advance After).',
    verifyTip: 'Ít nhất 2 slide có giá trị Advance After > 0 giây.',
  },
  'px1-t3': {
    steps: [
      'Mở thẻ Trình chiếu (Slide Show) → bấm Trình chiếu tuỳ chỉnh (Custom Slide Show).',
      'Bấm Tạo bộ mới, đặt tên (ví dụ “Khách VIP”) và tích chọn ít nhất 2 trang chiếu.',
      'Bấm Lưu bộ trình chiếu tuỳ chỉnh.',
    ],
    examTrap: 'Phải chọn tối thiểu 2 trang chiếu đưa vào bộ Custom Show.',
    verifyTip: 'Danh sách Custom Show có ít nhất 1 bộ với >= 2 slide.',
  },
  'px1-t4': {
    steps: [
      'Chọn Slide 2 (“Điểm nhấn sản phẩm chủ lực”).',
      'Nhấp chọn khung nội dung → thẻ Hoạt hình → gắn 1 hiệu ứng.',
      'Nhấp chọn thẻ hình cam “Bản 2026 Mới” → thẻ Hoạt hình → gắn thêm 1 hiệu ứng thứ hai.',
    ],
    examTrap: 'Cần tối thiểu 2 hoạt hình trên cùng Slide 2.',
    verifyTip: 'Slide 2 có ít nhất 2 đối tượng được gắn hiệu ứng hoạt hình.',
  },
  'px1-t5': {
    steps: [
      'Mở thẻ Trang đầu (Home) → bấm nút Phần (Section).',
      'Chọn Thêm phần (Add Section) và đặt tên phần.',
      'Xác nhận để tổ chức các trang chiếu theo phần.',
    ],
    examTrap: 'Dùng tính năng Section trong thẻ Trang đầu.',
    verifyTip: 'Danh sách slide hiển thị tiêu đề Phần ở cột bên trái.',
  },
  'px2-t1': {
    steps: [
      'Chọn Slide 1 → Trang đầu → Phần (Section) → Thêm phần (ví dụ “Tài chính”).',
      'Chọn Slide 3 hoặc Slide 4 → Phần (Section) → Thêm phần thứ hai (ví dụ “Chiến lược”).',
      'Kiểm tra có tối thiểu 2 Phần riêng biệt.',
    ],
    examTrap: 'Cần tạo ít nhất 2 Phần chứ không phải chỉ 1 Phần.',
    verifyTip: 'Cột trái chia rõ tối thiểu 2 nhóm Phần.',
  },
  'px2-t2': {
    steps: [
      'Mở thẻ Xem (View) → bấm Slide Master.',
      'Bật kích hoạt Slide Master.',
      'Nhập “HĐQT Q4” vào Đầu trang (Header) và “Nội bộ” vào Chân trang (Footer) rồi bấm Lưu.',
    ],
    formulaOrValue: 'Header: HĐQT Q4 | Footer: Nội bộ',
    examTrap: 'Điền đúng cả Header lẫn Footer trong Slide Master.',
    verifyTip: 'Slide Master lưu đủ “HĐQT Q4” ở đầu trang và “Nội bộ” ở chân trang.',
  },
  'px2-t3': {
    steps: [
      'Chọn Slide 2 → thẻ Chèn → bấm Biểu đồ (Chart).',
      'Chọn Slide 3 → thẻ Chèn → bấm Bảng (Table).',
      'Kiểm tra đủ biểu đồ trên Slide 2 và bảng trên Slide 3.',
    ],
    examTrap: 'Không đặt nhầm cả hai lên cùng một slide.',
    verifyTip: 'Slide 2 có Biểu đồ, Slide 3 có Bảng.',
  },
  'px2-t4': {
    steps: [
      'Mở thẻ Thiết kế (Design) → bấm Hình mờ (Watermark).',
      'Bật kích hoạt Hình mờ và nhập “CONFIDENTIAL” hoặc “BẢO MẬT”.',
      'Lưu để áp dụng dấu mờ bảo mật toàn bài.',
    ],
    formulaOrValue: 'CONFIDENTIAL',
    examTrap: 'Nhớ bật công tắc kích hoạt Watermark sau khi nhập chữ.',
    verifyTip: 'Chữ mờ “CONFIDENTIAL” / “BẢO MẬT” hiện đều trên các slide.',
  },
  'px2-t5': {
    steps: [
      'Mở thẻ Trình chiếu (Slide Show) → bấm Thiết lập trình chiếu.',
      'Chọn kiểu trình chiếu Kiosk toàn màn hình (hoặc bật đồng thời Lặp liên tục + Dùng thời gian).',
      'Bấm Lưu cấu hình.',
    ],
    examTrap: 'Nếu không chọn Kiosk thì phải bật đủ cả 2 tuỳ chọn Loop và Use Timings.',
    verifyTip: 'Thiết lập trình chiếu lưu ở chế độ Kiosk hoặc Loop + Timings.',
  },
  'px3-t1': {
    steps: [
      'Mở thẻ Thiết kế (Design) → chọn chủ đề “Midnight Dark”.',
      'Tiếp tục trên thẻ Thiết kế → bấm Kích thước trang chiếu → chọn 16:10 hoặc 4:3.',
      'Kiểm tra đồng thời cả chủ đề và tỷ lệ màn hình mới.',
    ],
    examTrap: 'Phải thay đổi cả 2 thuộc tính: Theme = Midnight Dark và Aspect Ratio = 16:10 hoặc 4:3.',
    verifyTip: 'Bài chiếu mang giao diện Midnight Dark với tỷ lệ 16:10 hoặc 4:3.',
  },
  'px3-t2': {
    steps: [
      'Mở thẻ Chuyển tiếp (Transitions) → chọn Morph.',
      'Chỉnh Thời lượng (Duration) lên 1,0 giây trở lên.',
      'Bấm Áp dụng cho tất cả (Apply To All).',
    ],
    examTrap: 'Nhớ kiểm tra Thời lượng >= 1,0s trước khi bấm Áp dụng cho tất cả.',
    verifyTip: 'Mọi slide đều dùng chuyển tiếp Morph >= 1,0 giây.',
  },
  'px3-t3': {
    steps: [
      'Chọn Slide 2, bấm chọn khung nội dung hoặc thẻ “Hiệu năng 3x”.',
      'Mở thẻ Hoạt hình (Animations) → gắn một hiệu ứng xuất hiện.',
      'Đổi mục Bắt đầu (Start) từ “Khi bấm chuột” sang “Với hiệu ứng trước” (With Previous) hoặc “Sau hiệu ứng trước” (After Previous).',
    ],
    examTrap: 'Mặc định PowerPoint đặt On Click — phải chủ động đổi sang With Previous hoặc After Previous.',
    verifyTip: 'Ngăn Hoạt hình trên Slide 2 hiển thị trigger With/After Previous.',
  },
  'px3-t4': {
    steps: [
      'Chọn một khung chữ hoặc đối tượng trên Slide 1 (hoặc Slide 4).',
      'Mở thẻ Chèn (Insert) → bấm Liên kết (Ctrl + K).',
      'Dán “https://office.minhspark.com/keynote” hoặc chọn trang chiếu đích rồi bấm Lưu.',
    ],
    formulaOrValue: 'https://office.minhspark.com/keynote',
    shortcut: 'Ctrl + K',
    examTrap: 'Bấm lưu liên kết sau khi nhập URL.',
    verifyTip: 'Đối tượng đã có biểu tượng/thuộc tính siêu liên kết.',
  },
  'px3-t5': {
    steps: [
      'Mở thẻ Xem (View) → bấm Handout Master (hoặc Notes Master).',
      'Chọn bố cục 4 hoặc 6 trang chiếu/trang in và nhập tiêu đề “Keynote 2027” vào đầu/chân trang.',
      'Bấm Lưu thiết lập Master.',
    ],
    formulaOrValue: 'Keynote 2027',
    examTrap: 'Phân biệt Handout/Notes Master (mẫu in) với Slide Master (mẫu trình chiếu).',
    verifyTip: 'Handout Master hoặc Notes Master lưu cấu hình mới thành công.',
  },
  'px4-t1': {
    steps: [
      'Mở thẻ Trang đầu (Home) → bấm mũi tên Trang mới → thêm 1 trang bố cục So sánh / Hai nội dung / Tiêu đề phần.',
      'Bấm Trang mới thêm ít nhất 1 trang chiếu nữa để tổng số trang >= 6.',
      'Kiểm tra tổng số trang chiếu hiển thị từ 6 trở lên.',
    ],
    examTrap: 'Phải đạt đồng thời >= 6 slide và có ít nhất 1 bố cục chuyên biệt (Comparison / Two Content / Section).',
    verifyTip: 'Danh sách trái có >= 6 trang chiếu kèm bố cục đã chọn.',
  },
  'px4-t2': {
    steps: [
      'Mở thẻ Chèn (Insert) → bấm SmartArt để chèn 1 sơ đồ bất kỳ.',
      'Tiếp tục trên thẻ Chèn → bấm Hình dạng (Shapes) để chèn 1 hình khối.',
      'Chọn hình khối vừa chèn → bấm Chèn → Liên kết → nhập “https://office.minhspark.com/security” rồi lưu.',
    ],
    formulaOrValue: 'https://office.minhspark.com/security',
    shortcut: 'Ctrl + K',
    examTrap: 'Liên kết phải gắn trực tiếp lên đối tượng Hình dạng (Shape), không chỉ gắn lên chữ thường.',
    verifyTip: 'Bài có cả SmartArt và 1 Hình dạng mang siêu liên kết.',
  },
  'px4-t3': {
    steps: [
      'Mở thẻ Chuyển tiếp (Transitions) → chọn Fade, Push hoặc Wipe.',
      'Bật Tự động chuyển sau (Advance After) và đặt >= 3 giây.',
      'Bấm Áp dụng cho tất cả (Apply To All) để áp dụng đồng loạt cho toàn bộ bài.',
    ],
    examTrap: 'Nhớ bấm Áp dụng cho tất cả sau khi chỉnh cả kiểu chuyển tiếp lẫn 3 giây.',
    verifyTip: 'Mọi slide có Fade/Push/Wipe và >= 3 slide có tự chuyển >= 3 giây.',
  },
  'px4-t4': {
    steps: [
      'Chọn lần lượt Slide 3 và Slide 4 (2 trang đáp án) → thẻ Trình chiếu → bấm Ẩn trang chiếu (Hide Slide).',
      'Chọn Slide 1 → nhập lời dẫn dài >= 15 ký tự ở khung Ghi chú diễn giả bên dưới.',
      'Chọn Slide 2 → tiếp tục nhập lời dẫn dài >= 15 ký tự ở khung Ghi chú diễn giả.',
    ],
    examTrap: 'Cần ẩn tối thiểu 2 slide VÀ có ghi chú dài >= 15 ký tự ở cả Slide 1 lẫn Slide 2.',
    verifyTip: 'Slide 3, 4 có dấu ẩn; Slide 1, 2 đều có lời dẫn giảng viên rõ ràng.',
  },
  'px4-t5': {
    steps: [
      'Mở thẻ Trình chiếu (Slide Show) → bấm Trình chiếu tuỳ chỉnh (Custom Show).',
      'Tạo bộ mới (ví dụ “Phiên rút gọn”) và tích chọn tối thiểu 3 trang chiếu.',
      'Bấm Lưu bộ Trình chiếu tuỳ chỉnh.',
    ],
    examTrap: 'Đảm bảo tích chọn ít nhất 3 slide (chỉ chọn 2 slide sẽ không đạt câu này).',
    verifyTip: 'Bộ Custom Show chứa >= 3 trang chiếu đã được lưu.',
  },
  'px5-t1': {
    steps: [
      'Mở thẻ Thiết kế (Design) → chọn chủ đề “Emerald Executive”.',
      'Chọn Slide 1 → bấm Định dạng nền (Format Background).',
      'Đổi nền Slide 1 sang kiểu Gradient hoặc một màu nền tuỳ chỉnh khác trắng #FFFFFF.',
    ],
    examTrap: 'Áp dụng Theme trước rồi mới tuỳ biến nền Slide 1 để tránh Theme ghi đè lại nền.',
    verifyTip: 'Chủ đề là Emerald Executive và Slide 1 có nền tuỳ chỉnh khác trắng.',
  },
  'px5-t2': {
    steps: [
      'Chọn Slide 2 → thẻ Chèn → bấm Bảng (Table).',
      'Chọn Slide 3 → thẻ Chèn → bấm Biểu đồ (Chart).',
      'Chọn Slide 4 → thẻ Chèn → bấm SmartArt.',
    ],
    examTrap: 'Đặt đúng thứ tự: Slide 2 = Bảng, Slide 3 = Biểu đồ, Slide 4 = SmartArt.',
    verifyTip: 'Cả 3 trang 2, 3, 4 đều có đủ đối tượng trực quan tương ứng.',
  },
  'px5-t3': {
    steps: [
      'Lần lượt chọn 3 đối tượng trên các trang chiếu (ví dụ tiêu đề Slide 1, bảng Slide 2, biểu đồ Slide 3).',
      'Với mỗi đối tượng, mở thẻ Hoạt hình (Animations) và chọn 1 hiệu ứng xuất hiện/nhấn mạnh.',
      'Kiểm tra tổng số hiệu ứng hoạt hình toàn bài đạt tối thiểu 3.',
    ],
    examTrap: 'Không tính hiệu ứng chuyển trang (Transition) vào số lượng hoạt hình.',
    verifyTip: 'Tổng cộng có ít nhất 3 đối tượng đã gắn hoạt hình.',
  },
  'px5-t4': {
    steps: [
      'Mở thẻ Xem (View) → bấm Slide Master.',
      'Bật kích hoạt Slide Master và bật Số trang chiếu.',
      'Nhập “ESG 2026” vào ô Chân trang (Footer) rồi bấm Lưu.',
    ],
    formulaOrValue: 'ESG 2026',
    examTrap: 'Kiểm tra bật đủ 3 mục: Slide Master + Số trang + Chân trang “ESG 2026”.',
    verifyTip: 'Slide Master lưu đầy đủ cấu hình chân trang “ESG 2026” và số trang.',
  },
  'px5-t5': {
    steps: [
      'Mở thẻ Trình chiếu (Slide Show) → Thiết lập trình chiếu → bật Lặp liên tục cho đến khi nhấn Esc rồi bấm Lưu.',
      'Mở thẻ Xem lại (Review) → bấm Bình luận mới → gửi bình luận thứ nhất.',
      'Tiếp tục bấm Bình luận mới → gửi bình luận thứ hai.',
    ],
    shortcut: 'Ctrl + Alt + M',
    examTrap: 'Phải gửi đủ tối thiểu 2 bình luận khác nhau kèm bật Loop trong Thiết lập trình chiếu.',
    verifyTip: 'Loop đã bật và khung Xem lại có >= 2 bình luận.',
  },
};
