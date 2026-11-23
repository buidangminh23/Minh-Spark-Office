import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Printer,
  RotateCcw,
  Sparkles,
  Target,
  X,
  XCircle,
} from 'lucide-react';
import { MOS_MAX_SCORE, projectById, trackMeta } from '../../lib/mos/grader';
import { solutionForTask } from '../../lib/mos/solutions';
import type { MosAttemptRecord, MosProject } from '../../lib/mos/types';
import { MosSolutionCard } from './MosSolutionCard';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RING_R = 38;
const RING_C = 2 * Math.PI * RING_R;

export function MosScoreReport({
  attempt,
  customProjects,
  onClose,
  onRetryProject,
  onReviewFailed,
  onRetake,
}: {
  attempt: MosAttemptRecord;
  customProjects?: ReadonlyArray<MosProject>;
  onClose: () => void;
  onRetryProject: (projectId: string) => void;
  onReviewFailed?: (failedTaskIds: string[]) => void;
  onRetake: () => void;
}) {
  const track = trackMeta(attempt.track);
  const scorePct = Math.max(0, Math.min(100, (attempt.score / MOS_MAX_SCORE) * 100));
  const passPct = Math.max(0, Math.min(100, (attempt.passingScore / MOS_MAX_SCORE) * 100));
  const failedTaskIds = useMemo(
    () => attempt.projects.flatMap((p) => p.tasks.filter((t) => !t.passed).map((t) => t.taskId)),
    [attempt.projects],
  );

  const [displayScore, setDisplayScore] = useState(0);
  const [ringReady, setRingReady] = useState(false);
  const [openSolutions, setOpenSolutions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (failedTaskIds.length > 0) initial[failedTaskIds[0]] = true;
    return initial;
  });

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || attempt.score === 0) {
      const id = requestAnimationFrame(() => {
        setDisplayScore(attempt.score);
        setRingReady(true);
      });
      return () => cancelAnimationFrame(id);
    }
    const rafRing = requestAnimationFrame(() => setRingReady(true));
    const duration = 560;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(attempt.score * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRing);
      cancelAnimationFrame(frame);
    };
  }, [attempt.score]);

  const toggleSolution = (taskId: string) => {
    setOpenSolutions((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const allFailedOpen = failedTaskIds.length > 0 && failedTaskIds.every((id) => openSolutions[id]);

  const toggleAllFailed = () => {
    if (allFailedOpen) {
      setOpenSolutions({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const id of failedTaskIds) next[id] = true;
    setOpenSolutions(next);
  };

  const dashOffset = ringReady ? RING_C * (1 - scorePct / 100) : RING_C;

  return (
    <div className="mos-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="mos-modal mos-modal-lg mos-report-modal" role="dialog" aria-modal="true" aria-label="Phiếu điểm bài thi MOS">
        <header className="mos-modal-head">
          <h2>Phiếu điểm & Đáp án chi tiết · {track.title} ({attempt.examCode})</h2>
          <button type="button" className="mos-modal-close" aria-label="Đóng phiếu điểm" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="mos-modal-body">
          <div className={`mos-report-banner ${attempt.passed ? 'is-pass' : 'is-fail'}`}>
            {attempt.passed && (
              <div className="mos-celebrate-burst" aria-hidden="true">
                <span /><span /><span /><span /><span /><span />
              </div>
            )}
            <div className="mos-report-verdict">
              <div className="mos-verdict-icon" aria-hidden="true">
                {attempt.passed ? <Award size={26} /> : <XCircle size={26} />}
              </div>
              <div>
                <h3>
                  {attempt.passed ? (
                    <span className="mos-verdict-title-row">
                      <Sparkles size={18} /> ĐẠT CHUẨN CHỨNG CHỈ MOS
                    </span>
                  ) : 'CHƯA ĐẠT NGƯỠNG ĐIỂM CHUẨN'}
                </h3>
                <p>
                  {attempt.formatLabel} · MOS {attempt.version} · Hoàn thành {attempt.passedTasks}/{attempt.totalTasks} nhiệm vụ trong {formatDuration(attempt.durationSec)}
                </p>
              </div>
            </div>

            <div className="mos-report-score-wrap">
              <div className="mos-score-ring" aria-hidden="true">
                <svg viewBox="0 0 92 92" width="84" height="84">
                  <circle className="mos-ring-track" cx="46" cy="46" r={RING_R} />
                  <circle
                    className={`mos-ring-fill ${attempt.passed ? 'is-pass' : 'is-fail'}`}
                    cx="46"
                    cy="46"
                    r={RING_R}
                    strokeDasharray={RING_C}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className="mos-ring-center">
                  <strong>{displayScore}</strong>
                  <span>/ {MOS_MAX_SCORE}</span>
                </div>
              </div>
              <div className="mos-report-score-meta">
                <span>Chuẩn đạt</span>
                <strong>{attempt.passingScore} đ</strong>
              </div>
            </div>
          </div>

          <div className="mos-gauge" aria-label={`Điểm số ${attempt.score} trên ${MOS_MAX_SCORE}`}>
            <div className="mos-gauge-track">
              <div
                className={`mos-gauge-fill ${attempt.passed ? 'is-pass' : 'is-fail'}`}
                style={{ width: `${ringReady ? scorePct : 0}%` }}
              />
              <div className="mos-gauge-marker" style={{ left: `${passPct}%` }}>
                <span>Ngưỡng đạt {attempt.passingScore}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="mos-panel-head" style={{ marginBottom: 10 }}>
              <h3>Phân tích theo miền kỹ năng (Section Analysis)</h3>
              <span>{new Date(attempt.completedAt).toLocaleString('vi-VN')}</span>
            </div>
            <div className="mos-domain-list" style={{ ['--mos-accent' as string]: track.accent }}>
              {attempt.domains.map((domain) => (
                <div key={domain.domainId} className="mos-domain-row">
                  <div className="mos-domain-top">
                    <strong>{domain.code} · {domain.name}</strong>
                    <span>{domain.passedCount}/{domain.totalCount} ({domain.percent}%)</span>
                  </div>
                  <div className="mos-domain-bar">
                    <i style={{ width: `${ringReady ? domain.percent : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mos-panel-head" style={{ marginBottom: 10 }}>
              <h3>Chi tiết chấm tự động & Đáp án từng bước</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {failedTaskIds.length > 0 && (
                  <button type="button" className="mos-btn" onClick={toggleAllFailed}>
                    <BookOpenCheck size={14} /> {allFailedOpen ? 'Thu gọn đáp án' : `Mở đáp án ${failedTaskIds.length} câu sai`}
                  </button>
                )}
              </div>
            </div>
            <div className="mos-audit-list">
              {attempt.projects.map((project) => {
                const fullProject = projectById(project.projectId, customProjects);
                return (
                  <div key={project.projectId} className="mos-audit-proj">
                    <div className="mos-audit-proj-head">
                      <strong>{project.projectTitle} · {project.passedCount}/{project.totalCount} câu đạt</strong>
                      <button type="button" className="mos-btn" onClick={() => onRetryProject(project.projectId)}>
                        <RotateCcw size={14} /> Luyện lại dự án này
                      </button>
                    </div>
                    {project.tasks.map((task, idx) => {
                      const taskDef = fullProject?.tasks.find((t) => t.id === task.taskId);
                      const solution = taskDef ? solutionForTask(taskDef, fullProject) : null;
                      const isOpen = Boolean(openSolutions[task.taskId]);
                      return (
                        <div key={task.taskId} className={`mos-audit-item ${isOpen ? 'is-expanded' : ''}`}>
                          <div className="mos-audit-row">
                            {task.passed
                              ? <CheckCircle2 size={18} color="#16a34a" style={{ flex: 'none', marginTop: 2 }} />
                              : <XCircle size={18} color="#dc2626" style={{ flex: 'none', marginTop: 2 }} />}
                            <div className="mos-audit-row-main">
                              <strong>Câu {idx + 1}: {task.title}</strong>
                              <span>{task.detail}</span>
                            </div>
                            {solution && (
                              <button
                                type="button"
                                className={`mos-audit-sol-btn ${isOpen ? 'is-open' : ''}`}
                                aria-expanded={isOpen}
                                onClick={() => toggleSolution(task.taskId)}
                              >
                                <BookOpenCheck size={13} />
                                <span>{isOpen ? 'Ẩn đáp án' : 'Xem đáp án'}</span>
                                <ChevronDown size={14} className="mos-chevron" />
                              </button>
                            )}
                          </div>
                          {solution && (
                            <div className={`mos-accordion ${isOpen ? 'is-open' : ''}`}>
                              <div className="mos-accordion-inner">
                                <div className="mos-audit-sol-wrap">
                                  <MosSolutionCard solution={solution} compact />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="mos-modal-foot">
          <button type="button" className="mos-btn" onClick={() => window.print()}>
            <Printer size={15} /> In phiếu điểm
          </button>
          {failedTaskIds.length > 0 && onReviewFailed && (
            <button type="button" className="mos-btn" onClick={() => onReviewFailed(failedTaskIds)}>
              <Target size={15} /> Ôn ngay {failedTaskIds.length} câu vừa sai
            </button>
          )}
          <button type="button" className="mos-btn" onClick={onRetake}>
            <RotateCcw size={15} /> Thi lại bài này
          </button>
          <button type="button" className="mos-btn mos-btn-primary" onClick={onClose}>
            Về trang Ôn thi MOS
          </button>
        </footer>
      </section>
    </div>
  );
}
