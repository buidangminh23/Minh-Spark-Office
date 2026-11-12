import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Maximize2, Mic, MicOff, Minimize2, Pause, Play, Square } from 'lucide-react';
import {
  PresentationRecorder, cornerRect, formatDuration, listMediaDevices, openCameraStream, recordingSupport, type CameraCorner, type CameraShape,
  type MediaDeviceChoice, type RecorderSetup,
} from '../../lib/slideRecorder';
import { Dialog, Field } from './ribbonParts';

export interface RecordingPrefs {
  setup: RecorderSetup;
  saveTimings: boolean;
  saveNarrations: boolean;
  corner: CameraCorner;
  sizePct: number;
}

const PREFS_KEY = 'minh-slides-record-prefs';
const DEFAULT_SIZE_PCT = 22;
const MIN_SIZE_PCT = 12;
const MAX_SIZE_PCT = 55;
const COUNTDOWN_SECONDS = 3;
const MINI_SIZE = 46;
const BAR_HIDE_DELAY_MS = 1500;
const BAR_INITIAL_MS = 4000;

function loadPrefs(): Partial<RecordingPrefs> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<RecordingPrefs>;
  } catch {
    return {};
  }
}

function savePrefs(prefs: RecordingPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, setup: { ...prefs.setup } }));
  } catch {
    // Browser storage blocked; preferences stay for this session only.
  }
}

interface SetupProps {
  title: string;
  onCancel: () => void;
  onStart: (prefs: RecordingPrefs, preview: MediaStream | null) => void;
}

export function RecordSetupDialog({ title, onCancel, onStart }: SetupProps) {
  const stored = loadPrefs();
  const support = recordingSupport();
  const [cameras, setCameras] = useState<MediaDeviceChoice[]>([]);
  const [mics, setMics] = useState<MediaDeviceChoice[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(stored.setup?.cameraDeviceId ?? '');
  const [micId, setMicId] = useState<string | null>(stored.setup?.micDeviceId ?? '');
  const [shape, setShape] = useState<CameraShape>(stored.setup?.cameraShape ?? 'circle');
  const [mirror, setMirror] = useState(stored.setup?.mirror ?? true);
  const [systemAudio, setSystemAudio] = useState(stored.setup?.captureSystemAudio ?? true);
  const [saveTimings, setSaveTimings] = useState(stored.saveTimings ?? true);
  const [saveNarrations, setSaveNarrations] = useState(stored.saveNarrations ?? false);
  const corner: CameraCorner = stored.corner ?? 'bottom-right';
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handedOff = useRef(false);

  useEffect(() => {
    let cancelled = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (!support.camera || (cameraId === null && micId === null)) return;
    openCameraStream(cameraId, micId)
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
        setError('');
        const devices = await listMediaDevices();
        if (!cancelled) {
          setCameras(devices.cameras);
          setMics(devices.mics);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Chưa được cấp quyền camera/micro. Bấm biểu tượng ổ khóa trên thanh địa chỉ để cho phép.');
      });
    return () => {
      cancelled = true;
    };
  }, [cameraId, micId, support.camera]);

  useEffect(() => () => {
    if (!handedOff.current) streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = () => {
    const prefs: RecordingPrefs = {
      setup: { cameraDeviceId: cameraId, micDeviceId: micId, captureScreen: support.screen, captureSystemAudio: systemAudio, cameraShape: shape, mirror, fps: 30 },
      saveTimings,
      saveNarrations,
      corner,
      sizePct: stored.sizePct ?? DEFAULT_SIZE_PCT,
    };
    savePrefs(prefs);
    handedOff.current = true;
    onStart(prefs, streamRef.current);
  };

  const radius = shape === 'circle' ? '50%' : shape === 'rounded' ? '16%' : '6px';
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      wide
      footer={
        <>
          <button type="button" className="ppt-secondary-action-btn" onClick={onCancel}>Hủy</button>
          <button type="button" className="ppt-primary-action-btn" disabled={!support.recorder} onClick={start}>
            <span className="ppx-rec-dot is-live" /> Bắt đầu ghi
          </button>
        </>
      }
    >
      {!support.recorder && <div className="ppx-warn">Trình duyệt này không ghi được video. Hãy dùng Chrome hoặc Edge bản mới.</div>}
      {!support.screen && <div className="ppx-warn">Thiết bị này không cho ghi màn hình. Video sẽ chỉ có camera và tiếng.</div>}
      {error && <div className="ppx-warn">{error}</div>}
      <div className="ppx-rec-setup">
        <div className="ppx-rec-preview" style={{ borderRadius: radius }}>
          {cameraId === null ? <div className="ppt-cameo-placeholder"><CameraOff size={32} /><span>Đã tắt camera</span></div> : <video ref={videoRef} muted playsInline style={{ transform: mirror ? 'scaleX(-1)' : undefined }} />}
        </div>
        <div className="ppx-rec-options">
          <Field label="Camera">
            <select className="ppt-select" value={cameraId ?? 'off'} onChange={(e) => setCameraId(e.target.value === 'off' ? null : e.target.value)}>
              <option value="">Camera mặc định</option>
              {cameras.map((c) => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
              <option value="off">Không dùng camera</option>
            </select>
          </Field>
          <Field label="Micro">
            <select className="ppt-select" value={micId ?? 'off'} onChange={(e) => setMicId(e.target.value === 'off' ? null : e.target.value)}>
              <option value="">Micro mặc định</option>
              {mics.map((m) => <option key={m.deviceId} value={m.deviceId}>{m.label}</option>)}
              <option value="off">Không ghi tiếng</option>
            </select>
          </Field>
          <Field label="Khung camera">
            <select className="ppt-select" value={shape} onChange={(e) => setShape(e.target.value as CameraShape)}>
              <option value="circle">Tròn</option>
              <option value="rounded">Bo góc</option>
              <option value="rect">Chữ nhật</option>
            </select>
          </Field>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Lật ảnh camera như soi gương</label>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={systemAudio} onChange={(e) => setSystemAudio(e.target.checked)} /> Ghi cả âm thanh của trang (video, hiệu ứng)</label>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={saveTimings} onChange={(e) => setSaveTimings(e.target.checked)} /> Lưu thời gian từng trang vào bài</label>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={saveNarrations} disabled={micId === null} onChange={(e) => setSaveNarrations(e.target.checked)} /> Lưu lời thuyết minh vào từng trang chiếu</label>
        </div>
      </div>
      <div className="ppx-muted">
        Sau khi bấm Bắt đầu ghi, trình duyệt hỏi chia sẻ màn hình: chọn <b>thẻ này</b>. Trong lúc ghi, kéo khung camera tới chỗ bất kỳ, kéo chấm tròn ở góc khung để phóng to hoặc thu nhỏ, hoặc bấm <Minimize2 size={11} /> để thu gọn vào góc gần nhất. Video vẫn ghi đủ trang chiếu và camera.
      </div>
    </Dialog>
  );
}

interface OverlayProps {
  recorder: PresentationRecorder;
  preview: MediaStream | null;
  prefs: RecordingPrefs;
  onStarted: () => void;
  onStop: () => void;
}

export function RecordingOverlay({ recorder, preview, prefs, onStarted, onStop }: OverlayProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [minimized, setMinimized] = useState(false);
  const [corner, setCorner] = useState<CameraCorner>(prefs.corner);
  const [sizePct, setSizePct] = useState(prefs.sizePct);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(prefs.setup.cameraDeviceId === null);
  const [elapsed, setElapsed] = useState(0);
  const [barVisible, setBarVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ anchorX: number; anchorY: number; growX: 1 | -1; growY: 1 | -1 } | null>(null);
  const hasCamera = Boolean(preview?.getVideoTracks().length);
  const sizeBase = Math.min(window.innerWidth, window.innerHeight * 1.6);
  const sizePx = Math.round((sizeBase * sizePct) / 100);
  const shape = prefs.setup.cameraShape;

  useEffect(() => {
    if (videoRef.current && preview) {
      videoRef.current.srcObject = preview;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [preview, minimized]);

  const currentRect = useCallback(() => {
    if (!hasCamera) return null;
    if (minimized || !bubbleRef.current) return cornerRect(corner, sizePx, { width: window.innerWidth, height: window.innerHeight });
    const rect = bubbleRef.current.getBoundingClientRect();
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }, [hasCamera, minimized, corner, sizePx]);

  useLayoutEffect(() => {
    recorder.setCameraRectProvider(currentRect);
  }, [recorder, currentRect]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        try {
          recorder.start();
          onStarted();
        } catch {
          onStop();
        }
      }
      setCountdown((v) => v - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, recorder, onStarted, onStop]);

  useEffect(() => {
    if (countdown > 0) return;
    const timer = setInterval(() => setElapsed(recorder.elapsedMs()), 250);
    return () => clearInterval(timer);
  }, [countdown, recorder]);

  useEffect(() => {
    recorder.onScreenEnded(onStop);
  }, [recorder, onStop]);

  const revealBar = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setBarVisible(true);
  }, []);
  const scheduleHide = useCallback((delay = BAR_HIDE_DELAY_MS) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBarVisible(false), delay);
  }, []);
  useEffect(() => {
    if (countdown === 0) scheduleHide(BAR_INITIAL_MS);
  }, [countdown, scheduleHide]);
  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const togglePause = () => {
    if (recorder.isPaused) recorder.resume();
    else recorder.pause();
    setPaused(recorder.isPaused);
  };

  const minimizeToNearestCorner = () => {
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (rect) {
      const right = rect.left + rect.width / 2 > window.innerWidth / 2;
      const bottom = rect.top + rect.height / 2 > window.innerHeight / 2;
      setCorner(`${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}` as CameraCorner);
    }
    setMinimized(true);
    setPosition(null);
  };
  const onResizeDown = (event: React.PointerEvent) => {
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;
    const growX = rect.left + rect.width / 2 < window.innerWidth / 2 ? 1 : -1;
    const growY = rect.top + rect.height / 2 < window.innerHeight / 2 ? 1 : -1;
    resizeRef.current = { anchorX: growX > 0 ? rect.left : rect.right, anchorY: growY > 0 ? rect.top : rect.bottom, growX, growY };
    setPosition({ x: rect.left, y: rect.top });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.stopPropagation();
  };
  const onResizeMove = (event: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    const reachX = r.growX > 0 ? window.innerWidth - r.anchorX : r.anchorX;
    const reachY = r.growY > 0 ? window.innerHeight - r.anchorY : r.anchorY;
    const wanted = Math.max((event.clientX - r.anchorX) * r.growX, (event.clientY - r.anchorY) * r.growY);
    const minPx = (sizeBase * MIN_SIZE_PCT) / 100;
    const maxPx = Math.min((sizeBase * MAX_SIZE_PCT) / 100, reachX, reachY);
    const next = Math.max(minPx, Math.min(maxPx, wanted));
    setSizePct((next / sizeBase) * 100);
    setPosition({ x: r.growX > 0 ? r.anchorX : r.anchorX - next, y: r.growY > 0 ? r.anchorY : r.anchorY - next });
  };
  const onResizeUp = () => {
    resizeRef.current = null;
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest('button, .ppx-rec-resize')) return;
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.stopPropagation();
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - sizePx, event.clientX - dragRef.current.dx)),
      y: Math.max(0, Math.min(window.innerHeight - sizePx, event.clientY - dragRef.current.dy)),
    });
  };
  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (!position) return;
    const right = position.x + sizePx / 2 > window.innerWidth / 2;
    const bottom = position.y + sizePx / 2 > window.innerHeight / 2;
    setCorner(`${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}` as CameraCorner);
  };

  const radius = shape === 'circle' ? '50%' : shape === 'rounded' ? '16%' : '6px';
  const anchor = position ?? cornerRect(corner, sizePx, { width: window.innerWidth, height: window.innerHeight });
  const mini = cornerRect(corner, MINI_SIZE, { width: window.innerWidth, height: window.innerHeight });

  return (
    <div className="ppx-rec-overlay" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {countdown > 0 && <div className="ppx-rec-countdown">{countdown}</div>}
      {hasCamera && !minimized && (
        <div
          ref={bubbleRef}
          className="ppx-rec-bubble"
          style={{ left: anchor.x, top: anchor.y, width: sizePx, height: sizePx, borderRadius: radius }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerEnter={revealBar}
          onPointerLeave={() => scheduleHide()}
        >
          {cameraOff ? <div className="ppt-cameo-placeholder"><CameraOff size={24} /></div> : <video ref={videoRef} muted playsInline style={{ transform: prefs.setup.mirror ? 'scaleX(-1)' : undefined }} />}
          <div className="ppx-rec-bubble-tools">
            <button type="button" onClick={() => setSizePct((v) => Math.max(MIN_SIZE_PCT, v - 4))} title="Thu nhỏ khung">−</button>
            <button type="button" onClick={() => setSizePct((v) => Math.min(MAX_SIZE_PCT, v + 4))} title="Phóng to khung">+</button>
            <button type="button" onClick={minimizeToNearestCorner} title="Thu gọn vào góc (vẫn ghi camera)"><Minimize2 size={14} /></button>
          </div>
          <span
            className={`ppx-rec-resize is-${anchor.y + sizePx / 2 < window.innerHeight / 2 ? 'b' : 't'}${anchor.x + sizePx / 2 < window.innerWidth / 2 ? 'r' : 'l'}`}
            role="separator"
            aria-label="Kéo để đổi cỡ khung camera"
            title="Kéo để phóng to hoặc thu nhỏ khung camera"
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
          />
        </div>
      )}
      {hasCamera && minimized && (
        <button type="button" className="ppx-rec-mini" style={{ left: mini.x, top: mini.y, width: MINI_SIZE, height: MINI_SIZE }} onClick={() => setMinimized(false)} title="Mở lại khung camera">
          <Maximize2 size={18} />
        </button>
      )}
      <div className="ppx-rec-hotzone" onPointerEnter={revealBar} />
      <div className={`ppx-rec-bar ${barVisible || countdown > 0 ? '' : 'is-hidden'}`} onPointerEnter={revealBar} onPointerLeave={() => scheduleHide()}>
        <span className={`ppx-rec-dot ${countdown <= 0 && !paused ? 'is-live' : ''}`} />
        <span className="ppx-rec-time">{countdown > 0 ? 'Chuẩn bị…' : paused ? `Tạm dừng ${formatDuration(elapsed)}` : formatDuration(elapsed)}</span>
        <button type="button" disabled={countdown > 0} onClick={togglePause} title={paused ? 'Tiếp tục ghi' : 'Tạm dừng'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
        <button type="button" onClick={() => { setMicMuted((m) => !m); recorder.setMicMuted(!micMuted); }} title={micMuted ? 'Bật micro' : 'Tắt micro'}>{micMuted ? <MicOff size={14} /> : <Mic size={14} />}</button>
        {hasCamera && (
          <button type="button" onClick={() => { setCameraOff((c) => !c); recorder.setCameraEnabled(cameraOff); }} title={cameraOff ? 'Bật camera' : 'Tắt camera'}>{cameraOff ? <CameraOff size={14} /> : <Camera size={14} />}</button>
        )}
        <button type="button" className="is-stop" onClick={onStop} title="Dừng ghi và lưu video"><Square size={13} /> Dừng</button>
      </div>
    </div>
  );
}
