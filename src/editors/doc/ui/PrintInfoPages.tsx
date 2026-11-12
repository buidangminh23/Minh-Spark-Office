import type { CSSProperties } from 'react';
import type { Editor } from '@tiptap/core';
import type { CommentItem, FileMeta } from '../../../lib/storage';
import { currentAuthorName } from '../../../lib/currentAuthor';

type Box = { width: number; height: number; padding: string };

const pageStyle = ({ width, height, padding }: Box): CSSProperties => ({
  width,
  height,
  padding,
  boxSizing: 'border-box',
  overflow: 'hidden',
  background: '#fff',
  color: '#111827',
  fontFamily: 'Arial, sans-serif',
  fontSize: 13,
  lineHeight: 1.5,
});

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
const formatDate = (value: number) => new Date(value).toLocaleString('vi-VN', DATE_FORMAT);

export function documentStats(editor: Editor) {
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', ' ');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, characters: text.replace(/\s/g, '').length, paragraphs: editor.state.doc.childCount };
}

export function PropertiesPage({ box, title, meta, editor, pages }: { box: Box; title: string; meta: FileMeta; editor: Editor; pages: number }) {
  const stats = documentStats(editor);
  const rows: Array<[string, string]> = [
    ['Tên tệp', title],
    ['Người in', currentAuthorName()],
    ['Ngày tạo', formatDate(meta.createdAt)],
    ['Sửa lần cuối', formatDate(meta.updatedAt)],
    ['In lúc', formatDate(Date.now())],
    ['Số trang', String(pages)],
    ['Số từ', stats.words.toLocaleString('vi-VN')],
    ['Số ký tự (không tính dấu cách)', stats.characters.toLocaleString('vi-VN')],
    ['Số đoạn', stats.paragraphs.toLocaleString('vi-VN')],
  ];
  return (
    <div style={pageStyle(box)}>
      <h1 style={{ margin: '0 0 24px', fontSize: 20 }}>Thuộc tính tài liệu</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th style={{ width: '40%', padding: '8px 12px 8px 0', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontWeight: 600 }}>{label}</th>
              <td style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb', overflowWrap: 'anywhere' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const COMMENTS_PER_PAGE = 8;

export function CommentsPage({ box, comments, index }: { box: Box; comments: CommentItem[]; index: number }) {
  return (
    <div style={pageStyle(box)}>
      <h1 style={{ margin: '0 0 24px', fontSize: 20 }}>Nhận xét{index > 0 ? ' (tiếp)' : ''}</h1>
      <ol start={index * COMMENTS_PER_PAGE + 1} style={{ margin: 0, paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {comments.map((comment) => (
          <li key={comment.id}>
            <div style={{ fontWeight: 600 }}>{comment.author} · {formatDate(comment.createdAt)}{comment.resolved ? ' · Đã giải quyết' : ''}</div>
            {comment.quote && <div style={{ color: '#6b7280', fontStyle: 'italic' }}>“{comment.quote}”</div>}
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{comment.text}</div>
            {comment.replies?.map((reply) => (
              <div key={reply.id} style={{ marginTop: 4, paddingLeft: 12, borderLeft: '2px solid #e5e7eb' }}>
                <strong>{reply.author}:</strong> {reply.text}
              </div>
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
}
