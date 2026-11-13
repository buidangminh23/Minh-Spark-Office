import { useEffect, useRef, useState } from 'react';
import { Files, Merge, Scissors, X } from 'lucide-react';
import { MergePanel } from './fileParts/MergePanel';
import { SplitPanel } from './fileParts/SplitPanel';
import { DonePanel } from './fileParts/DonePanel';
import type { DoneResult } from './fileParts/shared';
import './conversion.css';
import './fileParts/fileParts.css';

type Mode = 'merge' | 'split';

export function FilePartsDialog({ onClose, onOpenFile }: { onClose: () => void; onOpenFile?: (file: File) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>('merge');
  const [round, setRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DoneResult>();

  useEffect(() => { dialog.current?.showModal(); }, []);

  function switchMode(value: Mode) {
    if (running || value === mode) return;
    setMode(value);
    setResult(undefined);
  }

  function again() {
    setResult(undefined);
    setRound((n) => n + 1);
  }

  const panelProps = { running, setRunning, onDone: setResult, onCancel: onClose };
  return <dialog ref={dialog} className="conversion-dialog fp-dialog" aria-labelledby="parts-title" onCancel={(event) => { event.preventDefault(); if (!running) onClose(); }}>
    <header className="fp-header">
      <div className="fp-heading">
        <span className="fp-heading-icon"><Files size={22} aria-hidden="true" /></span>
        <div><h2 id="parts-title">Gộp và tách tệp</h2><p>Xử lý ngay trên máy, tệp không gửi lên mạng</p></div>
      </div>
      <div className="fp-tabs" role="tablist" aria-label="Thao tác">
        {(['merge', 'split'] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={mode === value} disabled={running} onClick={() => switchMode(value)}>{value === 'merge' ? <><Merge size={18} aria-hidden="true" />Gộp tệp</> : <><Scissors size={18} aria-hidden="true" />Tách tệp</>}</button>)}
      </div>
      <button type="button" className="icon-btn" aria-label="Đóng" disabled={running} onClick={onClose}><X size={20} /></button>
    </header>
    {result ? <DonePanel result={result} onOpenFile={onOpenFile} onAgain={again} onClose={onClose} />
      : mode === 'merge' ? <MergePanel key={`merge-${round}`} {...panelProps} />
        : <SplitPanel key={`split-${round}`} {...panelProps} />}
  </dialog>;
}
