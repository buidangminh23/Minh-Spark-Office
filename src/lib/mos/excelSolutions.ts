import type { RawSolutionEntry } from './wordSolutions';

export const EXCEL_SOLUTIONS: Record<string, RawSolutionEntry> = {
  'e1-t1': {
    steps: [
      'Nhìn xuống thanh tên trang tính (Sheet Tabs) ở góc dưới bên trái bảng tính.',
      'Nhấp đúp trực tiếp vào thẻ tên “Sheet1” (hoặc chuột phải → Đổi tên).',
      'Gõ chính xác “DoanhThu” (không dấu, không khoảng trắng) rồi nhấn Enter.',
    ],
    formulaOrValue: 'DoanhThu',
    examTrap: 'Không thêm dấu cách thừa ở đầu/cuối tên trang tính như “Doanh Thu”.',
    verifyTip: 'Thẻ trang tính phía dưới hiển thị đúng chữ “DoanhThu”.',
  },
  'e1-t2': {
    steps: [
      'Nhấp giữ ô A1 và kéo ngang sang phải đến ô F1 để chọn vùng A1:F1.',
      'Mở thẻ Home (Trang chủ) → nhóm Căn chỉnh (Alignment).',
      'Bấm nút Gộp & căn giữa (Merge & Center).',
    ],
    examTrap: 'Chọn đúng vùng A1:F1 (6 cột), không kéo lố sang cột G hoặc thiếu cột F.',
    verifyTip: 'Tiêu đề “BÁO CÁO DOANH THU BÁN LẺ QUÝ III/2026” gộp thành 1 ô lớn kéo dài từ A1 đến F1.',
  },
  'e1-t3': {
    steps: [
      'Nhấp chọn ô F3 (cột Thành tiền dòng sản phẩm đầu tiên).',
      'Nhập chính xác công thức =D3*E3 rồi nhấn Enter.',
      'Đưa chuột vào chấm vuông góc dưới bên phải ô F3 (Fill Handle) kéo thẳng xuống ô F8.',
    ],
    formulaOrValue: '=D3*E3',
    examTrap: 'Tuyệt đối không gõ tay kết quả số đã tính nhẩm; hệ thống MOS kiểm tra công thức động bắt đầu bằng dấu =.',
    verifyTip: 'Ô F3 hiện 22.500.000 và ô F8 có công thức =D8*E8.',
  },
  'e1-t4': {
    steps: [
      'Chọn ô F9 (dòng Tổng cộng) → gõ =SUM(F3:F8) rồi nhấn Enter.',
      'Chọn ô F11 (Doanh thu trung bình) → gõ =AVERAGE(F3:F8) rồi nhấn Enter.',
      'Chọn ô F12 (Đơn hàng cao nhất) → gõ =MAX(F3:F8) rồi nhấn Enter.',
    ],
    formulaOrValue: 'F9: =SUM(F3:F8) | F11: =AVERAGE(F3:F8) | F12: =MAX(F3:F8)',
    shortcut: 'Alt + =',
    examTrap: 'Kiểm tra đúng địa chỉ dòng: Tổng ở F9, Trung bình ở F11 (bỏ trống dòng 10), Cao nhất ở F12.',
    verifyTip: 'Cả 3 ô F9, F11, F12 đều hiển thị kết quả số hợp lệ và chứa đúng hàm SUM, AVERAGE, MAX.',
  },
  'e1-t5': {
    steps: [
      'Nhấp chọn ô A3 (ngay bên dưới 2 dòng tiêu đề cần cố định).',
      'Mở thẻ View (Xem) trên thanh Ribbon → bấm Cố định khung (Freeze Panes).',
      'Chọn Cố định tại ô đang chọn (hoặc Cố định 2 dòng đầu).',
    ],
    examTrap: 'Bấm Freeze Top Row chỉ khoá mỗi dòng 1 (thiếu dòng tiêu đề bảng ở dòng 2) — phải chọn A3 để khoá cả dòng 1 và 2.',
    verifyTip: 'Cuộn trang tính xuống dưới thấy cả dòng 1 và dòng 2 đứng yên phía trên.',
  },
  'e2-t1': {
    steps: [
      'Chọn ô F3 (cột Điểm TB của học viên đầu tiên).',
      'Nhập công thức =AVERAGE(D3:E3) rồi nhấn Enter.',
      'Kéo Fill Handle từ F3 xuống hết ô F8 cho cả 6 học viên.',
    ],
    formulaOrValue: '=AVERAGE(D3:E3)',
    examTrap: 'Dùng hàm AVERAGE(D3:E3) chuẩn xác và nhanh hơn chia thủ công.',
    verifyTip: 'Ô F3 ra 850, ô F8 ra 800.',
  },
  'e2-t2': {
    steps: [
      'Chọn ô G3 (cột Kết quả).',
      'Nhập công thức =IF(F3>=700,"Đạt","Chưa đạt") rồi nhấn Enter.',
      'Kéo Fill Handle từ G3 xuống ô G8.',
    ],
    formulaOrValue: '=IF(F3>=700,"Đạt","Chưa đạt")',
    examTrap: 'Nhớ dấu >= (lớn hơn HOẶC BẰNG 700), thiếu dấu = sẽ chấm sai học viên đúng 700 điểm.',
    verifyTip: 'Học viên >=700 hiện “Đạt”, học viên <700 hiện “Chưa đạt”.',
  },
  'e2-t3': {
    steps: [
      'Chọn ô I3 (bên cạnh nhãn “Số HV đạt (>=700)”).',
      'Nhập công thức =COUNTIF(F3:F8,">=700") rồi nhấn Enter.',
      'Kiểm tra kết quả trả về là 4 học viên đạt chuẩn.',
    ],
    formulaOrValue: '=COUNTIF(F3:F8,">=700")',
    examTrap: 'Điều kiện ">=700" trong COUNTIF bắt buộc phải bọc trong dấu ngoặc kép.',
    verifyTip: 'Ô I3 hiển thị số 4 và thanh công thức ghi =COUNTIF(F3:F8,">=700").',
  },
  'e2-t4': {
    steps: [
      'Chọn ô I4 (bên cạnh nhãn “Tổng điểm TB lớp MOS-A”).',
      'Nhập công thức =SUMIF(C3:C8,"MOS-A",F3:F8) rồi nhấn Enter.',
      'Kiểm tra thứ tự 3 đối số: vùng điều kiện C3:C8, điều kiện "MOS-A", vùng cộng F3:F8.',
    ],
    formulaOrValue: '=SUMIF(C3:C8,"MOS-A",F3:F8)',
    examTrap: 'Rất hay nhầm thứ tự của SUMIF với SUMIFS: trong SUMIF thì vùng cần cộng F3:F8 luôn đứng CUỐI CÙNG.',
    verifyTip: 'Ô I4 trả về tổng điểm trung bình của 3 học viên lớp MOS-A.',
  },
  'e2-t5': {
    steps: [
      'Bấm nút dấu + ở thanh trang tính phía dưới cùng bên trái để thêm trang tính mới.',
      'Nhấp đúp vào tên trang mới vừa tạo (ví dụ Sheet2).',
      'Đổi tên thành “TongHop” rồi nhấn Enter.',
    ],
    formulaOrValue: 'TongHop',
    examTrap: 'Gõ đúng “TongHop” không dấu, không khoảng trắng.',
    verifyTip: 'Thanh dưới có đủ cả 2 trang “HocVien” và “TongHop”.',
  },
  'e3-t1': {
    steps: [
      'Chọn ô B3 trên trang TonKho.',
      'Nhập công thức =LEFT(A3,2) để lấy 2 ký tự đầu của mã hàng ở cột A rồi nhấn Enter.',
      'Kéo Fill Handle từ B3 xuống B7.',
    ],
    formulaOrValue: '=LEFT(A3,2)',
    examTrap: 'Không gõ tay chữ “VN”, “SG”… — phải dùng đúng hàm LEFT(A3,2).',
    verifyTip: 'Cột B từ B3:B7 tự trích ra mã vùng 2 ký tự.',
  },
  'e3-t2': {
    steps: [
      'Chọn ô F3 trên trang TonKho.',
      'Nhập công thức =D3-E3 (Tồn đầu trừ Xuất kho) rồi nhấn Enter.',
      'Kéo công thức từ F3 xuống hết ô F7.',
    ],
    formulaOrValue: '=D3-E3',
    examTrap: 'Đừng trừ ngược E3-D3 sẽ ra số âm.',
    verifyTip: 'Giá trị F3:F7 lần lượt là 15, 38, 12, 38, 9.',
  },
  'e3-t3': {
    steps: [
      'Chọn ô G3 trên trang TonKho.',
      'Nhập công thức =IF(F3<20,"Nhập thêm","Ổn định") rồi nhấn Enter.',
      'Sao chép công thức xuống vùng G3:G7.',
    ],
    formulaOrValue: '=IF(F3<20,"Nhập thêm","Ổn định")',
    examTrap: 'Kiểm tra dấu < 20 (nhỏ hơn 20), không dùng <= 20.',
    verifyTip: 'Các dòng tồn cuối 15, 12, 9 hiện “Nhập thêm”; dòng 38 hiện “Ổn định”.',
  },
  'e3-t4': {
    steps: [
      'Chọn ô H3 trên trang TonKho.',
      'Nhập chính xác =VLOOKUP(B3,BangGia!$A$2:$B$5,2,FALSE) rồi nhấn Enter.',
      'Kéo Fill Handle từ H3 xuống H7 để tra cứu phụ phí cho cả 5 mặt hàng.',
    ],
    formulaOrValue: '=VLOOKUP(B3,BangGia!$A$2:$B$5,2,FALSE)',
    shortcut: 'F4 (khoá địa chỉ tuyệt đối $)',
    examTrap: 'Quên dấu $ khoá vùng $A$2:$B$5 khiến khi kéo xuống H4..H7 bảng tra bị trượt và báo lỗi #N/A.',
    verifyTip: 'Cả 5 ô H3:H7 trả về đúng mức phụ phí số từ trang BangGia, không có #N/A.',
  },
  'e3-t5': {
    steps: [
      'Bôi chọn vùng H3:H7 → trên thẻ Home bấm nút định dạng phân tách hàng nghìn (#,##0).',
      'Chuyển sang thẻ Page Layout (Bố cục trang) → bấm Hướng trang (Orientation) → chọn Ngang (Landscape).',
      'Xác nhận thiết lập đã lưu.',
    ],
    examTrap: 'Nhớ thực hiện cả 2 yêu cầu: định dạng số cho H3:H7 VÀ đổi hướng in sang Ngang.',
    verifyTip: 'Số tiền ở H3:H7 có dấu phân tách hàng nghìn rõ ràng và hướng trang là Ngang.',
  },
  'e4a-t1': {
    steps: [
      'Chọn ô E3 (cột Lương chính).',
      'Nhập =C3*D3 (Lương ngày × Ngày công) rồi nhấn Enter.',
      'Kéo Fill Handle từ E3 xuống E7.',
    ],
    formulaOrValue: '=C3*D3',
    examTrap: 'Kiểm tra sao chép đủ cả 5 dòng từ E3 đến E7.',
    verifyTip: 'Cả 5 ô E3:E7 hiển thị đúng Lương chính theo công thức nhân.',
  },
  'e4a-t2': {
    steps: [
      'Chọn ô G3 (cột Tổng lĩnh).',
      'Nhập =E3+F3 (hoặc =SUM(E3:F3)) rồi nhấn Enter.',
      'Kéo Fill Handle từ G3 xuống G7.',
    ],
    formulaOrValue: '=E3+F3',
    examTrap: 'Chỉ cộng Lương chính (E) và Thưởng (F), tránh cộng nhầm cột Ngày công (D).',
    verifyTip: 'Cả 5 ô G3:G7 đều dùng công thức cộng cột E và cột F.',
  },
  'e4a-t3': {
    steps: [
      'Chọn ô B9 (cạnh nhãn “Lương thấp nhất”).',
      'Nhập =MIN(G3:G7) rồi nhấn Enter.',
      'Kiểm tra giá trị trả về đúng mức Tổng lĩnh nhỏ nhất trong cột G.',
    ],
    formulaOrValue: '=MIN(G3:G7)',
    examTrap: 'Tránh nhầm vùng E3:E7 (Lương chính) với G3:G7 (Tổng lĩnh).',
    verifyTip: 'Thanh công thức ô B9 hiển thị =MIN(G3:G7).',
  },
  'e4a-t4': {
    steps: [
      'Chọn ô B10 (cạnh nhãn “Tổng số nhân sự”).',
      'Nhập =COUNTA(A3:A7) rồi nhấn Enter.',
      'Kiểm tra kết quả đếm ra đúng 5 nhân sự.',
    ],
    formulaOrValue: '=COUNTA(A3:A7)',
    examTrap: 'Hàm COUNT chỉ đếm ô chứa số (sẽ trả về 0 với mã NV01..NV05 dạng chữ) — phải dùng COUNTA.',
    verifyTip: 'Ô B10 hiển thị giá trị 5.',
  },
  'e4a-t5': {
    steps: [
      'Bôi chọn vùng A1:G1 → mở thẻ Home → bấm Gộp & căn giữa (Merge & Center).',
      'Mở thẻ Page Layout → chuyển Hướng trang sang Ngang (Landscape) hoặc bỏ chọn In đường lưới (Gridlines).',
      'Kiểm tra bảng tiêu đề căn gọn trên 7 cột A–G.',
    ],
    examTrap: 'Gộp đúng đến cột G (A1:G1), không dừng ở cột F.',
    verifyTip: 'Tiêu đề gộp gọn A1:G1 và tuỳ chọn in đã cập nhật.',
  },
  'e5a-t1': {
    steps: [
      'Chọn ô C3 (cột Họ và tên đầy đủ).',
      'Nhập =PROPER(A3&" "&B3) (hoặc =CONCAT(A3," ",B3)) rồi nhấn Enter.',
      'Kéo công thức từ C3 xuống hết ô C6.',
    ],
    formulaOrValue: '=PROPER(A3&" "&B3)',
    examTrap: 'Phải chèn dấu cách " " ở giữa Họ và Tên; dùng PROPER giúp tự viết hoa chữ cái đầu mỗi từ.',
    verifyTip: 'C3:C6 hiển thị đầy đủ Họ và Tên có dấu cách chuẩn ở giữa.',
  },
  'e5a-t2': {
    steps: [
      'Chọn ô E3 (cột Mã chuẩn hoá).',
      'Nhập =UPPER(D3) rồi nhấn Enter.',
      'Kéo Fill Handle từ E3 xuống E6.',
    ],
    formulaOrValue: '=UPPER(D3)',
    examTrap: 'Không tự gõ lại chữ hoa thủ công; dùng hàm UPPER để chuyển động.',
    verifyTip: 'Toàn bộ mã ở E3:E6 chuyển sang chữ IN HOA.',
  },
  'e5a-t3': {
    steps: [
      'Chọn ô F3 (cột Độ dài mã).',
      'Nhập =LEN(D3) rồi nhấn Enter.',
      'Kéo công thức từ F3 xuống F6.',
    ],
    formulaOrValue: '=LEN(D3)',
    examTrap: 'Hàm LEN đếm cả ký tự dấu gạch ngang nếu có trong mã.',
    verifyTip: 'Cả 4 ô F3:F6 hiển thị số nguyên độ dài ký tự bằng hàm LEN.',
  },
  'e5a-t4': {
    steps: [
      'Mở thẻ View (Xem) trên thanh Ribbon.',
      'Bấm nút Cố định khung (Freeze Panes).',
      'Chọn Cố định cột đầu tiên (Freeze First Column).',
    ],
    examTrap: 'Chọn Freeze First Column (khoá cột A), không bấm nhầm Freeze Top Row.',
    verifyTip: 'Cuộn ngang sang phải thấy cột A luôn cố định.',
  },
  'e5a-t5': {
    steps: [
      'Nhấp đúp vào tên trang tính “KhachHang” ở góc dưới bên trái.',
      'Nhập chính xác “DanhBa” rồi nhấn Enter.',
      'Kiểm tra tab mới không có dấu cách thừa.',
    ],
    formulaOrValue: 'DanhBa',
    examTrap: 'Viết liền “DanhBa” đúng chính tả.',
    verifyTip: 'Thẻ trang tính phía dưới hiện đúng chữ “DanhBa”.',
  },
  'e6a-t1': {
    steps: [
      'Chọn ô D3 (cột Chênh lệch).',
      'Nhập =B3-C3 (Dự toán trừ Thực chi) rồi nhấn Enter.',
      'Kéo Fill Handle từ D3 xuống D6.',
    ],
    formulaOrValue: '=B3-C3',
    examTrap: 'Sao chép đủ 4 dòng hạng mục từ D3 đến D6.',
    verifyTip: 'D3:D6 hiển thị chênh lệch giữa cột B và cột C.',
  },
  'e6a-t2': {
    steps: [
      'Chọn ô E3 (cột Tỷ lệ thực chi).',
      'Nhập =C3/B3 (Thực chi chia Dự toán) rồi nhấn Enter.',
      'Kéo công thức từ E3 xuống E6.',
    ],
    formulaOrValue: '=C3/B3',
    examTrap: 'Không chia ngược B3/C3 — tỷ lệ thực chi phải lấy Thực chi (C) chia Dự toán (B).',
    verifyTip: 'E3:E6 ra tỷ số thập phân gần 0.8–1.1 (sẽ thành % ở Task 3).',
  },
  'e6a-t3': {
    steps: [
      'Bôi chọn vùng E3:E6.',
      'Mở thẻ Home (Trang chủ) → nhóm Định dạng số (Number).',
      'Bấm biểu tượng Phần trăm (%).',
    ],
    shortcut: 'Ctrl + Shift + %',
    examTrap: 'Không nhân thêm 100 vào công thức ở Task 2 khi đã áp dụng định dạng % (sẽ ra 9000%).',
    verifyTip: 'Toàn bộ E3:E6 hiển thị rõ ký hiệu %.',
  },
  'e6a-t4': {
    steps: [
      'Chọn ô B7 → gõ =SUM(B3:B6) rồi nhấn Enter.',
      'Chọn ô C7 → gõ =SUM(C3:C6) rồi nhấn Enter.',
      'Chọn ô D7 → gõ =SUM(D3:D6) rồi nhấn Enter (hoặc kéo ngang từ B7 sang D7).',
    ],
    formulaOrValue: '=SUM(B3:B6)',
    shortcut: 'Alt + =',
    examTrap: 'Cần đủ công thức SUM ở cả 3 cột B7, C7 và D7.',
    verifyTip: 'Dòng tổng 7 có đủ tổng Dự toán, Thực chi và Chênh lệch.',
  },
  'e6a-t5': {
    steps: [
      'Mở thẻ Page Layout (Bố cục trang) hoặc hộp thoại In / PDF.',
      'Tìm mục Tỷ lệ thu phóng (Scale to Fit).',
      'Bật chế độ Vừa 1 trang (Fit to Page).',
    ],
    examTrap: 'Đừng quên lưu/áp dụng thiết lập in sau khi chọn Fit to Page.',
    verifyTip: 'Thiết lập in hiển thị đang bật Fit to Page.',
  },
  'e7a-t1': {
    steps: [
      'Chọn ô D3 (cột Chiết khấu 5%).',
      'Nhập =C3*5% (hoặc =C3*0.05) rồi nhấn Enter.',
      'Kéo Fill Handle từ D3 xuống D7.',
    ],
    formulaOrValue: '=C3*5%',
    examTrap: 'Phải có ký hiệu % hoặc dùng 0.05 (gõ =C3*5 sẽ nhân gấp 5 lần giá trị đơn).',
    verifyTip: 'D3:D7 tính ra đúng 5% của cột C.',
  },
  'e7a-t2': {
    steps: [
      'Chọn ô E3 (cột Thanh toán).',
      'Nhập =C3-D3 (Giá trị đơn trừ Chiết khấu) rồi nhấn Enter.',
      'Kéo công thức từ E3 xuống E7.',
    ],
    formulaOrValue: '=C3-D3',
    examTrap: 'Kiểm tra đủ cả 5 đơn hàng từ E3 đến E7.',
    verifyTip: 'Cột E luôn nhỏ hơn cột C đúng bằng giá trị chiết khấu cột D.',
  },
  'e7a-t3': {
    steps: [
      'Chọn ô B9 (tổng đơn Online).',
      'Nhập =SUMIF(B3:B7,"Online",C3:C7) rồi nhấn Enter.',
      'Kiểm tra thứ tự: vùng kênh B3:B7, điều kiện "Online", vùng cộng C3:C7.',
    ],
    formulaOrValue: '=SUMIF(B3:B7,"Online",C3:C7)',
    examTrap: 'Đặt đúng vùng cộng C3:C7 ở đối số thứ 3 của SUMIF.',
    verifyTip: 'Ô B9 hiển thị đúng tổng các đơn có kênh Online.',
  },
  'e7a-t4': {
    steps: [
      'Chọn ô B10 (đếm số đơn Online).',
      'Nhập =COUNTIF(B3:B7,"Online") rồi nhấn Enter.',
      'Kiểm tra số đếm khớp với số dòng có chữ “Online” trong cột B.',
    ],
    formulaOrValue: '=COUNTIF(B3:B7,"Online")',
    examTrap: 'Chuỗi "Online" phải đặt trong ngoặc kép.',
    verifyTip: 'Ô B10 trả về số nguyên đếm đúng số đơn Online.',
  },
  'e7a-t5': {
    steps: [
      'Bôi chọn vùng A1:E1 → thẻ Home → bấm Gộp & căn giữa (Merge & Center).',
      'Chọn ô A3 → mở thẻ View → bấm Cố định khung (Freeze Panes) → chọn Cố định tại ô đang chọn.',
      'Kiểm tra cả tiêu đề đã gộp và 2 dòng đầu đã cố định.',
    ],
    examTrap: 'Nhớ thực hiện đủ 2 thao tác: gộp A1:E1 và cố định 2 dòng đầu.',
    verifyTip: 'Tiêu đề căn giữa từ A1 đến E1 và cuộn xuống vẫn giữ nguyên dòng 1–2.',
  },
  'ee1-t1': {
    steps: [
      'Chọn ô H3 trên trang KPI_2026.',
      'Nhập chính xác =SUMIFS(E3:E10,B3:B10,"Miền Bắc",C3:C10,"Đạt") rồi nhấn Enter.',
      'Chú ý trong SUMIFS: vùng tính tổng E3:E10 luôn đứng ĐẦU TIÊN, theo sau là từng cặp (vùng_điều_kiện, điều_kiện).',
    ],
    formulaOrValue: '=SUMIFS(E3:E10,B3:B10,"Miền Bắc",C3:C10,"Đạt")',
    examTrap: 'Sai lầm số 1 ở MOS Expert: đặt sum_range E3:E10 ở cuối giống SUMIF sẽ gây lỗi sai cú pháp.',
    verifyTip: 'Ô H3 trả về tổng doanh số nhân viên Miền Bắc có trạng thái Đạt (275.000.000).',
  },
  'ee1-t2': {
    steps: [
      'Chọn ô H4 trên trang KPI_2026.',
      'Nhập =COUNTIFS(B3:B10,"Miền Nam",E3:E10,">=100000000") rồi nhấn Enter.',
      'Kiểm tra đủ 8 chữ số 0 trong mốc 100000000 (100 triệu).',
    ],
    formulaOrValue: '=COUNTIFS(B3:B10,"Miền Nam",E3:E10,">=100000000")',
    examTrap: 'Đừng thêm dấu chấm ngăn cách vào chuỗi ">=100000000" bên trong công thức.',
    verifyTip: 'Ô H4 trả về 3 nhân viên Miền Nam đạt doanh số từ 100 triệu trở lên.',
  },
  'ee1-t3': {
    steps: [
      'Chọn ô H5 trên trang KPI_2026.',
      'Nhập =INDEX(A3:A10,MATCH(MAX(E3:E10),E3:E10,0)) rồi nhấn Enter.',
      'Cơ chế: MAX tìm doanh số cao nhất → MATCH(...,0) tìm vị trí dòng chính xác → INDEX lấy tên nhân viên ở cột A.',
    ],
    formulaOrValue: '=INDEX(A3:A10,MATCH(MAX(E3:E10),E3:E10,0))',
    examTrap: 'Thiếu tham số 0 ở cuối MATCH sẽ khiến Excel tìm gần đúng và trả sai tên nhân viên.',
    verifyTip: 'Ô H5 hiển thị tên “Bùi Thảo Vy” (doanh số cao nhất 175.000.000).',
  },
  'ee1-t4': {
    steps: [
      'Chọn ô F3 (cột Xếp hạng thưởng).',
      'Nhập =IF(AND(D3>=90,E3>=100000000),"Thưởng cao","Tiêu chuẩn") rồi nhấn Enter.',
      'Kéo Fill Handle từ F3 xuống hết ô F10.',
    ],
    formulaOrValue: '=IF(AND(D3>=90,E3>=100000000),"Thưởng cao","Tiêu chuẩn")',
    examTrap: 'Phải dùng hàm AND bọc cả 2 điều kiện D3>=90 và E3>=100000000.',
    verifyTip: 'Chỉ nhân viên thoả đồng thời KPI >= 90 và DS >= 100tr mới nhận “Thưởng cao”.',
  },
  'ee1-t5': {
    steps: [
      'Mở thẻ Page Layout (Bố cục trang) trên thanh Ribbon.',
      'Đổi Hướng trang (Orientation) sang Ngang (Landscape).',
      'Bật chế độ thu gọn Vừa 1 trang (Fit to Page).',
    ],
    examTrap: 'Thiếu 1 trong 2 thiết lập (Landscape hoặc Fit to Page) đều chưa đạt câu này.',
    verifyTip: 'Thiết lập in hiển thị hướng Ngang và tỷ lệ Vừa 1 trang.',
  },
  'ee2-t1': {
    steps: [
      'Chọn ô B3 trên trang BanHang.',
      'Nhập =MID(A3,4,2) (bắt đầu từ ký tự thứ 4, lấy 2 ký tự) rồi nhấn Enter.',
      'Kéo Fill Handle từ B3 xuống B6.',
    ],
    formulaOrValue: '=MID(A3,4,2)',
    examTrap: 'Đếm kỹ vị trí: “V”(1) “N”(2) “-”(3) → “A”(4) “1”(5), nên vị trí bắt đầu là 4 và độ dài là 2.',
    verifyTip: 'B3:B6 lần lượt hiển thị A1, B2, C3, X9.',
  },
  'ee2-t2': {
    steps: [
      'Chọn ô D3 trên trang BanHang.',
      'Nhập =IFERROR(VLOOKUP(B3,DanhMuc!$A$2:$B$4,2,FALSE),0) rồi nhấn Enter.',
      'Kéo Fill Handle từ D3 xuống D6 để kiểm tra dòng X9 tự trả về 0 thay vì #N/A.',
    ],
    formulaOrValue: '=IFERROR(VLOOKUP(B3,DanhMuc!$A$2:$B$4,2,FALSE),0)',
    shortcut: 'F4',
    examTrap: 'Phải khoá tuyệt đối $A$2:$B$4 và bọc ngoài bằng IFERROR(..., 0) để bẫy mã X9 không có trong danh mục.',
    verifyTip: 'D3..D5 ra đơn giá chuẩn, D6 hiển thị 0 sạch lỗi.',
  },
  'ee2-t3': {
    steps: [
      'Chọn ô E3 trên trang BanHang.',
      'Nhập =C3*D3 (Số lượng × Đơn giá) rồi nhấn Enter.',
      'Kéo Fill Handle từ E3 xuống E6.',
    ],
    formulaOrValue: '=C3*D3',
    examTrap: 'Nếu Task 2 chưa dùng IFERROR thì ô E6 sẽ bị lan lỗi #N/A.',
    verifyTip: 'E3:E6 ra giá trị số hợp lệ, riêng E6 bằng 0.',
  },
  'ee2-t4': {
    steps: [
      'Chọn ô F3 trên trang BanHang.',
      'Nhập =IF(D3=0,"Thiếu giá","Hợp lệ") rồi nhấn Enter.',
      'Kéo Fill Handle từ F3 xuống F6.',
    ],
    formulaOrValue: '=IF(D3=0,"Thiếu giá","Hợp lệ")',
    examTrap: 'So sánh với số 0 (D3=0), không bọc số 0 trong dấu ngoặc kép "0".',
    verifyTip: 'F3:F5 hiện “Hợp lệ”, F6 hiện “Thiếu giá”.',
  },
  'ee2-t5': {
    steps: [
      'Bôi chọn vùng 8 ô từ D3 đến E6 (cột Đơn giá và Thành tiền).',
      'Mở thẻ Home → bấm nút định dạng phân tách hàng nghìn (#,##0).',
      'Kiểm tra tất cả 8 ô đều hiển thị dấu phân tách nghìn rõ ràng.',
    ],
    examTrap: 'Đừng quên chọn cả 2 cột D và E (D3:E6), tránh chỉ định dạng mỗi cột E.',
    verifyTip: 'Cả 8 ô vùng D3:E6 có định dạng số phân tách hàng nghìn.',
  },
  'ee3-t1': {
    steps: [
      'Chọn ô D3 (cột Lợi nhuận).',
      'Nhập =B3-C3 (Doanh thu trừ Chi phí) rồi nhấn Enter.',
      'Kéo Fill Handle từ D3 xuống D7.',
    ],
    formulaOrValue: '=B3-C3',
    examTrap: 'Kéo đủ 5 chi nhánh từ D3 đến D7.',
    verifyTip: 'Lợi nhuận Hà Nội là 230.000.000, TP.HCM là 330.000.000.',
  },
  'ee3-t2': {
    steps: [
      'Chọn ô E3 (cột Biên LN).',
      'Nhập =D3/B3 (Lợi nhuận chia Doanh thu) rồi nhấn Enter.',
      'Kéo Fill Handle từ E3 xuống E7.',
    ],
    formulaOrValue: '=D3/B3',
    examTrap: 'Biên lợi nhuận chia cho Doanh thu (B3), không chia cho Chi phí (C3).',
    verifyTip: 'E3:E7 ra tỷ lệ khoảng 0.18–0.30.',
  },
  'ee3-t3': {
    steps: [
      'Chọn ô F3 (cột Xếp hạng).',
      'Nhập =RANK(D3,$D$3:$D$7) (hoặc =RANK.EQ(D3,$D$3:$D$7)) rồi nhấn Enter.',
      'Kéo Fill Handle từ F3 xuống F7.',
    ],
    formulaOrValue: '=RANK(D3,$D$3:$D$7)',
    shortcut: 'F4',
    examTrap: 'Bắt buộc khoá tuyệt đối $D$3:$D$7, nếu quên khoá thì xếp hạng các dòng dưới sẽ sai hoàn toàn.',
    verifyTip: 'TP.HCM xếp hạng 1, Hà Nội hạng 2, Cần Thơ hạng 5.',
  },
  'ee3-t4': {
    steps: [
      'Chọn ô B9 (TB LN chi nhánh > 100tr).',
      'Nhập =AVERAGEIF(D3:D7,">100000000") rồi nhấn Enter.',
      'Kiểm tra dấu ngoặc kép bọc quanh ">100000000".',
    ],
    formulaOrValue: '=AVERAGEIF(D3:D7,">100000000")',
    examTrap: 'Viết đúng 8 chữ số 0 trong 100000000 và dùng dấu > lớn hơn hẳn.',
    verifyTip: 'Ô B9 hiển thị trung bình lợi nhuận của Hà Nội và TP.HCM (280.000.000).',
  },
  'ee3-t5': {
    steps: [
      'Bôi chọn vùng E3:E7 → thẻ Home → bấm biểu tượng % (Percentage).',
      'Bôi chọn vùng tiêu đề A1:F1 → thẻ Home → bấm Gộp & căn giữa (Merge & Center).',
      'Kiểm tra đủ cả 2 thao tác.',
    ],
    examTrap: 'Gộp đúng A1:F1 (đủ 6 cột), không gộp thiếu cột F.',
    verifyTip: 'E3:E7 hiện phần trăm và A1:F1 gộp thành một tiêu đề cân đối.',
  },
  'ee4-t1': {
    steps: [
      'Chọn ô E3 trên trang DanhGia.',
      'Nhập =IF(OR(C3>=8.5,D3>=8.5),"Ưu tiên","Tiêu chuẩn") rồi nhấn Enter.',
      'Kéo công thức từ E3 xuống E6.',
    ],
    formulaOrValue: '=IF(OR(C3>=8.5,D3>=8.5),"Ưu tiên","Tiêu chuẩn")',
    examTrap: 'Đề yêu cầu “HOẶC” nên dùng OR, không dùng nhầm AND.',
    verifyTip: 'HR01, HR02, HR04 nhận “Ưu tiên”; HR03 nhận “Tiêu chuẩn”.',
  },
  'ee4-t2': {
    steps: [
      'Chọn ô F3 trên trang DanhGia.',
      'Nhập =ROUND(AVERAGE(C3:D3),1) rồi nhấn Enter.',
      'Kéo Fill Handle từ F3 xuống F6.',
    ],
    formulaOrValue: '=ROUND(AVERAGE(C3:D3),1)',
    examTrap: 'Chỉ giảm số thập phân hiển thị bằng nút .00 không làm thay đổi giá trị thật — MOS yêu cầu hàm ROUND(..., 1).',
    verifyTip: 'F3:F6 làm tròn chuẩn 1 chữ số thập phân (7.9, 8.0, 6.3, 8.8).',
  },
  'ee4-t3': {
    steps: [
      'Chọn ô B8 (Số NV thiếu điểm).',
      'Nhập =COUNTBLANK(C3:D6) rồi nhấn Enter.',
      'Kiểm tra hàm trả về 0 vì cả 8 ô điểm đã có dữ liệu.',
    ],
    formulaOrValue: '=COUNTBLANK(C3:D6)',
    examTrap: 'Truyền đúng vùng điểm số C3:D6.',
    verifyTip: 'Thanh công thức ô B8 ghi =COUNTBLANK(C3:D6).',
  },
  'ee4-t4': {
    steps: [
      'Bấm dấu + ở thanh trang tính phía dưới cùng bên trái để thêm trang mới.',
      'Nhấp đúp vào tên trang mới tạo.',
      'Gõ đúng “GhiChuHR” rồi nhấn Enter.',
    ],
    formulaOrValue: 'GhiChuHR',
    examTrap: 'Giữ nguyên viết hoa “GhiChuHR”, không chèn khoảng trắng.',
    verifyTip: 'Thanh trang tính xuất hiện thêm tab “GhiChuHR”.',
  },
  'ee4-t5': {
    steps: [
      'Nhấp chọn chính xác ô B3 (giao điểm ngay dưới dòng 2 và ngay bên phải cột A).',
      'Mở thẻ View (Xem) → bấm Cố định khung (Freeze Panes).',
      'Chọn Cố định tại ô đang chọn để khoá đồng thời cả 2 dòng đầu và cột A.',
    ],
    examTrap: 'Chọn nhầm A3 sẽ chỉ khoá dòng mà không khoá cột A; phải chọn đúng ô B3.',
    verifyTip: 'Cuộn xuống giữ dòng 1–2 và cuộn ngang giữ cột A.',
  },
  'ee5-t1': {
    steps: [
      'Chuyển sang trang tính “TongHop6Thang” ở thanh dưới.',
      'Chọn ô B3 → nhập =Quy1!B3 rồi nhấn Enter.',
      'Kéo Fill Handle từ B3 xuống B5 để liên kết cả 3 gói sản phẩm từ trang Quy1.',
    ],
    formulaOrValue: '=Quy1!B3',
    examTrap: 'Không copy/paste giá trị tĩnh; phải dùng công thức tham chiếu liên trang có dấu chấm than (!).',
    verifyTip: 'B3:B5 hiển thị 120tr, 280tr, 95tr và thanh công thức chứa Quy1!.',
  },
  'ee5-t2': {
    steps: [
      'Trên trang TongHop6Thang, chọn ô C3.',
      'Nhập =Quy2!B3 rồi nhấn Enter.',
      'Kéo Fill Handle từ C3 xuống C5.',
    ],
    formulaOrValue: '=Quy2!B3',
    examTrap: 'Trên trang Quy2, doanh thu cũng nằm ở cột B (Quy2!B3), không nhập nhầm Quy2!C3.',
    verifyTip: 'C3:C5 hiển thị 145tr, 320tr, 110tr.',
  },
  'ee5-t3': {
    steps: [
      'Trên trang TongHop6Thang, chọn ô D3.',
      'Nhập =SUM(B3:C3) (hoặc =B3+C3) rồi nhấn Enter.',
      'Kéo công thức từ D3 xuống D5.',
    ],
    formulaOrValue: '=SUM(B3:C3)',
    examTrap: 'Sao chép đủ cả 3 sản phẩm D3:D5.',
    verifyTip: 'D3:D5 lần lượt ra 265tr, 600tr, 205tr.',
  },
  'ee5-t4': {
    steps: [
      'Trên trang TongHop6Thang, chọn ô E3.',
      'Nhập =(C3-B3)/B3 rồi nhấn Enter.',
      'Kéo công thức từ E3 xuống E5.',
    ],
    formulaOrValue: '=(C3-B3)/B3',
    examTrap: 'Thiếu cặp ngoặc tròn (C3-B3) sẽ khiến Excel tính B3/B3 trước rồi mới trừ, dẫn đến kết quả sai hoàn toàn.',
    verifyTip: 'E3:E5 hiển thị tỷ lệ tăng trưởng dương khoảng 0.14–0.21.',
  },
  'ee5-t5': {
    steps: [
      'Trên trang TongHop6Thang, bôi chọn A1:E1 → thẻ Home → bấm Gộp & căn giữa.',
      'Mở thẻ Page Layout → bấm Hướng trang (Orientation) → chọn Ngang (Landscape).',
      'Kiểm tra hoàn tất cả 2 yêu cầu.',
    ],
    examTrap: 'Đảm bảo đang đứng ở đúng trang TongHop6Thang khi gộp A1:E1.',
    verifyTip: 'Tiêu đề TongHop6Thang gộp gọn A1:E1 và hướng trang in là Ngang.',
  },
};
