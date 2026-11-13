import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, FilePlus2, Maximize2, Minimize2, Plus, Trash2, X } from 'lucide-react';
import { formatBytes } from '../../lib/download';
import { conversionBaseName } from '../../lib/conversionTypes';
import { mergeFiles, mergePages, partFileName, partsAccept, partsFormat } from '../../lib/fileParts';
import { FormatLogo } from '../FormatLogo';
import { PageCard } from './PageCard';
import { usePartPages } from './usePartPages';
import { colorAt, FORMAT_BADGES, UNIT_NOUN, type DoneResult, type QueueItem } from './shared';

type Pick = { id: number; index: number };

type Props = { running: boolean; setRunning: (value: boolean) => void; onDone: (result: DoneResult) => void; onCancel: () => void };

export function MergePanel({ running, setRunning, onDone, onCancel }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const dragFrom = useRef<number | null>(null);
  const [kind, setKind] = useState<'files' | 'pages'>('files');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [focus, setFocus] = useState(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [stem, setStem] = useState<string>();
  const [zoom, setZoom] = useState(false);
  const [error, setError] = useState('');
  const format = queue.length ? partsFormat(queue[0].file) : undefined;
  const unit = format === 'docx' ? 'pages' : 'blocks';
  const requests = useMemo(() => queue.map((item) => ({ file: item.file, unit: unit as 'pages' | 'blocks' })), [queue, unit]);
  const pages = usePartPages(requests);
  const flat = useMemo(() => queue.flatMap((item) => (pages.get(item.file)?.labels ?? []).map((label, index) => ({ item, index, label }))), [queue, pages]);
  const total = flat.length;
  const current = flat[Math.min(focus, Math.max(0, total - 1))];
  const defaultStem = queue.length ? `${conversionBaseName(queue[0].file.name)} - ${kind === 'files' ? 'đã gộp' : 'trang đã chọn'}` : '';
  const name = stem ?? defaultStem;
  const unitNoun = format ? UNIT_NOUN[format] : 'trang';

  function addFiles(files: File[]) {
    if (running || !files.length) return;
    try {
      const expected = format ?? partsFormat(files[0]);
      for (const file of files) {
        if (!file.size) throw new Error(`Tệp trống: ${file.name}`);
        if (partsFormat(file) !== expected) throw new Error('Các tệp cần gộp phải cùng định dạng.');
      }
      setQueue((items) => [...items, ...files.map((file) => ({ id: ++sequence.current, file, color: colorAt(sequence.current - 1) }))]);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không đọc được tệp.'); }
  }

  function move(index: number, offset: number) {
    const next = queue.slice();
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setQueue(next);
  }

  function remove(id: number) {
    setQueue((items) => items.filter((item) => item.id !== id));
    setPicks((list) => list.filter((pick) => pick.id !== id));
    setFocus(0);
  }

  function togglePick(id: number, index: number) {
    setPicks((list) => list.some((pick) => pick.id === id && pick.index === index) ? list.filter((pick) => !(pick.id === id && pick.index === index)) : [...list, { id, index }]);
  }

  function movePick(from: number, to: number) {
    if (to < 0 || to >= picks.length || from === to) return;
    const next = picks.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPicks(next);
  }

  async function run() {
    if (!format) return;
    setRunning(true);
    setError('');
    try {
      const byId = new Map(queue.map((item) => [item.id, item]));
      const blob = kind === 'files'
        ? (await mergeFiles(queue.map((item) => item.file))).blob
        : await mergePages(picks.map((pick) => ({ file: byId.get(pick.id)!.file, index: pick.index })), unit);
      const count = kind === 'files' ? total : picks.length;
      onDone({
        title: kind === 'files' ? `Đã gộp ${queue.length} tệp` : `Đã ghép ${picks.length} ${unitNoun}`,
        source: `${count} ${unitNoun} · ${partFileName(name, format)}`,
        parts: [{ blob, stem: name, extension: format, pages: count }],
        zipStem: name,
        noun: unitNoun,
        again: 'Gộp tệp khác',
      });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không xử lý được tệp.'); }
    finally { setRunning(false); }
  }

  const loading = queue.some((item) => pages.get(item.file)?.reading !== false);
  const canRun = !running && (kind === 'files' ? queue.length >= 2 : picks.length >= 1 && !loading);
  const summary = !queue.length ? 'Chọn các tệp cùng định dạng'
    : kind === 'files' ? (queue.length < 2 ? 'Cần ít nhất 2 tệp để gộp' : `Kết quả: 1 tệp · ${total} ${unitNoun} · ${formatBytes(queue.reduce((sum, item) => sum + item.file.size, 0))}`)
      : `Kết quả: 1 tệp · ${picks.length} ${unitNoun} lấy từ ${new Set(picks.map((pick) => pick.id)).size} tệp`;

  const nameField = format && <label className="fp-name">
    <span>Tên tệp</span>
    <span className="fp-name-box"><input value={name} disabled={running} onChange={(event) => setStem(event.target.value)} aria-label="Tên tệp kết quả" /><em>.{format}</em></span>
  </label>;

  const picker = <input ref={input} type="file" hidden multiple accept={format ? '.' + format : partsAccept} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />;

  if (!queue.length) return <>
    <div className="fp-body fp-body-single">
      <div className="fp-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}>
        <span className="fp-drop-icon"><FilePlus2 size={30} aria-hidden="true" /></span>
        <strong>Kéo các tệp cần gộp vào đây</strong>
        <span>Tất cả tệp phải cùng một định dạng. Sắp xếp lại thứ tự sau khi thêm.</span>
        <button type="button" className="btn primary" onClick={() => input.current?.click()}><Plus size={18} aria-hidden="true" />Chọn tệp từ máy</button>
        <span className="fp-formats">{Object.values(FORMAT_BADGES).map((badge) => <span key={badge.text}><FormatLogo badge={badge} size={20} />{badge.text}</span>)}</span>
        {picker}
      </div>
      {error && <p role="alert" className="conversion-error">{error}</p>}
    </div>
    <footer className="fp-footer"><p>Cần ít nhất 2 tệp để gộp</p><div><button type="button" className="btn" onClick={onCancel}>Huỷ</button><button type="button" className="btn primary" disabled>Gộp tệp</button></div></footer>
  </>;

  return <>
    <div className="fp-body">
      <section className="fp-col" aria-label="Tệp cần gộp">
        <div className="fp-segment" role="radiogroup" aria-label="Cách gộp">
          <button type="button" role="radio" aria-checked={kind === 'files'} disabled={running} onClick={() => setKind('files')}>Ghép cả tệp</button>
          <button type="button" role="radio" aria-checked={kind === 'pages'} disabled={running} onClick={() => setKind('pages')}>{`Chọn từng ${unitNoun}`}</button>
        </div>
        {kind === 'files' ? <>
          <div className="fp-col-head"><strong>Thứ tự gộp</strong><span>Dùng nút mũi tên để đổi thứ tự</span></div>
          <ol className="fp-files">
            {queue.map((item, index) => {
              const info = pages.get(item.file);
              const first = flat.findIndex((page) => page.item.id === item.id);
              const active = current?.item.id === item.id;
              return <li key={item.id} className={active ? 'is-active' : ''} style={{ '--fp-color': item.color } as React.CSSProperties}>
                <span className="fp-swatch">{index + 1}</span>
                <span className="fp-file-text"><strong data-no-translate>{item.file.name}</strong><span>{info?.reading ? 'Đang đọc…' : info?.error ? info.error : `${info?.labels.length ?? 0} ${unitNoun} · ${formatBytes(item.file.size)}`}</span></span>
                <button type="button" className="icon-btn fp-eye" aria-label={`Xem trước: ${item.file.name}`} disabled={first < 0} onClick={() => setFocus(first)}><Eye size={18} /></button>
                <button type="button" className="icon-btn" aria-label={`Đưa lên: ${item.file.name}`} disabled={running || index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} /></button>
                <button type="button" className="icon-btn" aria-label={`Đưa xuống: ${item.file.name}`} disabled={running || index === queue.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /></button>
                <button type="button" className="icon-btn fp-danger" aria-label={`Bỏ ${item.file.name}`} disabled={running} onClick={() => remove(item.id)}><Trash2 size={18} /></button>
              </li>;
            })}
          </ol>
          <button type="button" className="fp-add" disabled={running} onClick={() => input.current?.click()}><Plus size={18} aria-hidden="true" />{`Thêm tệp ${format?.toUpperCase()} khác`}</button>
          <div className="fp-grow" />
          {nameField}
        </> : <>
          <p className="fp-hint">{`Bấm vào ${unitNoun} để thêm vào tệp kết quả. Bấm lần nữa để bỏ.`}</p>
          <div className="fp-scroll">
            {queue.map((item) => {
              const info = pages.get(item.file);
              return <div key={item.id} className="fp-source" style={{ '--fp-color': item.color } as React.CSSProperties}>
                <div className="fp-source-head">
                  <span className="fp-dot" />
                  <strong data-no-translate>{item.file.name}</strong>
                  <span>{`${info?.labels.length ?? 0} ${unitNoun}`}</span>
                  <button type="button" className="fp-link" disabled={running || !info?.labels.length} onClick={() => setPicks((list) => [...list.filter((pick) => pick.id !== item.id), ...(info?.labels ?? []).map((_, index) => ({ id: item.id, index }))])}>Chọn tất cả</button>
                </div>
                {info?.error && <p role="alert" className="conversion-error">{info.error}</p>}
                <div className="fp-page-row">
                  {(info?.labels ?? []).map((label, index) => {
                    const order = picks.findIndex((pick) => pick.id === item.id && pick.index === index);
                    return <PageCard key={index} size="small" number={index + 1} label={label} thumb={info?.thumbs[index]} color={order >= 0 ? item.color : undefined} badge={order >= 0 ? order + 1 : undefined}
                      ariaLabel={`${label} của ${item.file.name}${order >= 0 ? `, đã chọn, vị trí ${order + 1}` : ''}`} onClick={() => togglePick(item.id, index)} />;
                  })}
                </div>
              </div>;
            })}
          </div>
          <button type="button" className="fp-add" disabled={running} onClick={() => input.current?.click()}><Plus size={18} aria-hidden="true" />{`Thêm tệp ${format?.toUpperCase()} khác`}</button>
        </>}
        {picker}
        {error && <p role="alert" className="conversion-error">{error}</p>}
      </section>

      <section className="fp-col fp-preview" aria-label={kind === 'files' ? 'Xem trước kết quả' : 'Tệp kết quả'}>
        {kind === 'files' ? <>
          <div className="fp-col-head">
            <span><strong>Xem trước kết quả</strong>{current && <span>{`${unitNoun[0].toUpperCase() + unitNoun.slice(1)} ${focus + 1} / ${total} · ${current.index + 1} của `}<b data-no-translate style={{ color: current.item.color }}>{current.item.file.name}</b></span>}</span>
            <span className="fp-tools">
              <button type="button" className="icon-btn fp-boxed" aria-label="Trang trước" disabled={focus <= 0} onClick={() => setFocus(focus - 1)}><ChevronLeft size={18} /></button>
              <button type="button" className="icon-btn fp-boxed" aria-label="Trang sau" disabled={focus >= total - 1} onClick={() => setFocus(focus + 1)}><ChevronRight size={18} /></button>
              <button type="button" className="icon-btn fp-boxed" aria-label={zoom ? 'Thu nhỏ xem trước' : 'Phóng to xem trước'} aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
            </span>
          </div>
          <div className={zoom ? 'fp-stage is-zoomed' : 'fp-stage'}>
            {current ? <div className="fp-sheet-large">{pages.get(current.item.file)?.thumbs[current.index] ? <img src={pages.get(current.item.file)?.thumbs[current.index]} alt={`${current.label} của ${current.item.file.name}`} /> : <span data-no-translate>{current.label}</span>}</div> : <p className="fp-hint">Đang đọc tệp…</p>}
          </div>
          <div className="fp-legend">{queue.map((item) => <span key={item.id} style={{ '--fp-color': item.color } as React.CSSProperties}><span className="fp-dot" /><span data-no-translate>{conversionBaseName(item.file.name)}</span></span>)}</div>
          <div className="fp-strip" role="listbox" aria-label="Các trang của tệp kết quả">
            {flat.map((page, index) => <PageCard key={`${page.item.id}-${page.index}`} role="option" size="small" number={index + 1} label={page.label} thumb={pages.get(page.item.file)?.thumbs[page.index]} color={page.item.color} selected={index === focus}
              ariaLabel={`Trang ${index + 1}, ${page.label} của ${page.item.file.name}`} onClick={() => setFocus(index)} />)}
          </div>
        </> : <>
          <div className="fp-col-head">
            <span><strong>{`Tệp kết quả · ${picks.length} ${unitNoun}`}</strong><span>Kéo thả để đổi thứ tự</span></span>
            <button type="button" className="btn" disabled={running || !picks.length} onClick={() => setPicks([])}>Bỏ chọn tất cả</button>
          </div>
          {nameField}
          {picks.length ? <ol className="fp-picked">
            {picks.map((pick, index) => {
              const item = queue.find((entry) => entry.id === pick.id)!;
              const info = pages.get(item.file);
              const label = info?.labels[pick.index] ?? '';
              return <li key={`${pick.id}-${pick.index}`} draggable onDragStart={() => { dragFrom.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragFrom.current !== null) movePick(dragFrom.current, index); dragFrom.current = null; }}>
                <PageCard number={pick.index + 1} label={label} thumb={info?.thumbs[pick.index]} color={item.color} badge={index + 1} ariaLabel={`Vị trí ${index + 1}: ${label} của ${item.file.name}`} />
                <span className="fp-picked-caption" data-no-translate>{conversionBaseName(item.file.name)}</span>
                <span className="fp-picked-tools">
                  <button type="button" className="icon-btn" aria-label={`Đưa lên trước: vị trí ${index + 1}`} disabled={index === 0} onClick={() => movePick(index, index - 1)}><ChevronLeft size={16} /></button>
                  <button type="button" className="icon-btn fp-danger" aria-label={`Bỏ vị trí ${index + 1}`} onClick={() => togglePick(pick.id, pick.index)}><X size={16} /></button>
                  <button type="button" className="icon-btn" aria-label={`Đưa xuống sau: vị trí ${index + 1}`} disabled={index === picks.length - 1} onClick={() => movePick(index, index + 1)}><ChevronRight size={16} /></button>
                </span>
              </li>;
            })}
          </ol> : <p className="fp-hint fp-empty">{`Chưa chọn ${unitNoun} nào. Bấm vào ${unitNoun} ở cột bên trái để thêm.`}</p>}
        </>}
      </section>
    </div>
    <footer className="fp-footer">
      <p role="status">{running ? 'Đang xử lý…' : summary}</p>
      <div>
        <button type="button" className="btn" disabled={running} onClick={onCancel}>Huỷ</button>
        <button type="button" className="btn primary" disabled={!canRun} onClick={() => void run()}>{kind === 'files' ? `Gộp ${queue.length} tệp` : `Ghép ${picks.length} ${unitNoun}`}</button>
      </div>
    </footer>
  </>;
}
