import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Flag,
  HelpCircle,
  PanelBottom,
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
} from '../../lib/mos/grader';
import type {
  MosAttemptRecord,
  MosProject,
  MosSessionConfig,
  MosTaskGrade,
} from '../../lib/mos/types';
import type { DocContent, FileContent, FileMeta, SheetContent, SlideContent } from '../../lib/storage';
import { useUi } from '../ui';

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

export function MosExamRunner({
  config,
  onCancel,
  onFinish,
  onSaveCopyToWorkspace,
}: {
  config: MosSessionConfig;
  onCancel: () => void;
  onFinish: (attempt: MosAttemptRecord) => void;
  onSaveCopyToWorkspace: (name: string, content: FileContent) => void;
}) {
  const ui = useUi();
  const track = trackMeta(config.track);
  const examCode = examCodeFor(config.track, config.version, config.level);
  const domains = useMemo(() => domainsForTrack(config.track), [config.track]);

  const projects = useMemo(
    () => config.projectIds.map((id) => projectById(id)).filter((p): p is MosProject => Boolean(p)),
    [config.projectIds],
  );

  const [started, setStarted] = useState(config.mode !== 'exam');
  const [editorReady, setEditorReady] = useState(() => Boolean(loadedEditors[track.editorKind]));
  const [editorError, setEditorError] = useState('');
  const [projectIndex, setProjectIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | number>(0);
  const [consoleHeight, setConsoleHeight] = useState(218);
  const [fontIndex, setFontIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [reviewTasks, setReviewTasks] = useState<Record<string, boolean>>({});
  const [liveChecks, setLiveChecks] = useState<Record<string, MosTaskGrade>>({});
  const [resetEpochs, setResetEpochs] = useState<Record<string, number>>({});
  const [elapsedSec, setElapsedSec] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [initialDocs, setInitialDocs] = useState<Record<string, FileContent>>(() =>
    Object.fromEntries(projects.map((p) => [p.id, p.createStarter()])),
  );

  const docsRef = useRef<Record<string, FileContent>>({});
  const elapsedRef = useRef(0);
  const submittedRef = useRef(false);

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

  const submitExam = useCallback(async (autoByTimeout = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await saveActiveDocumentForExit().catch(() => false);
      const snapshot: Record<string, FileContent> = {};
      for (const project of projects) {
        snapshot[project.id] = docsRef.current[project.id] ?? project.createStarter();
      }
      const attempt = gradeExamAttempt({
        config,
        contentsByProjectId: snapshot,
        durationSec: Math.max(1, elapsedRef.current),
      });
      if (autoByTimeout) ui.toast('Hết thời gian làm bài. Hệ thống đã tự động nộp bài và chấm điểm.');
      onFinish(attempt);
    } finally {
      setSubmitting(false);
    }
  }, [config, onFinish, projects, ui]);

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

  const switchProject = async (nextIndex: number, nextTab: 'overview' | number = 0) => {
    if (nextIndex < 0 || nextIndex >= projects.length) return;
    await saveActiveDocumentForExit().catch(() => false);
    if (currentProject && docsRef.current[currentProject.id]) {
      const savedCopy = structuredClone(docsRef.current[currentProject.id]);
      setInitialDocs((prev) => ({ ...prev, [currentProject.id]: savedCopy }));
    }
    setProjectIndex(nextIndex);
    setActiveTab(nextTab);
    setShowHint(false);
  };

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
    const content = docsRef.current[currentProject.id] ?? currentProject.createStarter();
    onSaveCopyToWorkspace(currentProject.fileName, structuredClone(content));
  };

  const handleCheckCurrentTask = async () => {
    if (!currentProject || !currentTask) return;
    await saveActiveDocumentForExit().catch(() => false);
    const content = docsRef.current[currentProject.id] ?? currentProject.createStarter();
    const result = gradeSingleTask(currentProject, currentTask.id, content);
    setLiveChecks((prev) => ({ ...prev, [currentTask.id]: result }));
    if (result.passed) {
      setCompletedTasks((prev) => ({ ...prev, [currentTask.id]: true }));
      ui.toast(`Đạt: ${currentTask.title}`);
    } else {
      ui.toast(result.detail, true);
    }
  };

  const handleGradeProject = async () => {
    await saveActiveDocumentForExit().catch(() => false);
    if (projectIndex + 1 < projects.length) {
      const ok = await ui.confirm(
        `Grade Project ${projectIndex + 1} / ${projects.length}`,
        `Lưu bài làm dự án “${currentProject?.title}” và chuyển sang Dự án ${projectIndex + 2}? Bạn vẫn có thể quay lại từ nút Summary.`,
        false,
      );
      if (ok) void switchProject(projectIndex + 1, 0);
      return;
    }
    const total = projects.reduce((sum, p) => sum + tasksForProjectInSession(p, config.focusTaskIds).length, 0);
    const done = Object.values(completedTasks).filter(Boolean).length;
    const review = Object.values(reviewTasks).filter(Boolean).length;
    const msg = review > 0
      ? `Đã đánh dấu hoàn thành ${done}/${total} nhiệm vụ (còn ${review} câu Mark for review). Xác nhận nộp toàn bộ bài thi để chấm điểm MOS?`
      : `Đã đánh dấu hoàn thành ${done}/${total} nhiệm vụ. Xác nhận nộp bài và xem Phiếu điểm MOS (thang 1000 điểm)?`;
    const ok = await ui.confirm('Nộp bài & Chấm điểm MOS', msg, false);
    if (ok) void submitExam(false);
  };

  const handleExit = async () => {
    const ok = await ui.confirm(
      'Thoát phòng thi MOS',
      'Bài làm chưa nộp sẽ không được lưu vào lịch sử điểm. Bạn có muốn quay về trang Ôn thi MOS?',
      false,
    );
    if (ok) onCancel();
  };

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = consoleHeight;
    const onMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      setConsoleHeight(Math.max(168, Math.min(420, startHeight + delta)));
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

  const DocEditor = loadedEditors.doc;
  const SheetEditor = loadedEditors.sheet;
  const SlideEditor = loadedEditors.slide;

  if (!started) {
    return (
      <div className="mos-modal-backdrop" role="presentation">
        <section className="mos-modal" role="dialog" aria-modal="true" aria-label="Hướng dẫn trước khi bắt đầu bài thi MOS">
          <header className="mos-modal-head">
            <h2>Phòng thi mô phỏng MOS · {track.title} ({examCode})</h2>
            <button type="button" className="mos-modal-close" aria-label="Huỷ" onClick={onCancel}>
              <X size={18} />
            </button>
          </header>
          <div className="mos-modal-body">
            <div className="mos-briefing-grid">
              <div className="mos-briefing-cell">
                <span>Mã kỳ thi</span>
                <strong>{examCode} · MOS {config.version}</strong>
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
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Quy chế giao diện thi thật</h3>
              <ul className="mos-rules-list">
                <li>3/4 màn hình phía trên là phần mềm <strong>{track.appName}</strong> thực tế; 1/4 phía dưới là khung câu hỏi chuẩn MOS (thanh xanh dương, thẻ <strong>Overview / Task 1..5</strong> và 4 nút <strong>Previous Task / Mark Completed / Mark for review / Next Task</strong>).</li>
                <li>Bấm <strong>Summary</strong> trên thanh xanh để xem tổng quan mọi dự án và nhảy tới bất kỳ câu nào.</li>
                <li>Bấm <strong>Restart Project</strong> để khôi phục tệp gốc dự án hiện tại; bấm <strong>Grade Project</strong> để chuyển dự án tiếp theo hoặc nộp bài chấm điểm.</li>
                <li>{config.allowHints ? 'Chế độ này bật nút ? (Gợi ý Ribbon) và Check Task (kiểm tra đúng/sai ngay lập tức).' : 'Chế độ thi thử ẩn gợi ý và tự động chấm điểm khi nộp bài hoặc hết giờ.'}</li>
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

  const isLastTaskInProject = typeof activeTab === 'number' && activeTab >= currentTasks.length - 1;
  const isLastProject = projectIndex >= projects.length - 1;
  const effectiveConsoleHeight = Math.max(consoleHeight, (config.allowHints && showHint) || (config.allowLiveCheck && currentCheck) ? 276 : consoleHeight);

  return (
    <div className="mos-runner" role="application" aria-label={`Phòng thi ${track.title}`}>
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
      </div>

      <div className="mos-splitter" onMouseDown={startResize} title="Kéo để chỉnh chiều cao khung đề thi" />

      <section className="mos-console" style={{ height: effectiveConsoleHeight }} aria-label="Khung câu hỏi MOS chuẩn phòng thi">
        <div className="mos-compass-bar">
          <div className="mos-compass-left">
            <button
              type="button"
              className="mos-compass-icon-btn"
              aria-label={config.allowHints ? 'Gợi ý thao tác' : 'Hướng dẫn phòng thi'}
              aria-pressed={showHint}
              title={config.allowHints ? 'Bật/tắt gợi ý đường dẫn Ribbon' : 'Xem hướng dẫn phòng thi'}
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
            <span className="mos-compass-proj">Project {projectIndex + 1} / {projects.length}</span>
            <span className="mos-compass-code">{examCode}</span>
          </div>

          <div className="mos-compass-center">
            <span className={`mos-compass-timer ${timerUrgent ? 'is-urgent' : timerWarn ? 'is-warn' : ''}`} aria-live="off">
              {remainingSec !== null ? formatHms(remainingSec) : formatHms(elapsedSec)}
            </span>
          </div>

          <div className="mos-compass-right">
            <button type="button" className="mos-compass-link" onClick={() => setSummaryOpen(true)}>
              Summary
            </button>
            <button type="button" className="mos-compass-link" onClick={() => void handleRestartProject()}>
              Restart Project
            </button>
            <button type="button" className="mos-compass-link" onClick={() => void handleSaveProject()}>
              Save Project
            </button>
            <button type="button" className="mos-compass-link is-grade" disabled={submitting} onClick={() => void handleGradeProject()}>
              {isLastProject ? 'Finish Exam' : 'Grade Project'}
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
                onClick={() => { setActiveTab('overview'); setShowHint(false); }}
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
                    onClick={() => { setActiveTab(idx); setShowHint(false); }}
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
              <div className="mos-task-inner">
                {activeTab === 'overview' || !currentTask ? (
                  <>
                    <div className="mos-task-meta-line">
                      <strong>Project {projectIndex + 1}: {currentProject.title}</strong>
                      <span className="mos-task-domain">{currentProject.fileName}</span>
                      <span>{currentTasks.length} Tasks</span>
                    </div>
                    <p className="mos-task-instruction">{currentProject.scenario}</p>
                  </>
                ) : (
                  <>
                    <div className="mos-task-meta-line">
                      <strong>Task {(typeof activeTab === 'number' ? activeTab : 0) + 1} · {currentTask.title}</strong>
                      {domainMap.get(currentTask.domainId) && (
                        <span className="mos-task-domain">
                          {domainMap.get(currentTask.domainId)?.code} · {domainMap.get(currentTask.domainId)?.name}
                        </span>
                      )}
                    </div>
                    <p className="mos-task-instruction">{currentTask.instruction}</p>

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
              <button
                type="button"
                className="mos-real-btn is-nav"
                disabled={activeTab === 'overview'}
                onClick={() => {
                  if (typeof activeTab === 'number') {
                    setActiveTab(activeTab === 0 ? 'overview' : activeTab - 1);
                    setShowHint(false);
                  }
                }}
              >
                Previous Task
              </button>

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
                Mark Completed
              </button>

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
                Mark for review
              </button>

              <button
                type="button"
                className="mos-real-btn is-nav"
                disabled={isLastTaskInProject && isLastProject}
                onClick={() => {
                  if (activeTab === 'overview') {
                    setActiveTab(0);
                    setShowHint(false);
                  } else if (!isLastTaskInProject) {
                    setActiveTab(activeTab + 1);
                    setShowHint(false);
                  } else if (!isLastProject) {
                    void switchProject(projectIndex + 1, 0);
                  }
                }}
              >
                {isLastTaskInProject && !isLastProject ? 'Next Project' : 'Next Task'}
              </button>

              {config.allowLiveCheck && currentTask && (
                <button
                  type="button"
                  className="mos-real-btn is-check"
                  onClick={() => void handleCheckCurrentTask()}
                >
                  <ShieldCheck size={14} /> Kiểm tra câu
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {summaryOpen && (
        <div className="mos-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSummaryOpen(false); }}>
          <section className="mos-modal mos-modal-lg" role="dialog" aria-modal="true" aria-label="Summary — Tổng quan bài thi">
            <header className="mos-modal-head">
              <h2>Summary · {track.title} ({examCode})</h2>
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
                      <span>Project {pIdx + 1}: {proj.title} ({proj.fileName})</span>
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
                            <span>Task {tIdx + 1}: {task.title}</span>
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
              <button type="button" className="mos-btn mos-btn-primary" onClick={() => { setSummaryOpen(false); void submitExam(false); }}>
                <Send size={14} /> Finish Exam & Chấm điểm
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
