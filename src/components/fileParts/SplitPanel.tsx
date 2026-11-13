import { useMemo, useRef, useState } from 'react';
import { FilePlus2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { formatBytes } from '../../lib/download';
import { conversionBaseName } from '../../lib/conversionTypes';
import { canMeasureWordPages } from '../../lib/desktopWordPages';
import { partRanges, partsAccept, partsFormat, splitParts, type WordSplitUnit } from '../../lib/fileParts';
import { FormatLogo } from '../FormatLogo';
import { PageCard } from './PageCard';
import { usePartPages } from './usePartPages';
import { colorAt, FORMAT_BADGES, pageRangeText, UNIT_NOUN, type DoneResult } from './shared';

type Kind = 'each' | 'ranges' | 'groups';
type Group = { id: number; name?: string; pages: number[] };
type Output = { key: string; stem: string; pages: number[]; color: string };

type Props = { running: boolean; setRunning: (value: boolean) => void; onDone: (result: DoneResult) => void; onCancel: () => void };

const KIND_LABELS: Record<Kind, string> = { each: 'Mỗi trang một tệp', ranges: 'Theo khoảng trang', groups: 'Chia nhóm tự chọn' };

function rangeOutputs(text: string, count: number): { groups: number[][]; error: string } {
  if (!text.trim()) return { groups: [], error: '' };
  try { return { groups: partRanges(text.replace(/,\s*$/, ''), count), error: '' }; }
  catch (reason) { return { groups: [], error: reason instanceof Error ? reason.message : 'Khoảng trang không hợp lệ.' }; }
}

export function SplitPanel({ running, setRunning, onDone, onCancel }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(1);
  const [file, setFile] = useState<File>();
  const [kind, setKind] = useState<Kind>('ranges');
  const [wordUnit, setWordUnit] = useState<WordSplitUnit>('pages');
  const [measure, setMeasure] = useState(0);
  const [ranges, setRanges] = useState('');
  const [anchor, setAnchor] = useState<number>();
  const [groups, setGroups] = useState<Group[]>([{ id: 1, pages: [] }]);
  const [activeId, setActiveId] = useState(1);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const format = file ? partsFormat(file) : undefined;
  const unit: WordSplitUnit = format === 'docx' ? wordUnit : 'blocks';
  const requests = useMemo(() => file ? [{ file, unit, measure }] : [], [file, unit, measure]);
  const info = usePartPages(requests).get(file as File);
  const labels = useMemo(() => info?.labels ?? [], [info?.labels]);
  const count = labels.length;
  const base = file ? conversionBaseName(file.name) : '';
  const noun = format === 'docx' && unit === 'blocks' ? 'mục' : format ? UNIT_NOUN[format] : 'trang';
  const parsed = useMemo(() => rangeOutputs(ranges, count), [ranges, count]);

  const outputs: Output[] = useMemo(() => {
    if (kind === 'each') return labels.map((_, index) => ({ key: `each-${index}`, stem: `${base} - ${noun} ${index + 1}`, pages: [index], color: colorAt(index) }));
    if (kind === 'ranges') return parsed.groups.map((pages, index) => ({ key: `range-${index}`, stem: `${base} - ${noun} ${pageRangeText(pages)}`, pages, color: colorAt(index) }));
    return groups.map((group, index) => ({ key: `group-${group.id}`, stem: group.name ?? `${base} - phần ${index + 1}`, pages: group.pages, color: colorAt(index) }));
  }, [kind, labels, base, noun, parsed, groups]);

  const owner = useMemo(() => {
    const map = new Map<number, number>();
    outputs.forEach((output, index) => output.pages.forEach((page) => { if (!map.has(page)) map.set(page, index); }));
    return map;
  }, [outputs]);

  function chooseFile(files: File[]) {
    if (running || !files.length) return;
    try {
      if (files.length > 1) throw new Error('Chọn một tệp nguồn cho mỗi lần tách.');
      partsFormat(files[0]);
      if (!files[0].size) throw new Error(`Tệp trống: ${files[0].name}`);
      setFile(files[0]);
      resetChoices();
      setMeasure(0);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không đọc được tệp.'); }
  }

  function resetChoices() {
    setRanges('');
    setAnchor(undefined);
    setGroups([{ id: ++sequence.current, pages: [] }]);
    setActiveId(sequence.current);
    setNames({});
  }

  function clickPage(index: number) {
    if (kind === 'ranges') {
      if (anchor === undefined) { setAnchor(index); return; }
      const [first, last] = anchor <= index ? [anchor, index] : [index, anchor];
      const piece = first === last ? `${first + 1}` : `${first + 1}-${last + 1}`;
      setRanges((text) => text.trim() ? `${text.replace(/,\s*$/, '')}, ${piece}` : piece);
      setAnchor(undefined);
      return;
    }
    if (kind !== 'groups') return;
    setGroups((list) => list.map((group) => {
      const has = group.pages.includes(index);
      if (group.id === activeId) return { ...group, pages: has ? group.pages.filter((page) => page !== index) : [...group.pages, index].sort((a, b) => a - b) };
      return has ? { ...group, pages: group.pages.filter((page) => page !== index) } : group;
    }));
  }

  function addGroup() {
    const id = ++sequence.current;
    setGroups((list) => [...list, { id, pages: [] }]);
    setActiveId(id);
  }

  function removeGroup(id: number) {
    const rest = groups.filter((group) => group.id !== id);
    setGroups(rest.length ? rest : [{ id: ++sequence.current, pages: [] }]);
    if (id === activeId) setActiveId(rest[0]?.id ?? sequence.current);
  }

  async function run() {
    if (!file || !format) return;
    setRunning(true);
    setError('');
    try {
      const blobs = await splitParts(file, outputs.map((output) => output.pages), unit, info?.layout);
      onDone({
        title: `Đã tách thành ${blobs.length} tệp`,
        source: `${file.name} · ${count} ${noun}`,
        parts: blobs.map((blob, index) => ({ blob, stem: names[outputs[index].key] ?? outputs[index].stem, extension: format, pages: outputs[index].pages.length })),
        zipStem: `${base} - đã tách`,
        noun,
        again: 'Tách tệp khác',
      });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không xử lý được tệp.'); }
    finally { setRunning(false); }
  }

  const picker = <input ref={input} type="file" hidden accept={partsAccept} onChange={(event) => { chooseFile(Array.from(event.target.files ?? [])); event.target.value = ''; }} />;

  if (!file || !format) return <>
    <div className="fp-body fp-body-single">
      <div className="fp-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFile(Array.from(event.dataTransfer.files)); }}>
        <span className="fp-drop-icon"><FilePlus2 size={30} aria-hidden="true" /></span>
        <strong>Kéo tệp cần tách vào đây</strong>
        <span>Chọn một tệp. Sau đó bấm vào các trang để chia thành tệp mới.</span>
        <button type="button" className="btn primary" onClick={() => input.current?.click()}><Plus size={18} aria-hidden="true" />Chọn tệp từ máy</button>
        <span className="fp-formats">{Object.values(FORMAT_BADGES).map((badge) => <span key={badge.text}><FormatLogo badge={badge} size={20} />{badge.text}</span>)}</span>
        {picker}
      </div>
      {error && <p role="alert" className="conversion-error">{error}</p>}
    </div>
    <footer className="fp-footer"><p>Chọn một tệp để tách</p><div><button type="button" className="btn" onClick={onCancel}>Huỷ</button><button type="button" className="btn primary" disabled>Tách tệp</button></div></footer>
  </>;

  const wordPages = format === 'docx' && unit === 'pages';
  const emptyOutput = outputs.some((output) => !output.pages.length);
  const canRun = !running && !info?.reading && count > 0 && outputs.length > 0 && !emptyOutput && !parsed.error;
  const skipped = count - owner.size;
  const hint = kind === 'each' ? `Tạo ${count} tệp, mỗi ${noun} một tệp.`
    : kind === 'ranges' ? (anchor === undefined ? `Bấm ${noun} đầu rồi ${noun} cuối ở bên phải để thêm một khoảng.` : `Đã chọn ${noun} ${anchor + 1}. Bấm ${noun} cuối của khoảng.`)
      : `Bấm ${noun} ở bên phải để đưa vào nhóm đang chọn.`;

  return <>
    <div className="fp-body">
      <section className="fp-col" aria-label="Cách tách">
        <div className="fp-srcfile">
          <span className="fp-srcfile-row">
            <FormatLogo badge={FORMAT_BADGES[format]} size={28} />
            <span className="fp-file-text"><strong data-no-translate>{file.name}</strong><span>{info?.reading ? 'Đang đọc…' : `${count} ${noun} · ${formatBytes(file.size)}`}</span></span>
            <button type="button" className="btn" disabled={running} onClick={() => input.current?.click()}>Đổi tệp</button>
          </span>
          {picker}
        </div>
        {format === 'docx' && <label className="fp-field"><span>Tách tài liệu Word theo</span>
          <select className="text-field" value={wordUnit} disabled={running} onChange={(event) => { setWordUnit(event.target.value as WordSplitUnit); setMeasure(0); resetChoices(); }}>
            <option value="pages">Số trang</option><option value="blocks">Đoạn văn và bảng</option>
          </select>
          {wordPages && <span className="fp-hint">{info?.layout ? 'Dùng thứ tự trang in do Microsoft Word vừa xác định.' : 'Dùng thứ tự trang in đã lưu trong tệp Word.'}</span>}
        </label>}
        {wordPages && canMeasureWordPages() && info && !info.reading && !info.layout && (info.canMeasure || count > 0) &&
          <button type="button" className="btn" disabled={running} onClick={() => { resetChoices(); setMeasure((n) => n + 1); }}><RefreshCw size={16} aria-hidden="true" />Đọc lại số trang bằng Microsoft Word</button>}
        <div className="fp-segment fp-segment-3" role="radiogroup" aria-label="Cách tách">
          {(Object.keys(KIND_LABELS) as Kind[]).map((value) => <button key={value} type="button" role="radio" aria-checked={kind === value} disabled={running} onClick={() => { setKind(value); setAnchor(undefined); }}>{KIND_LABELS[value]}</button>)}
        </div>
        {kind === 'ranges' && <label className="fp-field"><span>{`Khoảng ${noun}`}</span>
          <input className="text-field" placeholder="1-3, 4, 5-7" value={ranges} disabled={running} onChange={(event) => { setRanges(event.target.value); setAnchor(undefined); }} aria-invalid={Boolean(parsed.error)} />
          {parsed.error && <span className="fp-field-error" role="alert">{parsed.error}</span>}
        </label>}
        <p className="fp-hint">{hint}</p>
        {kind === 'groups' ? <ol className="fp-groups">
          {groups.map((group, index) => {
            const active = group.id === activeId;
            return <li key={group.id} className={active ? 'is-active' : ''} style={{ '--fp-color': colorAt(index) } as React.CSSProperties} onClick={() => setActiveId(group.id)}>
              <span className="fp-swatch">{index + 1}</span>
              <span className="fp-group-main">
                <span className="fp-name-box"><input value={group.name ?? `${base} - phần ${index + 1}`} disabled={running} aria-label={`Tên tệp nhóm ${index + 1}`} onFocus={() => setActiveId(group.id)} onChange={(event) => setGroups((list) => list.map((item) => item.id === group.id ? { ...item, name: event.target.value } : item))} /><em>.{format}</em></span>
                <span className="fp-group-meta">{group.pages.length ? `${noun[0].toUpperCase() + noun.slice(1)} ${pageRangeText(group.pages)} · ${group.pages.length} ${noun}` : `Chưa có ${noun} nào`}{active && <b className="fp-tag">Đang chọn</b>}</span>
              </span>
              <button type="button" className="icon-btn fp-danger" aria-label={`Xoá nhóm ${index + 1}`} disabled={running} onClick={(event) => { event.stopPropagation(); removeGroup(group.id); }}><Trash2 size={18} /></button>
            </li>;
          })}
          <li className="fp-groups-add"><button type="button" className="fp-add" disabled={running} onClick={addGroup}><Plus size={18} aria-hidden="true" />Thêm nhóm</button></li>
        </ol> : <ol className="fp-outputs" aria-label="Các tệp sẽ tạo">
          {outputs.map((output, index) => <li key={output.key} style={{ '--fp-color': output.color } as React.CSSProperties}>
            <span className="fp-swatch">{index + 1}</span>
            <span className="fp-name-box"><input value={names[output.key] ?? output.stem} disabled={running} aria-label={`Tên tệp ${index + 1}`} onChange={(event) => setNames((map) => ({ ...map, [output.key]: event.target.value }))} /><em>.{format}</em></span>
            <span className="fp-output-meta">{`${output.pages.length} ${noun}`}</span>
          </li>)}
        </ol>}
        {error && <p role="alert" className="conversion-error">{error}</p>}
      </section>

      <section className="fp-col fp-preview" aria-label={`Các ${noun} của tệp`}>
        <div className="fp-col-head"><span><strong>Xem trước</strong><span>{kind !== 'each' && skipped > 0 ? `${count} ${noun} · ${skipped} ${noun} không lấy` : `${count} ${noun}`}</span></span></div>
        {info?.error && <p role="alert" className="conversion-error">{info.error}</p>}
        {info?.reading && <p className="fp-hint" role="status">{wordPages && measure ? 'Microsoft Word đang phân trang…' : 'Đang đọc nội dung tệp…'}</p>}
        <div className="fp-grid">
          {labels.map((label, index) => {
            const target = owner.get(index);
            const color = target === undefined ? undefined : outputs[target].color;
            const dim = kind !== 'each' && target === undefined;
            const tag = target !== undefined ? `Tệp ${target + 1}` : dim && (kind === 'groups' || ranges.trim()) ? 'Không lấy' : undefined;
            return <PageCard key={index} number={index + 1} label={label} thumb={info?.thumbs[index]} color={color} tag={tag} dim={dim && Boolean(tag)} selected={anchor === index}
              ariaLabel={`${label}${target !== undefined ? `, thuộc tệp ${target + 1}` : ''}`} onClick={kind === 'each' ? undefined : () => clickPage(index)} />;
          })}
        </div>
      </section>
    </div>
    <footer className="fp-footer">
      <p role="status">{running ? 'Đang tách…' : emptyOutput ? 'Có nhóm chưa có trang nào.' : outputs.length ? `Kết quả: ${outputs.length} tệp ${format.toUpperCase()}` : `Chưa có khoảng ${noun} nào`}</p>
      <div>
        <button type="button" className="btn" disabled={running} onClick={onCancel}>Huỷ</button>
        <button type="button" className="btn primary" disabled={!canRun} onClick={() => void run()}>{`Tách thành ${outputs.length} tệp`}</button>
      </div>
    </footer>
  </>;
}
