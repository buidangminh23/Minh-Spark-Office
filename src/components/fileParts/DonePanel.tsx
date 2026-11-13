import { useState } from 'react';
import { CheckCircle2, Download, ExternalLink, RotateCcw } from 'lucide-react';
import { downloadBlob, formatBytes } from '../../lib/download';
import { partFileName, zipParts } from '../../lib/fileParts';
import { colorAt, type DoneResult } from './shared';

type Props = { result: DoneResult; onOpenFile?: (file: File) => void; onAgain: () => void; onClose: () => void };

export function DonePanel({ result, onOpenFile, onAgain, onClose }: Props) {
  const [stems, setStems] = useState(() => result.parts.map((part) => part.stem));
  const [zipStem, setZipStem] = useState(result.zipStem);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState('');
  const many = result.parts.length > 1;
  const fileName = (index: number) => partFileName(stems[index], result.parts[index].extension);

  function open(index: number) {
    const part = result.parts[index];
    onOpenFile?.(new File([part.blob], fileName(index), { type: part.blob.type }));
    onClose();
  }

  async function saveAll() {
    setZipping(true);
    setError('');
    try {
      const archive = await zipParts(result.parts.map((part, index) => ({ blob: part.blob, name: fileName(index) })), zipStem);
      downloadBlob(archive.blob, archive.name);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tạo được tệp ZIP.'); }
    finally { setZipping(false); }
  }

  return <>
    <div className="fp-body fp-body-single">
      <div className="fp-done-head">
        <CheckCircle2 size={28} aria-hidden="true" />
        <div><strong>{result.title}</strong><span data-no-translate>{result.source}</span></div>
      </div>
      <p className="fp-hint">Đặt lại tên trước khi lưu. Phần đuôi tệp được giữ nguyên.</p>
      <ol className="fp-results">
        {result.parts.map((part, index) => <li key={index} style={{ '--fp-color': colorAt(index) } as React.CSSProperties}>
          <span className="fp-swatch">{index + 1}</span>
          <span className="fp-result-main">
            <span className="fp-name-box"><input value={stems[index]} aria-label={`Tên tệp ${index + 1}`} onChange={(event) => setStems((list) => list.map((stem, at) => at === index ? event.target.value : stem))} /><em>.{part.extension}</em></span>
            <span className="fp-output-meta">{`${part.pages} ${result.noun} · ${formatBytes(part.blob.size)}`}</span>
          </span>
          {onOpenFile && <button type="button" className="btn" onClick={() => open(index)}><ExternalLink size={16} aria-hidden="true" />Mở</button>}
          <button type="button" className="btn" onClick={() => downloadBlob(part.blob, fileName(index))}><Download size={16} aria-hidden="true" />Lưu</button>
        </li>)}
      </ol>
      {many && <label className="fp-field fp-zip"><span>Tên tệp ZIP</span>
        <span className="fp-name-box"><input value={zipStem} onChange={(event) => setZipStem(event.target.value)} aria-label="Tên tệp ZIP" /><em>.zip</em></span>
      </label>}
      {error && <p role="alert" className="conversion-error">{error}</p>}
    </div>
    <footer className="fp-footer">
      <button type="button" className="btn" onClick={onAgain}><RotateCcw size={16} aria-hidden="true" />{result.again}</button>
      <div>
        <button type="button" className="btn" onClick={onClose}>Xong</button>
        {many ? <button type="button" className="btn primary" disabled={zipping} onClick={() => void saveAll()}><Download size={16} aria-hidden="true" />{zipping ? 'Đang nén…' : `Lưu cả ${result.parts.length} tệp (.zip)`}</button>
          : <button type="button" className="btn primary" onClick={() => downloadBlob(result.parts[0].blob, fileName(0))}><Download size={16} aria-hidden="true" />Lưu tệp</button>}
      </div>
    </footer>
  </>;
}
