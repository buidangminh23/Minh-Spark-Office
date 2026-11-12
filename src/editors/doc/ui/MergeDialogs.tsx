import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownAZ, CheckCircle2, ListChecks, MapPin, Search, Settings2, Users, Wand2 } from 'lucide-react';
import { useDoc, type MergeData } from '../DocContext';
import { BLOCK_LABELS, COMPARISONS, DEFAULT_ADDRESS, DEFAULT_GREETING, STD_FIELDS, activeRecords, addressLines, checkMerge, findRecords, fold, greetingText, guessFieldMap, testCondition, type AddressOptions, type BlockKind, type Comparison, type Condition, type FieldMap, type GreetingOptions, type MergeType, type NameFormat, MERGE_TYPES } from '../mailMerge';
import Modal from './Modal';

const NAME_FORMATS: { id: NameFormat; label: string }[] = [
  { id: 'title-full', label: 'Danh xưng + Họ và tên (Ông Nguyễn Văn A)' }, { id: 'full', label: 'Họ và tên (Nguyễn Văn A)' },
  { id: 'title-first', label: 'Danh xưng + Tên (Ông A)' }, { id: 'title-last', label: 'Danh xưng + Họ (Ông Nguyễn)' }, { id: 'first', label: 'Chỉ tên (A)' },
];

const previewRow = (merge: MergeData, preview: number | null) => {
  const records = activeRecords(merge);
  return records[Math.min(preview ?? 0, Math.max(0, records.length - 1))]?.row ?? {};
};

function ConditionFields({ headers, value, onChange }: { headers: string[]; value: Condition; onChange: (next: Condition) => void }) {
  const noValue = value.op === 'empty' || value.op === 'filled';
  return (
    <div className="merge-condition">
      <select className="text-field" aria-label="Trường" value={value.field} onChange={(e) => onChange({ ...value, field: e.target.value })}>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select>
      <select className="text-field" aria-label="Phép so sánh" value={value.op} onChange={(e) => onChange({ ...value, op: e.target.value as Comparison })}>{COMPARISONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <input className="text-field" aria-label="Giá trị so sánh" placeholder="Giá trị" disabled={noValue} value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value })} />
    </div>
  );
}

export function RecipientsDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [draft, setDraft] = useState<MergeData | null>(() => (ctx.merge ? { ...ctx.merge, rows: ctx.merge.rows.map((row) => ({ ...row })), excluded: [...(ctx.merge.excluded ?? [])] } : null));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Condition>({ field: ctx.merge?.headers[0] ?? '', op: 'eq', value: '' });
  if (!draft) return <Modal title="Danh sách người nhận" icon={<Users size={20} />} onClose={onClose} actions={<button className="btn btn-primary" onClick={() => ctx.openDialog('mailmerge')}>Chọn danh sách</button>}><p>Chưa có danh sách người nhận.</p></Modal>;
  const excluded = new Set(draft.excluded ?? []);
  const visible = draft.rows.map((row, index) => ({ row, index })).filter(({ row }) => !query || Object.values(row).some((value) => fold(value).includes(fold(query))));
  const setExcluded = (next: Set<number>) => setDraft({ ...draft, excluded: [...next].sort((a, b) => a - b) });
  const toggle = (index: number) => {
    const next = new Set(excluded);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExcluded(next);
  };
  const edit = (index: number, header: string, value: string) => setDraft({ ...draft, rows: draft.rows.map((row, i) => (i === index ? { ...row, [header]: value } : row)) });
  const sortBy = (header: string) => {
    const order = draft.rows.map((row, index) => ({ row, index, out: excluded.has(index) })).sort((a, b) => fold(a.row[header] ?? '').localeCompare(fold(b.row[header] ?? ''), 'vi', { numeric: true }));
    setDraft({ ...draft, rows: order.map((item) => item.row), excluded: order.flatMap((item, index) => (item.out ? [index] : [])) });
  };
  const applyFilter = () => setExcluded(new Set(draft.rows.flatMap((row, index) => (testCondition(row, filter) ? [] : [index]))));
  const removeDuplicates = () => {
    const seen = new Set<string>();
    const next = new Set(excluded);
    draft.rows.forEach((row, index) => {
      const key = fold(Object.values(row).join('|'));
      if (seen.has(key)) next.add(index);
      seen.add(key);
    });
    setExcluded(next);
  };
  const addRow = () => setDraft({ ...draft, rows: [...draft.rows, Object.fromEntries(draft.headers.map((h) => [h, '']))] });
  const save = () => {
    ctx.setMerge(draft);
    if (ctx.mergePreview !== null) ctx.setMergePreview(0);
    ctx.ui.toast(`Đã chọn ${draft.rows.length - excluded.size}/${draft.rows.length} người nhận`);
    onClose();
  };
  return (
    <Modal title="Sửa danh sách người nhận" subtitle={`${draft.source} · đang chọn ${draft.rows.length - excluded.size}/${draft.rows.length}`} icon={<Users size={20} />} onClose={onClose} width={980}
      actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={save}>Áp dụng</button></>}>
      <div className="merge-toolbar">
        <label className="merge-search"><Search size={14} /><input className="text-field" placeholder="Tìm trong danh sách" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <button className="btn" onClick={() => setExcluded(new Set())}>Chọn tất cả</button>
        <button className="btn" onClick={() => setExcluded(new Set(draft.rows.map((_, i) => i)))}>Bỏ chọn tất cả</button>
        <button className="btn" onClick={removeDuplicates}>Bỏ bản trùng</button>
        <button className="btn" onClick={addRow}>Thêm người nhận</button>
      </div>
      <div className="merge-toolbar">
        <span className="field-label">Lọc: chỉ chọn bản ghi có</span>
        <ConditionFields headers={draft.headers} value={filter} onChange={setFilter} />
        <button className="btn" onClick={applyFilter}>Áp dụng lọc</button>
      </div>
      <div className="merge-table-wrap tall">
        <table className="merge-edit-table">
          <thead><tr><th aria-label="Chọn" />{draft.headers.map((h) => <th key={h}><button type="button" className="merge-sort" title={`Sắp xếp theo ${h}`} onClick={() => sortBy(h)}>{h} <ArrowDownAZ size={12} /></button></th>)}</tr></thead>
          <tbody>
            {visible.slice(0, 500).map(({ row, index }) => (
              <tr key={index} className={excluded.has(index) ? 'off' : ''}>
                <td><input type="checkbox" aria-label={`Chọn bản ghi ${index + 1}`} checked={!excluded.has(index)} onChange={() => toggle(index)} /></td>
                {draft.headers.map((h) => <td key={h}><input className="merge-cell" aria-label={`${h} của bản ghi ${index + 1}`} value={row[h] ?? ''} onChange={(e) => edit(index, h, e.target.value)} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length > 500 && <div className="dialog-subtitle">Đang hiện 500/{visible.length} dòng, dùng ô tìm để thu hẹp.</div>}
      </div>
    </Modal>
  );
}

export function MatchFieldsDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const merge = ctx.merge;
  const [map, setMap] = useState<FieldMap>(() => ({ ...(merge ? guessFieldMap(merge.headers) : {}), ...(merge?.fieldMap ?? {}) }));
  if (!merge) return null;
  const save = () => {
    ctx.setMerge({ ...merge, fieldMap: Object.fromEntries(Object.entries(map).filter(([, value]) => value)) });
    onClose();
  };
  return (
    <Modal title="Khớp trường" subtitle="Chọn cột trong danh sách ứng với từng thông tin. Khối địa chỉ và Dòng chào dùng các cột này." icon={<Settings2 size={20} />} onClose={onClose} width={560}
      actions={<><button className="btn" onClick={() => setMap(guessFieldMap(merge.headers))}>Tự nhận lại</button><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={save}>Lưu</button></>}>
      <div className="merge-map">
        {STD_FIELDS.map((field) => (
          <label key={field.id} className="field inline"><span className="field-label">{field.label}</span>
            <select className="text-field" value={map[field.id] ?? ''} onChange={(e) => setMap({ ...map, [field.id]: e.target.value })}>
              <option value="">(không ghép)</option>
              {merge.headers.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
        ))}
      </div>
    </Modal>
  );
}

const ensureMap = (merge: MergeData): MergeData => (merge.fieldMap && Object.keys(merge.fieldMap).length ? merge : { ...merge, fieldMap: guessFieldMap(merge.headers) });

export function AddressBlockDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [options, setOptions] = useState<AddressOptions>(DEFAULT_ADDRESS);
  if (!ctx.merge) return null;
  const merge = ensureMap(ctx.merge);
  const lines = addressLines(merge, previewRow(merge, ctx.mergePreview), options);
  const insert = () => {
    if (merge !== ctx.merge) ctx.setMerge(merge);
    ctx.editor.chain().focus().insertMergeBlock('address', options).run();
    onClose();
  };
  return (
    <Modal title="Chèn khối địa chỉ" icon={<MapPin size={20} />} onClose={onClose} width={620}
      actions={<><button className="btn" onClick={() => ctx.openDialog('mergematch')}>Khớp trường…</button><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={insert}>Chèn</button></>}>
      <label className="field"><span className="field-label">Cách ghi tên người nhận</span><select className="text-field" value={options.nameFormat} onChange={(e) => setOptions({ ...options, nameFormat: e.target.value as NameFormat })}>{NAME_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
      <div className="check-row"><label><input type="checkbox" checked={options.company} onChange={(e) => setOptions({ ...options, company: e.target.checked })} /> Ghi tên công ty</label></div>
      <label className="field"><span className="field-label">Quốc gia trong địa chỉ</span><select className="text-field" value={options.country} onChange={(e) => setOptions({ ...options, country: e.target.value as AddressOptions['country'] })}><option value="foreign">Chỉ ghi khi khác</option><option value="always">Luôn ghi</option><option value="never">Không ghi</option></select></label>
      {options.country === 'foreign' && <label className="field"><span className="field-label">Không ghi khi quốc gia là</span><input className="text-field" value={options.homeCountry} onChange={(e) => setOptions({ ...options, homeCountry: e.target.value })} /></label>}
      <div className="field-label">Xem trước</div>
      <div className="merge-sample">{lines.length ? lines.map((line, i) => <div key={i}>{line}</div>) : <em>Bản ghi này chưa có dữ liệu địa chỉ. Kiểm tra Khớp trường.</em>}</div>
    </Modal>
  );
}

export function GreetingDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [options, setOptions] = useState<GreetingOptions>(DEFAULT_GREETING);
  if (!ctx.merge) return null;
  const merge = ensureMap(ctx.merge);
  const insert = () => {
    if (merge !== ctx.merge) ctx.setMerge(merge);
    ctx.editor.chain().focus().insertMergeBlock('greeting', options).run();
    onClose();
  };
  return (
    <Modal title="Chèn dòng chào" icon={<Wand2 size={20} />} onClose={onClose} width={560}
      actions={<><button className="btn" onClick={() => ctx.openDialog('mergematch')}>Khớp trường…</button><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={insert}>Chèn</button></>}>
      <div className="merge-condition">
        <select className="text-field" aria-label="Lời chào" value={options.salutation} onChange={(e) => setOptions({ ...options, salutation: e.target.value })}>{['Kính gửi', 'Thân gửi', 'Gửi', 'Chào', 'Dear'].map((s) => <option key={s}>{s}</option>)}</select>
        <select className="text-field" aria-label="Tên" value={options.nameFormat} onChange={(e) => setOptions({ ...options, nameFormat: e.target.value as NameFormat })}>{NAME_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
        <select className="text-field" aria-label="Dấu câu" value={options.punctuation} onChange={(e) => setOptions({ ...options, punctuation: e.target.value })}><option value=",">,</option><option value=":">:</option><option value="!">!</option><option value="">(không)</option></select>
      </div>
      <label className="field"><span className="field-label">Khi thiếu tên người nhận</span><input className="text-field" value={options.fallback} onChange={(e) => setOptions({ ...options, fallback: e.target.value })} /></label>
      <div className="field-label">Xem trước</div>
      <div className="merge-sample">{greetingText(merge, previewRow(merge, ctx.mergePreview), options)}</div>
    </Modal>
  );
}

let ruleKind: BlockKind = 'if';
export const setRuleKind = (kind: BlockKind) => { ruleKind = kind; };

const RULE_KINDS: BlockKind[] = ['if', 'skipif', 'nextif', 'next', 'recnum', 'seqnum', 'fillin'];
const RULE_HELP: Record<string, string> = {
  if: 'Chèn chữ khác nhau tuỳ dữ liệu, ví dụ “Anh” hoặc “Chị”. Gõ «Tên cột» để lấy dữ liệu.',
  skipif: 'Bỏ hẳn bản ghi thoả điều kiện, không tạo bản nào cho người đó.',
  nextif: 'Chuyển sang bản ghi tiếp theo trong cùng trang khi thoả điều kiện.',
  next: 'Lấy bản ghi tiếp theo cho các trường phía sau, dùng cho nhãn và danh bạ.',
  recnum: 'Chèn số thứ tự của bản ghi trong danh sách gốc.',
  seqnum: 'Chèn số thứ tự của bản đang trộn: 1, 2, 3…',
  fillin: 'Hỏi một lần khi trộn rồi chèn câu trả lời vào mọi bản.',
};

export function RuleDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const headers = ctx.merge?.headers ?? [];
  const [kind, setKind] = useState<BlockKind>(ruleKind);
  const [condition, setCondition] = useState<Condition>({ field: headers[0] ?? '', op: 'eq', value: '' });
  const [then, setThen] = useState('');
  const [otherwise, setOtherwise] = useState('');
  const [prompt, setPrompt] = useState('Nhập nội dung');
  const [value, setValue] = useState('');
  const needsCondition = kind === 'if' || kind === 'skipif' || kind === 'nextif';
  const insert = () => {
    const options = kind === 'if' ? { ...condition, then, otherwise } : needsCondition ? condition : kind === 'fillin' ? { prompt, value } : {};
    ctx.editor.chain().focus().insertMergeBlock(kind, options).run();
    onClose();
  };
  return (
    <Modal title="Quy tắc trộn" subtitle={RULE_HELP[kind]} icon={<ListChecks size={20} />} onClose={onClose} width={640}
      actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={needsCondition && !condition.field} onClick={insert}>Chèn</button></>}>
      <label className="field"><span className="field-label">Loại quy tắc</span><select className="text-field" value={kind} onChange={(e) => setKind(e.target.value as BlockKind)}>{RULE_KINDS.map((k) => <option key={k} value={k}>{BLOCK_LABELS[k]}</option>)}</select></label>
      {needsCondition && (headers.length ? <ConditionFields headers={headers} value={condition} onChange={setCondition} /> : <div className="field-error">Hãy chọn danh sách người nhận trước.</div>)}
      {kind === 'if' && <>
        <label className="field"><span className="field-label">Thì chèn</span><textarea className="text-field" rows={2} value={then} onChange={(e) => setThen(e.target.value)} /></label>
        <label className="field"><span className="field-label">Không thì chèn</span><textarea className="text-field" rows={2} value={otherwise} onChange={(e) => setOtherwise(e.target.value)} /></label>
      </>}
      {kind === 'fillin' && <>
        <label className="field"><span className="field-label">Câu hỏi khi trộn</span><input className="text-field" value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
        <label className="field"><span className="field-label">Câu trả lời mặc định</span><input className="text-field" value={value} onChange={(e) => setValue(e.target.value)} /></label>
      </>}
    </Modal>
  );
}

export function FindRecipientDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [query, setQuery] = useState('');
  const [field, setField] = useState('');
  const merge = ctx.merge;
  const results = useMemo(() => (merge ? findRecords(merge, query, field || undefined) : []), [merge, query, field]);
  if (!merge) return null;
  const records = activeRecords(merge);
  const go = (index: number) => {
    const position = records.findIndex((item) => item.index === index);
    if (position < 0) return ctx.ui.toast('Bản ghi này đang bị bỏ chọn trong danh sách người nhận', true);
    ctx.setMergePreview(position);
    onClose();
  };
  return (
    <Modal title="Tìm người nhận" icon={<Search size={20} />} onClose={onClose} width={620} actions={<button className="btn" onClick={onClose}>Đóng</button>}>
      <div className="merge-condition">
        <input className="text-field" autoFocus placeholder="Gõ tên, email, địa chỉ…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="text-field" aria-label="Tìm trong" value={field} onChange={(e) => setField(e.target.value)}><option value="">Mọi trường</option>{merge.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select>
      </div>
      <div className="merge-results">
        {query && !results.length && <div className="dialog-subtitle">Không tìm thấy.</div>}
        {results.slice(0, 50).map((index) => <button key={index} type="button" className="merge-result" onClick={() => go(index)}><strong>#{index + 1}</strong> {merge.headers.slice(0, 3).map((h) => merge.rows[index][h]).filter(Boolean).join(' · ')}</button>)}
      </div>
    </Modal>
  );
}

export function CheckErrorsDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const merge = ctx.merge;
  const type: MergeType = ctx.page.mergeType ?? 'letters';
  const problems = useMemo(() => (merge ? checkMerge(ctx.editor.getJSON(), merge, type, ctx.page.mergeEmail?.to ?? merge.fieldMap?.email ?? guessFieldMap(merge.headers).email) : []), [ctx.editor, merge, type, ctx.page.mergeEmail?.to]);
  if (!merge) return null;
  return (
    <Modal title="Kiểm tra lỗi trộn thư" subtitle={`${MERGE_TYPES.find((t) => t.id === type)?.label} · ${activeRecords(merge).length} người nhận`} icon={problems.length ? <AlertTriangle size={20} color="#d97706" /> : <CheckCircle2 size={20} color="#16a34a" />} onClose={onClose} width={620}
      actions={<button className="btn btn-primary" onClick={onClose}>Đóng</button>}>
      {problems.length ? (
        <ul className="merge-problems">{problems.slice(0, 200).map((problem, i) => <li key={i}>{problem.record ? <strong>Bản ghi {problem.record}: </strong> : null}{problem.message}</li>)}</ul>
      ) : <p>Không thấy lỗi. Có thể hoàn tất trộn thư.</p>}
    </Modal>
  );
}
