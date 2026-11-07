import type { Editor } from '@tiptap/react';
import { ClipboardPaste, FileInput, Replace, Sigma, Table2 } from 'lucide-react';
import { MAX_SERVER_PDF_BASE64, trimContext } from '../../api/_shared/addin';
import { getProviderKey } from './client';
import { ADDIN_INFO } from './store';
import { extractFormula, extractTable, renderMarkdown, toCellValue } from './markdown';
import type { AddinHost } from './AddinPane';
import type { AddinProvider } from '../../api/_shared/addin';

const selectedText = (editor: Editor) => {
  const { from, to, empty } = editor.state.selection;
  return empty ? '' : editor.state.doc.textBetween(from, to, '\n', ' ').trim();
};

export function docHost(editor: Editor, documentName: string): AddinHost {
  return {
    app: 'doc',
    documentName,
    describeContext: () => (selectedText(editor) ? 'Đoạn đang chọn' : 'Toàn bộ tài liệu'),
    readContext: () => {
      const selection = selectedText(editor);
      if (selection) return { label: 'Đoạn đang chọn', text: trimContext(selection) };
      return { label: 'Toàn bộ tài liệu', text: trimContext(editor.getText({ blockSeparator: '\n' }).trim()) };
    },
    actions: [
      {
        id: 'insert',
        label: 'Chèn vào con trỏ',
        icon: <ClipboardPaste size={13} />,
        run: (text) => {
          const at = editor.state.selection.to;
          editor.chain().focus().setTextSelection(at).insertContent(renderMarkdown(text)).run();
          return 'Đã chèn';
        },
      },
      {
        id: 'replace',
        label: 'Thay đoạn đang chọn',
        icon: <Replace size={13} />,
        isAvailable: () => !editor.state.selection.empty,
        run: (text) => {
          if (editor.state.selection.empty) return 'Chưa chọn đoạn nào';
          editor.chain().focus().insertContent(renderMarkdown(text)).run();
          return 'Đã thay';
        },
      },
    ],
    suggestions: ['Tóm tắt tài liệu này', 'Viết lại đoạn đang chọn cho trang trọng hơn', 'Dịch đoạn đang chọn sang tiếng Anh', 'Soát lỗi chính tả và ngữ pháp'],
  };
}

export type SheetBridge = {
  sheetName: () => string;
  selectionA1: () => string;
  readSelection: () => string;
  readSheet: () => string;
  writeTable: (rows: (string | number)[][]) => string;
  writeFormula: (formula: string) => string;
};

export function sheetHost(bridge: SheetBridge, documentName: string): AddinHost {
  return {
    app: 'sheet',
    documentName,
    describeContext: () => `${bridge.sheetName()}, vùng chọn ${bridge.selectionA1()}`,
    readContext: () => {
      const text = [`Sheet: ${bridge.sheetName()}`, `Selected range: ${bridge.selectionA1()}`, 'Selected values:', bridge.readSelection(), '', 'Sheet data:', bridge.readSheet()].join('\n');
      return { label: bridge.sheetName(), text: trimContext(text) };
    },
    actions: [
      {
        id: 'table',
        label: 'Ghi bảng từ ô đang chọn',
        icon: <Table2 size={13} />,
        isAvailable: (text) => Boolean(extractTable(text)),
        run: (text) => {
          const table = extractTable(text);
          return table ? bridge.writeTable(table.map((row) => row.map(toCellValue))) : 'Không thấy bảng trong câu trả lời';
        },
      },
      {
        id: 'formula',
        label: 'Đặt công thức vào ô',
        icon: <Sigma size={13} />,
        isAvailable: (text) => Boolean(extractFormula(text)),
        run: (text) => {
          const formula = extractFormula(text);
          return formula ? bridge.writeFormula(formula) : 'Không thấy công thức';
        },
      },
    ],
    suggestions: ['Phân tích dữ liệu trên trang này', 'Viết công thức tính tổng theo từng nhóm', 'Tạo bảng mẫu theo dõi chi tiêu 12 tháng', 'Giải thích công thức ở ô đang chọn'],
  };
}

export type PdfBridge = {
  dataUrl: () => string | undefined;
  pageText: () => string;
  notes: () => string;
  page: () => number;
  addNote: (text: string, author: string) => void;
};

export function pdfHost(bridge: PdfBridge, documentName: string, provider: () => AddinProvider | null): AddinHost {
  const limitFor = () => {
    const open = provider();
    return open && getProviderKey(open) ? Number.POSITIVE_INFINITY : MAX_SERVER_PDF_BASE64;
  };
  const base64 = () => bridge.dataUrl()?.split(',', 2)[1] ?? '';
  return {
    app: 'pdf',
    documentName,
    describeContext: () => {
      const data = base64();
      if (!data) return 'Trang đang xem và ghi chú';
      return data.length > limitFor() ? 'Trang đang xem (tệp quá lớn để gửi qua tài khoản)' : 'Tệp PDF và ghi chú';
    },
    readContext: () => {
      const data = base64();
      const pdf = data && data.length <= limitFor() ? { name: documentName, base64: data } : undefined;
      const visible = pdf ? '' : bridge.pageText();
      const text = [`Current page: ${bridge.page()}`, visible ? `Visible page text:\n${visible}` : '', bridge.notes() ? `Notes:\n${bridge.notes()}` : ''].filter(Boolean).join('\n\n');
      return { label: pdf ? 'Tệp PDF' : 'Trang đang xem', text: trimContext(text), pdf };
    },
    actions: [
      {
        id: 'note',
        label: 'Lưu thành ghi chú',
        icon: <FileInput size={13} />,
        run: (text) => {
          const open = provider();
          bridge.addNote(text, open ? ADDIN_INFO[open].name : 'Add-in');
          return 'Đã thêm ghi chú';
        },
      },
    ],
    suggestions: ['Tóm tắt tệp PDF này', 'Liệt kê các ý chính kèm số trang', 'Trích các con số và mốc thời gian quan trọng', 'Dịch trang hiện tại sang tiếng Việt'],
  };
}
