import { useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, Keyboard, Navigation } from 'lucide-react';
import type { MosTaskSolution } from '../../lib/mos/types';

export function MosSolutionCard({
  solution,
  compact = false,
  onCopy,
}: {
  solution: MosTaskSolution;
  compact?: boolean;
  onCopy?: (value: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (value: string) => {
    setCopied(true);
    if (onCopy) {
      onCopy(value);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(value).catch(() => undefined);
    }
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`mos-sol-card ${compact ? 'is-compact' : ''}`}>
      <div className="mos-sol-meta">
        <span className="mos-sol-path">
          <Navigation size={12} /> {solution.ribbonPath}
        </span>
        {solution.shortcut && (
          <span className="mos-sol-shortcut">
            <Keyboard size={12} /> <kbd>{solution.shortcut}</kbd>
          </span>
        )}
      </div>

      <ol className="mos-sol-steps">
        {solution.steps.map((step, index) => (
          <li key={step} className="mos-sol-step">
            <span className="mos-sol-num">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {solution.formulaOrValue && (
        <div className="mos-sol-value-box">
          <div className="mos-sol-value-text">
            <span>Đáp án / Công thức chuẩn</span>
            <code>{solution.formulaOrValue}</code>
          </div>
          <button
            type="button"
            className={`mos-sol-copy-btn ${copied ? 'is-copied' : ''}`}
            onClick={() => handleCopy(solution.formulaOrValue!)}
          >
            {copied ? <><Check size={13} /> Đã chép</> : <><Copy size={13} /> Sao chép</>}
          </button>
        </div>
      )}

      {solution.examTrap && (
        <div className="mos-sol-trap">
          <AlertTriangle size={14} style={{ flex: 'none', marginTop: 2 }} />
          <div>
            <strong>Bẫy phòng thi MOS:</strong> {solution.examTrap}
          </div>
        </div>
      )}

      <div className="mos-sol-verify">
        <CheckCircle2 size={14} style={{ flex: 'none', marginTop: 2 }} />
        <span><strong>Tự kiểm tra:</strong> {solution.verifyTip}</span>
      </div>
    </div>
  );
}
