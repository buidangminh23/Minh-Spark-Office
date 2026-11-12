import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CameraOff, FileText, Link2, Music2, Pause, Play } from 'lucide-react';
import type { SlideElement } from '../../lib/slideTypes';
import { INDENT_STEP_PX, displayText, listMarker, textDirectionStyle } from '../../lib/slideTextOps';
import { cropClipPath, imageFilterCss } from '../../lib/slideImageOps';
import { formatBytes } from '../../lib/download';
import { slideIcon } from './slideIconLibrary';

export function textDecorationOf(el: SlideElement): CSSProperties['textDecoration'] {
  const parts: string[] = [];
  if (el.textDecoration === 'underline') parts.push('underline');
  if (el.strikethrough || el.textDecoration === 'line-through') parts.push('line-through');
  return parts.length ? parts.join(' ') : 'none';
}

export function textEffectStyle(el: SlideElement): CSSProperties {
  const style: CSSProperties = {
    letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
    ...textDirectionStyle(el.textDirection),
  };
  if (el.textColumns && el.textColumns > 1) {
    style.columnCount = el.textColumns;
    style.columnGap = '24px';
    style.display = 'block';
  }
  if (el.textOutline) style.WebkitTextStroke = `1.2px ${el.textOutline}`;
  const shadows: string[] = [];
  if (el.textShadow) shadows.push('0 2px 4px rgba(0,0,0,0.3)');
  if (el.textGlow) shadows.push(`0 0 6px ${el.textGlow}`, `0 0 14px ${el.textGlow}`, `0 0 24px ${el.textGlow}`);
  if (shadows.length) style.textShadow = shadows.join(', ');
  return style;
}

function lineInner(el: SlideElement, line: string): ReactNode {
  const text = line || ' ';
  if (el.textGradient) {
    return (
      <span style={{ backgroundImage: el.textGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{text}</span>
    );
  }
  if (el.highlight) {
    return <span style={{ background: el.highlight, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '0 2px' }}>{text}</span>;
  }
  return text;
}

export function RichTextLines({ el, slideIndex }: { el: SlideElement; slideIndex: number }) {
  const lines = displayText(el, slideIndex).split('\n');
  const indent = (el.indentLevel ?? 0) * INDENT_STEP_PX;
  let counter = -1;
  return (
    <>
      {lines.map((line, idx) => {
        const hasMarker = el.isBullet && line.trim().length > 0;
        if (hasMarker) counter += 1;
        return (
          <div key={idx} style={{ paddingLeft: indent + (el.isBullet ? 26 : 0), position: 'relative', breakInside: 'avoid' }}>
            {hasMarker && (
              <span aria-hidden="true" style={{ position: 'absolute', left: indent, width: 22, textAlign: 'right', paddingRight: 6, boxSizing: 'border-box' }}>
                {listMarker(el, counter)}
              </span>
            )}
            {lineInner(el, line)}
          </div>
        );
      })}
    </>
  );
}

export function imageEffectStyle(el: SlideElement): { filter?: string; crop?: string } {
  return { filter: imageFilterCss(el.imageAdjust), crop: cropClipPath(el.crop) };
}

export function IconElementView({ el }: { el: SlideElement }) {
  const Icon = slideIcon(el.iconName);
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="img" aria-label={el.altText || el.iconName}>
      <Icon width="100%" height="100%" color={el.fill || el.color || '#1E293B'} strokeWidth={el.strokeWidth ? Math.max(0.5, el.strokeWidth) : 1.75} />
    </div>
  );
}

const sharedStreams = new Map<string, { stream: Promise<MediaStream>; users: number }>();

function acquireCamera(deviceId: string | undefined) {
  const key = deviceId ?? 'default';
  let entry = sharedStreams.get(key);
  if (!entry) {
    entry = {
      stream: navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false }),
      users: 0,
    };
    sharedStreams.set(key, entry);
  }
  entry.users += 1;
  return {
    stream: entry.stream,
    release: () => {
      const current = sharedStreams.get(key);
      if (!current) return;
      current.users -= 1;
      if (current.users > 0) return;
      sharedStreams.delete(key);
      void current.stream.then((s) => s.getTracks().forEach((track) => track.stop())).catch(() => undefined);
    },
  };
}

export function CameoElementView({ el, live }: { el: SlideElement; live: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const deviceId = el.cameoData?.deviceId;
  useEffect(() => {
    if (!live || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    const handle = acquireCamera(deviceId);
    handle.stream
      .then((stream) => {
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setError('Chưa được cấp quyền camera');
      });
    return () => {
      cancelled = true;
      handle.release();
    };
  }, [deviceId, live]);
  const shape = el.cameoData?.shape ?? 'circle';
  const radius = shape === 'circle' ? '50%' : shape === 'rounded' ? '16%' : '4px';
  return (
    <div className="ppt-cameo" style={{ borderRadius: radius, border: `${el.strokeWidth ?? 3}px solid ${el.stroke || '#FFFFFF'}` }}>
      {live && !error ? (
        <video ref={videoRef} muted playsInline style={{ transform: el.cameoData?.mirror === false ? undefined : 'scaleX(-1)' }} />
      ) : (
        <div className="ppt-cameo-placeholder">
          <CameraOff size={28} />
          <span>{error || 'Camera (Cameo)'}</span>
        </div>
      )}
    </div>
  );
}

export function AudioElementView({ el, presenting }: { el: SlideElement; presenting: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const data = el.audioData;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !presenting || !data?.autoplay) return;
    audio.volume = data.volume ?? 1;
    void audio.play().catch(() => undefined);
    return () => audio.pause();
  }, [presenting, data?.autoplay, data?.volume, data?.url]);
  if (!data) return null;
  const hidden = presenting && data.hideDuringShow;
  const toggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  };
  return (
    <div className="ppt-audio-el" style={{ opacity: hidden ? 0 : 1 }}>
      <audio ref={audioRef} src={data.url} loop={data.loop} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <button type="button" className="ppt-audio-btn" onClick={toggle} onPointerDown={(e) => presenting && e.stopPropagation()} title={data.name || 'Âm thanh'}>
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <Music2 size={22} color="#D83B01" />
      <span className="ppt-audio-name">{data.name || 'Âm thanh'}</span>
    </div>
  );
}

export function ObjectElementView({ el }: { el: SlideElement }) {
  const data = el.objectData;
  if (!data) return null;
  return (
    <div className="ppt-object-el" title={`${data.name} (${formatBytes(data.size)})`}>
      <FileText size={34} color="#2563EB" />
      <span className="ppt-object-name">{data.name}</span>
      <span className="ppt-object-size">{formatBytes(data.size)}</span>
    </div>
  );
}

export function LinkBadge({ el }: { el: SlideElement }) {
  if (!el.link) return null;
  return (
    <div className="ppt-link-badge" title={el.link.tooltip || (el.link.kind === 'url' ? el.link.url : 'Liên kết trong bài')}>
      <Link2 size={10} />
    </div>
  );
}
