import { useMemo, useState } from 'react';
import type { PresentationData, SlideData } from '../../lib/slideTypes';
import { PrintDialog } from '../../components/print/PrintDialog';
import type { PrintItem, PrintSource } from '../../components/print/printTypes';
import { SlideCanvas } from './SlideCanvas';

type Layout = 'full' | 'notes' | 'h2' | 'h3' | 'h4' | 'h6' | 'h9';

const SLIDE_HEIGHT = 540;
const NOTES_PAGE_RATIO = Math.SQRT2;
const NOTES_PAD = 48;

const LAYOUTS: { value: Layout; label: string; grid?: { cols: number; rows: number } }[] = [
  { value: 'full', label: 'Mỗi trang 1 trang chiếu' },
  { value: 'notes', label: 'Trang chiếu kèm ghi chú' },
  { value: 'h2', label: 'Tờ phát tay · 2 trang chiếu', grid: { cols: 1, rows: 2 } },
  { value: 'h3', label: 'Tờ phát tay · 3 trang chiếu', grid: { cols: 1, rows: 3 } },
  { value: 'h4', label: 'Tờ phát tay · 4 trang chiếu', grid: { cols: 2, rows: 2 } },
  { value: 'h6', label: 'Tờ phát tay · 6 trang chiếu', grid: { cols: 2, rows: 3 } },
  { value: 'h9', label: 'Tờ phát tay · 9 trang chiếu', grid: { cols: 3, rows: 3 } },
];

const noop = () => undefined;

function StaticSlide({ slide, presentation, index }: { slide: SlideData; presentation: PresentationData; index: number }) {
  return (
    <div className="mp-slide">
      <SlideCanvas
        slide={slide}
        aspectRatio={presentation.aspectRatio}
        zoom={100}
        selectedElementId={null}
        onSelectElement={noop}
        onUpdateElement={noop}
        readOnly
        showAnimBadges={false}
        watermark={presentation.watermark}
        slideMaster={presentation.slideMaster}
        slideIndex={index}
      />
    </div>
  );
}

function NotesPage({ slide, presentation, index, width }: { slide: SlideData; presentation: PresentationData; index: number; width: number }) {
  const slideScale = (width - NOTES_PAD * 2) / width;
  return (
    <div className="mp-notes-page" style={{ width, height: Math.round(width * NOTES_PAGE_RATIO), padding: NOTES_PAD }}>
      <div style={{ width: width - NOTES_PAD * 2, height: SLIDE_HEIGHT * slideScale, overflow: 'hidden', outline: '1px solid #cbd5e1' }}>
        <div style={{ transform: `scale(${slideScale})`, transformOrigin: '0 0' }}>
          <StaticSlide slide={slide} presentation={presentation} index={index} />
        </div>
      </div>
      <div className="mp-notes-text">
        <strong>Ghi chú · Trang chiếu {index + 1}</strong>
        <p>{slide.notes?.trim() || 'Không có ghi chú.'}</p>
      </div>
    </div>
  );
}

type Props = { presentation: PresentationData; title: string; activeIndex: number; onClose: () => void };

export function SlidePrintDialog({ presentation, title, activeIndex, onClose }: Props) {
  const [layout, setLayout] = useState<Layout>('full');
  const [includeHidden, setIncludeHidden] = useState(false);
  const width = presentation.aspectRatio === '4:3' ? 720 : 960;
  const option = LAYOUTS.find((l) => l.value === layout)!;

  const source: PrintSource = useMemo(() => {
    const entries = presentation.slides.map((slide, index) => ({ slide, index })).filter(({ slide }) => includeHidden || !slide.hidden);
    const items: PrintItem[] = entries.map(({ slide, index }) =>
      layout === 'notes'
        ? { key: slide.id, size: { w: width, h: Math.round(width * NOTES_PAGE_RATIO) }, render: () => <NotesPage slide={slide} presentation={presentation} index={index} width={width} /> }
        : { key: slide.id, size: { w: width, h: SLIDE_HEIGHT }, render: () => <StaticSlide slide={slide} presentation={presentation} index={index} /> },
    );
    const current = Math.max(0, entries.findIndex((e) => e.index === activeIndex));
    return {
      kind: 'slide',
      title,
      items,
      currentItem: current,
      perPage: option.grid ? { ...option.grid, gapMm: 6 } : undefined,
    };
  }, [presentation, includeHidden, layout, width, title, activeIndex, option.grid]);

  const extra = (
    <>
      <h3>Trang chiếu</h3>
      <label className="mp-field">
        <span>Bố cục in</span>
        <select className="text-field" value={layout} onChange={(e) => setLayout(e.target.value as Layout)}>
          {LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </label>
      <label className="mp-check"><input type="checkbox" checked={includeHidden} onChange={(e) => setIncludeHidden(e.target.checked)} /><span>In cả trang chiếu ẩn</span></label>
    </>
  );

  return <PrintDialog source={source} onClose={onClose} extraOptions={extra} />;
}
