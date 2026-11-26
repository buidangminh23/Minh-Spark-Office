import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, RotateCcw, X, XCircle } from 'lucide-react';
import { drillsForTrack } from '../../lib/mos/drills';
import { trackMeta, versionMeta } from '../../lib/mos/grader';
import type { MosDrillMode, MosDrillSummary, MosLevel, MosTrackId, MosVersion } from '../../lib/mos/types';

const TIMED_DRILL_SEC = 5 * 60;
const KEYS = ['A', 'B', 'C', 'D'] as const;

export function MosDrillModal({
  track,
  version,
  level,
  initialMode,
  onClose,
  onComplete,
}: {
  track: MosTrackId;
  version?: MosVersion;
  level: MosLevel;
  initialMode: MosDrillMode;
  onClose: () => void;
  onComplete: (summary: MosDrillSummary) => void;
}) {
  const meta = trackMeta(track);
  const verInfo = version ? versionMeta(version) : null;
  const questions = drillsForTrack(track, level, version);
  const [mode, setMode] = useState<MosDrillMode>(initialMode);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [remaining, setRemaining] = useState(TIMED_DRILL_SEC);

  const current = questions[index];
  const selected = current ? answers[current.id] : undefined;

  useEffect(() => {
    if (mode !== 'timed' || finished) return;
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, finished]);

  const pickOption = (optIndex: number) => {
    if (!current || finished) return;
    if (mode === 'practice' && revealed) return;
    const next = { ...answers, [current.id]: optIndex };
    setAnswers(next);
    if (mode === 'practice') setRevealed(true);
  };

  const handleNext = () => {
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
      setRevealed(false);
      return;
    }
    const correct = questions.reduce((sum, q) => sum + (answers[q.id] === q.answerIndex ? 1 : 0), 0);
    setFinished(true);
    onComplete({ track, mode, correct, total: questions.length, completedAt: 0 });
  };

  const restart = (nextMode: MosDrillMode) => {
    setMode(nextMode);
    setIndex(0);
    setAnswers({});
    setRevealed(false);
    setFinished(false);
    setRemaining(TIMED_DRILL_SEC);
  };

  const correctCount = questions.reduce((sum, q) => sum + (answers[q.id] === q.answerIndex ? 1 : 0), 0);
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="mos-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="mos-modal" role="dialog" aria-modal="true" aria-label={`Trắc nghiệm nhanh ${meta.title}`}>
        <header className="mos-modal-head">
          <h2>Trắc nghiệm Ribbon & Phím tắt · {meta.title} ({verInfo ? `${verInfo.short} · ` : ''}{level === 'expert' ? 'Expert' : 'Associate'})</h2>
          <button type="button" className="mos-modal-close" aria-label="Đóng trắc nghiệm" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="mos-modal-body">
          <div className="mos-panel-head">
            <div className="mos-seg" role="tablist" aria-label="Chế độ trắc nghiệm">
              <button type="button" role="tab" aria-selected={mode === 'practice'} className={mode === 'practice' ? 'is-active' : ''} onClick={() => restart('practice')}>
                Giải thích ngay
              </button>
              <button type="button" role="tab" aria-selected={mode === 'timed'} className={mode === 'timed' ? 'is-active' : ''} onClick={() => restart('timed')}>
                Thi bấm giờ 5 phút
              </button>
            </div>
            {mode === 'timed' && !finished ? (
              <span className={`mos-compass-timer ${remaining < 60 ? 'is-urgent' : ''}`}>
                <Clock size={14} /> {mm}:{ss}
              </span>
            ) : (
              <span>Câu {Math.min(index + 1, questions.length)}/{questions.length}</span>
            )}
          </div>

          {!finished && current ? (
            <>
              <p className="mos-drill-q">{index + 1}. {current.prompt}</p>
              <div className="mos-drill-options">
                {current.options.map((opt, idx) => {
                  const isSelected = selected === idx;
                  const showResult = mode === 'practice' && revealed;
                  const cls = [
                    'mos-drill-opt',
                    showResult && idx === current.answerIndex ? 'is-correct' : '',
                    showResult && isSelected && idx !== current.answerIndex ? 'is-wrong' : '',
                    !showResult && isSelected ? 'is-selected' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <button key={opt} type="button" className={cls} onClick={() => pickOption(idx)}>
                      <span className="mos-drill-key">{KEYS[idx]}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {mode === 'practice' && revealed && (
                <div className="mos-drill-explain">
                  <strong>{selected === current.answerIndex ? 'Chính xác.' : `Đáp án đúng: ${KEYS[current.answerIndex]}.`}</strong> {current.explanation}
                </div>
              )}
            </>
          ) : (
            <div className="mos-audit-list">
              <div className={`mos-report-banner ${correctCount >= Math.ceil(questions.length * 0.7) ? 'is-pass' : 'is-fail'}`}>
                <div className="mos-report-verdict">
                  <div className="mos-verdict-icon">
                    {correctCount >= Math.ceil(questions.length * 0.7) ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                  </div>
                  <div>
                    <h3>Hoàn thành {correctCount}/{questions.length} câu đúng</h3>
                    <p>Tỷ lệ chính xác {Math.round((correctCount / questions.length) * 100)}% · Chế độ {mode === 'timed' ? 'Thi bấm giờ' : 'Giải thích ngay'}</p>
                  </div>
                </div>
              </div>
              <div className="mos-audit-proj">
                {questions.map((q, idx) => {
                  const ok = answers[q.id] === q.answerIndex;
                  return (
                    <div key={q.id} className="mos-audit-row">
                      {ok
                        ? <CheckCircle2 size={17} color="#16a34a" style={{ flex: 'none', marginTop: 2 }} />
                        : <XCircle size={17} color="#dc2626" style={{ flex: 'none', marginTop: 2 }} />}
                      <div>
                        <strong>Câu {idx + 1}: {q.prompt}</strong>
                        <span>Đáp án {KEYS[q.answerIndex]}: {q.options[q.answerIndex]} — {q.explanation}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="mos-modal-foot">
          {!finished ? (
            <>
              <button type="button" className="mos-btn" disabled={index === 0} onClick={() => { setIndex((i) => Math.max(0, i - 1)); setRevealed(false); }}>
                Câu trước
              </button>
              <button type="button" className="mos-btn mos-btn-primary" disabled={selected === undefined} onClick={handleNext}>
                {index + 1 < questions.length ? <>Câu tiếp theo <ArrowRight size={14} /></> : 'Nộp bài trắc nghiệm'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="mos-btn" onClick={() => restart(mode)}>
                <RotateCcw size={14} /> Làm lại
              </button>
              <button type="button" className="mos-btn mos-btn-primary" onClick={onClose}>
                Hoàn tất
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
