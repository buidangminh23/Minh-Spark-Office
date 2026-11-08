import { contractDocHtml, meetingMinutesDocHtml, sampleDocHtml } from '../../lib/templates';

const today = () => {
  const d = new Date();
  return `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
};

export const coverPageHtml = (title: string) => `
<p></p><p></p><p></p>
<p style="text-align: center"><span style="font-size: 11pt; color: #798394">CÔNG TY MINH SPARK</span></p>
<p></p>
<h1 style="text-align: center"><span style="font-size: 32pt">${title || 'Tiêu đề tài liệu'}</span></h1>
<p style="text-align: center"><span style="font-size: 14pt; color: #586071">Phụ đề hoặc mô tả ngắn của tài liệu</span></p>
<p></p><p></p><p></p><p></p>
<p style="text-align: center"><strong>Người lập:</strong> Nguyễn Văn A</p>
<p style="text-align: center">Hà Nội, ${today()}</p>
<div data-page-break="true"></div>
`;

const officialLetterHtml = () => `
<table><tbody><tr>
<td><p style="text-align: center"><strong>CÔNG TY MINH SPARK</strong></p><p style="text-align: center">Số: …/2026/CV-MS</p><p style="text-align: center"><em>V/v: ………………………</em></p></td>
<td><p style="text-align: center"><strong>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p><p style="text-align: center"><strong>Độc lập – Tự do – Hạnh phúc</strong></p><p style="text-align: center"><em>Hà Nội, ${today()}</em></p></td>
</tr></tbody></table>
<p style="text-align: center"><strong>Kính gửi:</strong> ………………………………………</p>
<p style="text-align: justify">Căn cứ …………………………………………………………………………………………</p>
<p style="text-align: justify">Công ty Minh Spark trân trọng đề nghị Quý cơ quan ……………………………………………</p>
<p style="text-align: justify">Rất mong nhận được sự quan tâm, phối hợp của Quý cơ quan.</p>
<p><strong>Nơi nhận:</strong></p>
<ul><li><p>Như trên;</p></li><li><p>Lưu: VT.</p></li></ul>
<p style="text-align: right"><strong>GIÁM ĐỐC</strong></p>
<p style="text-align: right"><em>(Ký, ghi rõ họ tên, đóng dấu)</em></p>
`;

const resumeHtml = () => `
<h1>Họ và Tên</h1>
<p>📧 email@example.com · 📞 0900 000 000 · 📍 Hà Nội</p>
<hr>
<h2>Mục tiêu nghề nghiệp</h2>
<p>Tóm tắt 2–3 câu về định hướng và giá trị bạn mang lại.</p>
<h2>Kinh nghiệm làm việc</h2>
<h3>Chức danh — Công ty (2023 – nay)</h3>
<ul><li><p>Thành tích có số liệu cụ thể.</p></li><li><p>Trách nhiệm chính.</p></li></ul>
<h2>Học vấn</h2>
<p><strong>Trường Đại học …</strong> — Chuyên ngành …, tốt nghiệp 2022</p>
<h2>Kỹ năng</h2>
<ul><li><p>Kỹ năng chuyên môn</p></li><li><p>Ngoại ngữ</p></li></ul>
`;

const letterHtml = () => `
<p style="text-align: right"><em>Hà Nội, ${today()}</em></p>
<p><strong>Kính gửi:</strong> Anh/Chị …</p>
<p style="text-align: justify">Nội dung thư …</p>
<p>Trân trọng,</p>
<p><strong>Minh Spark</strong></p>
`;

export const DOC_TEMPLATES: { id: string; name: string; description: string; html: () => string }[] = [
  { id: 'blank', name: 'Tài liệu trống', description: 'Bắt đầu từ trang trắng', html: () => '<p></p>' },
  { id: 'report', name: 'Báo cáo hoạt động', description: 'Mục tiêu, ngân sách, lịch triển khai, việc cần làm', html: sampleDocHtml },
  { id: 'official', name: 'Công văn hành chính', description: 'Đúng thể thức văn bản hành chính Việt Nam', html: officialLetterHtml },
  { id: 'contract', name: 'Hợp đồng dịch vụ', description: 'Hợp đồng kinh tế có điều khoản đầy đủ', html: contractDocHtml },
  { id: 'minutes', name: 'Biên bản cuộc họp', description: 'Thành phần, nội dung, kết luận, phân công', html: meetingMinutesDocHtml },
  { id: 'resume', name: 'Sơ yếu lý lịch (CV)', description: 'CV gọn gàng một trang', html: resumeHtml },
  { id: 'letter', name: 'Thư cá nhân', description: 'Thư ngắn có ngày tháng và lời chào', html: letterHtml },
];
