import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Flag,
  HelpCircle,
  PanelBottom,
  Pause,
  Play,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { saveActiveDocumentForExit } from '../../lib/documentCloser';
import { loadEditor, loadedEditors } from '../../lib/editorModules';
import {
  domainsForTrack,
  examCodeFor,
  gradeExamAttempt,
  gradeSingleTask,
  projectById,
  tasksForProjectInSession,
  trackMeta,
  versionMeta,
} from '../../lib/mos/grader';
import { solutionForTask } from '../../lib/mos/solutions';
import type {
  MosAttemptRecord,
  MosLang,
  MosProject,
  MosSavedDraft,
  MosSessionConfig,
  MosTaskGrade,
} from '../../lib/mos/types';
import type { DocContent, FileContent, FileMeta, SheetContent, SlideContent } from '../../lib/storage';
import { useUi } from '../ui';
import { MosSolutionCard } from './MosSolutionCard';

const FONT_STEPS = [14, 16, 18] as const;

function formatHms(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function makeTempMeta(project: MosProject): FileMeta {
  const now = Date.now();
  return {
    id: `mos-live-${project.id}`,
    name: project.fileName,
    kind: project.kind,
    createdAt: now,
    updatedAt: now,
    openedAt: now,
    starred: false,
    deletedAt: null,
    size: 4096,
    preview: project.title,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderInstructionWithCopyTokens(
  text: string,
  tokens: string[] | undefined,
  copiedToken: string | null,
  onCopy: (token: string) => void,
): { nodes: ReactNode; matchedCount: number } {
  const unique = [...new Set((tokens ?? []).map((t) => t.trim()).filter((t) => t.length >= 2))]
    .sort((a, b) => b.length - a.length);
  if (unique.length === 0) return { nodes: text, matchedCount: 0 };

  const pattern = new RegExp(`(${unique.map(escapeRegExp).join('|')})`, 'g');
  const parts = text.split(pattern);
  if (parts.length === 1) return { nodes: text, matchedCount: 0 };

  const tokenSet = new Set(unique);
  let matchedCount = 0;
  const nodes = parts.map((part, idx) => {
    if (tokenSet.has(part)) {
      matchedCount += 1;
      const isCopied = copiedToken === part;
      return (
        <button
          key={`${idx}-${part}`}
          type="button"
          className={`mos-copy-token ${isCopied ? 'is-copied' : ''}`}
          title="Bấm để sao chép nhanh (Click-to-Copy)"
          onClick={() => onCopy(part)}
        >
          {part}
        </button>
      );
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
  return { nodes, matchedCount };
}

export function MosExamRunner({
  config,
  initialDraft,
  customProjects,
  onSaveDraft,
  onClearDraft,
  onCancel,
  onFinish,
  onSaveCopyToWorkspace,
}: {
  config: MosSessionConfig;
  initialDraft?: MosSavedDraft | null;
  customProjects?: ReadonlyArray<MosProject>;
  onSaveDraft?: (draft: MosSavedDraft) => void;
  onClearDraft?: () => void;
  onCancel: () => void;
  onFinish: (attempt: MosAttemptRecord) => void;
  onSaveCopyToWorkspace: (name: string, content: FileContent) => void;
}) {
  const ui = useUi();
  const track = trackMeta(config.track);
  const versionInfo = versionMeta(config.version);
  const examCode = examCodeFor(config.track, config.version, config.level);
  const domains = useMemo(() => domainsForTrack(config.track), [config.track]);

  const projects = useMemo(
    () => config.projectIds.map((id) => projectById(id, customProjects)).filter((p): p is MosProject => Boolean(p)),
    [config.projectIds, customProjects],
  );

  const [started, setStarted] = useState(Boolean(initialDraft) || config.mode !== 'exam');
  const [lang, setLang] = useState<MosLang>(initialDraft?.config.lang ?? config.lang ?? 'vi');
  const [editorReady, setEditorReady] = useState(() => Boolean(loadedEditors[track.editorKind]));
  const [editorError, setEditorError] = useState('');
  const [projectIndex, setProjectIndex] = useState(() => Math.min(initialDraft?.projectIndex ?? 0, Math.max(0, projects.length - 1)));
  const [activeTab, setActiveTab] = useState<'overview' | number>(initialDraft?.activeTab ?? 0);
  const [taskSlideDir, setTaskSlideDir] = useState<'none' | 'next' | 'prev'>('none');
  const [consoleHeight, setConsoleHeight] = useState(config.version === '365' ? 236 : 220);
  const [fontIndex, setFontIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [solutionDrawerOpen, setSolutionDrawerOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(initialDraft?.completedTasks ?? {});
  const [reviewTasks, setReviewTasks] = useState<Record<string, boolean>>(initialDraft?.reviewTasks ?? {});
  const [liveChecks, setLiveChecks] = useState<Record<string, MosTaskGrade>>({});
  const [resetEpochs, setResetEpochs] = useState<Record<string, number>>({});
  const [elapsedSec, setElapsedSec] = useState(initialDraft?.elapsedSec ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [initialDocs, setInitialDocs] = useState<Record<string, FileContent>>(() =>
    Object.fromEntries(projects.map((p) => [p.id, initialDraft?.docs[p.id] ? structuredClone(initialDraft.docs[p.id]) : p.createStarter()])),
  );

  const docsRef = useRef<Record<string, FileContent>>({});
  const elapsedRef = useRef(initialDraft?.elapsedSec ?? 0);
  const submittedRef = useRef(false);

  useEffect(() => {
    for (const project of projects) {
      if (!docsRef.current[project.id] && initialDocs[project.id]) {
        docsRef.current[project.id] = initialDocs[project.id];
      }
    }
  }, [projects, initialDocs]);

  useEffect(() => {
    elapsedRef.current = elapsedSec;
  }, [elapsedSec]);

  const currentProject = projects[projectIndex] ?? projects[0];
  const currentTasks = useMemo(
    () => (currentProject ? tasksForProjectInSession(currentProject, config.focusTaskIds) : []),
    [currentProject, config.focusTaskIds],
  );
  const currentTask = typeof activeTab === 'number' ? currentTasks[activeTab] ?? currentTasks[0] : null;
  const currentResetEpoch = currentProject ? (resetEpochs[currentProject.id] ?? 0) : 0;

  const currentMeta = useMemo(
    () => (currentProject ? makeTempMeta(currentProject) : null),
    [currentProject],
  );
  const currentInitialContent = currentProject ? (initialDocs[currentProject.id] ?? null) : null;

  useEffect(() => {
    if (loadedEditors[track.editorKind]) return;
    let alive = true;
    loadEditor(track.editorKind).then(
      () => { if (alive) setEditorReady(true); },
      () => { if (alive) setEditorError('Không tải được trình soạn thảo cho phòng thi.'); },
    );
    return () => { alive = false; };
  }, [track.editorKind]);

  useEffect(() => {
    if (!started || !editorReady || currentProject?.kind !== 'doc') return;
    const resetScroll = () => {
      const ws = document.querySelector('.mos-runner .doc-workspace, .mos-runner .doc-canvas');
      if (ws) ws.scrollTop = 0;
    };
    const t1 = setTimeout(resetScroll, 120);
    const t2 = setTimeout(resetScroll, 420);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [started, editorReady, currentProject?.id, currentProject?.kind, currentResetEpoch]);

  const buildSnapshot = useCallback((): Record<string, FileContent> => {
    const snapshot: Record<string, FileContent> = {};
    for (const project of projects) {
      snapshot[project.id] = docsRef.current[project.id] ?? initialDocs[project.id] ?? project.createStarter();
    }
    return snapshot;
  }, [projects, initialDocs]);

  const submitExam = useCallback(async (autoByTimeout = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await saveActiveDocumentForExit().catch(() => false);
      const snapshot = buildSnapshot();
      const attempt = gradeExamAttempt({
        config: { ...config, lang },
        contentsByProjectId: snapshot,
        durationSec: Math.max(1, elapsedRef.current),
        customProjects,
      });
      onClearDraft?.();
      if (autoByTimeout) ui.toast('Hết thời gian làm bài. Hệ thống đã tự động nộp bài và chấm điểm.');
      onFinish(attempt);
    } finally {
      setSubmitting(false);
    }
  }, [buildSnapshot, config, customProjects, lang, onClearDraft, onFinish, ui]);

  useEffect(() => {
    if (!started || submitting) return;
    const timer = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (config.timeLimitSec !== null && next >= config.timeLimitSec) {
          clearInterval(timer);
          void submitExam(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started, submitting, config.timeLimitSec, submitExam]);

  const handleEditorSave = useCallback(async (_meta: FileMeta, nextContent: FileContent) => {
    if (currentProject) {
      docsRef.current[currentProject.id] = structuredClone(nextContent);
    }
    return true;
  }, [currentProject]);

  const handleCopyToken = useCallback((token: string) => {
    setCopiedToken(token);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(token).catch(() => undefined);
    }
    ui.toast(`Đã sao chép: ${token}`);
    setTimeout(() => {
      setCopiedToken((prev) => (prev === token ? null : prev));
    }, 1600);
  }, [ui]);

  const selectTabWithDir = useCallback((nextTab: 'overview' | number, animate = true) => {
    if (!animate) {
      setTaskSlideDir('none');
    } else {
      const curRank = activeTab === 'overview' ? -1 : activeTab;
      const nextRank = nextTab === 'overview' ? -1 : nextTab;
      setTaskSlideDir(nextRank > curRank ? 'next' : nextRank < curRank ? 'prev' : 'none');
    }
    setActiveTab(nextTab);
    setShowHint(false);
  }, [activeTab]);

  const switchProject = useCallback(async (nextIndex: number, nextTab: 'overview' | number = 0) => {
    if (nextIndex < 0 || nextIndex >= projects.length) return;
    await saveActiveDocumentForExit().catch(() => false);
    if (currentProject && docsRef.current[currentProject.id]) {
      const savedCopy = structuredClone(docsRef.current[currentProject.id]);
      setInitialDocs((prev) => ({ ...prev, [currentProject.id]: savedCopy }));
    }
    setTaskSlideDir(nextIndex > projectIndex ? 'next' : 'prev');
    setProjectIndex(nextIndex);
    setActiveTab(nextTab);
    setShowHint(false);
  }, [currentProject, projectIndex, projects.length]);

  const handleRestartProject = async () => {
    if (!currentProject) return;
    const ok = await ui.confirm(
      'Restart Project — Đặt lại dự án',
      `Khôi phục tệp “${currentProject.fileName}” về trạng thái ban đầu? Mọi thao tác trong dự án này sẽ bị xoá.`,
      true,
    );
    if (!ok) return;
    const fresh = currentProject.createStarter();
    docsRef.current[currentProject.id] = fresh;
    setInitialDocs((prev) => ({ ...prev, [currentProject.id]: fresh }));
    setResetEpochs((prev) => ({ ...prev, [currentProject.id]: (prev[currentProject.id] ?? 0) + 1 }));
    setLiveChecks((prev) => {
      const next = { ...prev };
      for (const task of currentProject.tasks) delete next[task.id];
      return next;
    });
    ui.toast(`Đã khôi phục “${currentProject.fileName}” về bản gốc`);
  };

  const handleSaveProject = async () => {
    if (!currentProject) return;
    await saveActiveDocumentForExit().catch(() => false);
    const content = docsRef.current[currentProject.id] ?? initialDocs[currentProject.id] ?? currentProject.createStarter();
    onSaveCopyToWorkspace(currentProject.fileName, structuredClone(content));
  };

  const handlePauseAndSaveDraft = async () => {
    if (!onSaveDraft) {
      onCancel();
      return;
    }
    await saveActiveDocumentForExit().catch(() => false);
    const snapshot = buildSnapshot();
    onSaveDraft({
      config: { ...config, lang },
      projectIndex,
      activeTab,
      elapsedSec: elapsedRef.current,
      completedTasks,
      reviewTasks,
      docs: snapshot,
      savedAt: Date.now(),
    });
    ui.toast('Đã lưu tạm bài thi MOS. Bạn có thể bấm Tiếp tục bất cứ lúc nào.');
    onCancel();
  };

  const handleCheckCurrentTask = useCallback(async () => {
    if (!currentProject || !currentTask) return;
    await saveActiveDocumentForExit().catch(() => false);
    const content = docsRef.current[currentProject.id] ?? initialDocs[currentProject.id] ?? currentProject.createStarter();
    const result = gradeSingleTask(currentProject, currentTask.id, content);
    setLiveChecks((prev) => ({ ...prev, [currentTask.id]: result }));
    if (result.passed) {
      setCompletedTasks((prev) => ({ ...prev, [currentTask.id]: true }));
      ui.toast(`Đạt: ${currentTask.title}`);
    } else {
      ui.toast(result.detail, true);
    }
  }, [currentProject, currentTask, initialDocs, ui]);

  const handleGradeProject = async () => {
    await saveActiveDocumentForExit().catch(() => false);
    if (projectIndex + 1 < projects.length) {
      const nextLabel = versionInfo.projectFormat === 'slash'
        ? `${projectIndex + 1} / ${projects.length}`
        : `${projectIndex + 1} of ${projects.length}`;
      const ok = await ui.confirm(
        `${versionInfo.submitLabel} · Project ${nextLabel}`,
        `Lưu bài làm dự án “${currentProject?.title}” và chuyển sang Dự án ${projectIndex + 2}? Bạn vẫn có thể quay lại từ nút Summary.`,
        false,
      );
      if (ok) void switchProject(projectIndex + 1, 0);
      return;
    }
    setSummaryOpen(true);
  };

  const handleExit = async () => {
    const ok = await ui.confirm(
      'Thoát phòng thi MOS',
      'Bài làm chưa lưu tạm sẽ không được chấm điểm. Dùng nút Tạm dừng (Pause) nếu muốn giữ bài làm tiếp sau. Xác nhận thoát?',
      false,
    );
    if (ok) onCancel();
  };

  const isLastTaskInProject = typeof activeTab === 'number' && activeTab >= currentTasks.length - 1;
  const isLastProject = projectIndex >= projects.length - 1;

  const goPrevTask = useCallback((animate = true) => {
    if (typeof activeTab === 'number') {
      selectTabWithDir(activeTab === 0 ? 'overview' : activeTab - 1, animate);
    }
  }, [activeTab, selectTabWithDir]);

  const goNextTask = useCallback((animate = true) => {
    if (activeTab === 'overview') {
      selectTabWithDir(0, animate);
    } else if (!isLastTaskInProject) {
      selectTabWithDir(activeTab + 1, animate);
    } else if (!isLastProject) {
      void switchProject(projectIndex + 1, 0);
    }
  }, [activeTab, isLastProject, isLastTaskInProject, projectIndex, selectTabWithDir, switchProject]);

  useEffect(() => {
    if (!started || summaryOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === 'arrowleft') {
        event.preventDefault();
        goPrevTask(false);
      } else if (key === 'arrowright') {
        event.preventDefault();
        goNextTask(false);
      } else if (key === 'm' && currentTask) {
        event.preventDefault();
        setCompletedTasks((prev) => ({ ...prev, [currentTask.id]: !prev[currentTask.id] }));
      } else if (key === 'r' && currentTask) {
        event.preventDefault();
        setReviewTasks((prev) => ({ ...prev, [currentTask.id]: !prev[currentTask.id] }));
      } else if (key === 'h' && config.allowHints) {
        event.preventDefault();
        setShowHint((v) => !v);
      } else if (key === 'k' && config.allowLiveCheck && currentTask) {
        event.preventDefault();
        void handleCheckCurrentTask();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [started, summaryOpen, goPrevTask, goNextTask, currentTask, config.allowHints, config.allowLiveCheck, handleCheckCurrentTask]);

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = consoleHeight;
    const onMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      setConsoleHeight(Math.max(176, Math.min(440, startHeight + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const remainingSec = config.timeLimitSec !== null ? Math.max(0, config.timeLimitSec - elapsedSec) : null;
  const timerWarn = remainingSec !== null && remainingSec <= 300 && remainingSec > 60;
  const timerUrgent = remainingSec !== null && remainingSec <= 60;
  const totalSessionTasks = projects.reduce((sum, p) => sum + tasksForProjectInSession(p, config.focusTaskIds).length, 0);
  const completedSessionCount = projects.reduce(
    (sum, p) => sum + tasksForProjectInSession(p, config.focusTaskIds).filter((t) => completedTasks[t.id] || liveChecks[t.id]?.passed).length,
    0,
  );
  const currentSolution = useMemo(
    () => (currentTask ? solutionForTask(currentTask, currentProject) : null),
    [currentTask, currentProject],
  );

  const DocEditor = loadedEditors.doc;
  const SheetEditor = loadedEditors.sheet;
  const SlideEditor = loadedEditors.slide;

  if (!started) {
    return (
      <div className="mos-modal-backdrop" role="presentation">
        <section className="mos-modal" role="dialog" aria-modal="true" aria-label="Hướng dẫn trước khi bắt đầu bài thi MOS">
          <header className="mos-modal-head">
            <h2>Phòng thi mô phỏng {versionInfo.short} · {track.title} ({examCode})</h2>
            <button type="button" className="mos-modal-close" aria-label="Huỷ" onClick={onCancel}>
              <X size={18} />
            </button>
          </header>
          <div className="mos-modal-body">
            <div className="mos-briefing-grid">
              <div className="mos-briefing-cell">
                <span>Mã kỳ thi</span>
                <strong>{examCode} · {versionInfo.short}</strong>
              </div>
              <div className="mos-briefing-cell">
                <span>Thời gian làm bài</span>
                <strong>{config.timeLimitSec ? `${Math.round(config.timeLimitSec / 60)} phút` : 'Không giới hạn'}</strong>
              </div>
              <div className="mos-briefing-cell">
                <span>Quy mô đề thi</span>
                <strong>{projects.length} dự án · {totalSessionTasks} nhiệm vụ</strong>
              </div>
              <div className="mos-briefing-cell">
                <span>Điểm chuẩn đạt</span>
                <strong>{config.passingScore} / 1000</strong>
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Giao diện đúng phiên bản {versionInfo.label}</h3>
              <ul className="mos-rules-list">
                <li>Khung soạn thảo <strong>{track.appName}</strong> và thanh câu hỏi phía dưới được cấu hình đúng giao diện <strong>{versionInfo.uiSummary}</strong>.</li>
                <li>Bấm trực tiếp vào các cụm chữ gạch chân chấm (Click-to-Copy) trong đề bài để sao chép chính xác tên cột, công thức, nhãn chân trang hoặc URL.</li>
                <li>Phím tắt điều hướng nhanh: <strong>Alt + ←/→</strong> chuyển câu, <strong>Alt + M</strong> đánh dấu hoàn thành, <strong>Alt + R</strong> cắm cờ xem lại.</li>
                <li>{config.allowHints ? 'Chế độ này bật nút ? (Gợi ý Ribbon), ngăn Đáp án chi tiết từng bước và Kiểm tra câu ngay.' : 'Chế độ thi thử ẩn gợi ý khi làm bài; sau khi nộp bài sẽ mở khoá toàn bộ Đáp án chi tiết từng bước trên Phiếu điểm.'}</li>
              </ul>
            </div>
          </div>
          <footer className="mos-modal-foot">
            <button type="button" className="mos-btn" onClick={onCancel}>Quay lại</button>
            <button type="button" className="mos-btn mos-btn-primary" onClick={() => setStarted(true)}>
              <Play size={15} /> Bắt đầu làm bài
            </button>
          </footer>
        </section>
      </div>
    );
  }

  const domainMap = new Map(domains.map((d) => [d.id, d]));
  const currentCheck = currentTask ? liveChecks[currentTask.id] : undefined;
  const isDone = currentTask ? Boolean(completedTasks[currentTask.id]) : false;
  const isReview = currentTask ? Boolean(reviewTasks[currentTask.id]) : false;
  const fontSize = FONT_STEPS[fontIndex];

  const activeProjectTitle = currentProject
    ? (lang === 'en' ? (currentProject.titleEn ?? currentProject.title) : currentProject.title)
    : '';
  const activeProjectScenario = currentProject
    ? (lang === 'en' ? (currentProject.scenarioEn ?? currentProject.scenario) : currentProject.scenario)
    : '';
  const activeTaskTitle = currentTask
    ? (lang === 'en' ? (currentTask.titleEn ?? currentTask.title) : currentTask.title)
    : '';
  const activeTaskInstruction = currentTask
    ? (lang === 'en' ? (currentTask.instructionEn ?? currentTask.instruction) : currentTask.instruction)
    : '';
  const activeDomain = currentTask ? domainMap.get(currentTask.domainId) : undefined;
  const activeDomainLabel = activeDomain ? (lang === 'en' ? activeDomain.nameEn : activeDomain.name) : '';

  const renderedInstruction = currentTask
    ? renderInstructionWithCopyTokens(activeTaskInstruction, currentTask.copyTokens, copiedToken, handleCopyToken)
    : { nodes: '', matchedCount: 0 };

  const hasFeedbackOverlay = Boolean((config.allowHints && showHint) || (config.allowLiveCheck && currentCheck));
  const hasCopyBar = Boolean(currentTask?.copyTokens && currentTask.copyTokens.length > 0);
  const minConsoleHeight = hasFeedbackOverlay
    ? (config.version === '365' ? 328 : 294)
    : hasCopyBar
      ? (config.version === '365' ? 258 : 238)
      : consoleHeight;
  const effectiveConsoleHeight = Math.max(consoleHeight, minConsoleHeight);
  const projectCounter = versionInfo.projectFormat === 'slash'
    ? `Project ${projectIndex + 1} / ${projects.length}`
    : `Project ${projectIndex + 1} of ${projects.length}`;
  const timerString = remainingSec !== null ? formatHms(remainingSec) : formatHms(elapsedSec);
  const taskSwapKey = `${currentProject?.id ?? 'none'}:${String(activeTab)}`;
  const taskAnimClass = taskSlideDir === 'next' ? 'is-slide-next' : taskSlideDir === 'prev' ? 'is-slide-prev' : '';

  const prevButton = (
    <button
      type="button"
      className="mos-real-btn is-nav"
      disabled={activeTab === 'overview'}
      onClick={() => goPrevTask(true)}
    >
      {config.version === '2016' ? '◀ Previous' : config.version === '365' ? '← Previous Task' : 'Previous Task'}
    </button>
  );

  const nextButton = (
    <button
      type="button"
      className="mos-real-btn is-nav"
      disabled={isLastTaskInProject && isLastProject}
      onClick={() => goNextTask(true)}
    >
      {isLastTaskInProject && !isLastProject
        ? (config.version === '2016' ? 'Next Project ▶' : 'Next Project')
        : (config.version === '2016' ? 'Next ▶' : config.version === '365' ? 'Next Task →' : 'Next Task')}
    </button>
  );

  const completeButton = (
    <button
      type="button"
      className={`mos-real-btn is-complete ${isDone ? 'is-on' : ''}`}
      disabled={!currentTask}
      aria-pressed={isDone}
      onClick={() => {
        if (!currentTask) return;
        setCompletedTasks((prev) => ({ ...prev, [currentTask.id]: !prev[currentTask.id] }));
      }}
    >
      {isDone && <Check size={14} />}
      {config.version === '365' ? 'Mark as Complete' : 'Mark Completed'}
    </button>
  );

  const reviewButton = (
    <button
      type="button"
      className={`mos-real-btn is-review ${isReview ? 'is-on' : ''}`}
      disabled={!currentTask}
      aria-pressed={isReview}
      onClick={() => {
        if (!currentTask) return;
        setReviewTasks((prev) => ({ ...prev, [currentTask.id]: !prev[currentTask.id] }));
      }}
    >
      {isReview && <Flag size={13} />}
      {config.version === '2019' ? 'Mark for review' : 'Mark for Review'}
    </button>
  );

  const solutionButton = config.allowHints && currentTask ? (
    <button
      type="button"
      className={`mos-real-btn is-solution ${solutionDrawerOpen ? 'is-on' : ''}`}
      aria-pressed={solutionDrawerOpen}
      onClick={() => setSolutionDrawerOpen((v) => !v)}
    >
      <BookOpenCheck size={14} /> {lang === 'en' ? 'Solution' : 'Đáp án'}
    </button>
  ) : null;

  const checkButton = config.allowLiveCheck && currentTask ? (
    <button
      type="button"
      className="mos-real-btn is-check"
      onClick={() => void handleCheckCurrentTask()}
    >
      <ShieldCheck size={14} /> {lang === 'en' ? 'Check Task' : 'Kiểm tra câu'}
    </button>
  ) : null;

  return (
    <div
      className="mos-runner"
      data-mos-version={config.version}
      data-mos-app={config.track}
      role="application"
      aria-label={`Phòng thi ${track.title} ${versionInfo.short}`}
    >
      <div className="mos-runner-stage">
        {editorError ? (
          <div className="mos-editor-loading">{editorError}</div>
        ) : !editorReady || !currentProject || !currentMeta || !currentInitialContent ? (
          <div className="mos-editor-loading">Đang khởi tạo {track.appName} cho dự án “{currentProject?.title}”…</div>
        ) : currentProject.kind === 'doc' && DocEditor ? (
          <DocEditor
            key={`${currentProject.id}:${currentResetEpoch}`}
            meta={currentMeta}
            content={currentInitialContent as DocContent}
            onSave={handleEditorSave}
            onRename={() => undefined}
            onBack={() => void handleExit()}
          />
        ) : currentProject.kind === 'sheet' && SheetEditor ? (
          <SheetEditor
            key={`${currentProject.id}:${currentResetEpoch}`}
            meta={currentMeta}
            content={currentInitialContent as SheetContent}
            onSave={handleEditorSave}
            onRename={() => undefined}
            onBack={() => void handleExit()}
          />
        ) : currentProject.kind === 'slide' && SlideEditor ? (
          <SlideEditor
            key={`${currentProject.id}:${currentResetEpoch}`}
            meta={currentMeta}
            content={currentInitialContent as SlideContent}
            onSave={handleEditorSave}
            onRename={() => undefined}
            onBack={() => void handleExit()}
          />
        ) : (
          <div className="mos-editor-loading">Đang tải trình soạn thảo…</div>
        )}

        {config.allowHints && currentSolution && currentTask && (
          <aside
            className={`mos-solution-drawer ${solutionDrawerOpen ? 'is-open' : ''}`}
            aria-label="Đáp án chi tiết từng bước"
            aria-hidden={!solutionDrawerOpen}
          >
            <div className="mos-solution-drawer-head">
              <div>
                <strong>Đáp án chi tiết · Task {(typeof activeTab === 'number' ? activeTab : 0) + 1}</strong>
                <span>{activeTaskTitle}</span>
              </div>
              <button
                type="button"
                className="mos-modal-close"
                aria-label="Đóng đáp án chi tiết"
                onClick={() => setSolutionDrawerOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="mos-solution-drawer-body">
              <MosSolutionCard solution={currentSolution} onCopy={handleCopyToken} />
            </div>
          </aside>
        )}
      </div>

      <div className="mos-splitter" onMouseDown={startResize} title="Kéo để chỉnh chiều cao khung đề thi" />

      <section className="mos-console" style={{ height: effectiveConsoleHeight }} aria-label={`Khung câu hỏi ${versionInfo.short}`}>
        <div className="mos-compass-bar">
          <div className="mos-compass-left">
            {config.version === '365' && <span className="mos-compass-ver">MOS 365</span>}
            {config.version === '2016' && <span className="mos-compass-ver">MOS 2016</span>}
            <button
              type="button"
              className="mos-compass-icon-btn"
              aria-label={config.allowHints ? 'Gợi ý thao tác' : 'Hướng dẫn phòng thi'}
              aria-pressed={showHint}
              title={config.allowHints ? 'Bật/tắt gợi ý đường dẫn Ribbon (Alt+H)' : 'Hướng dẫn phòng thi'}
              onClick={() => {
                if (config.allowHints) setShowHint((v) => !v);
                else ui.toast('Đang ở chế độ Thi thử: gợi ý được ẩn giống phòng thi Certiport.');
              }}
            >
              <HelpCircle size={15} />
            </button>
            <button
              type="button"
              className="mos-compass-icon-btn"
              aria-label="Đổi cỡ chữ câu hỏi"
              title="Thay đổi cỡ chữ đề bài (AA)"
              onClick={() => setFontIndex((i) => (i + 1) % FONT_STEPS.length)}
            >
              AA
            </button>
            <button
              type="button"
              className="mos-compass-icon-btn"
              aria-label="Mở danh sách dự án"
              title="Mở bảng Summary chuyển nhanh dự án"
              onClick={() => setSummaryOpen(true)}
            >
              <PanelBottom size={15} />
            </button>
            <span className="mos-compass-proj">{projectCounter}</span>
            <span className="mos-compass-code">{examCode}</span>
            <button
              type="button"
              className="mos-compass-lang"
              title="Chuyển ngôn ngữ đề bài Tiếng Việt / English"
              onClick={() => setLang((prev) => (prev === 'vi' ? 'en' : 'vi'))}
            >
              {lang === 'vi' ? 'VI' : 'EN'}
            </button>
          </div>

          <div className="mos-compass-center">
            <span className={`mos-compass-timer ${timerUrgent ? 'is-urgent' : timerWarn ? 'is-warn' : ''}`} aria-live="off">
              {config.version === '2016' ? `${remainingSec !== null ? 'Time Remaining: ' : 'Elapsed: '}${timerString}` : timerString}
            </span>
            {config.version === '365' && (
              <span className="mos-compass-progress-pill">
                {completedSessionCount}/{totalSessionTasks} Tasks
              </span>
            )}
          </div>

          <div className="mos-compass-right">
            <button type="button" className="mos-compass-link" onClick={() => setSummaryOpen(true)}>
              {config.version === '365' ? 'Go To Summary' : 'Summary'}
            </button>
            <button type="button" className="mos-compass-link" onClick={() => void handleRestartProject()}>
              Restart Project
            </button>
            {onSaveDraft && (
              <button
                type="button"
                className="mos-compass-link"
                title="Tạm dừng và lưu bản nháp để làm tiếp sau"
                onClick={() => void handlePauseAndSaveDraft()}
              >
                <Pause size={13} /> {config.version === '365' ? 'Pause' : 'Tạm dừng'}
              </button>
            )}
            <button type="button" className="mos-compass-link" onClick={() => void handleSaveProject()}>
              {config.version === '2019' ? 'Save Project' : 'Save'}
            </button>
            <button type="button" className="mos-compass-link is-grade" disabled={submitting} onClick={() => void handleGradeProject()}>
              {isLastProject ? 'Finish Exam' : versionInfo.submitLabel}
            </button>
            <button type="button" className="mos-compass-icon-btn" aria-label="Thoát phòng thi" title="Thoát phòng thi" onClick={() => void handleExit()}>
              <X size={15} />
            </button>
          </div>
        </div>

        {currentProject && (
          <>
            <div className="mos-task-tabs-bar" role="tablist" aria-label="Thẻ nhiệm vụ trong dự án">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview'}
                className={`mos-task-tab ${activeTab === 'overview' ? 'is-active' : ''}`}
                onClick={() => selectTabWithDir('overview', true)}
              >
                Overview
              </button>
              {currentTasks.map((task, idx) => {
                const check = liveChecks[task.id];
                const done = completedTasks[task.id];
                const flagged = reviewTasks[task.id];
                const tabCls = [
                  'mos-task-tab',
                  activeTab === idx ? 'is-active' : '',
                  done || check?.passed ? 'is-marked-done' : flagged ? 'is-marked-review' : '',
                ].filter(Boolean).join(' ');
                return (
                  <button
                    key={task.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === idx}
                    className={tabCls}
                    onClick={() => selectTabWithDir(idx, true)}
                  >
                    {(check?.passed || done) && <Check size={13} className="mos-tab-status-done" />}
                    {!done && check && !check.passed && <XCircle size={13} className="mos-tab-status-fail" />}
                    {!done && !check && flagged && <Flag size={12} className="mos-tab-status-review" />}
                    <span>Task {idx + 1}</span>
                  </button>
                );
              })}
            </div>

            <div className="mos-task-body" style={{ fontSize }}>
              <div key={taskSwapKey} className={`mos-task-inner ${taskAnimClass}`}>
                {activeTab === 'overview' || !currentTask ? (
                  <>
                    <div className="mos-task-meta-line">
                      <strong>Project {projectIndex + 1}: {activeProjectTitle}</strong>
                      <span className="mos-task-domain">{currentProject.fileName}</span>
                      <span>{currentTasks.length} Tasks</span>
                    </div>
                    <p className="mos-task-instruction">{activeProjectScenario}</p>
                  </>
                ) : (
                  <>
                    <div className="mos-task-meta-line">
                      <strong>Task {(typeof activeTab === 'number' ? activeTab : 0) + 1} · {activeTaskTitle}</strong>
                      {activeDomain && (
                        <span className="mos-task-domain">
                          {activeDomain.code} · {activeDomainLabel}
                        </span>
                      )}
                    </div>
                    <p className="mos-task-instruction">{renderedInstruction.nodes}</p>

                    {currentTask.copyTokens && currentTask.copyTokens.length > 0 && (
                      <div className="mos-copy-bar">
                        <span className="mos-copy-bar-label">{lang === 'en' ? 'Click to copy:' : 'Sao chép nhanh:'}</span>
                        {currentTask.copyTokens.map((token) => (
                          <button
                            key={token}
                            type="button"
                            className={`mos-copy-chip ${copiedToken === token ? 'is-copied' : ''}`}
                            onClick={() => handleCopyToken(token)}
                          >
                            {copiedToken === token ? <Check size={11} /> : <Copy size={11} />} {token}
                          </button>
                        ))}
                      </div>
                    )}

                    {config.allowHints && showHint && (
                      <div className="mos-hint-box">
                        <span className="mos-hint-path">{currentTask.ribbonPath}</span>
                        <div>{currentTask.hint}</div>
                      </div>
                    )}

                    {config.allowLiveCheck && currentCheck && (
                      <div className={`mos-live-feedback ${currentCheck.passed ? 'is-pass' : 'is-fail'}`} role="status">
                        {currentCheck.passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        <span>{currentCheck.detail}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mos-console-foot">
              {config.version === '2019' ? (
                <>
                  {prevButton}
                  {completeButton}
                  {reviewButton}
                  {nextButton}
                  {solutionButton}
                  {checkButton}
                </>
              ) : (
                <>
                  <div className="mos-foot-group">
                    {prevButton}
                    {nextButton}
                  </div>
                  <div className="mos-foot-group">
                    {completeButton}
                    {reviewButton}
                    {solutionButton}
                    {checkButton}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {summaryOpen && (
        <div className="mos-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSummaryOpen(false); }}>
          <section className="mos-modal mos-modal-lg" role="dialog" aria-modal="true" aria-label="Summary — Tổng quan bài thi">
            <header className="mos-modal-head">
              <h2>Summary · {track.title} ({examCode} · {versionInfo.short})</h2>
              <button type="button" className="mos-modal-close" aria-label="Đóng Summary" onClick={() => setSummaryOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="mos-modal-body">
              {projects.map((proj, pIdx) => {
                const tasks = tasksForProjectInSession(proj, config.focusTaskIds);
                const doneCount = tasks.filter((t) => completedTasks[t.id] || liveChecks[t.id]?.passed).length;
                return (
                  <div key={proj.id} className="mos-summary-proj">
                    <div className="mos-summary-proj-head">
                      <span>Project {pIdx + 1}: {lang === 'en' ? (proj.titleEn ?? proj.title) : proj.title} ({proj.fileName})</span>
                      <span>{doneCount}/{tasks.length} Completed</span>
                    </div>
                    <div className="mos-summary-tasks">
                      {tasks.map((task, tIdx) => {
                        const done = completedTasks[task.id] || liveChecks[task.id]?.passed;
                        const flagged = reviewTasks[task.id];
                        return (
                          <button
                            key={task.id}
                            type="button"
                            className="mos-summary-task"
                            onClick={() => {
                              setSummaryOpen(false);
                              void switchProject(pIdx, tIdx);
                            }}
                          >
                            {done
                              ? <CheckCircle2 size={15} className="mos-tab-status-done" style={{ flex: 'none' }} />
                              : flagged
                                ? <Flag size={14} className="mos-tab-status-review" style={{ flex: 'none' }} />
                                : <Circle size={14} color="#94a3b8" style={{ flex: 'none' }} />}
                            <span>Task {tIdx + 1}: {lang === 'en' ? (task.titleEn ?? task.title) : task.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <footer className="mos-modal-foot">
              <button type="button" className="mos-btn" onClick={() => setSummaryOpen(false)}>Quay lại bài thi</button>
              <button type="button" className="mos-btn mos-btn-primary" disabled={submitting} onClick={() => { setSummaryOpen(false); void submitExam(false); }}>
                <Send size={14} /> Finish Exam & Chấm điểm
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
