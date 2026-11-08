import type { Editor } from '@tiptap/core';
import type { DocCtx, ViewState } from './DocContext';
import { currentAuthor } from './DocContext';
import { sha256 } from './docTools';
import { LOCK_META } from './extReview';
import { collectChanges, type TrackedChange } from './trackChanges';

export const TRACK_LOCK_PREFIX = 'lock:';
export const TRACK_EVERYONE = 'everyone';

export const trackLocked = (ctx: DocCtx) => (ctx.page.trackLock ?? '').startsWith(TRACK_LOCK_PREFIX);

export const visibleChanges = (editor: Editor, view: ViewState): TrackedChange[] => collectChanges(editor.state.doc).filter((change) => {
  if (view.markupAuthor && change.author !== view.markupAuthor) return false;
  if (change.kind === 'format') return view.markupFormatting;
  return view.markupInsDel;
});

export const changeAuthors = (ctx: DocCtx) => [...new Set([...collectChanges(ctx.editor.state.doc).map((change) => change.author), ...ctx.comments.map((comment) => comment.author)].filter(Boolean))];

const changeAtSelection = (ctx: DocCtx) => {
  const { from, to } = ctx.editor.state.selection;
  const list = visibleChanges(ctx.editor, ctx.view);
  return list.find((change) => change.from <= to && change.to >= from) ?? null;
};

export function jumpChange(ctx: DocCtx, dir: 1 | -1) {
  const { editor } = ctx;
  const list = visibleChanges(editor, ctx.view);
  if (!list.length) {
    ctx.ui.toast('Không còn thay đổi nào cần duyệt');
    return false;
  }
  const { from, to } = editor.state.selection;
  const target = dir > 0 ? list.find((change) => change.from >= to && !(change.from === from && change.to === to)) ?? list[0] : [...list].reverse().find((change) => change.to <= from) ?? list[list.length - 1];
  editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().run();
  return true;
}

export function resolveCurrent(ctx: DocCtx, accept: boolean, moveNext: boolean) {
  const change = changeAtSelection(ctx);
  if (!change) {
    if (!moveNext) ctx.ui.toast('Đặt con trỏ vào một thay đổi trước', true);
    if (moveNext) jumpChange(ctx, 1);
    return;
  }
  const { editor } = ctx;
  const range = { from: change.from, to: change.to };
  editor.chain().focus()[accept ? 'acceptChange' : 'rejectChange'](range).run();
  if (moveNext) {
    const at = Math.min(editor.state.tr.mapping.map(change.from), editor.state.doc.content.size);
    editor.commands.setTextSelection(at);
    jumpChange(ctx, 1);
  }
}

export function resolveShown(ctx: DocCtx, accept: boolean) {
  const { editor, view } = ctx;
  const list = visibleChanges(editor, view);
  if (!list.length) {
    ctx.ui.toast('Không có thay đổi nào đang hiện');
    return;
  }
  [...list].sort((a, b) => b.from - a.from).forEach((change) => {
    editor.commands[accept ? 'acceptChange' : 'rejectChange']({ from: change.from, to: change.to });
  });
  ctx.ui.toast(`Đã ${accept ? 'chấp nhận' : 'từ chối'} ${list.length} thay đổi`);
}

export function resolveAll(ctx: DocCtx, accept: boolean, stopTracking: boolean) {
  const { editor } = ctx;
  if (accept) editor.chain().focus().acceptAllChanges().run();
  else editor.chain().focus().rejectAllChanges().run();
  if (stopTracking) {
    if (trackLocked(ctx)) ctx.ui.toast('Theo dõi đang bị khoá nên vẫn bật', true);
    else ctx.setView({ editMode: 'editing' });
  }
}

export async function toggleTrackLock(ctx: DocCtx) {
  if (trackLocked(ctx)) {
    const stored = String(ctx.page.trackLock).slice(TRACK_LOCK_PREFIX.length);
    const res = await ctx.ui.ask({ title: 'Mở khoá theo dõi', fields: [{ name: 'password', label: 'Mật khẩu', type: 'password' }], confirmText: 'Mở khoá', validate: async (values) => ((await sha256(String(values.password))) === stored ? null : 'Mật khẩu không đúng') });
    if (res) {
      ctx.setPage({ trackLock: undefined });
      ctx.ui.toast('Đã mở khoá theo dõi');
    }
    return;
  }
  const res = await ctx.ui.ask({ title: 'Khoá theo dõi thay đổi', message: 'Không ai tắt được Theo dõi thay đổi nếu không có mật khẩu.', fields: [{ name: 'password', label: 'Mật khẩu', type: 'password' }, { name: 'confirm', label: 'Nhập lại', type: 'password' }], confirmText: 'Khoá', validate: (values) => (!String(values.password) ? 'Hãy nhập mật khẩu' : values.password !== values.confirm ? 'Hai mật khẩu không khớp' : null) });
  if (!res) return;
  ctx.setPage({ trackLock: `${TRACK_LOCK_PREFIX}${await sha256(String(res.password))}` });
  ctx.setView({ editMode: 'suggesting' });
  ctx.ui.toast('Đã khoá theo dõi thay đổi');
}

export function setTrackScope(ctx: DocCtx, scope: 'everyone' | 'mine' | 'off') {
  if (trackLocked(ctx)) {
    ctx.ui.toast('Theo dõi đang bị khoá. Mở khoá trước khi đổi.', true);
    return;
  }
  ctx.setPage({ trackLock: scope === 'everyone' ? TRACK_EVERYONE : undefined });
  ctx.setView({ editMode: scope === 'off' ? 'editing' : 'suggesting' });
}

export function deleteComments(ctx: DocCtx, scope: 'current' | 'shown' | 'all') {
  const { editor } = ctx;
  const ids = scope === 'current'
    ? [ctx.activeCommentId ?? editor.getAttributes('comment').commentId].filter(Boolean).map(String)
    : ctx.comments.filter((comment) => scope === 'all' || (!comment.resolved && (!ctx.view.markupAuthor || comment.author === ctx.view.markupAuthor))).map((comment) => comment.id);
  if (!ids.length) {
    ctx.ui.toast(scope === 'current' ? 'Đặt con trỏ vào đoạn có bình luận để xoá' : 'Không có bình luận nào để xoá', true);
    return;
  }
  ids.forEach((id) => editor.chain().unsetCommentById(id).run());
  ctx.setComments((items) => items.filter((comment) => !ids.includes(comment.id)));
  ctx.setActiveCommentId(null);
  ctx.markDirty();
  if (scope !== 'current') ctx.ui.toast(`Đã xoá ${ids.length} bình luận`);
}

export const commentPositions = (editor: Editor) => {
  const list: { id: string; pos: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    const mark = node.marks.find((m) => m.type.name === 'comment');
    if (mark && !list.some((c) => c.id === mark.attrs.commentId)) list.push({ id: String(mark.attrs.commentId), pos });
  });
  return list;
};

export function jumpComment(ctx: DocCtx, dir: 1 | -1) {
  const { editor } = ctx;
  const list = commentPositions(editor).filter((c) => ctx.comments.some((x) => x.id === c.id && !x.resolved && (!ctx.view.markupAuthor || x.author === ctx.view.markupAuthor)));
  if (!list.length) {
    ctx.ui.toast('Không có bình luận nào đang mở', true);
    return;
  }
  const head = editor.state.selection.from;
  const target = dir > 0 ? list.find((c) => c.pos > head) ?? list[0] : [...list].reverse().find((c) => c.pos < head) ?? list[list.length - 1];
  editor.chain().focus().setTextSelection(target.pos + 1).scrollIntoView().run();
  ctx.setActiveCommentId(target.id);
  if (ctx.view.commentsMode === 'list') ctx.setView({ sidePanel: 'comments' });
}

const BLOCKS = ['paragraph', 'heading'];

export function setLocked(ctx: DocCtx, locked: boolean, wholeDoc = false) {
  const { editor } = ctx;
  const { from, to } = editor.state.selection;
  const tr = editor.state.tr;
  let count = 0;
  const visit = (node: import('@tiptap/pm/model').Node, pos: number) => {
    if (!BLOCKS.includes(node.type.name)) return true;
    if (Boolean(node.attrs.locked) !== locked) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, locked: locked ? currentAuthor() : null });
      count += 1;
    }
    return false;
  };
  if (wholeDoc) editor.state.doc.descendants(visit);
  else editor.state.doc.nodesBetween(from, to, visit);
  if (count) editor.view.dispatch(tr.setMeta(LOCK_META, true).setMeta('addToHistory', false));
  ctx.ui.toast(count ? `Đã ${locked ? 'khoá' : 'mở khoá'} ${count} đoạn` : locked ? 'Các đoạn đang chọn đã khoá sẵn' : 'Không có đoạn nào cần mở khoá');
}

export const countLocked = (editor: Editor) => {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.attrs?.locked) count += 1;
    return true;
  });
  return count;
};

export async function startProtection(ctx: DocCtx, mode: 'readonly' | 'tracked' | 'comments', password: string) {
  ctx.setPage({ protectHash: await sha256(password), protectMode: mode });
  ctx.setView({ editMode: mode === 'tracked' ? 'suggesting' : 'viewing' });
  ctx.ui.toast({ readonly: 'Tài liệu chỉ cho xem', tracked: 'Mọi chỉnh sửa đều được theo dõi', comments: 'Tài liệu chỉ cho bình luận' }[mode]);
}

export async function stopProtection(ctx: DocCtx, password: string) {
  if ((await sha256(password)) !== ctx.page.protectHash) return false;
  ctx.setPage({ protectHash: undefined, protectMode: undefined });
  ctx.setView({ editMode: 'editing' });
  ctx.ui.toast('Đã bỏ hạn chế chỉnh sửa');
  return true;
}

export type ReadabilityReport = { words: number; chars: number; charsNoSpaces: number; paragraphs: number; sentences: number; wordsPerSentence: number; charsPerWord: number; sentencesPerParagraph: number; passive: number; ease: number; grade: number };

const syllables = (word: string) => {
  if (/[^\p{ASCII}]/u.test(word)) return 1;
  const lower = word.toLowerCase().replace(/e$/, '');
  return Math.max(1, (lower.match(/[aeiouy]+/g) ?? []).length);
};

export function readabilityReport(text: string): ReadabilityReport {
  const tokens = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  const words = tokens.length;
  const sentenceList = text.split(/[.!?…]+(?:\s|$)|\n+/).map((sentence) => sentence.trim()).filter(Boolean);
  const sentences = sentenceList.length || (words ? 1 : 0);
  const paragraphs = text.split(/\n+/).filter((line) => line.trim()).length;
  const charsNoSpaces = text.replace(/\s+/g, '').length;
  const syllableCount = tokens.reduce((sum, token) => sum + syllables(token), 0);
  const passive = sentenceList.filter((sentence) => /(^|\s)(bị|được)\s/i.test(sentence) || /\b(is|are|was|were|been|be)\s+\w+(ed|en)\b/i.test(sentence)).length;
  const wordsPerSentence = sentences ? words / sentences : 0;
  const syllablesPerWord = words ? syllableCount / words : 0;
  return {
    words,
    chars: text.length,
    charsNoSpaces,
    paragraphs,
    sentences,
    wordsPerSentence,
    charsPerWord: words ? charsNoSpaces / words : 0,
    sentencesPerParagraph: paragraphs ? sentences / paragraphs : 0,
    passive: sentences ? Math.round((passive / sentences) * 100) : 0,
    ease: words ? Math.max(0, Math.min(100, 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord)) : 0,
    grade: words ? Math.max(0, 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59) : 0,
  };
}
