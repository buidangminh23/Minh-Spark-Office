import { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  BookOpenCheck,
  Clock,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Languages,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Timer,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { drillsForTrack } from '../../lib/mos/drills';
import { importMosExamPack, type ImportedExamGroup, type ImportedMosPack } from '../../lib/mos/examPackImport';
import {
  buildPresetSession,
  domainsForTrack,
  examCodeFor,
  examSetsForSelection,
  MOS_LEVELS,
  MOS_PASSING_SCORE,
  MOS_TRACKS,
  MOS_VERSIONS,
  projectById,
  projectsForVersion,
  trackMeta,
  versionMeta,
} from '../../lib/mos/grader';
import {
  clearMosDraft,
  examSetReadiness,
  loadMosDraft,
  loadMosProgress,
  recordMosAttempt,
  recordMosDrill,
  saveMosDraft,
  saveMosProgress,
  versionTrackReadiness,
} from '../../lib/mos/progress';
import { solutionForTask } from '../../lib/mos/solutions';
import type {
  MosAttemptRecord,
  MosDrillMode,
  MosDrillSummary,
  MosExamNumber,
  MosLang,
  MosLevel,
  MosMode,
  MosProgress,
  MosProject,
  MosSavedDraft,
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
import { MosSolutionCard } from './MosSolutionCard';
import './mos.css';

const HERO_RING_R = 34;
const HERO_RING_C = 2 * Math.PI * HERO_RING_R;

export function MosHub() {
  const { user } = useAccount();
  const storage = useWorkspace();
  const ui = useUi();
  const uid = user?.uid ?? null;

  const [track, setTrack] = useState<MosTrackId>('word');
  const [version, setVersion] = useState<MosVersion>('365');
  const [level, setLevel] = useState<MosLevel>('associate');
  const [examNumber, setExamNumber] = useState<MosExamNumber>(1);
  const [lang, setLang] = useState<MosLang>('vi');

  const [progressStore, setProgressStore] = useState<{ uid: string | null; data: MosProgress }>(() => ({
    uid,
    data: loadMosProgress(uid),
  }));
  const progress = progressStore.uid === uid ? progressStore.data : loadMosProgress(uid);
  const updateProgress = (next: MosProgress) => {
    setProgressStore({ uid, data: next });
    saveMosProgress(uid, next);
  };

  const [draftStore, setDraftStore] = useState<{ uid: string | null; data: MosSavedDraft | null }>(() => ({
    uid,
    data: loadMosDraft(uid),
  }));
  const savedDraft = draftStore.uid === uid ? draftStore.data : loadMosDraft(uid);
  const updateDraft = (next: MosSavedDraft | null) => {
    setDraftStore({ uid, data: next });
    if (next) saveMosDraft(uid, next);
    else clearMosDraft(uid);
  };

  const [importedPacks, setImportedPacks] = useState<ImportedMosPack[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importingPack, setImportingPack] = useState(false);
  const [solutionModalProject, setSolutionModalProject] = useState<MosProject | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const [activeSession, setActiveSession] = useState<MosSessionConfig | null>(null);
  const [activeDraft, setActiveDraft] = useState<MosSavedDraft | null>(null);
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

  const allCustomProjects = useMemo(() => importedPacks.flatMap((pack) => pack.projects), [importedPacks]);
  const currentTrack = trackMeta(track);
  const currentVersion = versionMeta(version);
  const examCode = examCodeFor(track, version, level);
  const examSets = useMemo(() => examSetsForSelection(track, version, level), [track, version, level]);
  const activeExamSet = useMemo(
    () => examSets.find((item) => item.examNumber === examNumber) ?? examSets[0],
    [examSets, examNumber],
  );
  const visibleProjects = activeExamSet.projects;
  const allTrackProjects = useMemo(() => projectsForVersion(track, version), [track, version]);
  const domains = useMemo(() => domainsForTrack(track), [track]);
  const versionReadiness = useMemo(
    () => versionTrackReadiness(progress, track, version, level),
    [progress, track, version, level],
  );
  const readiness = useMemo(
    () => examSetReadiness(progress, track, version, level, examNumber),
    [progress, track, version, level, examNumber],
  );
  const trackAttempts = useMemo(
    () => progress.attempts.filter((item) => item.track === track).slice(0, 6),
    [progress.attempts, track],
  );
  const passedTaskSet = useMemo(() => new Set(progress.passedTaskIds), [progress.passedTaskIds]);
  const drillInfo = progress.drillStats[track];
  const drillCount = useMemo(() => drillsForTrack(track, level, version).length, [track, level, version]);

  const draftPlayable = useMemo(() => {
    if (!savedDraft) return false;
    return savedDraft.config.projectIds.every((id) => Boolean(projectById(id, allCustomProjects)));
  }, [savedDraft, allCustomProjects]);

  const launchSession = (config: MosSessionConfig, draft: MosSavedDraft | null = null) => {
    setLastSession(config);
    setActiveDraft(draft);
    setActiveSession(config);
  };

  const handleExamComplete = (attempt: MosAttemptRecord) => {
    updateProgress(recordMosAttempt(progress, attempt));
    setActiveSession(null);
    setActiveDraft(null);
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
      lang,
      projectIds: customProjects,
      timeLimitSec: customMinutes > 0 ? customMinutes * 60 : null,
      allowHints: customHints,
      allowLiveCheck: customLiveCheck,
      passingScore: customPassScore,
      label: `Đề tuỳ chỉnh · ${customProjects.length} dự án${customMinutes > 0 ? ` (${customMinutes}p)` : ''}`,
    });
  };

  const handleImportFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setImportingPack(true);
    try {
      const pack = await importMosExamPack(Array.from(fileList), { track, version, level });
      setImportedPacks((prev) => [pack, ...prev]);
      setTrack(pack.track);
      setVersion(pack.version);
      setLevel(pack.level);
      setImportModalOpen(false);
      ui.toast(`Đã nhập bộ đề “${pack.name}”: ${pack.projects.length} dự án (${pack.groups.length} đề).`);
    } catch (error) {
      ui.toast(error instanceof Error ? error.message : 'Không thể đọc bộ đề đã chọn.', true);
    } finally {
      setImportingPack(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const launchImportedGroup = (pack: ImportedMosPack, group: ImportedExamGroup, mode: MosMode) => {
    launchSession({
      track: pack.track,
      version,
      level: pack.level,
      format: mode === 'exam' ? 'certiport-exam' : 'guided-training',
      mode,
      lang,
      projectIds: group.projects.map((p) => p.id),
      timeLimitSec: mode === 'exam' ? 50 * 60 : null,
      allowHints: mode === 'training',
      allowLiveCheck: mode === 'training',
      passingScore: MOS_PASSING_SCORE,
      label: `${pack.name} · ${group.label}`,
    });
  };

  const totalVisibleTasks = visibleProjects.reduce((sum, p) => sum + p.tasks.length, 0);
  const weakCount = readiness.weakTaskIds.length;
  const heroDashOffset = HERO_RING_C * (1 - versionReadiness.percent / 100);

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
    <div
      className="mos-page"
      style={{
        ['--mos-accent' as string]: currentTrack.accent,
        ['--mos-office' as string]: currentTrack.officeColor,
      }}
    >
      <section className="mos-hero" aria-label="Trung tâm luyện thi chứng chỉ MOS">
        <div className="mos-hero-glow" aria-hidden="true" />
        <div className="mos-hero-main">
          <div className="mos-hero-title-row">
            <SuiteLogo kind={currentTrack.editorKind} size={50} />
            <div>
              <div className="mos-hero-heading">
                <h1>Ôn thi MOS · {currentTrack.title}</h1>
                <span className="mos-hero-code">{examCode}</span>
              </div>
              <p>
                {currentVersion.label} · {level === 'expert' ? 'Expert chuyên sâu' : 'Associate chuẩn'} · 5 bộ đề riêng ({versionReadiness.totalTasks} nhiệm vụ có đáp án từng bước)
              </p>
            </div>
          </div>

          <div className="mos-hero-controls">
            <div className="mos-seg is-glass" role="tablist" aria-label="Phiên bản kỳ thi MOS">
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

            <div className="mos-seg is-glass" role="tablist" aria-label="Cấp độ kỳ thi MOS">
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

            <div className="mos-seg is-glass" role="tablist" aria-label="Ngôn ngữ đề thi">
              <button type="button" role="tab" aria-selected={lang === 'vi'} className={lang === 'vi' ? 'is-active' : ''} onClick={() => setLang('vi')}>
                <Languages size={13} /> VI
              </button>
              <button type="button" role="tab" aria-selected={lang === 'en'} className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
                EN
              </button>
            </div>

            <button type="button" className="mos-hero-ghost-btn" onClick={() => setImportModalOpen(true)}>
              <Upload size={14} /> Nhập bộ đề từ máy
            </button>
          </div>

          <div className="mos-hero-ctas">
            <button
              type="button"
              className="mos-hero-cta-primary"
              onClick={() => launchSession(buildPresetSession('certiport-exam', { track, version, level, examNumber, lang }))}
            >
              <Award size={16} />
              <span>Vào phòng thi {currentVersion.short} · Đề {examNumber} ({visibleProjects.length} dự án · 50p)</span>
              <ArrowRight size={15} className="mos-arrow-glide" />
            </button>
            <button
              type="button"
              className="mos-hero-cta-secondary"
              onClick={() => launchSession(buildPresetSession('guided-training', { track, version, level, examNumber, lang }))}
            >
              <BookOpenCheck size={16} />
              <span>Luyện Đề {examNumber} + Đáp án từng bước</span>
            </button>
          </div>
        </div>

        <div className="mos-hero-side">
          <div className="mos-hero-readiness">
            <div className="mos-hero-ring" aria-label={`Tiến độ ${versionReadiness.percent}%`}>
              <svg viewBox="0 0 84 84" width="76" height="76">
                <circle className="mos-hero-ring-track" cx="42" cy="42" r={HERO_RING_R} />
                <circle
                  className="mos-hero-ring-fill"
                  cx="42"
                  cy="42"
                  r={HERO_RING_R}
                  strokeDasharray={HERO_RING_C}
                  strokeDashoffset={heroDashOffset}
                />
              </svg>
              <strong>{versionReadiness.percent}%</strong>
            </div>
            <div className="mos-hero-metrics">
              <div>
                <span>Điểm cao nhất ({currentVersion.short})</span>
                <strong>{versionReadiness.bestMock !== null ? `${versionReadiness.bestMock} / 1000` : 'Chưa thi'}</strong>
              </div>
              <div>
                <span>Tổng 5 đề ({currentVersion.short})</span>
                <strong>{versionReadiness.passedTasks}/{versionReadiness.totalTasks} câu</strong>
              </div>
              <div>
                <span>Trắc nghiệm</span>
                <strong>{drillInfo ? `${Math.round((drillInfo.correct / Math.max(1, drillInfo.total)) * 100)}%` : `${drillCount} câu`}</strong>
              </div>
            </div>
          </div>

          <div className="mos-mini-preview" data-preview-version={version} aria-label={`Xem trước giao diện ${currentVersion.short}`}>
            <div className="mos-mini-titlebar">
              <span className="mos-mini-dot" />
              <span className="mos-mini-file">{visibleProjects[0]?.fileName ?? 'Exam.docx'}</span>
              <span className="mos-mini-ver-tag">{currentVersion.short}</span>
            </div>
            <div className="mos-mini-ribbon">
              <span className="mos-mini-ribbon-card" />
            </div>
            <div className="mos-mini-stage">
              <span className="mos-mini-doc-sheet" />
            </div>
            <div className="mos-mini-console">
              <div className="mos-mini-console-bar">
                <span>{currentVersion.projectFormat === 'slash' ? `Project 1 / ${visibleProjects.length}` : `Project 1 of ${visibleProjects.length}`}</span>
                <span>00:50:00</span>
              </div>
              <div className="mos-mini-console-tabs">
                <i className="is-on" /><i /><i /><i />
              </div>
            </div>
          </div>
        </div>
      </section>

      {savedDraft && draftPlayable && (
        <div className="mos-draft-banner" role="region" aria-label="Bài thi đang tạm dừng">
          <div className="mos-draft-info">
            <Clock size={20} style={{ flex: 'none' }} />
            <div>
              <strong>Đang có bài thi tạm dừng: {savedDraft.config.label}</strong>
              <small>
                MOS {savedDraft.config.version} · Đang ở Project {savedDraft.projectIndex + 1}/{savedDraft.config.projectIds.length} · Lưu lúc {new Date(savedDraft.savedAt).toLocaleTimeString('vi-VN')}
              </small>
            </div>
          </div>
          <div className="mos-draft-actions">
            <button type="button" className="mos-btn" onClick={() => updateDraft(null)}>
              Xoá bản nháp
            </button>
            <button
              type="button"
              className="mos-btn mos-btn-primary"
              onClick={() => launchSession(savedDraft.config, savedDraft)}
            >
              <Play size={14} /> Tiếp tục làm bài
            </button>
          </div>
        </div>
      )}

      <div className="mos-tracks" role="tablist" aria-label="Chọn môn chứng chỉ MOS">
        {MOS_TRACKS.map((item) => {
          const stat = versionTrackReadiness(progress, item.id, version, level);
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
                <small>{item.subtitle} · 5 đề {currentVersion.short}</small>
                <div className="mos-track-progress">
                  <div className="mos-mini-bar"><i style={{ width: `${stat.percent}%` }} /></div>
                  <span>{stat.passedTasks}/{stat.totalTasks} câu</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <section className="mos-exam-bank-panel" aria-label="Chọn bộ đề thi hoàn chỉnh theo phiên bản">
        <div className="mos-panel-head">
          <div className="mos-exam-bank-title">
            <h3>Chọn bộ đề hoàn chỉnh · {currentVersion.short} ({examCode})</h3>
            <p>
              Tách biệt hoàn toàn bộ đề giữa MOS 2016, MOS 2019 và MOS 365 · Mỗi đề gồm {visibleProjects.length} dự án ({totalVisibleTasks} nhiệm vụ) chuẩn 50 phút
            </p>
          </div>
          <span className="mos-exam-bank-summary">
            Hoàn tất {versionReadiness.completedExams}/5 đề · Đang mở Đề {examNumber}
          </span>
        </div>

        <div className="mos-exam-cards-grid" role="tablist" aria-label="Danh sách 5 đề thi hoàn chỉnh">
          {examSets.map((set) => {
            const setStat = examSetReadiness(progress, track, version, level, set.examNumber);
            const isSelected = set.examNumber === examNumber;
            const rawTitle = lang === 'en' ? set.titleEn : set.title;
            const cleanTitle = rawTitle.replace(/^.*?·\s*/, '');
            const cleanSub = lang === 'en' ? set.subtitleEn : set.subtitle;
            return (
              <button
                key={set.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`mos-exam-card ${isSelected ? 'is-active' : ''}`}
                onClick={() => setExamNumber(set.examNumber)}
              >
                <div className="mos-exam-card-top">
                  <span className="mos-exam-num-pill">
                    {lang === 'en' ? `Exam 0${set.examNumber}` : `Đề 0${set.examNumber}`}
                  </span>
                  {setStat.bestMock !== null ? (
                    <span className={`mos-exam-score-pill ${setStat.bestMock >= MOS_PASSING_SCORE ? 'is-pass' : 'is-fail'}`}>
                      {setStat.bestMock}/1000
                    </span>
                  ) : isSelected ? (
                    <span className="mos-exam-active-pill">{lang === 'en' ? 'Selected' : 'Đang chọn'}</span>
                  ) : (
                    <span className="mos-exam-meta-pill">{set.projects.length}P · {set.totalTasks}T</span>
                  )}
                </div>

                <div className="mos-exam-card-body">
                  <strong>{cleanTitle}</strong>
                  <p>{cleanSub}</p>
                </div>

                <div className="mos-exam-card-foot">
                  <div className="mos-mini-bar"><i style={{ width: `${setStat.percent}%` }} /></div>
                  <span>{setStat.passedTasks}/{set.totalTasks} {lang === 'en' ? 'tasks' : 'câu'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mos-launch-panel" aria-label="Chọn hình thức ôn luyện và thi thử">
        <div className="mos-modes-grid">
          <button
            type="button"
            className="mos-mode-item is-primary"
            onClick={() => launchSession(buildPresetSession('certiport-exam', { track, version, level, examNumber, lang }))}
          >
            <div className="mos-mode-head">
              <span className="mos-mode-icon"><Award size={18} /></span>
              <span className="mos-mode-tag">Đề {examNumber} · 50 phút · {visibleProjects.length} dự án</span>
            </div>
            <div className="mos-mode-body">
              <strong>Thi thử chuẩn Certiport · Đề {examNumber}</strong>
              <p>Đề thi hoàn chỉnh {visibleProjects.length} dự án / {totalVisibleTasks} nhiệm vụ của riêng {currentVersion.short}, đếm ngược 50 phút, xuất Phiếu điểm kèm đáp án chi tiết.</p>
            </div>
            <div className="mos-mode-foot">
              <span>Vào phòng thi {currentVersion.short} · Đề {examNumber}</span>
              <ArrowRight size={15} className="mos-arrow-glide" />
            </div>
          </button>

          <button
            type="button"
            className="mos-mode-item"
            onClick={() => launchSession(buildPresetSession('guided-training', { track, version, level, examNumber, lang }))}
          >
            <div className="mos-mode-head">
              <span className="mos-mode-icon"><BookOpen size={18} /></span>
              <span className="mos-mode-tag">Đề {examNumber} · Đáp án + Chấm ngay</span>
            </div>
            <div className="mos-mode-body">
              <strong>Luyện tập có hướng dẫn · Đề {examNumber}</strong>
              <p>Không giới hạn thời gian, mở ngăn Đáp án từng bước song song tài liệu, sao chép công thức Click-to-Copy và chấm đúng/sai ngay.</p>
            </div>
            <div className="mos-mode-foot">
              <span>Mở chế độ luyện Đề {examNumber}</span>
              <ArrowRight size={15} className="mos-arrow-glide" />
            </div>
          </button>

          <button
            type="button"
            className="mos-mode-item"
            onClick={() => launchSession(buildPresetSession('speed-sprint', { track, version, level, examNumber, lang, projectId: visibleProjects[0]?.id }))}
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
              <ArrowRight size={15} className="mos-arrow-glide" />
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
              <ArrowRight size={15} className="mos-arrow-glide" />
            </div>
          </button>

          <button type="button" className="mos-mode-item" onClick={() => setDrillModal('practice')}>
            <div className="mos-mode-head">
              <span className="mos-mode-icon"><HelpCircle size={18} /></span>
              <span className="mos-mode-tag">{drillCount} câu · Phím tắt & Bẫy</span>
            </div>
            <div className="mos-mode-body">
              <strong>Trắc nghiệm Ribbon & Phím tắt</strong>
              <p>Ôn nhanh vị trí công cụ, cú pháp hàm và các bẫy đề thi phổ biến với 2 chế độ: Giải thích ngay hoặc Bấm giờ 5 phút.</p>
            </div>
            <div className="mos-mode-foot">
              <span>Mở bộ trắc nghiệm</span>
              <ArrowRight size={15} className="mos-arrow-glide" />
            </div>
          </button>

          <button type="button" className="mos-mode-item" onClick={openCustomBuilder}>
            <div className="mos-mode-head">
              <span className="mos-mode-icon"><SlidersHorizontal size={18} /></span>
              <span className="mos-mode-tag">Tuỳ chọn hoàn toàn</span>
            </div>
            <div className="mos-mode-body">
              <strong>Tuỳ chỉnh đề thi</strong>
              <p>Tự chọn bộ dự án (Associate + Expert), thời lượng, bật/tắt gợi ý, chấm trực tiếp từng câu và nâng điểm chuẩn đạt lên 800–900.</p>
            </div>
            <div className="mos-mode-foot">
              <span>Thiết lập đề riêng</span>
              <ArrowRight size={15} className="mos-arrow-glide" />
            </div>
          </button>
        </div>
      </section>

      {importedPacks.length > 0 && (
        <section className="mos-panel" aria-label="Bộ đề MOS nhập từ máy">
          <div className="mos-panel-head">
            <h3>Bộ đề MOS đã nhập từ máy ({importedPacks.length})</h3>
            <button type="button" className="mos-btn" onClick={() => setImportModalOpen(true)}>
              <Upload size={14} /> Thêm bộ đề khác
            </button>
          </div>
          {importedPacks.map((pack) => (
            <div key={pack.id} className="mos-imported-card">
              <div className="mos-imported-head">
                <div>
                  <strong>{pack.name}</strong>
                  <div style={{ fontSize: 12.5, color: 'var(--ws-muted)', marginTop: 2 }}>
                    {trackMeta(pack.track).title} · MOS {pack.version} · {pack.projects.length} dự án ({pack.projects.reduce((s, p) => s + p.tasks.length, 0)} nhiệm vụ)
                  </div>
                </div>
                <button
                  type="button"
                  className="mos-btn"
                  onClick={() => setImportedPacks((prev) => prev.filter((item) => item.id !== pack.id))}
                >
                  <Trash2 size={14} /> Gỡ bộ đề
                </button>
              </div>
              <div className="mos-imported-groups">
                {pack.groups.map((group) => (
                  <div key={group.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="mos-btn mos-btn-primary"
                      onClick={() => launchImportedGroup(pack, group, 'exam')}
                    >
                      <Award size={13} /> Thi thử {group.label} ({group.projects.length} dự án)
                    </button>
                    <button
                      type="button"
                      className="mos-btn"
                      onClick={() => launchImportedGroup(pack, group, 'training')}
                    >
                      <Play size={13} /> Luyện tập
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="mos-split-cols">
        <section className="mos-panel" aria-label="Danh sách dự án thực hành">
          <div className="mos-panel-head">
            <h3>{lang === 'en' ? activeExamSet.titleEn : activeExamSet.title} ({visibleProjects.length} dự án · {totalVisibleTasks} nhiệm vụ)</h3>
            {weakCount > 0 && (
              <button
                type="button"
                className="mos-btn"
                onClick={() => launchSession(buildPresetSession('weak-review', { track, version, level, examNumber, lang, weakTaskIds: readiness.weakTaskIds }))}
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
                  <div className="mos-project-num" aria-hidden="true">
                    {String(project.order).padStart(2, '0')}
                  </div>
                  <div className="mos-project-main">
                    <div className="mos-project-title">
                      <strong>{lang === 'en' ? (project.titleEn ?? project.title) : project.title}</strong>
                      <span className={`mos-level-pill ${project.level === 'expert' ? 'is-expert' : ''}`}>
                        {project.level === 'expert' ? 'Expert' : project.difficulty}
                      </span>
                    </div>
                    <p className="mos-project-sub">{lang === 'en' ? (project.scenarioEn ?? project.scenario) : project.scenario}</p>
                    <div className="mos-project-meta">
                      <code>{project.fileName}</code>
                      <span><Clock size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />~{project.minutes} phút</span>
                      <span className="mos-task-dots" title={`Đã đạt ${doneInProject}/${project.tasks.length} câu`}>
                        {project.tasks.map((task) => (
                          <i key={task.id} className={passedTaskSet.has(task.id) ? 'is-done' : ''} />
                        ))}
                        <span>{doneInProject}/{project.tasks.length}</span>
                      </span>
                    </div>
                  </div>
                  <div className="mos-project-actions">
                    <button
                      type="button"
                      className="mos-btn"
                      title="Xem đáp án chi tiết 5 nhiệm vụ của dự án này"
                      onClick={() => setSolutionModalProject(project)}
                    >
                      <BookOpenCheck size={13} /> Đáp án
                    </button>
                    <button
                      type="button"
                      className="mos-btn"
                      onClick={() => launchSession(buildPresetSession('single-project', { track, version, level, examNumber, lang, projectId: project.id }))}
                    >
                      <Play size={13} /> Luyện tập
                    </button>
                    <button
                      type="button"
                      className="mos-btn mos-btn-primary"
                      onClick={() => launchSession(buildPresetSession('speed-sprint', { track, version, level, examNumber, lang, projectId: project.id }))}
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
              <span>{currentTrack.title} · {level === 'expert' ? 'Expert' : 'Associate'}</span>
            </div>
            <div className="mos-domain-list">
              {domains.map((domain) => {
                const domainTasks = visibleProjects.flatMap((p) => p.tasks.filter((t) => t.domainId === domain.id));
                const passed = domainTasks.filter((t) => passedTaskSet.has(t.id)).length;
                const pct = domainTasks.length > 0 ? Math.round((passed / domainTasks.length) * 100) : 0;
                return (
                  <div key={domain.id} className="mos-domain-row">
                    <div className="mos-domain-top">
                      <strong>{domain.code} · {lang === 'en' ? domain.nameEn : domain.name}</strong>
                      <span>{passed}/{domainTasks.length}</span>
                    </div>
                    <div className="mos-domain-bar">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <button
                      type="button"
                      className="mos-domain-action"
                      onClick={() => launchSession(buildPresetSession('domain-focus', { track, version, level, examNumber, lang, domainIds: [domain.id] }))}
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
                        {item.examCode} · MOS {item.version} · {item.passedTasks}/{item.totalTasks} câu · {new Date(item.completedAt).toLocaleDateString('vi-VN')}
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

      {solutionModalProject && (
        <div className="mos-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSolutionModalProject(null); }}>
          <section className="mos-modal mos-modal-lg" role="dialog" aria-modal="true" aria-label="Đáp án chi tiết dự án">
            <header className="mos-modal-head">
              <h2>Đáp án chi tiết · Dự án {solutionModalProject.order}: {solutionModalProject.title}</h2>
              <button type="button" className="mos-modal-close" aria-label="Đóng" onClick={() => setSolutionModalProject(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="mos-modal-body">
              <div className="mos-sol-sheet-intro">
                <code>{solutionModalProject.fileName}</code>
                <span>{solutionModalProject.scenario}</span>
              </div>
              <div className="mos-sol-sheet-list">
                {solutionModalProject.tasks.map((task, idx) => (
                  <div key={task.id} className="mos-sol-sheet-item">
                    <div className="mos-sol-sheet-head">
                      <span className="mos-sol-task-badge">Task {idx + 1}</span>
                      <div>
                        <strong>{task.title}</strong>
                        <p>{task.instruction}</p>
                      </div>
                    </div>
                    <MosSolutionCard
                      solution={solutionForTask(task, solutionModalProject)}
                      onCopy={(val) => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          void navigator.clipboard.writeText(val).catch(() => undefined);
                        }
                        ui.toast(`Đã sao chép: ${val}`);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <footer className="mos-modal-foot">
              <button type="button" className="mos-btn" onClick={() => setSolutionModalProject(null)}>Đóng</button>
              <button
                type="button"
                className="mos-btn mos-btn-primary"
                onClick={() => {
                  const target = solutionModalProject;
                  setSolutionModalProject(null);
                  launchSession(buildPresetSession('single-project', { track, version, level, examNumber, lang, projectId: target.id }));
                }}
              >
                <Play size={14} /> Thực hành dự án này ngay
              </button>
            </footer>
          </section>
        </div>
      )}

      {importModalOpen && (
        <div className="mos-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setImportModalOpen(false); }}>
          <section className="mos-modal" role="dialog" aria-modal="true" aria-label="Nhập bộ đề thi MOS từ máy">
            <header className="mos-modal-head">
              <h2>Nhập bộ đề thi MOS từ máy (.zip / thư mục)</h2>
              <button type="button" className="mos-modal-close" aria-label="Đóng" onClick={() => setImportModalOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="mos-modal-body">
              <div className="mos-import-drop">
                <FolderOpen size={30} color="var(--mos-accent)" />
                <strong>Hỗ trợ trực tiếp cấu trúc bộ đề GMetrix / IIG / TeraBox</strong>
                <p>
                  Tự động nhận diện thư mục dạng <code>Exam 1 / Project 1..7</code> kèm tệp đề bài (<code>Bộ câu hỏi.docx</code>, <code>.txt</code>) và tệp thực hành (<code>.docx</code>, <code>.xlsx</code>, <code>.pptx</code>) để thi ngay trên giao diện MOS 2016 / 2019 / 365.
                </p>
                <div className="mos-import-btns">
                  <button
                    type="button"
                    className="mos-btn mos-btn-primary"
                    disabled={importingPack}
                    onClick={() => folderInputRef.current?.click()}
                  >
                    <FolderOpen size={15} /> {importingPack ? 'Đang nạp bộ đề…' : 'Chọn thư mục bộ đề'}
                  </button>
                  <button
                    type="button"
                    className="mos-btn"
                    disabled={importingPack}
                    onClick={() => zipInputRef.current?.click()}
                  >
                    <Upload size={15} /> Chọn tệp .zip / tệp lẻ
                  </button>
                </div>
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  {...({ webkitdirectory: '' } as Record<string, string>)}
                  onChange={(e) => void handleImportFiles(e.target.files)}
                />
                <input
                  ref={zipInputRef}
                  type="file"
                  multiple
                  accept=".zip,.docx,.xlsx,.xlsm,.pptx,.txt,.md"
                  style={{ display: 'none' }}
                  onChange={(e) => void handleImportFiles(e.target.files)}
                />
              </div>

              <ul className="mos-rules-list">
                <li>Hỗ trợ các gói đề tải từ TeraBox như <strong>Word 2016 Demo 1</strong> (<code>Exam 1..3 / Project 1..7 / Bicycles.docx + Bộ câu hỏi.docx</code>) hay <strong>pp2016</strong> (<code>Exam 1..3 / Project 1..7 / *.pptx</code>).</li>
                <li>Tự động tách từng câu <code>Task 1..5</code> hoặc <code>Câu 1..5</code> và tạo nút sao chép nhanh Click-to-Copy cho các cụm từ trong ngoặc kép.</li>
                <li>Sau khi nhập, bạn có thể chạy bộ đề bằng đúng giao diện <strong>MOS 2016</strong>, <strong>MOS 2019</strong> hoặc <strong>MOS 365</strong>.</li>
              </ul>
            </div>
            <footer className="mos-modal-foot">
              <button type="button" className="mos-btn" onClick={() => setImportModalOpen(false)}>Đóng</button>
            </footer>
          </section>
        </div>
      )}

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
                  const count = visibleProjects.flatMap((p) => p.tasks.filter((t) => t.domainId === domain.id)).length;
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
                  launchSession(buildPresetSession('domain-focus', { track, version, level, examNumber, lang, domainIds: selectedDomains }));
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
                      <span>Cho phép gợi ý & đáp án</span>
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
                          <strong>[Đề {project.examNumber ?? 1} · {project.level === 'expert' ? 'Expert' : 'Associate'}] Dự án {project.order}: {project.title}</strong>
                          <small>{project.fileName} · {project.tasks.length} nhiệm vụ · {project.difficulty}</small>
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
          version={version}
          level={level}
          initialMode={drillModal}
          onClose={() => setDrillModal(null)}
          onComplete={handleDrillComplete}
        />
      )}

      {activeSession && (
        <MosExamRunner
          config={activeSession}
          initialDraft={activeDraft}
          customProjects={allCustomProjects}
          onSaveDraft={(draft) => updateDraft(draft)}
          onClearDraft={() => updateDraft(null)}
          onCancel={() => {
            setActiveSession(null);
            setActiveDraft(null);
          }}
          onFinish={handleExamComplete}
          onSaveCopyToWorkspace={handleSaveCopyToWorkspace}
        />
      )}

      {report && (
        <MosScoreReport
          attempt={report}
          customProjects={allCustomProjects}
          onClose={() => setReport(null)}
          onRetryProject={(projectId) => {
            setReport(null);
            launchSession(buildPresetSession('single-project', {
              track: report.track,
              version: report.version,
              level: report.level,
              lang,
              projectId,
              customProjects: allCustomProjects,
            }));
          }}
          onReviewFailed={(failedTaskIds) => {
            setReport(null);
            launchSession(buildPresetSession('weak-review', {
              track: report.track,
              version: report.version,
              level: report.level,
              lang,
              weakTaskIds: failedTaskIds,
              customProjects: allCustomProjects,
            }));
          }}
          onRetake={() => {
            const target = lastSession ?? buildPresetSession('certiport-exam', {
              track: report.track,
              version: report.version,
              level: report.level,
              examNumber: report.examNumber ?? examNumber,
              lang,
            });
            setReport(null);
            launchSession(target);
          }}
        />
      )}
    </div>
  );
}
