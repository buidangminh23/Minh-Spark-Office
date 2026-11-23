import { Award, CheckCircle2, Printer, RotateCcw, X, XCircle } from 'lucide-react';
import { MOS_MAX_SCORE, trackMeta } from '../../lib/mos/grader';
import type { MosAttemptRecord } from '../../lib/mos/types';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MosScoreReport({
  attempt,
  onClose,
  onRetryProject,
  onRetake,
}: {
  attempt: MosAttemptRecord;
  onClose: () => void;
  onRetryProject: (projectId: string) => void;
  onRetake: () => void;
}) {
  const track = trackMeta(attempt.track);
  const scorePct = Math.max(0, Math.min(100, (attempt.score / MOS_MAX_SCORE) * 100));
  const passPct = Math.max(0, Math.min(100, (attempt.passingScore / MOS_MAX_SCORE) * 100));

  return (
    <div className="mos-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="mos-modal mos-modal-lg" role="dialog" aria-modal="true" aria-label="Phiếu điểm bài thi MOS">
        <header className="mos-modal-head">
          <h2>Phiếu điểm MOS · {track.title} ({attempt.examCode})</h2>
          <button type="button" className="mos-modal-close" aria-label="Đóng phiếu điểm" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="mos-modal-body">
          <div className={`mos-report-banner ${attempt.passed ? 'is-pass' : 'is-fail'}`}>
            <div className="mos-report-verdict">
              <div className="mos-verdict-icon" aria-hidden="true">
                {attempt.passed ? <Award size={26} /> : <XCircle size={26} />}
              </div>
              <div>
                <h3>{attempt.passed ? 'ĐẠT CHUẨN CHỨNG CHỈ MOS' : 'CHƯA ĐẠT NGƯỠNG ĐIỂM CHUẨN'}</h3>
                <p>
                  {attempt.formatLabel} · Phiên bản {attempt.version} · Hoàn thành {attempt.passedTasks}/{attempt.totalTasks} nhiệm vụ trong {formatDuration(attempt.durationSec)}
                </p>
              </div>
            </div>
            <div className="mos-report-score">
              <strong>{attempt.score}</strong>
              <span>/ {MOS_MAX_SCORE} điểm (Chuẩn đạt: {attempt.passingScore})</span>
            </div>
          </div>

          <div className="mos-gauge" aria-label={`Điểm số ${attempt.score} trên ${MOS_MAX_SCORE}`}>
            <div className="mos-gauge-track">
              <div className={`mos-gauge-fill ${attempt.passed ? 'is-pass' : 'is-fail'}`} style={{ width: `${scorePct}%` }} />
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
                    <i style={{ width: `${domain.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mos-panel-head" style={{ marginBottom: 10 }}>
              <h3>Chi tiết chấm tự động từng nhiệm vụ</h3>
              <span>{attempt.projects.length} dự án</span>
            </div>
            <div className="mos-audit-list">
              {attempt.projects.map((project) => (
                <div key={project.projectId} className="mos-audit-proj">
                  <div className="mos-audit-proj-head">
                    <strong>{project.projectTitle} · {project.passedCount}/{project.totalCount} câu đạt</strong>
                    <button type="button" className="mos-btn" onClick={() => onRetryProject(project.projectId)}>
                      <RotateCcw size={14} /> Luyện lại dự án này
                    </button>
                  </div>
                  {project.tasks.map((task, idx) => (
                    <div key={task.taskId} className="mos-audit-row">
                      {task.passed
                        ? <CheckCircle2 size={18} color="#16a34a" style={{ flex: 'none', marginTop: 1 }} />
                        : <XCircle size={18} color="#dc2626" style={{ flex: 'none', marginTop: 1 }} />}
                      <div>
                        <strong>Câu {idx + 1}: {task.title}</strong>
                        <span>{task.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="mos-modal-foot">
          <button type="button" className="mos-btn" onClick={() => window.print()}>
            <Printer size={15} /> In phiếu điểm
          </button>
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
