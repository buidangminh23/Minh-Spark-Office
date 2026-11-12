import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FilePlus2, Files, Trash2, X } from 'lucide-react';
import { downloadBlob, formatBytes } from '../lib/download';
import { mergeFiles, partLabels, partRanges, partsAccept, partsFormat, splitFile, type PartsFormat, type WordSplitUnit } from '../lib/fileParts';
import type { WordPhysicalPages } from '../lib/wordPageMap';
import { canMeasureWordPages, measureWordPages } from '../lib/desktopWordPages';
import './conversion.css';

const unitLabels: Record<PartsFormat, string> = {
  pdf: 'Trang PDF', docx: 'Đoạn văn và bảng', xlsx: 'Trang tính', pptx: 'Trang chiếu',
};

type SelectedFile = { id: number; file: File };

export function FilePartsDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const [mode, setMode] = useState<'merge' | 'split'>('merge');
  const [queue, setQueue] = useState<SelectedFile[]>([]);
  const [source, setSource] = useState<SelectedFile>();
  const [wordUnit, setWordUnit] = useState<WordSplitUnit>('pages');
  const [measureAttempt, setMeasureAttempt] = useState(0);
  const [inspection, setInspection] = useState<{
    source: SelectedFile; unit: WordSplitUnit; attempt: number; labels: string[]; error?: string; layout?: WordPhysicalPages; canMeasure?: boolean;
  }>();
  const [each, setEach] = useState(false);
  const [ranges, setRanges] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; name: string }>();
  const merging = mode === 'merge';
  const selected = merging ? queue : source ? [source] : [];
  const selectedFormat = selected.length ? partsFormat(selected[0].file) : undefined;
  const wordPages = !merging && selectedFormat === 'docx' && wordUnit === 'pages';
  const current = inspection && inspection.source === source && inspection.unit === wordUnit && inspection.attempt === measureAttempt ? inspection : undefined;
  const labels = current?.labels ?? [];
  const reading = Boolean(source && !current);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (merging || !source) return;
    let active = true;
    const key = { source, unit: wordUnit, attempt: measureAttempt };
    async function inspect() {
      try {
        const layout = wordPages && measureAttempt > 0 ? await measureWordPages(key.source.file) : undefined;
        const items = await partLabels(key.source.file, wordUnit, layout);
        if (active) setInspection({ ...key, labels: items, layout, error: items.length ? undefined : 'Tệp chưa có nội dung để tách.' });
      } catch (reason) {
        if (active) setInspection({
          ...key, labels: [], error: reason instanceof Error ? reason.message : 'Không đọc được tệp.',
          canMeasure: wordPages && (measureAttempt > 0 || (reason instanceof Error && reason.name === 'WordPaginationError')),
        });
      }
    }
    void inspect();
    return () => { active = false; };
  }, [source, merging, wordPages, wordUnit, measureAttempt]);

  function clearResult() {
    setResult(undefined);
    setError('');
  }

  function addFiles(files: File[]) {
    if (running || !files.length) return;
    try {
      const format = merging && queue.length ? partsFormat(queue[0].file) : partsFormat(files[0]);
      if (!merging && files.length > 1) throw new Error('Chọn một tệp nguồn cho mỗi lần tách.');
      for (const file of files) {
        if (!file.size) throw new Error(`Tệp trống: ${file.name}`);
        if (partsFormat(file) !== format) throw new Error('Các tệp cần gộp phải cùng định dạng.');
      }
      const additions = files.map((file) => ({ id: ++sequence.current, file }));
      clearResult();
      if (merging) setQueue([...queue, ...additions]);
      else {
        setMeasureAttempt(0);
        setRanges('');
        setSource(additions[0]);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không đọc được tệp.'); }
  }

  function move(index: number, offset: number) {
    const next = queue.slice();
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setQueue(next);
    clearResult();
  }

  async function run() {
    if (running) return;
    setRunning(true);
    clearResult();
    try {
      if (merging) setResult(await mergeFiles(queue.map((item) => item.file)));
      else if (source && current) setResult(await splitFile(source.file, each ? labels.map((_, index) => [index]) : partRanges(ranges, labels.length), wordUnit, current.layout));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không xử lý được tệp.'); }
    finally { setRunning(false); }
  }

  const canRun = merging ? queue.length >= 2 : source && !reading && labels.length > 0 && (each || ranges.trim());
  return <dialog ref={dialog} className="conversion-dialog parts-dialog" aria-labelledby="parts-title" onCancel={(event) => { event.preventDefault(); if (!running) onClose(); }}>
    <header className="conversion-header">
      <div className="conversion-heading"><Files size={32} aria-hidden="true" /><div><h2 id="parts-title">Gộp và tách tệp</h2><p>PDF · Word (.docx) · Excel (.xlsx) · PowerPoint (.pptx)</p></div></div>
      <button className="icon-btn" aria-label="Đóng" disabled={running} onClick={onClose}><X size={20} /></button>
    </header>
    <div className="conversion-body">
      <div className="parts-modes" role="group" aria-label="Thao tác">
        {(['merge', 'split'] as const).map((value) => <button key={value} className="btn" aria-pressed={value === mode} disabled={running} onClick={() => { if (mode !== value) { setMode(value); clearResult(); } }}>{value === 'merge' ? 'Gộp tệp' : 'Tách tệp'}</button>)}
      </div>
      <div className="conversion-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}>
        <FilePlus2 size={26} aria-hidden="true" />
        <strong>{merging ? 'Chọn các tệp cùng định dạng theo thứ tự cần gộp' : 'Chọn một tệp để tách'}</strong>
        <button className="btn" disabled={running} onClick={() => input.current?.click()}>{!merging && source ? 'Đổi tệp nguồn' : 'Chọn tệp'}</button>
        <input ref={input} type="file" hidden multiple={merging} accept={merging && selectedFormat ? '.' + selectedFormat : partsAccept} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      </div>
      <ol className="conversion-queue">
        {selected.map(({ id, file }, index) => <li key={id} className="conversion-item parts-file">
          <div className="conversion-file"><strong data-no-translate>{index + 1}. {file.name}</strong><span>{formatBytes(file.size)}</span></div>
          <div className="conversion-item-actions">
            {merging && <><button className="icon-btn" title="Đưa lên" aria-label={`Đưa lên: ${file.name}`} disabled={running || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
            <button className="icon-btn" title="Đưa xuống" aria-label={`Đưa xuống: ${file.name}`} disabled={running || index === queue.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button></>}
            <button className="icon-btn" aria-label={`Bỏ ${file.name}`} disabled={running} onClick={() => { if (merging) setQueue(queue.filter((item) => item.id !== id)); else setSource(undefined); clearResult(); }}><Trash2 size={16} /></button>
          </div>
        </li>)}
      </ol>
      {!merging && source && selectedFormat && <>
        {selectedFormat === 'docx' && <div className="parts-split"><label className="field"><span className="field-label">Tách tài liệu Word theo</span>
          <select className="text-field" value={wordUnit} disabled={running} onChange={(event) => {
            setWordUnit(event.target.value as WordSplitUnit); setMeasureAttempt(0); setRanges(''); clearResult();
          }}>
            <option value="pages">Số trang</option><option value="blocks">Đoạn văn và bảng</option>
          </select>
        </label></div>}
        {reading && <p role="status">{wordPages && measureAttempt ? 'Microsoft Word đang phân trang…' : 'Đang đọc nội dung tệp…'}</p>}
        {current?.error && <p role="alert" className="conversion-error">{current.error}</p>}
        {wordPages && canMeasureWordPages() && current && !current.layout && (current.canMeasure || labels.length > 0) &&
          <button type="button" className="btn" disabled={running} onClick={() => { clearResult(); setMeasureAttempt(n => n + 1); }}>Đọc lại số trang bằng Microsoft Word</button>}
        {labels.length > 0 && <div className="parts-split">
          {wordPages && <p className="conversion-help">{current?.layout ? 'Dùng thứ tự trang in do Microsoft Word vừa xác định.' : 'Dùng thứ tự trang in đã lưu trong tệp Word.'}</p>}
          <details><summary>{wordPages ? 'Trang Word' : unitLabels[selectedFormat]} ({labels.length})</summary>
            <ol>{labels.map((label, index) => <li key={index} data-no-translate={(selectedFormat === 'docx' && !wordPages) || selectedFormat === 'xlsx' ? true : undefined}>{label}</li>)}</ol>
          </details>
          <label className="conversion-check"><input type="checkbox" checked={each} disabled={running} onChange={(event) => { setEach(event.target.checked); clearResult(); }} />{wordPages ? 'Tách mỗi trang thành một tệp Word riêng' : 'Tách mỗi mục thành một tệp riêng'}</label>
          {!each && <label className="field"><span className="field-label">{wordPages ? 'Khoảng trang cần tách' : 'Khoảng cần tách'}</span>
            <input className="text-field" placeholder="1-3, 4, 5-7" value={ranges} disabled={running} onChange={(event) => { setRanges(event.target.value); clearResult(); }} />
            <span className="conversion-help">Mỗi khoảng tạo một tệp. Nhiều tệp sẽ được tải cùng trong một tệp ZIP.</span>
          </label>}
        </div>}
      </>}
      {error && <p role="alert" className="conversion-error">{error}</p>}
    </div>
    <footer className="conversion-footer">
      <p role="status">{running ? 'Đang xử lý…' : result ? result.name : ''}</p>
      {result ? <button className="btn primary" onClick={() => downloadBlob(result.blob, result.name)}>Tải kết quả</button>
        : <button className="btn primary" disabled={running || !canRun} onClick={() => void run()}>{merging ? 'Gộp các tệp' : 'Tách thành tệp mới'}</button>}
    </footer>
  </dialog>;
}
