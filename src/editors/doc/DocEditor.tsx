import { useEffect, useState, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';

import {
  ArrowLeft,
  Save,
  Download,
  Printer,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Subscript as SubIcon,
  Superscript as SuperIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListTodo,
  Indent,
  Outdent,
  Table as TableIcon,
  Image as ImageIcon,
  Link2,
  Minus,
  Quote,
  Code,
  FileText,
  CheckCircle2,
  Clock,
  Layout,
  Eye,
  Settings,
  Plus,
  Trash2,
} from 'lucide-react';

import { ParagraphFormat, PageBreak } from './extensions';
import { exportDocx } from '../../lib/docxConvert';
import { downloadBlob, pickFile, readAsDataUrl } from '../../lib/download';
import { defaultPage, PAGE_SIZES, type DocContent, type FileMeta, type PageSettings } from '../../lib/storage';
import { useUi } from '../../components/ui';

interface DocEditorProps {
  meta: FileMeta;
  content: DocContent;
  onSave: (meta: FileMeta, content: DocContent) => void;
  onRename: (name: string) => void;
  onBack: () => void;
}

type RibbonTab = 'home' | 'insert' | 'layout' | 'view' | 'file';

export default function DocEditor({ meta, content, onSave, onRename, onBack }: DocEditorProps) {
  const ui = useUi();
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [title, setTitle] = useState(meta.name);
  const [page, setPage] = useState<PageSettings>(content.page || defaultPage());
  const [zoom, setZoom] = useState(100);
  const [showOutline, setShowOutline] = useState(true);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving'>('saved');
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: true, allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Underline,
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder: 'Bắt đầu soạn thảo văn bản tại đây…' }),
      CharacterCount,
      Link.configure({ openOnClick: false }),
      ParagraphFormat,
      PageBreak,
    ],
    content: content.json || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: e }) => {
      setSavedStatus('saving');
      updateHeadings(e);
    },
  });

  const updateHeadings = (e: typeof editor) => {
    if (!e) return;
    const items: { id: string; text: string; level: number }[] = [];
    e.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const text = node.textContent;
        if (text) {
          items.push({
            id: `heading-${pos}`,
            text,
            level: node.attrs.level,
          });
        }
      }
    });
    setHeadings(items);
  };

  useEffect(() => {
    if (editor) {
      updateHeadings(editor);
    }
  }, [editor]);

  // Debounced auto-save
  useEffect(() => {
    if (savedStatus !== 'saving' || !editor) return;
    const timer = setTimeout(() => {
      const json = editor.getJSON();
      const updatedMeta: FileMeta = {
        ...meta,
        name: title,
        updatedAt: Date.now(),
        preview: editor.getText().slice(0, 160),
      };
      const updatedContent: DocContent = {
        kind: 'doc',
        json,
        page,
      };
      onSave(updatedMeta, updatedContent);
      setSavedStatus('saved');
    }, 800);

    return () => clearTimeout(timer);
  }, [savedStatus, editor, meta, title, page, onSave]);

  const handleTitleBlur = () => {
    if (title.trim() && title !== meta.name) {
      onRename(title.trim());
    } else {
      setTitle(meta.name);
    }
  };

  // Export handlers
  const handleExportDocx = async () => {
    if (!editor) return;
    try {
      ui.showBusy('Đang tạo tệp Word (.docx)…');
      const blob = await exportDocx(editor.getJSON(), page, title);
      downloadBlob(blob, `${title}.docx`);
      ui.toast('Đã tải xuống tệp Word thành công!');
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi khi xuất DOCX', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleExportHtml = () => {
    if (!editor) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}</style></head><body>${editor.getHTML()}</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${title}.html`);
    ui.toast('Đã tải xuống HTML!');
  };

  const handleExportTxt = () => {
    if (!editor) return;
    const blob = new Blob([editor.getText()], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${title}.txt`);
    ui.toast('Đã tải xuống Plain Text!');
  };

  const handleInsertImage = async () => {
    if (!editor) return;
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      editor.chain().focus().setImage({ src: dataUrl }).run();
      ui.toast('Đã chèn hình ảnh');
    } catch {
      ui.toast('Không thể tải ảnh này', true);
    }
  };

  const handleInsertLink = async () => {
    if (!editor) return;
    const prevUrl = editor.getAttributes('link').href || '';
    const result = await ui.ask({
      title: 'Chèn liên kết',
      fields: [{ name: 'url', label: 'Địa chỉ URL (https://...)', value: prevUrl, placeholder: 'https://example.com' }],
      confirmText: 'Lưu link',
    });
    if (!result) return;
    const url = String(result.url || '').trim();
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
  };

  const handleInsertTable = async () => {
    if (!editor) return;
    const res = await ui.ask({
      title: 'Chèn bảng mới',
      fields: [
        { name: 'rows', label: 'Số dòng', type: 'number', value: 3, min: 1, max: 50 },
        { name: 'cols', label: 'Số cột', type: 'number', value: 3, min: 1, max: 20 },
      ],
      confirmText: 'Chèn bảng',
    });
    if (!res) return;
    const rows = Math.max(1, Number(res.rows) || 3);
    const cols = Math.max(1, Number(res.cols) || 3);
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  };

  const handlePageSettings = async () => {
    const res = await ui.ask({
      title: 'Thiết lập trang (Page Setup)',
      fields: [
        {
          name: 'size',
          label: 'Khổ giấy',
          type: 'select',
          value: page.size,
          options: [
            { value: 'A4', label: 'A4 (210 × 297 mm)' },
            { value: 'A5', label: 'A5 (148 × 210 mm)' },
            { value: 'Letter', label: 'Letter (8.5 × 11 in)' },
            { value: 'Legal', label: 'Legal (8.5 × 14 in)' },
          ],
        },
        {
          name: 'orientation',
          label: 'Hướng giấy',
          type: 'select',
          value: page.orientation,
          options: [
            { value: 'portrait', label: 'Trang dọc (Portrait)' },
            { value: 'landscape', label: 'Trang ngang (Landscape)' },
          ],
        },
        { name: 'header', label: 'Tiêu đề đầu trang (Header)', value: page.header, placeholder: 'Văn bản đầu trang...' },
        { name: 'footer', label: 'Tiêu đề chân trang (Footer)', value: page.footer, placeholder: 'Văn bản chân trang...' },
        { name: 'pageNumbers', label: 'Hiển thị số trang', type: 'checkbox', value: page.pageNumbers },
      ],
      confirmText: 'Áp dụng',
    });
    if (!res) return;
    setPage((prev) => ({
      ...prev,
      size: (res.size as PageSettings['size']) || prev.size,
      orientation: (res.orientation as PageSettings['orientation']) || prev.orientation,
      header: String(res.header || ''),
      footer: String(res.footer || ''),
      pageNumbers: Boolean(res.pageNumbers),
    }));
    setSavedStatus('saving');
    ui.toast('Đã cập nhật thiết lập trang');
  };

  const pageSizeStyle = useMemo(() => {
    const s = PAGE_SIZES[page.size];
    const isLandscape = page.orientation === 'landscape';
    const w = isLandscape ? s.height : s.width;
    const h = isLandscape ? s.width : s.height;
    return {
      width: `${w}px`,
      minHeight: `${h}px`,
      transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
      transformOrigin: 'top center',
    };
  }, [page, zoom]);

  const wordCount = editor?.storage.characterCount?.words() ?? 0;
  const charCount = editor?.storage.characterCount?.characters() ?? 0;

  return (
    <div className="editor-shell">
      {/* Top Header */}
      <header className="editor-top">
        <div className="editor-title-group">
          <button className="icon-btn" onClick={onBack} title="Quay lại danh sách tệp">
            <ArrowLeft size={18} />
          </button>
          <div className="file-icon-box doc" style={{ width: 28, height: 28 }}>
            <FileText size={16} />
          </div>
          <input
            className="editor-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            title="Nhấp để đổi tên tài liệu"
          />
          <div className={`save-pill ${savedStatus}`}>
            {savedStatus === 'saved' ? (
              <>
                <CheckCircle2 size={13} />
                <span>Đã lưu</span>
              </>
            ) : (
              <>
                <Clock size={13} />
                <span>Đang lưu…</span>
              </>
            )}
          </div>
        </div>

        <div className="topbar-right">
          <button className="btn btn-doc" onClick={handleExportDocx} title="Tải xuống Word (.docx)">
            <Download size={15} />
            <span>Xuất Word (.docx)</span>
          </button>
          <button className="btn" onClick={() => window.print()} title="In tài liệu (Ctrl+P)">
            <Printer size={15} />
            <span>In / PDF</span>
          </button>
        </div>
      </header>

      {/* Ribbon Toolbar */}
      <div className="ribbon">
        <div className="ribbon-tabs">
          <button className={`ribbon-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            Trang đầu (Home)
          </button>
          <button className={`ribbon-tab ${activeTab === 'insert' ? 'active' : ''}`} onClick={() => setActiveTab('insert')}>
            Chèn (Insert)
          </button>
          <button className={`ribbon-tab ${activeTab === 'layout' ? 'active' : ''}`} onClick={() => setActiveTab('layout')}>
            Bố trí (Layout)
          </button>
          <button className={`ribbon-tab ${activeTab === 'view' ? 'active' : ''}`} onClick={() => setActiveTab('view')}>
            Xem (View)
          </button>
          <button className={`ribbon-tab ${activeTab === 'file' ? 'active' : ''}`} onClick={() => setActiveTab('file')}>
            Tệp (File)
          </button>
        </div>

        <div className="ribbon-body">
          {activeTab === 'home' && (
            <>
              {/* Undo / Redo */}
              <div className="ribbon-group">
                <button
                  className="icon-btn"
                  onClick={() => editor?.chain().focus().undo().run()}
                  disabled={!editor?.can().undo()}
                  title="Hoàn tác (Ctrl+Z)"
                >
                  <Undo2 size={16} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => editor?.chain().focus().redo().run()}
                  disabled={!editor?.can().redo()}
                  title="Làm lại (Ctrl+Y)"
                >
                  <Redo2 size={16} />
                </button>
              </div>

              {/* Font & Size */}
              <div className="ribbon-group">
                <select
                  className="ribbon-select"
                  onChange={(e) => {
                    if (e.target.value === 'default') editor?.chain().focus().unsetFontFamily().run();
                    else editor?.chain().focus().setFontFamily(e.target.value).run();
                  }}
                  title="Phông chữ"
                >
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Calibri">Calibri</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Tahoma">Tahoma</option>
                  <option value="Verdana">Verdana</option>
                </select>

                <select
                  className="ribbon-select"
                  style={{ width: 62 }}
                  onChange={(e) => editor?.chain().focus().setFontSize(e.target.value).run()}
                  title="Cỡ chữ"
                >
                  <option value="11pt">11pt</option>
                  <option value="9pt">9pt</option>
                  <option value="10pt">10pt</option>
                  <option value="12pt">12pt</option>
                  <option value="14pt">14pt</option>
                  <option value="16pt">16pt</option>
                  <option value="18pt">18pt</option>
                  <option value="20pt">20pt</option>
                  <option value="24pt">24pt</option>
                  <option value="32pt">32pt</option>
                  <option value="48pt">48pt</option>
                </select>
              </div>

              {/* Basic Formatting */}
              <div className="ribbon-group">
                <button
                  className={`icon-btn ${editor?.isActive('bold') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  title="Đậm (Ctrl+B)"
                >
                  <Bold size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive('italic') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  title="Nghiêng (Ctrl+I)"
                >
                  <Italic size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive('underline') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  title="Gạch chân (Ctrl+U)"
                >
                  <UnderlineIcon size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive('strike') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                  title="Gạch ngang chữ"
                >
                  <Strikethrough size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive('subscript') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleSubscript().run()}
                  title="Chỉ số dưới (X₂)"
                >
                  <SubIcon size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive('superscript') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleSuperscript().run()}
                  title="Chỉ số trên (X²)"
                >
                  <SuperIcon size={16} />
                </button>

                {/* Color pickers */}
                <input
                  type="color"
                  title="Màu chữ"
                  style={{ width: 26, height: 26, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                  onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
                />
                <button
                  className={`icon-btn ${editor?.isActive('highlight') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleHighlight({ color: '#fff59d' }).run()}
                  title="Màu dạ quang (Highlight)"
                >
                  <span style={{ backgroundColor: '#fff59d', padding: '0 4px', borderRadius: 2, fontWeight: 700, fontSize: 11 }}>H</span>
                </button>
              </div>

              {/* Alignments & Lists */}
              <div className="ribbon-group">
                <button
                  className={`icon-btn ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                  title="Căn trái"
                >
                  <AlignLeft size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                  title="Căn giữa"
                >
                  <AlignCenter size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                  title="Căn phải"
                >
                  <AlignRight size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
                  title="Căn đều"
                >
                  <AlignJustify size={16} />
                </button>
              </div>

              <div className="ribbon-group">
                <button
                  className={`icon-btn ${editor?.isActive('bulletList') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  title="Danh sách dấu đầu dòng"
                >
                  <List size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive('orderedList') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  title="Danh sách số"
                >
                  <ListOrdered size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive('taskList') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleTaskList().run()}
                  title="Danh sách việc cần làm (Task list)"
                >
                  <ListTodo size={16} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => editor?.chain().focus().decreaseIndent().run()}
                  title="Giảm thụt lề"
                >
                  <Outdent size={16} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => editor?.chain().focus().increaseIndent().run()}
                  title="Tăng thụt lề"
                >
                  <Indent size={16} />
                </button>
              </div>

              {/* Headings & Styles */}
              <div className="ribbon-group">
                <select
                  className="ribbon-select"
                  value={
                    editor?.isActive('heading', { level: 1 })
                      ? 'h1'
                      : editor?.isActive('heading', { level: 2 })
                      ? 'h2'
                      : editor?.isActive('heading', { level: 3 })
                      ? 'h3'
                      : 'p'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'p') editor?.chain().focus().setParagraph().run();
                    if (val === 'h1') editor?.chain().focus().toggleHeading({ level: 1 }).run();
                    if (val === 'h2') editor?.chain().focus().toggleHeading({ level: 2 }).run();
                    if (val === 'h3') editor?.chain().focus().toggleHeading({ level: 3 }).run();
                  }}
                  title="Kiểu đề mục (Styles)"
                >
                  <option value="p">Văn bản thường (Normal)</option>
                  <option value="h1">Tiêu đề 1 (Heading 1)</option>
                  <option value="h2">Tiêu đề 2 (Heading 2)</option>
                  <option value="h3">Tiêu đề 3 (Heading 3)</option>
                </select>

                <button
                  className={`icon-btn ${editor?.isActive('blockquote') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                  title="Trích dẫn"
                >
                  <Quote size={16} />
                </button>
                <button
                  className={`icon-btn ${editor?.isActive('codeBlock') ? 'active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                  title="Khối mã nguồn"
                >
                  <Code size={16} />
                </button>
              </div>
            </>
          )}

          {activeTab === 'insert' && (
            <>
              <div className="ribbon-group">
                <button className="btn" onClick={() => editor?.chain().focus().insertPageBreak().run()} title="Chèn ngắt trang">
                  <Layout size={15} />
                  <span>Ngắt trang</span>
                </button>
              </div>

              <div className="ribbon-group">
                <button className="btn" onClick={handleInsertTable} title="Chèn bảng">
                  <TableIcon size={15} />
                  <span>Chèn bảng</span>
                </button>
                {editor?.isActive('table') && (
                  <>
                    <button className="icon-btn" onClick={() => editor.chain().focus().addRowAfter().run()} title="Thêm dòng dưới">
                      <Plus size={15} />
                    </button>
                    <button className="icon-btn" onClick={() => editor.chain().focus().addColumnAfter().run()} title="Thêm cột phải">
                      <Plus size={15} />
                    </button>
                    <button className="icon-btn" onClick={() => editor.chain().focus().deleteRow().run()} title="Xoá dòng">
                      <Minus size={15} />
                    </button>
                    <button className="icon-btn" onClick={() => editor.chain().focus().deleteTable().run()} title="Xoá bảng">
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>

              <div className="ribbon-group">
                <button className="btn" onClick={handleInsertImage} title="Chèn hình ảnh từ máy tính">
                  <ImageIcon size={15} />
                  <span>Hình ảnh</span>
                </button>
                <button className="btn" onClick={handleInsertLink} title="Chèn liên kết web">
                  <Link2 size={15} />
                  <span>Liên kết</span>
                </button>
                <button className="btn" onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Đường kẻ ngang">
                  <Minus size={15} />
                  <span>Đường kẻ</span>
                </button>
              </div>
            </>
          )}

          {activeTab === 'layout' && (
            <>
              <div className="ribbon-group">
                <button className="btn" onClick={handlePageSettings}>
                  <Settings size={15} />
                  <span>Thiết lập trang chi tiết…</span>
                </button>
              </div>

              <div className="ribbon-group">
                <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 4 }}>Khổ giấy:</span>
                <select
                  className="ribbon-select"
                  value={page.size}
                  onChange={(e) => {
                    setPage((p) => ({ ...p, size: e.target.value as PageSettings['size'] }));
                    setSavedStatus('saving');
                  }}
                >
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>

              <div className="ribbon-group">
                <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 4 }}>Hướng giấy:</span>
                <select
                  className="ribbon-select"
                  value={page.orientation}
                  onChange={(e) => {
                    setPage((p) => ({ ...p, orientation: e.target.value as PageSettings['orientation'] }));
                    setSavedStatus('saving');
                  }}
                >
                  <option value="portrait">Trang dọc (Portrait)</option>
                  <option value="landscape">Trang ngang (Landscape)</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'view' && (
            <>
              <div className="ribbon-group">
                <button
                  className={`btn ${showOutline ? 'btn-primary' : ''}`}
                  onClick={() => setShowOutline(!showOutline)}
                  title="Hiện/Ẩn danh mục đầu đề"
                >
                  <Eye size={15} />
                  <span>Mục lục văn bản</span>
                </button>
              </div>

              <div className="ribbon-group">
                <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 4 }}>Thu phóng:</span>
                <select className="ribbon-select" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
                  <option value={75}>75%</option>
                  <option value={90}>90%</option>
                  <option value={100}>100%</option>
                  <option value={125}>125%</option>
                  <option value={150}>150%</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'file' && (
            <>
              <div className="ribbon-group">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!editor) return;
                    const json = editor.getJSON();
                    onSave({ ...meta, name: title, updatedAt: Date.now(), preview: editor.getText().slice(0, 160) }, { kind: 'doc', json, page });
                    setSavedStatus('saved');
                    ui.toast('Đã lưu tài liệu!');
                  }}
                >
                  <Save size={15} />
                  <span>Lưu ngay (Ctrl+S)</span>
                </button>
              </div>

              <div className="ribbon-group">
                <button className="btn" onClick={handleExportDocx}>
                  <Download size={15} />
                  <span>Tải Word (.docx)</span>
                </button>
                <button className="btn" onClick={handleExportHtml}>
                  <Download size={15} />
                  <span>Tải Web (.html)</span>
                </button>
                <button className="btn" onClick={handleExportTxt}>
                  <Download size={15} />
                  <span>Tải Văn bản (.txt)</span>
                </button>
                <button className="btn" onClick={() => window.print()}>
                  <Printer size={15} />
                  <span>In / PDF</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Editor Content Canvas */}
      <div className="doc-workspace">
        <div className="doc-canvas">
          <div className="doc-paper" style={pageSizeStyle}>
            {page.header && <div className="header-region">{page.header}</div>}

            <EditorContent editor={editor} />

            {(page.footer || page.pageNumbers) && (
              <div className="footer-region">
                <span>{page.footer}</span>
                {page.pageNumbers && <span>Trang 1</span>}
              </div>
            )}
          </div>
        </div>

        {/* Outline / Navigator */}
        {showOutline && (
          <aside className="doc-outline">
            <div className="outline-title">Mục lục văn bản</div>
            {headings.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 11, fontStyle: 'italic' }}>
                Chưa có tiêu đề nào. Sử dụng Tiêu đề 1, 2, 3 để tạo mục lục tự động.
              </div>
            ) : (
              headings.map((h, i) => (
                <button
                  key={i}
                  className={`outline-item h${h.level}`}
                  onClick={() => {
                    // Focus on editor
                    editor?.commands.focus();
                  }}
                >
                  {h.text}
                </button>
              ))
            )}

            <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--muted)' }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Thống kê</div>
              <div>Số từ: <strong>{wordCount}</strong></div>
              <div>Số ký tự: <strong>{charCount}</strong></div>
              <div>Thời gian đọc: <strong>~{Math.max(1, Math.ceil(wordCount / 200))} phút</strong></div>
            </div>
          </aside>
        )}
      </div>

      {/* Status Bar */}
      <footer className="editor-status">
        <div style={{ display: 'flex', gap: 16 }}>
          <span>Khổ: {page.size} ({page.orientation === 'portrait' ? 'Dọc' : 'Ngang'})</span>
          <span>Từ: {wordCount}</span>
          <span>Ký tự: {charCount}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>Thu phóng: {zoom}%</span>
          <input
            type="range"
            min={50}
            max={150}
            step={5}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ width: 80, cursor: 'pointer' }}
          />
        </div>
      </footer>
    </div>
  );
}
