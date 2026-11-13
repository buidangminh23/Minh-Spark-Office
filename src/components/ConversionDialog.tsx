import { useEffect, useRef, useState } from 'react';
import { Download, FilePlus2, Trash2, X } from 'lucide-react';
import { CONVERSION_ACCEPT, MAX_CONVERSION_BATCH_BYTES, MAX_CONVERSION_BYTES, MAX_CONVERSION_FILES, conversionTargets, conversionZip, convertFile } from '../lib/fileConversion';
import type { ConversionOptions, ConversionResult } from '../lib/conversionTypes';
import { downloadBlob, formatBytes } from '../lib/download';
import { presetAccept, presetAcceptsFile, presetSourceLabel, type ConversionPreset } from '../lib/conversionPresets';
import { ConvertLogo } from './ConvertLogo';
import { ConversionPair } from './ConversionPicker';
import './conversion.css';

type QueueItem = { id: number; file: File; target: string; status: 'ready' | 'running' | 'done' | 'error'; message?: string; result?: ConversionResult };

export function ConversionDialog({ preset, onClose }: { preset?: ConversionPreset; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [packing, setPacking] = useState(false);
  const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [fidelity, setFidelity] = useState<ConversionOptions['fidelity']>('layout');
  const [ocr, setOcr] = useState(true);
  const locked = running || packing;
  const showScanOptions = !preset || ((preset.from === 'pdf' || preset.from === 'image') && !['png', 'jpg', 'webp'].includes(preset.target));

  useEffect(() => {
    mounted.current = true;
    dialog.current?.showModal();
    return () => { mounted.current = false; controller.current?.abort(); void import('../lib/conversionOcr').then((module) => module.releaseConversionOcr()); };
  }, []);

  const addFiles = (files: File[]) => {
    if (locked) return;
    const added: QueueItem[] = [];
    const rejected: string[] = [];
    let size = queue.reduce((total, item) => total + item.file.size, 0);
    for (const file of files) {
      const targets = conversionTargets(file.name);
      if (preset && !presetAcceptsFile(preset, file.name)) { rejected.push(`${file.name}: không phải tệp ${presetSourceLabel(preset)}`); continue; }
      if (!targets.length) { rejected.push(`${file.name}: chưa hỗ trợ định dạng nguồn này`); continue; }
      if (!file.size || file.size > MAX_CONVERSION_BYTES) { rejected.push(`${file.name}: tệp phải có nội dung và không vượt quá 100 MB`); continue; }
      if (queue.length + added.length >= MAX_CONVERSION_FILES || size + file.size > MAX_CONVERSION_BATCH_BYTES) { rejected.push('Mỗi lượt tối đa 20 tệp, tổng dung lượng 200 MB'); break; }
      size += file.size;
      const target = targets.find((format) => format.id === preset?.target) ?? targets.find((format) => format.id === 'pdf') ?? targets[0];
      added.push({ id: ++sequence.current, file, target: target.id, status: 'ready' });
    }
    setQueue((items) => [...items, ...added]);
    setNotice(rejected.join('. '));
  };

  const update = (id: number, patch: Partial<QueueItem>) => {
    if (mounted.current) setQueue((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const run = async () => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setNotice('');
    try {
      const pending = queue.filter((item) => item.status !== 'done');
      let outputBytes = queue.reduce((sum, item) => sum + (item.result?.files.reduce((size, file) => size + file.blob.size, 0) ?? 0), 0);
      for (const [index, item] of pending.entries()) {
        if (abort.signal.aborted) break;
        update(item.id, { status: 'running', message: undefined, result: undefined });
        setProgress(`Tệp ${index + 1}/${pending.length}: ${item.file.name}`);
        try {
          const result = await convertFile(item.file, item.target, { fidelity, ocr, signal: abort.signal, onProgress: (message) => { if (mounted.current) setProgress(`Tệp ${index + 1}/${pending.length} · ${message}`); } });
          const resultBytes = result.files.reduce((sum, file) => sum + file.blob.size, 0);
          if (outputBytes + resultBytes > MAX_CONVERSION_BATCH_BYTES) throw new Error('Tổng kết quả vượt 200 MB. Tải các tệp đã hoàn thành, bỏ chúng khỏi danh sách rồi chạy tiếp.');
          outputBytes += resultBytes;
          update(item.id, { status: 'done', result });
        } catch (error) {
          update(item.id, { status: abort.signal.aborted ? 'ready' : 'error', message: abort.signal.aborted ? 'Đã dừng chuyển đổi' : error instanceof Error ? error.message : 'Không chuyển đổi được tệp này.' });
        }
      }
    } finally {
      controller.current = null;
      if (mounted.current) { setRunning(false); setProgress(abort.signal.aborted ? 'Đã dừng. Các kết quả đã hoàn thành vẫn được giữ lại.' : 'Đã xử lý xong lượt chuyển đổi.'); }
    }
  };

  const download = async (result: ConversionResult, name: string) => {
    setPacking(true);
    try {
      if (result.files.length === 1) downloadBlob(result.files[0].blob, result.files[0].name);
      else downloadBlob(await conversionZip(result.files), `${name.replace(/\.[^.]+$/, '')} - chuyen-doi.zip`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không đóng gói được kết quả.'); }
    finally { if (mounted.current) setPacking(false); }
  };

  const invalidate = () => setQueue((items) => items.map((item) => ({ ...item, status: 'ready', result: undefined, message: undefined })));
  const results = queue.flatMap((item) => item.result?.files ?? []);

  return <dialog ref={dialog} className="conversion-dialog" aria-labelledby="conversion-title" onCancel={(event) => { event.preventDefault(); if (!locked) onClose(); }}>
    <header className="conversion-header">
      <div className="conversion-heading">
        {preset ? <ConversionPair preset={preset} size={40} /> : <ConvertLogo size={44} />}
        <div><h2 id="conversion-title">{preset ? preset.title : 'Chuyển đổi định dạng'}</h2><p>{preset ? `Chọn tệp ${presetSourceLabel(preset)} để chuyển đổi, xử lý ngay trên thiết bị.` : 'Word, Excel, PowerPoint, PDF và ảnh, xử lý ngay trên thiết bị.'}</p></div>
      </div>
      <button className="icon-btn" aria-label="Đóng chuyển đổi" disabled={locked} onClick={onClose}><X size={20} /></button>
    </header>
    <div className="conversion-body">
      <div className="conversion-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}>
        <FilePlus2 size={30} aria-hidden="true" /><strong>{preset ? `Kéo tệp ${presetSourceLabel(preset)} vào đây hoặc chọn từ máy` : 'Kéo tệp vào đây hoặc chọn từ máy'}</strong>
        <span>Tối đa 20 tệp · Office 50 MB/tệp · PDF/ảnh 100 MB/tệp · 200 MB/lượt</span>
        <button className="btn primary" disabled={locked} onClick={() => input.current?.click()}>Chọn tệp</button>
        <input ref={input} hidden multiple type="file" accept={preset ? presetAccept(preset) : CONVERSION_ACCEPT} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      </div>
      {showScanOptions && <>
      <div className="conversion-options">
        <label className="field"><span className="field-label">Ưu tiên chuyển đổi</span><select className="text-field" value={fidelity} disabled={locked} onChange={(event) => { setFidelity(event.target.value as ConversionOptions['fidelity']); invalidate(); }}><option value="layout">Giữ bố cục trang</option><option value="editable">Nội dung có thể chỉnh sửa</option></select></label>
        <label className="conversion-check"><input type="checkbox" checked={ocr} disabled={locked} onChange={(event) => { setOcr(event.target.checked); invalidate(); }} /><span>OCR tiếng Việt và tiếng Anh cho ảnh, PDF quét</span></label>
      </div>
      <p className="conversion-help">PDF → Word/PowerPoint ở chế độ giữ bố cục dùng ảnh từng trang. Chế độ chỉnh sửa lấy chữ và bảng; bố cục có thể thay đổi. OCR có thể nhận sai chữ hoặc số, cần đối chiếu với bản gốc. Công thức và định dạng chỉ được giữ khi cặp định dạng hỗ trợ.</p>
      </>}
      {notice && <p role="alert" className="conversion-error">{notice}</p>}
      <ul className="conversion-queue" aria-label="Danh sách chuyển đổi">
        {queue.map((item) => {
          const targets = conversionTargets(item.file.name);
          const selected = targets.find((target) => target.id === item.target);
          return <li key={item.id} className="conversion-item">
            <div className="conversion-file"><strong title={item.file.name}>{item.file.name}</strong><span>{formatBytes(item.file.size)} · {item.status === 'done' ? 'Hoàn thành' : item.status === 'running' ? 'Đang xử lý' : item.status === 'error' ? 'Chưa chuyển đổi được' : 'Sẵn sàng'}</span></div>
            <label className="conversion-format"><span>Chuyển sang</span><select className="text-field" aria-label={`Định dạng đầu ra cho ${item.file.name}`} value={item.target} disabled={locked} onChange={(event) => update(item.id, { target: event.target.value, status: 'ready', result: undefined, message: undefined })}>{targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label>
            <div className="conversion-item-actions">{item.result && <button className="btn" disabled={locked} onClick={() => void download(item.result!, item.file.name)}><Download size={16} />Tải xuống</button>}<button className="icon-btn" disabled={locked} aria-label={`Bỏ ${item.file.name}`} onClick={() => setQueue((items) => items.filter((entry) => entry.id !== item.id))}><Trash2 size={17} /></button></div>
            <p className="conversion-description">{selected?.description}</p>
            {item.message && <p className="conversion-error" role="alert">{item.message}</p>}
            {item.result?.warnings.map((warning, index) => <p key={index} className="conversion-warning">{warning}</p>)}
          </li>;
        })}
      </ul>
    </div>
    <footer className="conversion-footer">
      <p role="status" aria-live="polite">{packing ? 'Đang đóng gói tệp…' : progress || `${queue.length} tệp đã chọn`}</p>
      {running ? <button className="btn" onClick={() => { controller.current?.abort(); setProgress('Đang dừng…'); }}>Dừng chuyển đổi</button> : <div>{results.length > 0 && <button className="btn" disabled={locked} onClick={() => void download({ files: results, warnings: [] }, 'Office 23.zip')}><Download size={16} />Tải tất cả</button>}<button className="btn primary" disabled={locked || !queue.some((item) => item.status !== 'done')} onClick={() => void run()}>Chuyển đổi</button></div>}
    </footer>
  </dialog>;
}
