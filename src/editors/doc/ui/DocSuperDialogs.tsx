import { useState, useMemo } from 'react';
import {
  Printer,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Presentation,
  X,
} from 'lucide-react';
import { useDoc } from '../DocContext';
import { useWorkspace } from '../../../lib/storage';
import { createSlideFromLayout } from '../../../lib/slideTemplates';
import type { PresentationData } from '../../../lib/slideTypes';

const PX_PER_MM = 3.78;
const toMm = (px: number) => Math.round(px / PX_PER_MM);
const toPx = (mm: number) => Math.round(mm * PX_PER_MM);
const DECREE30_RANGES = { top: [20, 25], bottom: [20, 25], left: [30, 35], right: [15, 20] } as const;
const DECREE30_MARGINS_MM = { top: 20, bottom: 20, left: 30, right: 15 };

export function PreflightDialog({ onClose }: { onClose: () => void }) {
  const { editor, page, setPage, print } = useDoc();
  const [fixedMargins, setFixedMargins] = useState(false);

  const docText = editor.getText();
  const wordCount = docText.trim() ? docText.trim().split(/\s+/).length : 0;
  const readingTimeMin = Math.ceil(wordCount / 200);

  // Scan document structure
  const stats = useMemo(() => {
    let imagesCount = 0;
    let tablesCount = 0;
    let h1Count = 0;
    let h2Count = 0;

    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image' || node.type.name === 'layoutImage') imagesCount++;
      if (node.type.name === 'table') tablesCount++;
      if (node.type.name === 'heading') {
        if (node.attrs.level === 1) h1Count++;
        if (node.attrs.level === 2) h2Count++;
      }
    });

    const margins = {
      top: toMm(page.margins.top),
      bottom: toMm(page.margins.bottom),
      left: toMm(page.margins.left),
      right: toMm(page.margins.right),
    };
    const isDecree30Margins = (Object.keys(DECREE30_RANGES) as (keyof typeof DECREE30_RANGES)[]).every((side) => {
      const [min, max] = DECREE30_RANGES[side];
      return margins[side] >= min && margins[side] <= max;
    });
    const leftMarginOk = margins.left >= 25;

    return {
      imagesCount,
      tablesCount,
      h1Count,
      h2Count,
      isDecree30Margins,
      leftMarginOk,
      margins,
    };
  }, [editor, page.margins]);

  const handleApplyDecree30Margins = () => {
    setPage({
      ...page,
      margins: {
        top: toPx(DECREE30_MARGINS_MM.top),
        bottom: toPx(DECREE30_MARGINS_MM.bottom),
        left: toPx(DECREE30_MARGINS_MM.left),
        right: toPx(DECREE30_MARGINS_MM.right),
      },
    });
    setFixedMargins(true);
  };

  const handlePrint = () => {
    onClose();
    print();
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" style={{ width: 620 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Trợ lý Tiền kỳ In ấn (Print Preflight Checker)</h2>
        <div className="dialog-subtitle">
          Kiểm tra toàn diện tiêu chuẩn trang in, lề gáy sách, độ phân giải và phân cấp văn bản trước khi in ấn
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '16px 0' }}>
          {/* Status summary */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 8,
              background: stats.leftMarginOk ? '#f0fdf4' : '#fff7ed',
              border: `1px solid ${stats.leftMarginOk ? '#bbf7d0' : '#fed7aa'}`,
            }}
          >
            {stats.leftMarginOk ? (
              <CheckCircle2 size={24} color="#16a34a" />
            ) : (
              <AlertTriangle size={24} color="#ea580c" />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: stats.leftMarginOk ? '#166534' : '#9a3412' }}>
                {stats.leftMarginOk
                  ? 'Tài liệu đạt tiêu chuẩn tiền kỳ in ấn'
                  : 'Cảnh báo lề gáy sách hẹp (< 25mm)'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Lề hiện tại: Trái {stats.margins.left}mm, Phải {stats.margins.right}mm, Trên {stats.margins.top}mm, Dưới {stats.margins.bottom}mm.
              </div>
            </div>
          </div>

          {/* Checklist items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>Dung lượng nội dung:</span>
              <strong>{wordCount} từ (~{readingTimeMin} phút đọc)</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>Cấu trúc tiêu đề:</span>
              <span>
                {stats.h1Count} Tiêu đề lớn (H1), {stats.h2Count} Tiêu đề phụ (H2)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>Hình ảnh & Bảng biểu:</span>
              <span>
                {stats.imagesCount} hình ảnh, {stats.tablesCount} bảng số liệu
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>Chuẩn lề Nghị định 30/2020/NĐ-CP:</span>
              {stats.isDecree30Margins || fixedMargins ? (
                <span style={{ color: '#16a34a', fontWeight: 600 }}>Đúng chuẩn (trên 20-25, dưới 20-25, trái 30-35, phải 15-20 mm)</span>
              ) : (
                <button
                  className="btn"
                  style={{ fontSize: 12, padding: '2px 8px' }}
                  onClick={handleApplyDecree30Margins}
                >
                  Áp dụng lề 20-20-30-15 mm
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={15} /> Mở lệnh In trang (Ctrl+P)
          </button>
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// 2. MERMAID & VECTOR DIAGRAM DIALOG
// -------------------------------------------------------------
export const DIAGRAM_TEMPLATES = [
  {
    id: 'flowchart',
    name: 'Lưu trình phê duyệt (Flowchart)',
    svg: `<svg viewBox="0 0 500 120" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc;border-radius:8px;font-family:sans-serif;font-size:12px;">
      <rect x="20" y="40" width="100" height="40" rx="6" fill="#eff6ff" stroke="#3b82f6" stroke-width="2"/>
      <text x="70" y="65" text-anchor="middle" fill="#1e40af" font-weight="600">Bắt đầu</text>
      <path d="M 120 60 L 160 60" stroke="#94a3b8" stroke-width="2" marker-end="url(#arrow)"/>
      <polygon points="210,35 260,60 210,85 160,60" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
      <text x="210" y="64" text-anchor="middle" fill="#92400e" font-weight="600">Xét duyệt?</text>
      <path d="M 260 60 L 300 60" stroke="#94a3b8" stroke-width="2"/>
      <rect x="300" y="40" width="100" height="40" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
      <text x="350" y="65" text-anchor="middle" fill="#166534" font-weight="600">Đã duyệt ✓</text>
      <path d="M 210 85 L 210 110 L 440 110 L 440 80" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="4"/>
      <rect x="390" y="40" width="100" height="40" rx="6" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
      <text x="440" y="65" text-anchor="middle" fill="#991b1b" font-weight="600">Từ chối ✕</text>
    </svg>`,
  },
  {
    id: 'sequence',
    name: 'Sơ đồ tương tác (Sequence Diagram)',
    svg: `<svg viewBox="0 0 500 140" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc;border-radius:8px;font-family:sans-serif;font-size:12px;">
      <rect x="40" y="15" width="90" height="30" rx="4" fill="#3b82f6" stroke="#2563eb"/><text x="85" y="35" text-anchor="middle" fill="#ffffff" font-weight="bold">Khách hàng</text>
      <line x1="85" y1="45" x2="85" y2="130" stroke="#cbd5e1" stroke-dasharray="4"/>
      <rect x="370" y="15" width="90" height="30" rx="4" fill="#107c41" stroke="#15803d"/><text x="415" y="35" text-anchor="middle" fill="#ffffff" font-weight="bold">Hệ thống</text>
      <line x1="415" y1="45" x2="415" y2="130" stroke="#cbd5e1" stroke-dasharray="4"/>
      <line x1="85" y1="70" x2="410" y2="70" stroke="#2563eb" stroke-width="2"/><polygon points="410,67 415,70 410,73" fill="#2563eb"/><text x="250" y="65" text-anchor="middle" fill="#1e3a8a">1. Gửi yêu cầu ký hợp đồng</text>
      <line x1="415" y1="105" x2="90" y2="105" stroke="#107c41" stroke-width="2" stroke-dasharray="4"/><polygon points="90,102 85,105 90,108" fill="#107c41"/><text x="250" y="100" text-anchor="middle" fill="#065f46">2. Phản hồi xác nhận thành công</text>
    </svg>`,
  },
  {
    id: 'mindmap',
    name: 'Sơ đồ tư duy (Mindmap)',
    svg: `<svg viewBox="0 0 500 130" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc;border-radius:8px;font-family:sans-serif;font-size:12px;">
      <rect x="180" y="45" width="140" height="40" rx="20" fill="#4f46e5" stroke="#4338ca" stroke-width="2"/>
      <text x="250" y="70" text-anchor="middle" fill="#ffffff" font-weight="bold">Kế hoạch 2026</text>
      <path d="M 180 65 C 120 65, 120 30, 60 30" fill="none" stroke="#4f46e5" stroke-width="2"/>
      <rect x="10" y="15" width="80" height="30" rx="6" fill="#eff6ff" stroke="#3b82f6"/><text x="50" y="35" text-anchor="middle" fill="#1e40af">Tài chính</text>
      <path d="M 180 65 C 120 65, 120 100, 60 100" fill="none" stroke="#4f46e5" stroke-width="2"/>
      <rect x="10" y="85" width="80" height="30" rx="6" fill="#fdf4ff" stroke="#c084fc"/><text x="50" y="105" text-anchor="middle" fill="#86198f">Nhân sự</text>
      <path d="M 320 65 C 380 65, 380 30, 440 30" fill="none" stroke="#4f46e5" stroke-width="2"/>
      <rect x="410" y="15" width="80" height="30" rx="6" fill="#f0fdf4" stroke="#22c55e"/><text x="450" y="35" text-anchor="middle" fill="#166534">Kinh doanh</text>
      <path d="M 320 65 C 380 65, 380 100, 440 100" fill="none" stroke="#4f46e5" stroke-width="2"/>
      <rect x="410" y="85" width="80" height="30" rx="6" fill="#fff7ed" stroke="#f97316"/><text x="450" y="105" text-anchor="middle" fill="#9a3412">Công nghệ</text>
    </svg>`,
  },
];

export function DiagramDialog({ onClose }: { onClose: () => void }) {
  const { editor } = useDoc();
  const [selected, setSelected] = useState(0);

  const handleInsert = () => {
    const item = DIAGRAM_TEMPLATES[selected];
    if (!item) return;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(item.svg)}`;
    editor
      .chain()
      .focus()
      .insertContent(
        `<div style="text-align: center; margin: 16px 0;"><img src="${dataUrl}" alt="${item.name}" style="max-width: 100%; border-radius: 8px; border: 1px solid #e2e8f0;" /><p style="font-size: 12px; color: #64748b; margin-top: 4px;">${item.name}</p></div>`
      )
      .run();
    onClose();
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" style={{ width: 640 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Chèn Sơ đồ Vector & Lưu trình (Diagrams)</h2>
        <div className="dialog-subtitle">Chèn lưu trình phê duyệt, sơ đồ tương tác hoặc sơ đồ tư duy vector sắc nét</div>

        <div style={{ display: 'flex', gap: 10, margin: '16px 0' }}>
          {DIAGRAM_TEMPLATES.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setSelected(i)}
              className="btn"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderColor: selected === i ? '#2563eb' : undefined,
                background: selected === i ? '#eff6ff' : undefined,
                color: selected === i ? '#1d4ed8' : undefined,
                fontWeight: selected === i ? 600 : 400,
              }}
            >
              {t.name.split(' (')[0]}
            </button>
          ))}
        </div>

        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 16,
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: DIAGRAM_TEMPLATES[selected]?.svg ?? '' }}
        />

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleInsert}>
            <GitBranch size={15} /> Chèn sơ đồ vào văn bản
          </button>
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// 3. DOC TO SLIDE EXPORTER DIALOG
// -------------------------------------------------------------
export function DocToSlideDialog({ onClose }: { onClose: () => void }) {
  const { editor, meta } = useDoc();
  const storage = useWorkspace();
  const [created, setCreated] = useState(false);
  const [createdName, setCreatedName] = useState('');

  // Extract slides from headings
  const extractedSections = useMemo(() => {
    const sections: { title: string; bullets: string[] }[] = [];
    let currentTitle = meta.name.replace(/\.[^/.]+$/, '');
    let currentBullets: string[] = [];

    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') {
        if (currentBullets.length > 0 || sections.length === 0) {
          sections.push({ title: currentTitle, bullets: currentBullets });
        }
        currentTitle = node.textContent.trim() || 'Slide';
        currentBullets = [];
      } else if (node.type.name === 'paragraph' || node.type.name === 'bulletList' || node.type.name === 'orderedList') {
        const text = node.textContent.trim();
        if (text && text.length < 200) {
          currentBullets.push(text);
        }
      }
    });

    if (currentBullets.length > 0 || sections.length === 0) {
      sections.push({ title: currentTitle, bullets: currentBullets });
    }

    return sections.slice(0, 15);
  }, [editor, meta.name]);

  const handleCreatePresentation = async () => {
    try {
      const slides = extractedSections.map((sec, idx) => {
        const slide = createSlideFromLayout(
          idx === 0 ? 'title' : 'title-content',
          idx,
          'office-classic',
          sec.title
        );
        if (idx > 0 && sec.bullets.length > 0) {
          // Add text bullet box
          slide.elements.push({
            id: `el-body-${Date.now()}-${idx}`,
            type: 'text',
            x: 10,
            y: 28,
            width: 80,
            height: 60,
            text: sec.bullets.slice(0, 5).map((b) => `• ${b}`).join('\n\n'),
            fontSize: 20,
            color: '#334155',
            textAlign: 'left',
          });
        }
        return slide;
      });

      const presData: PresentationData = {
        slides,
        themeId: 'office-classic',
        aspectRatio: '16:9',
        title: meta.name.replace(/\.[^/.]+$/, ''),
        author: 'Office 23',
      };

      const newName = `Thuyết trình - ${meta.name.replace(/\.[^/.]+$/, '')}.pptx`;
      await storage.saveFile(
        {
          id: `slide-${Date.now()}`,
          name: newName,
          kind: 'slide',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          openedAt: Date.now(),
          starred: false,
          deletedAt: null,
          size: 1024,
          preview: '',
        },
        { presentation: presData } as any
      );

      setCreatedName(newName);
      setCreated(true);
    } catch {
      alert('Không thể tạo file slide');
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" style={{ width: 580 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Chuyển đổi 1-Click: Docs sang Slide (Docs to Presentation)</h2>
        <div className="dialog-subtitle">
          Tự động phân tích các tiêu đề Heading và luận điểm trong văn bản để tạo bộ slide trình chiếu
        </div>

        <div style={{ margin: '16px 0' }}>
          {created ? (
            <div style={{ textAlign: 'center', padding: 20, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <CheckCircle2 size={36} color="#16a34a" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 600, fontSize: 15, color: '#166534' }}>
                Đã tạo bài thuyết trình thành công!
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                Tệp <strong>{createdName}</strong> đã được lưu vào Không gian làm việc.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#475569' }}>
                Đã tìm thấy <strong>{extractedSections.length} phân đoạn tiêu đề</strong> sẵn sàng chuyển đổi thành slide:
              </div>

              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: 8 }}>
                {extractedSections.map((sec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 600, color: '#4f46e5', width: 60 }}>Slide {i + 1}:</span>
                    <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {sec.title}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>({sec.bullets.length} ý)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            {created ? 'Đóng' : 'Hủy'}
          </button>
          {!created && (
            <button className="btn btn-primary" onClick={handleCreatePresentation}>
              <Presentation size={15} /> Tạo bài thuyết trình ngay
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
