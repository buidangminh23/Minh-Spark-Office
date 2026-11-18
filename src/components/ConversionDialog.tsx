import { useEffect, useRef, useState } from 'react';
import { Check, Download, FilePlus2, Info, LayoutTemplate, TextCursorInput, Trash2, X } from 'lucide-react';
import { CONVERSION_ACCEPT, MAX_CONVERSION_BATCH_BYTES, MAX_CONVERSION_BYTES, MAX_CONVERSION_FILES, conversionTargets, conversionZip, convertFile } from '../lib/fileConversion';
import type { ConversionOptions, ConversionResult } from '../lib/conversionTypes';
import { downloadBlob, formatBytes } from '../lib/download';
import { conversionOutputGroups, presetAccept, presetAcceptsFile, presetInitialFidelity, presetSampleName, presetSourceLabel, type ConversionPreset } from '../lib/conversionPresets';
import { conversionGuide } from '../lib/conversionGuide';
import { openOfficeLayoutSession } from '../lib/officeLayoutSession';
import { mediaConversionTargets } from '../lib/mediaConversionFormats';
import { isDesktop } from '../lib/desktop';
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
  const [dragging, setDragging] = useState(false);
  const [fidelity, setFidelity] = useState<ConversionOptions['fidelity']>(() => presetInitialFidelity(preset));
  const [ocr, setOcr] = useState(true);
  const locked = running || packing;
  const presetName = preset && presetSampleName(preset);
  const guides = queue.length ? queue.map((item) => conversionGuide(item.file.name, item.target, fidelity, ocr))
    : preset && presetName ? [conversionGuide(presetName, preset.target, fidelity, ocr)] : [];
  const showMode = guides.some((guide) => guide.mode);
  const showOcr = guides.some((guide) => guide.usesOcr);
  const officeWindow = guides.some((guide) => guide.needsEngine);
  const visualOnly = guides.filter((guide) => guide.mode).every((guide) => guide.visual);
  const presetDescription = !queue.length && preset && presetName
    ? guides[0]?.description ?? conversionTargets(presetName).find((format) => format.id === preset.target)?.description : undefined;

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
      if (preset && !targets.some(format => format.id === preset.target)) { rejected.push(`${file.name}: chưa hỗ trợ định dạng đầu ra đã chọn`); continue; }
      if (!targets.length) { rejected.push(`${file.name}: chưa hỗ trợ định dạng nguồn này`); continue; }
      const maxBytes = mediaConversionTargets(file.name).length ? MAX_CONVERSION_BYTES : 50 * 1024 * 1024;
      if (!file.size || file.size > maxBytes) { rejected.push(`${file.name}: tệp phải có nội dung và không vượt quá ${maxBytes / 1024 / 1024} MB`); continue; }
      if (queue.length + added.length >= MAX_CONVERSION_FILES || size + file.size > MAX_CONVERSION_BATCH_BYTES) { rejected.push('Mỗi lượt tối đa 20 tệp, tổng dung lượng 200 MB'); break; }
      size += file.size;
      const target = targets.find((format) => format.id === preset?.target) ?? targets.find((format) => format.id === 'pdf') ?? targets[0];
      added.push({ id: ++sequence.current, file, target: target.id, status: 'ready' });
    }
    setQueue((items) => [...items, ...added]);
    if (added.length) setProgress('');
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
    let layoutSession: ReturnType<typeof openOfficeLayoutSession> | undefined;
    let layoutFailure: Error | undefined;
    try {
      const pending = queue.filter((item) => item.status !== 'done');
      if (pending.some((item) => conversionGuide(item.file.name, item.target, fidelity, ocr).needsEngine)) {
        try { layoutSession = openOfficeLayoutSession(); }
        catch (error) { layoutFailure = error instanceof Error ? error : new Error('Không mở được cửa sổ dàn trang.'); }
      }
      let outputBytes = queue.reduce((sum, item) => sum + (item.result?.files.reduce((size, file) => size + file.blob.size, 0) ?? 0), 0);
      for (const [index, item] of pending.entries()) {
        if (abort.signal.aborted) break;
        update(item.id, { status: 'running', message: undefined, result: undefined });
        setProgress(`Tệp ${index + 1}/${pending.length}: ${item.file.name}`);
        try {
          if (layoutFailure && conversionGuide(item.file.name, item.target, fidelity, ocr).needsEngine) throw layoutFailure;
          const result = await convertFile(item.file, item.target, { fidelity, ocr, layoutSession, signal: abort.signal, onProgress: (message) => { if (mounted.current) setProgress(`Tệp ${index + 1}/${pending.length} · ${message}`); } });
          const resultBytes = result.files.reduce((sum, file) => sum + file.blob.size, 0);
          if (outputBytes + resultBytes > MAX_CONVERSION_BATCH_BYTES) throw new Error('Tổng kết quả vượt 200 MB. Tải các tệp đã hoàn thành, bỏ chúng khỏi danh sách rồi chạy tiếp.');
          outputBytes += resultBytes;
          update(item.id, { status: 'done', result });
        } catch (error) {
          update(item.id, { status: abort.signal.aborted ? 'ready' : 'error', message: abort.signal.aborted ? 'Đã dừng chuyển đổi' : error instanceof Error ? error.message : 'Không chuyển đổi được tệp này.' });
        }
      }
      if (mounted.current) setProgress(abort.signal.aborted ? 'Đã dừng. Các kết quả đã hoàn thành vẫn được giữ lại.' : 'Đã xử lý xong lượt chuyển đổi.');
    } catch (error) {
      if (mounted.current) { setNotice(error instanceof Error ? error.message : 'Không mở được cửa sổ dàn trang.'); setProgress(''); }
    } finally {
      layoutSession?.close();
      controller.current = null;
      if (mounted.current) setRunning(false);
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

  const invalidate = (setting: 'mode' | 'usesOcr') => {
    setProgress('');
    setQueue((items) => items.map((item) => conversionGuide(item.file.name, item.target, fidelity, ocr)[setting]
      ? { ...item, status: 'ready', result: undefined, message: undefined } : item));
  };
  const results = queue.flatMap((item) => item.result?.files ?? []);

  return <dialog ref={dialog} className="conversion-dialog" aria-labelledby="conversion-title"
    onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); }}
    onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); if (!locked && event.dataTransfer.types.includes('Files')) setDragging(true); }}
    onDragLeave={(event) => { event.stopPropagation(); if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}
    onCancel={(event) => { event.preventDefault(); if (!locked) onClose(); }}>
    <header className="conversion-header">
      <div className="conversion-heading">
        {preset ? <ConversionPair preset={preset} size={40} /> : <ConvertLogo size={44} />}
        <div><h2 id="conversion-title">{preset ? preset.title : 'Chuyển đổi định dạng'}</h2><p>{preset ? `Chọn tệp ${presetSourceLabel(preset)} để chuyển đổi, xử lý ngay trên thiết bị.` : 'Word, Excel, PowerPoint, PDF và ảnh, xử lý ngay trên thiết bị.'}</p></div>
      </div>
      <button className="icon-btn" aria-label="Đóng chuyển đổi" disabled={locked} onClick={onClose}><X size={20} /></button>
    </header>
    <div className="conversion-body">
      <div className={`conversion-drop conversion-upload${dragging ? ' is-dragging' : ''}`}>
        <div className="conversion-upload-icon"><FilePlus2 size={26} aria-hidden="true" /></div>
        <div className="conversion-upload-text"><strong>{preset ? `Kéo tệp ${presetSourceLabel(preset)} vào đây` : 'Kéo tệp vào đây'}</strong>
        <span>Tối đa 20 tệp · Office 50 MB/tệp · PDF/ảnh 100 MB/tệp · 200 MB/lượt</span></div>
        <button className="btn" disabled={locked} onClick={() => input.current?.click()}>Chọn tệp</button>
        <input ref={input} hidden multiple type="file" accept={preset ? presetAccept(preset) : CONVERSION_ACCEPT} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      </div>
      {showMode && <fieldset className="conversion-fidelity" disabled={locked}>
        <legend>Ưu tiên chuyển đổi</legend>
        <div className="conversion-mode-grid">
          <label className="conversion-mode"><input type="radio" name="conversion-mode" checked={fidelity === 'layout'} onChange={() => { invalidate('mode'); setFidelity('layout'); }} />
            <LayoutTemplate aria-hidden="true" size={20} /><strong>Giữ bố cục trang</strong><span className="conversion-radio"><Check size={12} /></span>
            <small>Ưu tiên vị trí chữ, bảng, ảnh và hình dạng biểu mẫu.</small></label>
          <label className="conversion-mode"><input type="radio" name="conversion-mode" checked={fidelity === 'editable'} onChange={() => { invalidate('mode'); setFidelity('editable'); }} />
            <TextCursorInput aria-hidden="true" size={20} /><strong>{visualOnly ? 'Dàn lại nội dung' : 'Ưu tiên nội dung'}</strong><span className="conversion-radio"><Check size={12} /></span>
            <small>{visualOnly ? 'Sắp xếp nội dung theo khổ trang mới.' : 'Trích chữ và dữ liệu theo khả năng của định dạng đích.'}</small></label>
        </div>
      </fieldset>}
      {officeWindow && <p className="conversion-note"><Info size={16} aria-hidden="true" /><span>{isDesktop() ? 'Cửa sổ dàn trang sẽ mở trong lúc chuyển đổi.' : 'Cửa sổ dàn trang sẽ mở trong lúc chuyển đổi. Trình duyệt tải bộ dàn trang khoảng 74 MiB ở lần đầu.'}</span></p>}
      {showOcr && <label className="conversion-check conversion-ocr"><input type="checkbox" checked={ocr} disabled={locked} onChange={(event) => { invalidate('usesOcr'); setOcr(event.target.checked); }} /><span><strong>Nhận dạng chữ (OCR)</strong><small>Đọc chữ tiếng Việt và tiếng Anh trên ảnh hoặc trang quét. Hãy đối chiếu số liệu sau khi chuyển.</small></span></label>}
      {presetDescription && <p className="conversion-note"><Info size={16} aria-hidden="true" /><span>{presetDescription}</span></p>}
      {notice && <p role="alert" className="conversion-error">{notice}</p>}
      <ul className="conversion-queue" aria-label="Danh sách chuyển đổi">
        {queue.map((item) => {
          const targets = conversionTargets(item.file.name);
          const formats = new Map(targets.map(target => [target.id, target]));
          const selected = formats.get(item.target);
          return <li key={item.id} className="conversion-item">
            <div className="conversion-file"><strong title={item.file.name}>{item.file.name}</strong><span>{formatBytes(item.file.size)} · {item.status === 'done' ? 'Hoàn thành' : item.status === 'running' ? 'Đang xử lý' : item.status === 'error' ? 'Chưa chuyển đổi được' : 'Sẵn sàng'}</span></div>
            <label className="conversion-format"><span>Chuyển sang</span><select className="text-field" aria-label={`Định dạng đầu ra cho ${item.file.name}`} value={item.target} disabled={locked} onChange={(event) => { setProgress(''); update(item.id, { target: event.target.value, status: 'ready', result: undefined, message: undefined }); }}>
              {conversionOutputGroups(item.file.name.split('.').pop()!.toLowerCase()).map(group => <optgroup key={group.kind} label={group.label}>
                {group.extensions.map(ext => <option key={ext} value={ext}>{formats.get(ext)?.label}</option>)}
              </optgroup>)}
            </select></label>
            <div className="conversion-item-actions">{item.result && <button className="btn" aria-label="Tải xuống" title="Tải xuống" disabled={locked} onClick={() => void download(item.result!, item.file.name)}><Download size={16} /><span>Tải xuống</span></button>}<button className="icon-btn" disabled={locked} aria-label={`Bỏ ${item.file.name}`} onClick={() => { setProgress(''); setQueue((items) => items.filter((entry) => entry.id !== item.id)); }}><Trash2 size={17} /></button></div>
            <p className="conversion-description">{conversionGuide(item.file.name, item.target, fidelity, ocr).description ?? selected?.description}</p>
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
