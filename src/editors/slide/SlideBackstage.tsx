import {
  FileText,
  Download,
  Printer,
  Save,
  Plus,
  ArrowLeft,
  X,
  CheckCircle2,
  Settings2,
} from 'lucide-react';
import type { FileMeta, SlideContent } from '../../lib/storage';

interface SlideBackstageProps {
  meta: FileMeta;
  content: SlideContent;
  onClose: () => void;
  onSave: () => void;
  onExportPptx: () => void;
  onPrint: () => void;
  onNew: () => void;
  onBackToHome: () => void;
  onOpenOptions: () => void;
}

export function SlideBackstage({
  meta,
  content,
  onClose,
  onSave,
  onExportPptx,
  onPrint,
  onNew,
  onBackToHome,
  onOpenOptions,
}: SlideBackstageProps) {
  const slideCount = content.presentation.slides.length;

  return (
    <div className="ppt-backstage" onClick={onClose}>
      <div className="ppt-backstage-card" onClick={(e) => e.stopPropagation()}>
        <div className="ppt-backstage-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={24} />
            <h2>Tệp · {meta.name}</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="ppt-backstage-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div>
              <strong style={{ fontSize: '15px', color: '#1E293B' }}>{meta.name}</strong>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                Tổng số: {slideCount} trang chiếu · Tỉ lệ: {content.presentation.aspectRatio} · Chủ đề: {content.presentation.themeId}
              </div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10B981', fontSize: '13px', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Đã sẵn sàng
            </span>
          </div>

          <div className="ppt-backstage-grid">
            <div className="ppt-backstage-action-card" onClick={onSave}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Save size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '14px', color: '#0F172A' }}>Lưu bài thuyết trình</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>Lưu ngay vào bộ nhớ máy và đồng bộ</p>
              </div>
            </div>

            <div className="ppt-backstage-action-card" onClick={onExportPptx}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#FFEDD5', color: '#EA580C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Download size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '14px', color: '#0F172A' }}>Tải xuống (.pptx)</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>Mở được trên Microsoft PowerPoint &amp; 365</p>
              </div>
            </div>

            <div className="ppt-backstage-action-card" onClick={onPrint}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Printer size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '14px', color: '#0F172A' }}>In bài thuyết trình</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>Mỗi trang chiếu chiếm 1 trang in khổ ngang</p>
              </div>
            </div>

            <div className="ppt-backstage-action-card" onClick={onNew}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '14px', color: '#0F172A' }}>Bài thuyết trình mới</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>Tạo bản trình bày trống hoặc từ mẫu</p>
              </div>
            </div>

            <div className="ppt-backstage-action-card" onClick={onOpenOptions}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Settings2 size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '14px', color: '#0F172A' }}>Tuỳ chọn</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>Hiển thị, soạn thảo, trình chiếu và ribbon của 23 Slides</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
            <button
              onClick={onBackToHome}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: '#F1F5F9',
                color: '#334155',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={16} /> Trở về Danh sách tệp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
