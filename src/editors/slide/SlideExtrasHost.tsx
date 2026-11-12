import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { PresentationData, SlideAspect, SlideElement } from '../../lib/slideTypes';
import { PresentationRecorder, timelineToSlideSeconds, type RecordingResult } from '../../lib/slideRecorder';
import { downloadBlob } from '../../lib/download';
import { newElementId, type ShowLaunch, type SlideDialog } from './slideExtrasContext';
import {
  AltTextDialog, DateTimeDialog, FontDialog, HeaderFooterDialog, IconsDialog, InsertTableDialog, LinkDialog, ObjectDialog, ParagraphDialog,
  ReplaceFontsDialog, SectionRenameDialog, SizePositionDialog, SymbolDialog,
} from './SlideTextDialogs';
import {
  CompressDialog, CropDialog, ExportVideoDialog, HandoutMasterDialog, LanguageDialog, MacrosDialog, NotesMasterDialog, RecordMediaDialog,
  SetupShowDialog, SlideSizeDialog, ThesaurusDialog, TranslateDialog,
} from './SlideToolDialogs';
import { RecordSetupDialog, RecordingOverlay, type RecordingPrefs } from './SlideRecordingStudio';

interface DialogHostProps {
  dialog: SlideDialog | null;
  onClose: () => void;
  onInsertTable: (rows: number, cols: number) => void;
  onChangeAspect: (aspect: SlideAspect) => void;
  onExportVideo: (secondsPerSlide: number, useTimings: boolean) => void;
}

export function SlideDialogHost({ dialog, onClose, onInsertTable, onChangeAspect, onExportVideo }: DialogHostProps) {
  if (!dialog) return null;
  switch (dialog) {
    case 'font':
      return <FontDialog onClose={onClose} />;
    case 'paragraph':
      return <ParagraphDialog onClose={onClose} />;
    case 'replace-fonts':
      return <ReplaceFontsDialog onClose={onClose} />;
    case 'insert-table':
      return <InsertTableDialog onClose={onClose} onInsert={onInsertTable} />;
    case 'link':
      return <LinkDialog onClose={onClose} />;
    case 'header-footer':
      return <HeaderFooterDialog onClose={onClose} />;
    case 'date-time':
      return <DateTimeDialog onClose={onClose} />;
    case 'symbol':
    case 'insert-symbol-text':
      return <SymbolDialog onClose={onClose} />;
    case 'icons':
      return <IconsDialog onClose={onClose} />;
    case 'object':
      return <ObjectDialog onClose={onClose} />;
    case 'alt-text':
      return <AltTextDialog onClose={onClose} />;
    case 'section-rename':
      return <SectionRenameDialog onClose={onClose} />;
    case 'size-position':
      return <SizePositionDialog onClose={onClose} />;
    case 'slide-size':
      return <SlideSizeDialog onClose={onClose} onApply={onChangeAspect} />;
    case 'setup-show':
    case 'monitor':
    case 'subtitles':
      return <SetupShowDialog onClose={onClose} />;
    case 'export-video':
      return <ExportVideoDialog onClose={onClose} onStart={onExportVideo} />;
    case 'language':
      return <LanguageDialog onClose={onClose} />;
    case 'thesaurus':
      return <ThesaurusDialog onClose={onClose} />;
    case 'translate':
      return <TranslateDialog onClose={onClose} />;
    case 'handout-master':
      return <HandoutMasterDialog onClose={onClose} />;
    case 'notes-master':
      return <NotesMasterDialog onClose={onClose} />;
    case 'macros':
      return <MacrosDialog onClose={onClose} />;
    case 'crop':
      return <CropDialog onClose={onClose} />;
    case 'compress':
      return <CompressDialog onClose={onClose} />;
    case 'record-audio':
      return <RecordMediaDialog onClose={onClose} kind="audio" />;
    case 'screen-record':
      return <RecordMediaDialog onClose={onClose} kind="screen" />;
    case 'record-studio':
      return null;
  }
}

export interface ActiveShow {
  launch: ShowLaunch;
  autoAdvanceSeconds?: number;
  useTimings?: boolean;
}

interface SessionDeps {
  fileName: string;
  getPresentation: () => PresentationData;
  commit: (updater: (current: PresentationData) => PresentationData) => void;
  setActiveSlideIndex: (index: number) => void;
  activeSlideIndex: number;
  toast: (text: string, error?: boolean) => void;
  confirm: (title: string, message?: ReactNode) => Promise<boolean>;
}

interface RecordingState {
  recorder: PresentationRecorder;
  prefs: RecordingPrefs;
  preview: MediaStream | null;
  exportOnly: boolean;
}

const NARRATION_PREFIX = 'Thuyết minh';
const NARRATION_SIZE = 6;
const EXPORT_START_DELAY_MS = 800;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Bài thuyết trình';
}

function narrationElement(url: string, slideIndex: number): SlideElement {
  return {
    id: newElementId('narr'),
    type: 'audio',
    name: `${NARRATION_PREFIX} trang ${slideIndex + 1}`,
    x: 100 - NARRATION_SIZE - 2,
    y: 100 - NARRATION_SIZE * 1.8 - 2,
    width: NARRATION_SIZE,
    height: NARRATION_SIZE * 1.8,
    zIndex: 90,
    audioData: { url, name: `${NARRATION_PREFIX} trang ${slideIndex + 1}`, autoplay: true, hideDuringShow: true, volume: 1 },
  };
}

export function useShowSession(deps: SessionDeps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const [show, setShow] = useState<ActiveShow | null>(null);
  const [pendingRecord, setPendingRecord] = useState<ShowLaunch | null>(null);
  const [recording, setRecording] = useState<RecordingState | null>(null);
  const rehearsal = useRef<{ index: number; enteredAt: number; totals: Map<number, number> } | null>(null);
  const stopping = useRef(false);

  const beginShow = useCallback((active: ActiveShow) => {
    const d = depsRef.current;
    if (!active.launch.fromCurrent) d.setActiveSlideIndex(0);
    const start = active.launch.fromCurrent ? d.activeSlideIndex : 0;
    rehearsal.current = active.launch.rehearse ? { index: start, enteredAt: performance.now(), totals: new Map() } : null;
    setShow(active);
  }, []);

  const launch = useCallback((next: ShowLaunch) => {
    if (next.recording) {
      setPendingRecord(next);
      return;
    }
    beginShow({ launch: next });
  }, [beginShow]);

  const onIndexChange = useCallback((index: number) => {
    recording?.recorder.markSlide(index);
    const r = rehearsal.current;
    if (r && r.index !== index) {
      const now = performance.now();
      r.totals.set(r.index, (r.totals.get(r.index) ?? 0) + (now - r.enteredAt));
      r.index = index;
      r.enteredAt = now;
    }
  }, [recording]);

  const saveRecordingResult = useCallback(async (result: RecordingResult, prefs: RecordingPrefs, exportOnly: boolean) => {
    const d = depsRef.current;
    downloadBlob(result.blob, `${safeName(d.fileName)}${exportOnly ? '' : ' - bản ghi'}.${result.extension}`);
    if (exportOnly) {
      d.toast(`Đã xuất video ${result.extension.toUpperCase()}`);
      return;
    }
    const seconds = prefs.saveTimings ? timelineToSlideSeconds(result.slideTimeline, result.durationMs) : new Map<number, number>();
    const narrations = prefs.saveNarrations ? await Promise.all(result.narrations.map(async (n) => ({ slideIndex: n.slideIndex, url: await blobToDataUrl(n.blob) }))) : [];
    if (seconds.size > 0 || narrations.length > 0) {
      d.commit((p) => ({
        ...p,
        slides: p.slides.map((s, i) => {
          const raw = seconds.get(i);
          const sec = raw === undefined ? undefined : Math.max(1, Math.round(raw));
          const audio = narrations.filter((n) => n.slideIndex === i);
          const kept = audio.length ? s.elements.filter((el) => !(el.type === 'audio' && (el.name ?? '').startsWith(NARRATION_PREFIX))) : s.elements;
          return {
            ...s,
            ...(sec !== undefined ? { rehearsedSeconds: sec, transition: { ...s.transition, advanceAfterSeconds: sec } } : {}),
            elements: [...kept, ...audio.map((n) => narrationElement(n.url, i))],
          };
        }),
      }));
    }
    d.toast(`Đã lưu video ${result.extension.toUpperCase()}${seconds.size ? ', thời gian từng trang' : ''}${narrations.length ? ' và lời thuyết minh' : ''}`);
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording || stopping.current) return;
    stopping.current = true;
    const { recorder, prefs, exportOnly } = recording;
    try {
      const result = await recorder.stop();
      setShow(null);
      setRecording(null);
      if (result && result.blob.size > 0) await saveRecordingResult(result, prefs, exportOnly);
      else depsRef.current.toast('Bản ghi trống, chưa có gì được lưu', true);
    } finally {
      recorder.dispose();
      stopping.current = false;
    }
  }, [recording, saveRecordingResult]);

  const startRecording = useCallback((prefs: RecordingPrefs, preview: MediaStream | null, base: ShowLaunch, exportOptions?: { seconds: number; useTimings: boolean }) => {
    const recorder = new PresentationRecorder(prefs.setup);
    recorder.enableNarration(prefs.saveNarrations && prefs.setup.micDeviceId !== null);
    setPendingRecord(null);
    recorder
      .acquire(preview)
      .then(() => {
        setRecording({ recorder, prefs, preview, exportOnly: Boolean(exportOptions) });
        if (exportOptions) {
          window.setTimeout(() => {
            try {
              recorder.start();
              recorder.markSlide(0);
            } catch {
              depsRef.current.toast('Trình duyệt này không hỗ trợ ghi video.', true);
            }
          }, EXPORT_START_DELAY_MS);
        }
        beginShow({ launch: { ...base, recording: true }, autoAdvanceSeconds: exportOptions?.seconds, useTimings: exportOptions?.useTimings });
      })
      .catch(() => {
        recorder.dispose();
        preview?.getTracks().forEach((t) => t.stop());
        depsRef.current.toast('Chưa ghi được: bạn cần cho phép chia sẻ thẻ này.', true);
      });
  }, [beginShow]);

  const exportVideo = useCallback((seconds: number, useTimings: boolean) => {
    const prefs: RecordingPrefs = {
      setup: { cameraDeviceId: null, micDeviceId: null, captureScreen: true, captureSystemAudio: true, cameraShape: 'circle', mirror: false, fps: 30 },
      saveTimings: false,
      saveNarrations: false,
      corner: 'bottom-right',
      sizePct: 22,
    };
    startRecording(prefs, null, { fromCurrent: false, exportVideo: true }, { seconds, useTimings });
  }, [startRecording]);

  const closeShow = useCallback(async () => {
    if (recording) {
      await stopRecording();
      return;
    }
    const r = rehearsal.current;
    setShow(null);
    if (!r) return;
    rehearsal.current = null;
    r.totals.set(r.index, (r.totals.get(r.index) ?? 0) + (performance.now() - r.enteredAt));
    const total = Math.round([...r.totals.values()].reduce((a, b) => a + b, 0) / 1000);
    const d = depsRef.current;
    const keep = await d.confirm('Lưu thời gian diễn tập?', `Tổng thời lượng: ${Math.floor(total / 60)} phút ${total % 60} giây. Lưu để trang chiếu tự chuyển theo thời gian này khi trình chiếu.`);
    if (!keep) return;
    d.commit((p) => ({
      ...p,
      slides: p.slides.map((s, i) => {
        const ms = r.totals.get(i);
        if (ms === undefined) return s;
        const sec = Math.max(1, Math.round(ms / 1000));
        return { ...s, rehearsedSeconds: sec, transition: { ...s.transition, advanceAfterSeconds: sec } };
      }),
    }));
    d.toast('Đã lưu thời gian diễn tập');
  }, [recording, stopRecording]);

  const overlay = recording && !recording.exportOnly ? (
    <RecordingOverlay
      recorder={recording.recorder}
      preview={recording.preview}
      prefs={recording.prefs}
      onStarted={() => recording.recorder.markSlide(depsRef.current.activeSlideIndex)}
      onStop={() => void stopRecording()}
    />
  ) : null;

  const setupDialog = pendingRecord ? (
    <RecordSetupDialog
      title={pendingRecord.fromCurrent ? 'Ghi bài thuyết trình từ trang hiện tại' : 'Ghi bài thuyết trình từ đầu'}
      onCancel={() => setPendingRecord(null)}
      onStart={(prefs, preview) => startRecording(prefs, preview, pendingRecord)}
    />
  ) : null;

  return { show, launch, closeShow, onIndexChange, overlay, setupDialog, exportVideo, stopRecording, isRecording: Boolean(recording) };
}
