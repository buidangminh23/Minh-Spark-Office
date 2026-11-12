export type CameraCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type CameraShape = 'circle' | 'rounded' | 'rect';

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RecorderSetup {
  cameraDeviceId: string | null;
  micDeviceId: string | null;
  captureScreen: boolean;
  captureSystemAudio: boolean;
  cameraShape: CameraShape;
  mirror: boolean;
  fps: number;
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  extension: 'mp4' | 'webm';
  durationMs: number;
  slideTimeline: { slideIndex: number; atMs: number }[];
  hadScreen: boolean;
  hadCamera: boolean;
  narrations: { slideIndex: number; blob: Blob }[];
}

export interface MediaDeviceChoice {
  deviceId: string;
  label: string;
}

const MAX_OUTPUT_WIDTH = 1920;
const FALLBACK_WIDTH = 1280;
const FALLBACK_HEIGHT = 720;
const CAMERA_RING_WIDTH = 4;
const CAMERA_RING_COLOR = 'rgba(255,255,255,0.92)';
const CORNER_RADIUS_RATIO = 0.14;
const RECORD_TIMESLICE_MS = 1000;
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickRecordingMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CANDIDATES.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? '';
}

export function recordingSupport() {
  const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  return {
    camera: Boolean(media?.getUserMedia),
    screen: Boolean(media?.getDisplayMedia),
    recorder: typeof MediaRecorder !== 'undefined' && pickRecordingMime() !== '',
  };
}

export async function listMediaDevices(): Promise<{ cameras: MediaDeviceChoice[]; mics: MediaDeviceChoice[] }> {
  const devices = (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];
  const label = (device: MediaDeviceInfo, fallback: string, index: number) => device.label || `${fallback} ${index + 1}`;
  const cameras = devices.filter((d) => d.kind === 'videoinput');
  const mics = devices.filter((d) => d.kind === 'audioinput');
  return {
    cameras: cameras.map((d, i) => ({ deviceId: d.deviceId, label: label(d, 'Camera', i) })),
    mics: mics.map((d, i) => ({ deviceId: d.deviceId, label: label(d, 'Micro', i) })),
  };
}

export async function openCameraStream(deviceId: string | null, micId: string | null): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: deviceId === null ? false : { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: micId === null ? false : { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true },
  });
}

export function cornerRect(corner: CameraCorner, sizePx: number, viewport: { width: number; height: number }, margin = 24): ViewportRect {
  const x = corner.endsWith('left') ? margin : viewport.width - sizePx - margin;
  const y = corner.startsWith('top') ? margin : viewport.height - sizePx - margin;
  return { x, y, width: sizePx, height: sizePx };
}

function even(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

function shapePath(ctx: CanvasRenderingContext2D, rect: ViewportRect, shape: CameraShape) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
    return;
  }
  const radius = shape === 'rounded' ? Math.min(rect.width, rect.height) * CORNER_RADIUS_RATIO : 0;
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
}

function drawCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, rect: ViewportRect, mirror: boolean) {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const scale = Math.max(rect.width / vw, rect.height / vh);
  const sw = rect.width / scale;
  const sh = rect.height / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  ctx.save();
  if (mirror) {
    ctx.translate(rect.x * 2 + rect.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function hiddenVideo(stream: MediaStream): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  void video.play().catch(() => undefined);
  return video;
}

export class PresentationRecorder {
  private screenStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private screenVideo: HTMLVideoElement | null = null;
  private cameraVideo: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private audioContext: AudioContext | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private drawTimer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  private timeline: { slideIndex: number; atMs: number }[] = [];
  private mimeType = '';
  private cameraRect: () => ViewportRect | null = () => null;
  private cameraEnabled = true;
  private screenEndedHandler: (() => void) | null = null;
  private surface: string | undefined;
  private narrationEnabled = false;
  private narrationRecorder: MediaRecorder | null = null;
  private narrationSlide = -1;
  private narrationChunks: Blob[] = [];
  private narrationDone: Promise<void>[] = [];
  private narrations: { slideIndex: number; blob: Blob }[] = [];

  private setup: RecorderSetup;

  constructor(setup: RecorderSetup) {
    this.setup = setup;
  }

  get isRecording() {
    return this.recorder?.state === 'recording';
  }

  get isPaused() {
    return this.recorder?.state === 'paused';
  }

  get hasScreen() {
    return Boolean(this.screenStream);
  }

  elapsedMs(now = performance.now()) {
    if (!this.startedAt) return 0;
    const pausedNow = this.pausedAt ? now - this.pausedAt : 0;
    return Math.max(0, now - this.startedAt - this.pausedTotal - pausedNow);
  }

  setCameraRectProvider(provider: () => ViewportRect | null) {
    this.cameraRect = provider;
  }

  setCameraEnabled(enabled: boolean) {
    this.cameraEnabled = enabled;
    this.cameraStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  setMicMuted(muted: boolean) {
    this.cameraStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  onScreenEnded(handler: () => void) {
    this.screenEndedHandler = handler;
  }

  enableNarration(enabled: boolean) {
    this.narrationEnabled = enabled;
  }

  markSlide(slideIndex: number) {
    const atMs = this.elapsedMs();
    const last = this.timeline[this.timeline.length - 1];
    if (last && last.slideIndex === slideIndex) return;
    this.timeline.push({ slideIndex, atMs });
    if (this.recorder) this.startNarrationSegment(slideIndex);
  }

  private finishNarrationSegment() {
    const recorder = this.narrationRecorder;
    if (!recorder || recorder.state === 'inactive') return;
    const slideIndex = this.narrationSlide;
    const chunks = this.narrationChunks;
    this.narrationDone.push(
      new Promise<void>((resolve) => {
        recorder.onstop = () => {
          if (chunks.length) this.narrations.push({ slideIndex, blob: new Blob(chunks, { type: recorder.mimeType.split(';')[0] || 'audio/webm' }) });
          resolve();
        };
        recorder.stop();
      }),
    );
    this.narrationRecorder = null;
  }

  private startNarrationSegment(slideIndex: number) {
    if (!this.narrationEnabled) return;
    const tracks = this.cameraStream?.getAudioTracks() ?? [];
    if (tracks.length === 0) return;
    this.finishNarrationSegment();
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
    const recorder = new MediaRecorder(new MediaStream(tracks), { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 48_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.start(RECORD_TIMESLICE_MS);
    if (this.isPaused) recorder.pause();
    this.narrationRecorder = recorder;
    this.narrationChunks = chunks;
    this.narrationSlide = slideIndex;
  }

  async acquire(existingCamera: MediaStream | null) {
    this.cameraStream = existingCamera;
    if (!this.cameraStream && (this.setup.cameraDeviceId !== null || this.setup.micDeviceId !== null)) {
      this.cameraStream = await openCameraStream(this.setup.cameraDeviceId, this.setup.micDeviceId);
    }
    if (this.setup.captureScreen) {
      const options = {
        video: { frameRate: { ideal: this.setup.fps }, displaySurface: 'browser' },
        audio: this.setup.captureSystemAudio,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
        systemAudio: this.setup.captureSystemAudio ? 'include' : 'exclude',
      } as DisplayMediaStreamOptions;
      this.screenStream = await navigator.mediaDevices.getDisplayMedia(options);
      this.screenStream.getVideoTracks()[0]?.addEventListener('ended', () => this.screenEndedHandler?.());
    }
  }

  start() {
    this.mimeType = pickRecordingMime();
    if (!this.mimeType) throw new Error('Trình duyệt này không hỗ trợ ghi video.');
    this.screenVideo = this.screenStream ? hiddenVideo(this.screenStream) : null;
    const hasCameraVideo = Boolean(this.cameraStream?.getVideoTracks().length);
    this.cameraVideo = hasCameraVideo ? hiddenVideo(this.cameraStream!) : null;
    const settings = this.screenStream?.getVideoTracks()[0]?.getSettings() as (MediaTrackSettings & { displaySurface?: string }) | undefined;
    this.surface = settings?.displaySurface;
    const sourceWidth = settings?.width ?? FALLBACK_WIDTH;
    const sourceHeight = settings?.height ?? FALLBACK_HEIGHT;
    const scale = Math.min(1, MAX_OUTPUT_WIDTH / sourceWidth);
    this.canvas = document.createElement('canvas');
    this.canvas.width = even(sourceWidth * scale);
    this.canvas.height = even(sourceHeight * scale);
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Không khởi tạo được khung ghép hình.');
    const draw = () => this.drawFrame(ctx);
    draw();
    this.drawTimer = setInterval(draw, Math.round(1000 / this.setup.fps));
    const output = this.canvas.captureStream(this.setup.fps);
    const audio = this.mixAudio();
    audio?.getAudioTracks().forEach((track) => output.addTrack(track));
    this.recorder = new MediaRecorder(output, { mimeType: this.mimeType, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 160_000 });
    this.chunks = [];
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start(RECORD_TIMESLICE_MS);
    this.startedAt = performance.now();
    this.pausedTotal = 0;
    this.pausedAt = 0;
    this.timeline = [];
    this.narrations = [];
    this.narrationDone = [];
  }

  pause() {
    if (this.recorder?.state !== 'recording') return;
    this.recorder.pause();
    if (this.narrationRecorder?.state === 'recording') this.narrationRecorder.pause();
    this.pausedAt = performance.now();
  }

  resume() {
    if (this.recorder?.state !== 'paused') return;
    this.recorder.resume();
    if (this.narrationRecorder?.state === 'paused') this.narrationRecorder.resume();
    this.pausedTotal += performance.now() - this.pausedAt;
    this.pausedAt = 0;
  }

  async stop(): Promise<RecordingResult | null> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      this.dispose();
      return null;
    }
    const durationMs = this.elapsedMs();
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    this.finishNarrationSegment();
    await Promise.all([stopped, ...this.narrationDone]);
    const mimeType = this.mimeType.split(';')[0];
    const result: RecordingResult = {
      blob: new Blob(this.chunks, { type: mimeType }),
      mimeType,
      extension: mimeType === 'video/mp4' ? 'mp4' : 'webm',
      durationMs,
      slideTimeline: [...this.timeline],
      hadScreen: Boolean(this.screenStream),
      hadCamera: Boolean(this.cameraVideo),
      narrations: [...this.narrations],
    };
    this.dispose();
    return result;
  }

  dispose(keepCamera = false) {
    if (this.drawTimer) clearInterval(this.drawTimer);
    this.drawTimer = null;
    this.screenStream?.getTracks().forEach((track) => track.stop());
    if (!keepCamera) this.cameraStream?.getTracks().forEach((track) => track.stop());
    void this.audioContext?.close().catch(() => undefined);
    this.screenStream = null;
    this.screenVideo = null;
    this.cameraVideo = null;
    this.audioContext = null;
    this.recorder = null;
    this.canvas = null;
  }

  private mixAudio(): MediaStream | null {
    const sources = [this.cameraStream, this.screenStream].filter((stream): stream is MediaStream => Boolean(stream?.getAudioTracks().length));
    if (sources.length === 0) return null;
    this.audioContext = new AudioContext();
    const destination = this.audioContext.createMediaStreamDestination();
    for (const stream of sources) this.audioContext.createMediaStreamSource(stream).connect(destination);
    return destination.stream;
  }

  private videoRect(rect: ViewportRect, canvas: HTMLCanvasElement): ViewportRect {
    const viewW = Math.max(1, window.innerWidth);
    const viewH = Math.max(1, window.innerHeight);
    if (!this.surface || this.surface === 'browser') {
      const sx = canvas.width / viewW;
      const sy = canvas.height / viewH;
      return { x: rect.x * sx, y: rect.y * sy, width: rect.width * sx, height: rect.height * sy };
    }
    const size = (rect.width / viewW) * canvas.width;
    const margin = canvas.width * 0.02;
    const right = rect.x + rect.width / 2 > viewW / 2;
    const bottom = rect.y + rect.height / 2 > viewH / 2;
    return {
      x: right ? canvas.width - size - margin : margin,
      y: bottom ? canvas.height - size * (rect.height / rect.width) - margin : margin,
      width: size,
      height: size * (rect.height / rect.width),
    };
  }

  private drawFrame(ctx: CanvasRenderingContext2D) {
    const canvas = ctx.canvas;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (this.screenVideo && this.screenVideo.videoWidth > 0) {
      ctx.drawImage(this.screenVideo, 0, 0, canvas.width, canvas.height);
    } else if (!this.screenStream && this.cameraVideo && this.cameraEnabled) {
      drawCover(ctx, this.cameraVideo, { x: 0, y: 0, width: canvas.width, height: canvas.height }, this.setup.mirror);
      return;
    }
    if (!this.cameraVideo || !this.cameraEnabled || this.cameraVideo.videoWidth === 0) return;
    const rect = this.cameraRect();
    if (!rect) return;
    const target = this.videoRect(rect, canvas);
    const sx = canvas.width / Math.max(1, window.innerWidth);
    ctx.save();
    shapePath(ctx, target, this.setup.cameraShape);
    ctx.clip();
    drawCover(ctx, this.cameraVideo, target, this.setup.mirror);
    ctx.restore();
    ctx.save();
    shapePath(ctx, target, this.setup.cameraShape);
    ctx.lineWidth = CAMERA_RING_WIDTH * sx;
    ctx.strokeStyle = CAMERA_RING_COLOR;
    ctx.stroke();
    ctx.restore();
  }
}

export function timelineToSlideSeconds(timeline: { slideIndex: number; atMs: number }[], totalMs: number): Map<number, number> {
  const seconds = new Map<number, number>();
  timeline.forEach((entry, index) => {
    const end = timeline[index + 1]?.atMs ?? totalMs;
    const duration = Math.max(0, end - entry.atMs) / 1000;
    seconds.set(entry.slideIndex, (seconds.get(entry.slideIndex) ?? 0) + duration);
  });
  return seconds;
}

export function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
