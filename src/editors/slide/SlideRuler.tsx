import type { SlideAspect } from '../../lib/slideTypes';
interface SlideRulerProps {
  aspectRatio: SlideAspect;
  zoom: number;
}

export function SlideHorizontalRuler({ zoom }: SlideRulerProps) {
  const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <div className="ppt-ruler-horizontal" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'left center' }}>
      {ticks.map((t) => (
        <div key={t} className="ppt-ruler-tick-h" style={{ left: `${t}%` }}>
          <span className="ppt-ruler-label">{t}%</span>
          <span className="ppt-ruler-mark" />
        </div>
      ))}
    </div>
  );
}

export function SlideVerticalRuler({ zoom }: SlideRulerProps) {
  const ticks = [0, 20, 40, 60, 80, 100];

  return (
    <div className="ppt-ruler-vertical" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
      {ticks.map((t) => (
        <div key={t} className="ppt-ruler-tick-v" style={{ top: `${t}%` }}>
          <span className="ppt-ruler-label">{t}%</span>
          <span className="ppt-ruler-mark" />
        </div>
      ))}
    </div>
  );
}
