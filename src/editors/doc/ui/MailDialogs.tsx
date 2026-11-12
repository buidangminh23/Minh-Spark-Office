import { useEffect, useState } from 'react';
import type { JSONContent } from '@tiptap/react';
import { CheckCircle2, Mail, MailOpen, Send, StickyNote, Tag, Wand2 } from 'lucide-react';
import { downloadBlob } from '../../../lib/download';
import { outlookAvailable, sendWithOutlook, type OutlookMode } from '../../../lib/outlook';
import { basePage, type PageSettings } from '../../../lib/storage';
import { useDoc, type DocCtx } from '../DocContext';
import { LABEL_PRESETS, MERGE_TYPES, activeRecords, buildEml, guessFieldMap, labelMargins, labelTable, mailtoUrl, type MergeType } from '../mailMerge';
import { buildMails, envelopePage, saveNewDoc, type BuiltMail } from '../mailingsRun';
import { requestPrintOnOpen } from '../docLaunch';
import Modal from './Modal';

const RETURN_KEY = 'minh-envelope-return';
const ENVELOPES: { id: PageSettings['size']; label: string }[] = [
  { id: 'DL', label: 'DL · 110 × 220 mm' }, { id: 'C5', label: 'C5 · 162 × 229 mm' }, { id: 'C6', label: 'C6 · 114 × 162 mm' },
  { id: 'C4', label: 'C4 · 229 × 324 mm' }, { id: 'Env10', label: '#10 · 4,13 × 9,5 in' }, { id: 'Monarch', label: 'Monarch · 3,88 × 7,5 in' },
];

const readReturn = () => {
  try {
    return localStorage.getItem(RETURN_KEY) ?? '';
  } catch {
    return '';
  }
};

const paragraphs = (text: string, attrs: Record<string, unknown> = {}, marks?: JSONContent['marks']): JSONContent[] =>
  text.split('\n').map((line) => ({ type: 'paragraph', attrs: { spaceAfter: 0, ...attrs }, content: line ? [{ type: 'text', text: line, ...(marks ? { marks } : {}) }] : [] }));

const selectedText = (ctx: DocCtx) => {
  const { from, to, empty } = ctx.editor.state.selection;
  return empty ? '' : ctx.editor.state.doc.textBetween(from, to, '\n').trim();
};

export function envelopeContent(returnAddress: string, delivery: JSONContent[]): JSONContent {
  const small = [{ type: 'textStyle', attrs: { fontSize: '10pt' } }];
  return {
    type: 'doc',
    content: [
      ...(returnAddress.trim() ? paragraphs(returnAddress.trim(), {}, small) : [{ type: 'paragraph' }]),
      { type: 'paragraph', attrs: { spaceBefore: 54, spaceAfter: 0 } },
      ...delivery.map((node) => ({ ...node, attrs: { ...(node.attrs ?? {}), indent: 7, spaceAfter: 0 } })),
    ],
  };
}

const mergeBlockParagraph = (kind: string, extra: JSONContent[] = []): JSONContent => ({ type: 'paragraph', attrs: { spaceAfter: 0 }, content: [...extra, { type: 'mergeBlock', attrs: { kind, options: '{}' } }] });

async function openGenerated(ctx: DocCtx, name: string, json: JSONContent, page: PageSettings, print: boolean) {
  const saved = await saveNewDoc(ctx, name, json, page);
  if (print) requestPrintOnOpen(saved.meta.id);
  ctx.onOpenSaved(saved.meta, saved.content);
}

export function EnvelopesDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [delivery, setDelivery] = useState(() => selectedText(ctx));
  const [returnAddress, setReturnAddress] = useState(readReturn);
  const [omit, setOmit] = useState(false);
  const [size, setSize] = useState<PageSettings['size']>('DL');
  const forMerge = Boolean(ctx.merge);
  const remember = () => {
    try { localStorage.setItem(RETURN_KEY, returnAddress); } catch { /* storage unavailable */ }
  };
  const create = async (print: boolean) => {
    remember();
    await openGenerated(ctx, 'Phong bì.docx', envelopeContent(omit ? '' : returnAddress, paragraphs(delivery.trim() || 'Người nhận')), envelopePage(size), print);
    onClose();
  };
  const applyToMerge = async () => {
    if (!(await ctx.ui.confirm('Dùng tài liệu này làm phong bì', 'Nội dung hiện tại sẽ được thay bằng mẫu phong bì có khối địa chỉ người nhận.'))) return;
    remember();
    ctx.setPage({ ...envelopePage(size), mergeType: 'envelopes', styles: ctx.page.styles });
    ctx.editor.commands.setContent(envelopeContent(omit ? '' : returnAddress, [mergeBlockParagraph('address')]));
    if (!ctx.merge?.fieldMap && ctx.merge) ctx.setMerge({ ...ctx.merge, fieldMap: guessFieldMap(ctx.merge.headers) });
    onClose();
  };
  return (
    <Modal title="Phong bì" icon={<Mail size={20} />} onClose={onClose} width={640}
      actions={<>
        <button className="btn" onClick={onClose}>Huỷ</button>
        {forMerge && <button className="btn" onClick={() => void applyToMerge()}>Dùng cho trộn thư</button>}
        <button className="btn" onClick={() => void create(true)}>In</button>
        <button className="btn btn-primary" onClick={() => void create(false)}>Tạo phong bì</button>
      </>}>
      <label className="field"><span className="field-label">Địa chỉ người nhận</span><textarea className="text-field" rows={4} autoFocus value={delivery} placeholder={'Ông Nguyễn Văn A\nSố 1 Tràng Tiền\nHoàn Kiếm, Hà Nội'} onChange={(e) => setDelivery(e.target.value)} /></label>
      <label className="field"><span className="field-label">Địa chỉ người gửi</span><textarea className="text-field" rows={3} value={returnAddress} disabled={omit} onChange={(e) => setReturnAddress(e.target.value)} /></label>
      <div className="check-row"><label><input type="checkbox" checked={omit} onChange={(e) => setOmit(e.target.checked)} /> Bỏ địa chỉ người gửi</label></div>
      <label className="field"><span className="field-label">Cỡ phong bì</span><select className="text-field" value={size} onChange={(e) => setSize(e.target.value as PageSettings['size'])}>{ENVELOPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </Modal>
  );
}

export function LabelsDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [text, setText] = useState(() => selectedText(ctx) || readReturn());
  const [presetId, setPresetId] = useState(LABEL_PRESETS[0].id);
  const [single, setSingle] = useState(false);
  const [row, setRow] = useState(1);
  const [col, setCol] = useState(1);
  const preset = LABEL_PRESETS.find((item) => item.id === presetId) ?? LABEL_PRESETS[0];
  const page: PageSettings = { ...basePage(), size: 'A4', margins: labelMargins(preset), pageNumbers: false, header: '', footer: '' };
  const create = async (print: boolean) => {
    const target = (Math.min(row, preset.rows) - 1) * preset.cols + Math.min(col, preset.cols) - 1;
    const table = labelTable(preset, (index) => (single && index !== target ? [{ type: 'paragraph' }] : paragraphs(text.trim() || ' ')));
    await openGenerated(ctx, 'Nhãn.docx', { type: 'doc', content: [table] }, page, print);
    onClose();
  };
  const applyToMerge = async () => {
    if (!(await ctx.ui.confirm('Dùng tài liệu này làm trang nhãn', `Nội dung hiện tại sẽ được thay bằng lưới ${preset.cols * preset.rows} nhãn, mỗi nhãn một người nhận.`))) return;
    ctx.setPage({ ...page, mergeType: 'labels', styles: ctx.page.styles });
    ctx.editor.commands.setContent({ type: 'doc', content: [labelTable(preset, (index) => [mergeBlockParagraph('address', index ? [{ type: 'mergeBlock', attrs: { kind: 'next', options: '{}' } }] : [])])] });
    if (ctx.merge && !ctx.merge.fieldMap) ctx.setMerge({ ...ctx.merge, fieldMap: guessFieldMap(ctx.merge.headers) });
    onClose();
  };
  return (
    <Modal title="Nhãn" icon={<Tag size={20} />} onClose={onClose} width={640}
      actions={<>
        <button className="btn" onClick={onClose}>Huỷ</button>
        {ctx.merge && <button className="btn" onClick={() => void applyToMerge()}>Dùng cho trộn thư</button>}
        <button className="btn" onClick={() => void create(true)}>In</button>
        <button className="btn btn-primary" onClick={() => void create(false)}>Tạo trang nhãn</button>
      </>}>
      <label className="field"><span className="field-label">Nội dung nhãn</span><textarea className="text-field" rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} /></label>
      <label className="field"><span className="field-label">Loại nhãn</span><select className="text-field" value={presetId} onChange={(e) => setPresetId(e.target.value)}>{LABEL_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <div className="check-row">
        <label><input type="radio" checked={!single} onChange={() => setSingle(false)} /> Cả trang cùng một nhãn</label>
        <label><input type="radio" checked={single} onChange={() => setSingle(true)} /> Một nhãn tại</label>
        <input className="text-field tiny" type="number" aria-label="Hàng" min={1} max={preset.rows} value={row} disabled={!single} onChange={(e) => setRow(Number(e.target.value) || 1)} />
        <span>hàng,</span>
        <input className="text-field tiny" type="number" aria-label="Cột" min={1} max={preset.cols} value={col} disabled={!single} onChange={(e) => setCol(Number(e.target.value) || 1)} />
        <span>cột</span>
      </div>
    </Modal>
  );
}

export function updateLabels(ctx: DocCtx) {
  const { state } = ctx.editor;
  let done = false;
  state.doc.descendants((node, pos) => {
    if (done || node.type.name !== 'table') return !done;
    done = true;
    const json = node.toJSON() as JSONContent;
    const first = json.content?.[0]?.content?.[0]?.content ?? [{ type: 'paragraph' }];
    const strip = (blocks: JSONContent[]) => blocks.map((block, i) => (i === 0 ? { ...block, content: (block.content ?? []).filter((child) => !(child.type === 'mergeBlock' && child.attrs?.kind === 'next')) } : block));
    const base = strip(first);
    let index = 0;
    const content = json.content?.map((rowNode) => ({
      ...rowNode,
      content: rowNode.content?.map((cell) => {
        const blocks = index++ === 0 ? base : base.map((block, i) => (i === 0 ? { ...block, content: [{ type: 'mergeBlock', attrs: { kind: 'next', options: '{}' } }, ...(block.content ?? [])] } : block));
        return { ...cell, content: blocks };
      }),
    }));
    ctx.editor.chain().focus().insertContentAt({ from: pos, to: pos + node.nodeSize }, { ...json, content }).run();
    return false;
  });
  ctx.ui.toast(done ? 'Đã chép nhãn đầu tiên sang mọi nhãn' : 'Tài liệu chưa có lưới nhãn. Dùng Bắt đầu trộn thư → Nhãn.', !done);
}

type Range = 'all' | 'current' | 'span';

export function EmailMergeDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const merge = ctx.merge;
  const saved = ctx.page.mergeEmail ?? {};
  const [to, setTo] = useState(saved.to ?? merge?.fieldMap?.email ?? (merge ? guessFieldMap(merge.headers).email : '') ?? '');
  const [cc, setCc] = useState(saved.cc ?? '');
  const [subject, setSubject] = useState(saved.subject ?? ctx.title.replace(/\.[^/.]+$/, ''));
  const [format, setFormat] = useState(saved.format ?? 'html');
  const [range, setRange] = useState<Range>('all');
  const [span, setSpan] = useState({ from: 1, to: merge ? activeRecords(merge).length : 1 });
  const [outlook, setOutlook] = useState<boolean | null>(null);
  const [mode, setMode] = useState<OutlookMode>('send');
  const [queue, setQueue] = useState<{ mail: BuiltMail; opened: boolean }[] | null>(null);
  useEffect(() => { void outlookAvailable().then(setOutlook); }, []);
  if (!merge) return null;
  const records = activeRecords(merge);
  const persist = () => ctx.setPage({ mergeEmail: { to, cc, subject, format } });
  const limited = (mails: BuiltMail[]) => {
    if (range === 'all') return mails;
    const allowed = range === 'current' ? new Set([records[ctx.mergePreview ?? 0]?.index]) : new Set(records.slice(Math.max(0, span.from - 1), span.to).map((item) => item.index));
    return mails.filter((mail) => allowed.has(mail.record));
  };
  const build = async (fmt: 'html' | 'text' | 'attachment') => {
    persist();
    const mails = await buildMails(ctx, { to, cc, subject, format: fmt });
    if (!mails) return null;
    const picked = limited(mails);
    if (!picked.length) ctx.ui.toast('Không có thư nào có địa chỉ email trong phạm vi đã chọn', true);
    return picked.length ? picked : null;
  };
  const viaOutlook = async () => {
    const mails = await build(format);
    if (!mails) return;
    const verb = mode === 'send' ? 'Gửi ngay' : mode === 'draft' ? 'Lưu vào Thư nháp' : 'Mở để xem';
    if (mode === 'send' && !(await ctx.ui.confirm(`Gửi ${mails.length} thư qua Outlook?`, `Thư đi từ tài khoản Outlook mặc định trên máy này tới ${mails.length} người nhận.`))) return;
    ctx.ui.showBusy(`Outlook đang xử lý ${mails.length} thư…`);
    try {
      const done = await sendWithOutlook(mails, mode);
      ctx.ui.toast(`${verb}: ${done} thư qua Outlook`);
      onClose();
    } catch (error) {
      ctx.ui.toast((error as Error).message, true);
    } finally {
      ctx.ui.showBusy(null);
    }
  };
  const viaMailApp = async () => {
    const mails = await build('text');
    if (mails) setQueue(mails.map((mail) => ({ mail, opened: false })));
  };
  const downloadEml = async () => {
    const mails = await build(format);
    if (!mails) return;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    mails.forEach((mail, i) => zip.file(`${String(i + 1).padStart(3, '0')} - ${mail.to.replace(/[\\/:*?"<>|]+/g, '_')}.eml`, buildEml(mail)));
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `${ctx.title.replace(/\.[^/.]+$/, '')} - thu.zip`);
    ctx.ui.toast(`Đã tải ${mails.length} thư .eml, mở bằng ứng dụng email để gửi`);
  };
  const openMail = (index: number) => {
    if (!queue) return;
    const { mail } = queue[index];
    window.open(mailtoUrl(mail.cc ? `${mail.to}` : mail.to, mail.subject, mail.body), '_blank');
    setQueue(queue.map((item, i) => (i === index ? { ...item, opened: true } : item)));
  };
  if (queue) {
    const next = queue.findIndex((item) => !item.opened);
    return (
      <Modal title="Mở thư trong ứng dụng email" subtitle="Mỗi thư mở thành một thư nháp trong ứng dụng email mặc định. Bấm Gửi trong ứng dụng đó." icon={<MailOpen size={20} />} onClose={onClose} width={680}
        actions={<><button className="btn" onClick={onClose}>Đóng</button><button className="btn btn-primary" disabled={next < 0} onClick={() => openMail(next)}>{next < 0 ? 'Đã mở hết' : `Mở thư ${next + 1}/${queue.length}`}</button></>}>
        <div className="merge-results">
          {queue.map((item, i) => <button key={i} type="button" className={`merge-result ${item.opened ? 'done' : ''}`} onClick={() => openMail(i)}>{item.opened ? <CheckCircle2 size={14} color="#16a34a" /> : <Mail size={14} />} <strong>{item.mail.to}</strong> · {item.mail.subject}</button>)}
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Gửi email" subtitle={`${records.length} người nhận`} icon={<Send size={20} />} onClose={onClose} width={640}
      actions={<>
        <button className="btn" onClick={onClose}>Huỷ</button>
        <button className="btn" disabled={!to} onClick={() => void downloadEml()}>Tải thư .eml</button>
        {outlook
          ? <button className="btn btn-primary" disabled={!to} onClick={() => void viaOutlook()}>Gửi qua Outlook</button>
          : <button className="btn btn-primary" disabled={!to || outlook === null} onClick={() => void viaMailApp()}>Mở bằng ứng dụng email</button>}
      </>}>
      <label className="field"><span className="field-label">Gửi tới (cột chứa email)</span><select className="text-field" value={to} onChange={(e) => setTo(e.target.value)}><option value="">(chọn cột)</option>{merge.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>
      <label className="field"><span className="field-label">Đồng gửi (CC), có thể dùng «Tên cột»</span><input className="text-field" value={cc} onChange={(e) => setCc(e.target.value)} /></label>
      <label className="field"><span className="field-label">Tiêu đề, có thể dùng «Tên cột»</span>
        <div className="merge-condition"><input className="text-field" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <select className="text-field" aria-label="Chèn trường vào tiêu đề" value="" onChange={(e) => e.target.value && setSubject(`${subject}«${e.target.value}»`)}><option value="">+ Trường</option>{merge.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
      </label>
      <label className="field"><span className="field-label">Định dạng thư</span><select className="text-field" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option value="html">HTML, giữ định dạng</option><option value="text">Văn bản thường</option><option value="attachment">Đính kèm tệp .docx</option></select></label>
      <div className="check-row">
        <label><input type="radio" checked={range === 'all'} onChange={() => setRange('all')} /> Tất cả</label>
        <label><input type="radio" checked={range === 'current'} onChange={() => setRange('current')} /> Bản ghi đang xem</label>
        <label><input type="radio" checked={range === 'span'} onChange={() => setRange('span')} /> Từ</label>
        <input className="text-field tiny" type="number" aria-label="Từ bản ghi" min={1} value={span.from} disabled={range !== 'span'} onChange={(e) => setSpan({ ...span, from: Number(e.target.value) || 1 })} />
        <span>đến</span>
        <input className="text-field tiny" type="number" aria-label="Đến bản ghi" min={1} value={span.to} disabled={range !== 'span'} onChange={(e) => setSpan({ ...span, to: Number(e.target.value) || 1 })} />
      </div>
      {outlook === null && <div className="dialog-subtitle">Đang kiểm tra Microsoft Outlook…</div>}
      {outlook && (
        <label className="field"><span className="field-label">Microsoft Outlook trên máy này</span>
          <select className="text-field" value={mode} onChange={(e) => setMode(e.target.value as OutlookMode)}><option value="send">Gửi ngay</option><option value="draft">Lưu vào Thư nháp để kiểm tra rồi gửi</option><option value="display">Mở từng thư trong Outlook</option></select>
        </label>
      )}
      {outlook === false && <div className="merge-note">Không thấy Microsoft Outlook trên máy này nên thư sẽ mở bằng ứng dụng email mặc định, dạng văn bản thường. Muốn giữ định dạng hoặc đính kèm, dùng Tải thư .eml rồi mở bằng ứng dụng email.</div>}
    </Modal>
  );
}

export function MergeWizardDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [step, setStep] = useState(1);
  const type: MergeType = ctx.page.mergeType ?? 'letters';
  const go = (dialog: Parameters<DocCtx['openDialog']>[0]) => ctx.openDialog(dialog);
  const steps = ['Loại tài liệu', 'Tài liệu bắt đầu', 'Người nhận', 'Soạn nội dung', 'Xem trước', 'Hoàn tất'];
  return (
    <Modal title="Trộn thư từng bước" subtitle={`Bước ${step}/6 · ${steps[step - 1]}`} icon={<Wand2 size={20} />} onClose={onClose} width={620}
      actions={<><button className="btn" disabled={step === 1} onClick={() => setStep(step - 1)}>Quay lại</button>{step < 6 ? <button className="btn btn-primary" disabled={step === 3 && !ctx.merge} onClick={() => setStep(step + 1)}>Tiếp</button> : <button className="btn btn-primary" onClick={onClose}>Xong</button>}</>}>
      <ol className="merge-steps">{steps.map((label, i) => <li key={label} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}>{label}</li>)}</ol>
      {step === 1 && <div className="merge-results">{MERGE_TYPES.map((item) => <button key={item.id} type="button" className={`merge-result ${type === item.id ? 'done' : ''}`} onClick={() => ctx.setPage({ mergeType: item.id })}><strong>{item.label}</strong> · {item.detail}</button>)}</div>}
      {step === 2 && <div className="merge-results">
        <button type="button" className="merge-result" onClick={() => setStep(3)}><strong>Dùng tài liệu hiện tại</strong></button>
        <button type="button" className="merge-result" onClick={() => go('envelopes')}><StickyNote size={14} /> <strong>Bố cục phong bì</strong></button>
        <button type="button" className="merge-result" onClick={() => go('labels')}><Tag size={14} /> <strong>Bố cục nhãn</strong></button>
        <button type="button" className="merge-result" onClick={() => go('templates')}><strong>Bắt đầu từ mẫu</strong></button>
      </div>}
      {step === 3 && <div className="merge-results">
        <button type="button" className="merge-result" onClick={() => go('mailmerge')}><strong>Chọn danh sách</strong> · CSV, Excel hoặc Minh Sheets</button>
        <button type="button" className="merge-result" disabled={!ctx.merge} onClick={() => go('mergerecipients')}><strong>Sửa danh sách người nhận</strong>{ctx.merge ? ` · ${activeRecords(ctx.merge).length} người` : ''}</button>
      </div>}
      {step === 4 && <div className="merge-results">
        <button type="button" className="merge-result" onClick={() => go('mergeaddress')}><strong>Khối địa chỉ</strong></button>
        <button type="button" className="merge-result" onClick={() => go('mergegreeting')}><strong>Dòng chào</strong></button>
        <button type="button" className="merge-result" onClick={() => go('mergerule')}><strong>Quy tắc</strong> · Nếu…Thì…Không thì, bỏ qua bản ghi</button>
        <p className="dialog-subtitle">Chèn từng trường bằng nút Chèn trường trên tab Gửi thư.</p>
      </div>}
      {step === 5 && <div className="merge-results">
        <button type="button" className="merge-result" onClick={() => ctx.setMergePreview(ctx.mergePreview ?? 0)}><strong>Bật xem kết quả</strong></button>
        <button type="button" className="merge-result" onClick={() => go('mergefind')}><strong>Tìm người nhận</strong></button>
        <button type="button" className="merge-result" onClick={() => go('mergecheck')}><strong>Kiểm tra lỗi</strong></button>
      </div>}
      {step === 6 && <p>Dùng nút Hoàn tất & trộn trên tab Gửi thư để tạo tài liệu, in hoặc gửi email.</p>}
    </Modal>
  );
}
