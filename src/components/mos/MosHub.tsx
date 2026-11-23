import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Clock,
  GraduationCap,
  HelpCircle,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import {
  buildPresetSession,
  domainsForTrack,
  examCodeFor,
  MOS_LEVELS,
  MOS_PASSING_SCORE,
  MOS_TRACKS,
  MOS_VERSIONS,
  projectsForTrack,
  trackMeta,
} from '../../lib/mos/grader';
import {
  loadMosProgress,
  recordMosAttempt,
  recordMosDrill,
  saveMosProgress,
  trackReadiness,
} from '../../lib/mos/progress';
import type {
  MosAttemptRecord,
  MosDrillMode,
  MosDrillSummary,
  MosLevel,
  MosMode,
  MosProgress,
  MosSessionConfig,
  MosTrackId,
  MosVersion,
} from '../../lib/mos/types';
import { useWorkspace, type FileContent, type FileMeta } from '../../lib/storage';
import { useAccount } from '../Authentication';
import { SuiteLogo } from '../SuiteLogo';
import { useUi } from '../ui';
import { MosDrillModal } from './MosDrillModal';
import { MosExamRunner } from './MosExamRunner';
import { MosScoreReport } from './MosScoreReport';
import './mos.css';

export function MosHub() {
  const { user } = useAccount();
  const storage = useWorkspace();
  const ui = useUi();
  const uid = user?.uid ?? null;

  const [track, setTrack] = useState<MosTrackId>('word');
  const [version, setVersion] = useState<MosVersion>('365');
  const [level, setLevel] = useState<MosLevel>('associate');
  const [progressStore, setProgressStore] = useState<{ uid: string | null; data: MosProgress }>(() => ({
    uid,
    data: loadMosProgress(uid),
  }));
  const progress = progressStore.uid === uid ? progressStore.data : loadMosProgress(uid);
  const updateProgress = (next: MosProgress) => {
    setProgressStore({ uid, data: next });
    saveMosProgress(uid, next);
  };
  const [activeSession, setActiveSession] = useState<MosSessionConfig | null>(null);
  const [lastSession, setLastSession] = useState<MosSessionConfig | null>(null);
  const [report, setReport] = useState<MosAttemptRecord | null>(null);
  const [drillModal, setDrillModal] = useState<MosDrillMode | null>(null);
  const [domainPickerOpen, setDomainPickerOpen] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [customOpen, setCustomOpen] = useState(false);

  const [customMode, setCustomMode] = useState<MosMode>('exam');
  const [customProjects, setCustomProjects] = useState<string[]>([]);
  const [customMinutes, setCustomMinutes] = useState<number>(50);
  const [customHints, setCustomHints] = useState(false);
  const [customLiveCheck, setCustomLiveCheck] = useState(false);
  const [customPassScore, setCustomPassScore] = useState<number>(MOS_PASSING_SCORE);

  const currentTrack = trackMeta(track);
  const examCode = examCodeFor(track, version, level);
  const visibleProjects = useMemo(() => projectsForTrack(track, level), [track, level]);
  const allTrackProjects = useMemo(() => projectsForTrack(track), [track]);
  const domains = useMemo(() => domainsForTrack(track), [track]);
  const readiness = useMemo(() => trackReadiness(progress, track), [progress, track]);
  const trackAttempts = useMemo(
    () => progress.attempts.filter((item) => item.track === track).slice(0, 6),
    [progress.attempts, track],
  );
  const passedTaskSet = useMemo(() => new Set(progress.passedTaskIds), [progress.passedTaskIds]);
  const drillInfo = progress.drillStats[track];

  const launchSession = (config: MosSessionConfig) => {
    setLastSession(config);
    setActiveSession(config);
  };

  const handleExamComplete = (attempt: MosAttemptRecord) => {
    updateProgress(recordMosAttempt(progress, attempt));
    setActiveSession(null);
    setReport(attempt);
  };

  const handleDrillComplete = (summary: MosDrillSummary) => {
    updateProgress(recordMosDrill(progress, summary));
    ui.toast(`Đã lưu kết quả trắc nghiệm: ${summary.correct}/${summary.total} câu đúng`);
  };

  const openDomainPicker = () => {
    setSelectedDomains([domains[0]?.id].filter(Boolean));
    setDomainPickerOpen(true);
  };

  const openCustomBuilder = () => {
    setCustomMode('exam');
    setCustomProjects(visibleProjects.map((p) => p.id));
    setCustomMinutes(50);
    setCustomHints(false);
    setCustomLiveCheck(false);
    setCustomPassScore(MOS_PASSING_SCORE);
    setCustomOpen(true);
  };

  const startCustomSession = () => {
    if (customProjects.length === 0) {
      ui.toast('Hãy chọn ít nhất một dự án để bắt đầu.', true);
      return;
    }
    setCustomOpen(false);
    launchSession({
      track,
      version,
      level,
      format: 'custom',
      mode: customMode,
      projectIds: customProjects,
      timeLimitSec: customMinutes > 0 ? customMinutes * 60 : null,
      allowHints: customHints,
      allowLiveCheck: customLiveCheck,
      passingScore: customPassScore,
      label: `Đề tuỳ chỉnh · ${customProjects.length} dự án${customMinutes > 0 ? ` (${customMinutes}p)` : ''}`,
    });
  };

  const totalVisibleTasks = visibleProjects.reduce((sum, p) => sum + p.tasks.length, 0);
  const weakCount = readiness.weakTaskIds.length;

  const handleSaveCopyToWorkspace = (name: string, content: FileContent) => {
    const now = Date.now();
    const meta: FileMeta = {
      id: `${content.kind}-mos-${now}`,
      name,
      kind: content.kind,
      createdAt: now,
      updatedAt: now,
      openedAt: now,
      starred: false,
      deletedAt: null,
      size: JSON.stringify(content).length,
      preview: 'Bài thực hành ôn thi MOS',
    };
    void storage.saveFile(meta, structuredClone(content)).then(
      () => ui.toast(`Đã lưu bản sao “${name}” vào kho tài liệu Office 23`),
      () => ui.toast('Chưa lưu được bản sao bài làm.', true),
    );
  };

  return (
    <div className="mos-page" style={{ ['--mos-accent' as string]: currentTrack.accent }}>
      <header className="mos-head">
        <div>
          <h1>Ôn thi MOS</h1>
          <p>Luyện thi và thi thử mô phỏng chuẩn phòng thi Certiport trực tiếp trên 23 Docs, 23 Sheets và 23 Slides.</p>
        </div>

        <div className="mos-head-controls">
          <div className="mos-seg" role="tablist" aria-label="Phiên bản kỳ thi MOS">
            {MOS_VERSIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={version === item.id}
                className={version === item.id ? 'is-active' : ''}
                onClick={() => setVersion(item.id)}
              >
                {item.short}
              </button>
            ))}
          </div>

          <div className="mos-seg" role="tablist" aria-label="Cấp độ kỳ thi MOS">
            {MOS_LEVELS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={level === item.id}
                className={level === item.id ? 'is-active' : ''}
                onClick={() => setLevel(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mos-tracks" role="tablist" aria-label="Chọn môn chứng chỉ MOS">
        {MOS_TRACKS.map((item) => {
          const stat = trackReadiness(progress, item.id);
          const code = examCodeFor(item.id, version, level);
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={track === item.id}
              className={`mos-track-btn ${track === item.id ? 'is-active' : ''}`}
              style={{ ['--mos-accent' as string]: item.accent }}
              onClick={() => setTrack(item.id)}
            >
              <SuiteLogo kind={item.editorKind} size={46} />
              <div className="mos-track-info">
                <div className="mos-track-top">
                  <strong>{item.title}</strong>
                  <span className="mos-code-pill">{code}</span>
                </div>
                <small>{item.subtitle}</small>
                <div className="mos-track-progress">
                  <div className="mos-mini-bar"><i style={{ width: `${stat.percent}%` }} /></div>
                  <span>{stat.passedTasks}/{stat.totalTasks} câu</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <section className="mos-launch-panel" aria-label="Chọn hình thức ôn luyện và thi thử">
        <div className="mos-launch-top">
          <div className="mos-launch-title">
            <SuiteLogo kind={currentTrack.editorKind} size={42} />
            <div>
              <h2>{currentTrack.title} · Mã đề {examCode}</h2>
              <p>
                {MOS_VERSIONS.find((v) => v.id === version)?.label} · {level === 'expert' ? 'Associate + Expert chuyên sâu' : 'Cấp độ Associate'} · {visibleProjects.length} dự án ({totalVisibleTasks} nhiệm vụ thực hành)
              </p>
            </div>
          </div>

          <div className="mos-readiness-strip">
            <div className="mos-stat">
              <span>Điểm thi thử cao nhất</span>
              <strong>{readiness.bestMock !== null ? `${readiness.bestMock} / 1000` : 'Chưa thi'}</strong>
            </div>
            <div className="mos-stat">
              <span>Tiến độ thực hành</span>
              <strong>{readiness.percent}% ({readiness.passedTasks}/{readiness.totalTasks})</strong>
            </div>
            <div className="mos-stat">
              <span>Trắc nghiệm nhanh</span>
              <strong>{drillInfo ? `${Math.round((drillInfo.correct / Math.max(1, drillInfo.total)) * 100)}% (${drillInfo.runs} lượt)` : 'Chưa làm'}</strong>
            </div>
          </div>
        </div>

        <div className="mos-modes-grid">
          <button
            type="button"
            className="mos-mode-item is-primary"
            onClick={() => launchSession(buildPresetSession('certiport-exam', { track, version, level }))}
          >
            <div className="mos-mode-head">
              <span className="mos-mode-icon"><Award size={18} /></span>
              <span className="mos-mode-tag">50 phút · Thang 1000</span>
            </div>
            <div className="mos-mode-body">
              <strong>Thi thử chuẩn Certiport</strong>
              <p>Giao diện phòng thi thật: đếm ngược 50 phút, ẩn gợi ý, đủ {visibleProjects.length} dự án liên tiếp, xuất Phiếu điểm MOS chuẩn 700/1000.</p>
            </div>
            <div className="mos-mode-foot">
              <span>Vào phòng thi ngay</span>
              <ArrowRight size={15} />
            </div>
          </button>

          <button
            type="button"
            className="mos-mode-item"
            onClick={() => launchSession(buildPresetSession('guided-training', { track, version, level }))}
          >
            <div className="mos-mode-head">
              <span className="mos-mode-icon"><BookOpen size={18} /></span>
              <span className="mos-mode-tag">Gợi ý + Chấm ngay</span>
            </div>
            <div className="mos-mode-body">
              <strong>Luyện tập có hướng dẫn</strong>
              <p>Không giới hạn thời gian, xem đường dẫn thẻ Ribbon từng bước và bấm kiểm tra đúng/sai trực tiếp trên từng câu.</p>
            </div>
            <div className="mos-mode-foot">
              <span>Mở chế độ luyện tập</span>
              <ArrowRight size={15} />
            </div>
          </button>

          <button
            type="button"
            className="mos-mode-item"
            onClick={() => launchSession(buildPresetSession('speed-sprint', { track, version, level, projectId: visibleProjects[0]?.id }))}
          >
            <div className="mos-mode-head">
              <span className="mos-mode-icon"><Zap size={18} /></span>
              <span className="mos-mode-tag">15 phút · 1 dự án</span>
            </div>
            <div className="mos-mode-body">
              <strong>Thi nhanh tốc độ</strong>
              <p>Rèn áp lực thời gian với 1 dự án hoàn chỉnh trong 15 phút, ẩn gợi ý, chấm tự động chuẩn 1000 điểm ngay khi nộp.</p>
            </div>
            <div className="mos-mode-foot">
              <span>Bắt đầu thi nhanh</span>
              <ArrowRight size={15} />
            </div>
          </button>

          <button type="button" className="mos-mode-item" onClick={openDomainPicker}>
            <div className="mos-mode-head">
              <span className="mos-mode-icon"><Target size={18} /></span>
              <span className="mos-mode-tag">4 miền kỹ năng</span>
            </div>
            <div className="mos-mode-body">
              <strong>Luyện theo miền kỹ năng</strong>
              <p>Chọn đích danh một hoặc nhiều nhóm năng lực (công thức, tham chiếu, bố cục, hoạt hình…) để tập trung xử lý điểm yếu.</p>
            </div>
            <div className="mos-mode-foot">
              <span>Chọn miền kỹ năng</span>
              <ArrowRight size={15} />
            </div>
          </button>

          <button type="button" className="mos-mode-item" onClick={() => setDrillModal('practice')}>
            <div className="mos-mode-head">
              <span className="mos-mode-icon"><HelpCircle size={18} /></span>
              <span className="mos-mode-tag">8 câu · Phím tắt & Bẫy</span>
            </div>
            <div className="mos-mode-body">
              <strong>Trắc nghiệm Ribbon & Phím tắt</strong>
              <p>Ôn nhanh vị trí công cụ, cú pháp hàm và các bẫy đề thi phổ biến với 2 chế độ: Giải thích ngay hoặc Bấm giờ 5 phút.</p>
            </div>
            <div className="mos-mode-foot">
              <span>Mở bộ trắc nghiệm</span>
              <ArrowRight size={15} />
            </div>
          </button>

          <button type="button" className="mos-mode-item" onClick={openCustomBuilder}>
            <div className="mos-mode-head">
              <span className="mos-mode-icon"><SlidersHorizontal size={18} /></span>
              <span className="mos-mode-tag">Tuỳ chọn hoàn toàn</span>
            </div>
            <div className="mos-mode-body">
              <strong>Tuỳ chỉnh đề thi</strong>
              <p>Tự chọn bộ dự án, thời lượng làm bài, bật/tắt gợi ý, chấm trực tiếp từng câu và nâng điểm chuẩn đạt lên 800 hoặc 850.</p>
            </div>
            <div className="mos-mode-foot">
              <span>Thiết lập đề riêng</span>
              <ArrowRight size={15} />
            </div>
          </button>
        </div>
      </section>

      <div className="mos-split-cols">
        <section className="mos-panel" aria-label="Danh sách dự án thực hành">
          <div className="mos-panel-head">
            <h3>Dự án thực hành ({visibleProjects.length})</h3>
            {weakCount > 0 && (
              <button
                type="button"
                className="mos-btn"
                onClick={() => launchSession(buildPresetSession('weak-review', { track, version, level, weakTaskIds: readiness.weakTaskIds }))}
              >
                <RotateCcw size={14} /> Ôn {weakCount} câu chưa đạt
              </button>
            )}
          </div>

          <div className="mos-project-list">
            {visibleProjects.map((project) => {
              const doneInProject = project.tasks.filter((t) => passedTaskSet.has(t.id)).length;
              return (
                <div key={project.id} className="mos-project-row">
                  <div className="mos-project-main">
                    <div className="mos-project-title">
                      <strong>Dự án {project.order}: {project.title}</strong>
                      <span className={`mos-level-pill ${project.level === 'expert' ? 'is-expert' : ''}`}>
                        {project.level === 'expert' ? 'Expert' : project.difficulty}
                      </span>
                    </div>
                    <p className="mos-project-sub">{project.scenario}</p>
                    <div className="mos-project-meta">
                      <code>{project.fileName}</code>
                      <span><Clock size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />~{project.minutes} phút</span>
                      <span>Đã đạt {doneInProject}/{project.tasks.length} câu</span>
                    </div>
                  </div>
                  <div className="mos-project-actions">
                    <button
                      type="button"
                      className="mos-btn"
                      onClick={() => launchSession(buildPresetSession('single-project', { track, version, level, projectId: project.id }))}
                    >
                      <Play size={13} /> Luyện tập
                    </button>
                    <button
                      type="button"
                      className="mos-btn mos-btn-primary"
                      onClick={() => launchSession(buildPresetSession('speed-sprint', { track, version, level, projectId: project.id }))}
                    >
                      <Timer size={13} /> Thi 15p
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <section className="mos-panel" aria-label="Tiến độ theo miền kỹ năng">
            <div className="mos-panel-head">
              <h3>Miền kỹ năng chuẩn MOS</h3>
              <span>{currentTrack.title}</span>
            </div>
            <div className="mos-domain-list">
              {domains.map((domain) => {
                const domainTasks = allTrackProjects.flatMap((p) => p.tasks.filter((t) => t.domainId === domain.id));
                const passed = domainTasks.filter((t) => passedTaskSet.has(t.id)).length;
                const pct = domainTasks.length > 0 ? Math.round((passed / domainTasks.length) * 100) : 0;
                return (
                  <div key={domain.id} className="mos-domain-row">
                    <div className="mos-domain-top">
                      <strong>{domain.code} · {domain.name}</strong>
                      <span>{passed}/{domainTasks.length}</span>
                    </div>
                    <div className="mos-domain-bar">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <button
                      type="button"
                      className="mos-domain-action"
                      onClick={() => launchSession(buildPresetSession('domain-focus', { track, version, level, domainIds: [domain.id] }))}
                    >
                      Luyện riêng miền này →
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mos-panel" aria-label="Lịch sử làm bài MOS">
            <div className="mos-panel-head">
              <h3>Lịch sử phiếu điểm</h3>
              <span>{trackAttempts.length} lượt gần đây</span>
            </div>
            {trackAttempts.length === 0 ? (
              <p className="mos-empty-note">Chưa có bài thi nào cho {currentTrack.title}. Bắt đầu một bài thi thử hoặc dự án luyện tập để lưu phiếu điểm.</p>
            ) : (
              <div className="mos-history-list">
                {trackAttempts.map((item) => (
                  <button key={item.id} type="button" className="mos-history-row" onClick={() => setReport(item)}>
                    <div className="mos-history-left">
                      <strong>{item.formatLabel}</strong>
                      <small>
                        {item.examCode} · {item.passedTasks}/{item.totalTasks} câu · {new Date(item.completedAt).toLocaleDateString('vi-VN')}
                      </small>
                    </div>
                    <span className={`mos-score-chip ${item.passed ? 'is-pass' : 'is-fail'}`}>
                      {item.score}/1000
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {domainPickerOpen && (
        <div className="mos-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDomainPickerOpen(false); }}>
          <section className="mos-modal" role="dialog" aria-modal="true" aria-label="Chọn miền kỹ năng ôn luyện">
            <header className="mos-modal-head">
              <h2>Chọn miền kỹ năng · {currentTrack.title}</h2>
              <button type="button" className="mos-modal-close" aria-label="Đóng" onClick={() => setDomainPickerOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="mos-modal-body">
              <div className="mos-check-list">
                {domains.map((domain) => {
                  const count = allTrackProjects.flatMap((p) => p.tasks.filter((t) => t.domainId === domain.id)).length;
                  const checked = selectedDomains.includes(domain.id);
                  return (
                    <label key={domain.id} className="mos-check-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setSelectedDomains((prev) => (e.target.checked ? [...prev, domain.id] : prev.filter((id) => id !== domain.id)))}
                      />
                      <div>
                        <strong>{domain.code} · {domain.name}</strong>
                        <small>{count} nhiệm vụ thực hành trực tiếp trên {currentTrack.appName}</small>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            <footer className="mos-modal-foot">
              <button type="button" className="mos-btn" onClick={() => setDomainPickerOpen(false)}>Huỷ</button>
              <button
                type="button"
                className="mos-btn mos-btn-primary"
                disabled={selectedDomains.length === 0}
                onClick={() => {
                  setDomainPickerOpen(false);
                  launchSession(buildPresetSession('domain-focus', { track, version, level, domainIds: selectedDomains }));
                }}
              >
                <GraduationCap size={15} /> Bắt đầu luyện miền đã chọn
              </button>
            </footer>
          </section>
        </div>
      )}

      {customOpen && (
        <div className="mos-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCustomOpen(false); }}>
          <section className="mos-modal" role="dialog" aria-modal="true" aria-label="Tuỳ chỉnh đề thi MOS">
            <header className="mos-modal-head">
              <h2>Tuỳ chỉnh đề thi · {currentTrack.title} ({examCode})</h2>
              <button type="button" className="mos-modal-close" aria-label="Đóng" onClick={() => setCustomOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="mos-modal-body">
              <div className="mos-form-grid">
                <div className="mos-field">
                  <label htmlFor="mos-custom-mode">Chế độ phòng thi</label>
                  <select
                    id="mos-custom-mode"
                    className="mos-select"
                    value={customMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as MosMode;
                      setCustomMode(nextMode);
                      setCustomHints(nextMode === 'training');
                      setCustomLiveCheck(nextMode === 'training');
                      setCustomMinutes(nextMode === 'exam' ? 50 : 0);
                    }}
                  >
                    <option value="exam">Thi thử (Testing Mode)</option>
                    <option value="training">Luyện tập (Training Mode)</option>
                  </select>
                </div>

                <div className="mos-field">
                  <label htmlFor="mos-custom-time">Giới hạn thời gian</label>
                  <select
                    id="mos-custom-time"
                    className="mos-select"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Number(e.target.value))}
                  >
                    <option value={0}>Không giới hạn thời gian</option>
                    <option value={15}>15 phút (Thi nhanh)</option>
                    <option value={30}>30 phút (Rút gọn)</option>
                    <option value={50}>50 phút (Chuẩn Certiport)</option>
                    <option value={60}>60 phút (Mở rộng)</option>
                  </select>
                </div>

                <div className="mos-field">
                  <label htmlFor="mos-custom-pass">Ngưỡng điểm đạt (trên 1000)</label>
                  <select
                    id="mos-custom-pass"
                    className="mos-select"
                    value={customPassScore}
                    onChange={(e) => setCustomPassScore(Number(e.target.value))}
                  >
                    <option value={700}>700 điểm (Chuẩn Certiport)</option>
                    <option value={800}>800 điểm (Mục tiêu khá giỏi)</option>
                    <option value={850}>850 điểm (Mục tiêu xuất sắc)</option>
                    <option value={900}>900 điểm (Luyện điểm tuyệt đối)</option>
                  </select>
                </div>

                <div className="mos-field">
                  <span className="mos-field-label">Quyền trợ giúp trong phòng thi</span>
                  <div className="mos-toggle-row" style={{ paddingTop: 6 }}>
                    <label className="mos-toggle">
                      <input type="checkbox" checked={customHints} onChange={(e) => setCustomHints(e.target.checked)} />
                      <span>Cho phép xem gợi ý</span>
                    </label>
                    <label className="mos-toggle">
                      <input type="checkbox" checked={customLiveCheck} onChange={(e) => setCustomLiveCheck(e.target.checked)} />
                      <span>Chấm trực tiếp từng câu</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mos-field">
                <span className="mos-field-label">Chọn các dự án đưa vào đề thi ({customProjects.length}/{allTrackProjects.length})</span>
                <div className="mos-check-list">
                  {allTrackProjects.map((project) => {
                    const checked = customProjects.includes(project.id);
                    return (
                      <label key={project.id} className="mos-check-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setCustomProjects((prev) => (e.target.checked ? [...prev, project.id] : prev.filter((id) => id !== project.id)))}
                        />
                        <div>
                          <strong>Dự án {project.order}: {project.title}</strong>
                          <small>{project.fileName} · {project.tasks.length} nhiệm vụ · {project.level === 'expert' ? 'Expert' : project.difficulty}</small>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <footer className="mos-modal-foot">
              <button type="button" className="mos-btn" onClick={() => setCustomOpen(false)}>Huỷ</button>
              <button type="button" className="mos-btn mos-btn-primary" disabled={customProjects.length === 0} onClick={startCustomSession}>
                <Play size={14} /> Bắt đầu đề tuỳ chỉnh
              </button>
            </footer>
          </section>
        </div>
      )}

      {drillModal && (
        <MosDrillModal
          track={track}
          initialMode={drillModal}
          onClose={() => setDrillModal(null)}
          onComplete={handleDrillComplete}
        />
      )}

      {activeSession && (
        <MosExamRunner
          config={activeSession}
          onCancel={() => setActiveSession(null)}
          onFinish={handleExamComplete}
          onSaveCopyToWorkspace={handleSaveCopyToWorkspace}
        />
      )}

      {report && (
        <MosScoreReport
          attempt={report}
          onClose={() => setReport(null)}
          onRetryProject={(projectId) => {
            setReport(null);
            launchSession(buildPresetSession('single-project', { track: report.track, version: report.version, level: report.level, projectId }));
          }}
          onRetake={() => {
            const target = lastSession ?? buildPresetSession('certiport-exam', { track: report.track, version: report.version, level: report.level });
            setReport(null);
            launchSession(target);
          }}
        />
      )}
    </div>
  );
}
