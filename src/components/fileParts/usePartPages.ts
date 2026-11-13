import { useEffect, useRef, useState } from 'react';
import { partLabels, partsFormat, type WordSplitUnit } from '../../lib/fileParts';
import type { WordPhysicalPages } from '../../lib/wordPageMap';
import { measureWordPages } from '../../lib/desktopWordPages';
import { readAsDataUrl } from '../../lib/download';

const MAX_THUMBS = 240;
const THUMB_WIDTH = 240;

export type PartPages = {
  key: string;
  labels: string[];
  thumbs: (string | undefined)[];
  reading: boolean;
  error?: string;
  layout?: WordPhysicalPages;
  canMeasure?: boolean;
};

export type PageRequest = { file: File; unit: WordSplitUnit; measure?: number };

const requestKey = ({ unit, measure = 0 }: PageRequest) => `${unit}:${measure}`;

async function renderThumbs(file: File, count: number, publish: (thumbs: (string | undefined)[]) => void, cancelled: () => boolean) {
  const { openPdfDocument, renderPageThumbnail } = await import('../../editors/pdf/pdfRender');
  const handle = openPdfDocument(await readAsDataUrl(file));
  try {
    const { doc } = await handle.opened;
    const thumbs: (string | undefined)[] = Array(count).fill(undefined);
    const last = Math.min(count, doc.numPages, MAX_THUMBS);
    for (let page = 1; page <= last; page += 1) {
      if (cancelled()) return;
      thumbs[page - 1] = await renderPageThumbnail(doc, page, THUMB_WIDTH);
      if (page % 4 === 0 || page === last) publish(thumbs.slice());
    }
  } finally {
    await handle.close();
  }
}

export function usePartPages(requests: PageRequest[]) {
  const [pages, setPages] = useState<Map<File, PartPages>>(() => new Map());
  const started = useRef(new Map<File, string>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    for (const request of requests) {
      const { file } = request;
      const key = requestKey(request);
      if (started.current.get(file) === key) continue;
      started.current.set(file, key);
      const current = () => mounted.current && started.current.get(file) === key;
      const update = (patch: Partial<PartPages>) => {
        if (!current()) return;
        setPages((map) => new Map(map).set(file, { key, labels: [], thumbs: [], reading: true, ...(map.get(file)?.key === key ? map.get(file) : undefined), ...patch }));
      };
      update({});
      void (async () => {
        const isWordPages = partsFormat(file) === 'docx' && request.unit === 'pages';
        try {
          const layout = isWordPages && request.measure ? await measureWordPages(file) : undefined;
          const labels = await partLabels(file, request.unit, layout);
          update({ labels, layout, reading: false, error: labels.length ? undefined : 'Tệp chưa có nội dung.' });
          if (partsFormat(file) === 'pdf' && labels.length) await renderThumbs(file, labels.length, (thumbs) => update({ thumbs }), () => !current());
        } catch (reason) {
          update({
            reading: false,
            error: reason instanceof Error ? reason.message : 'Không đọc được tệp.',
            canMeasure: isWordPages && (Boolean(request.measure) || (reason instanceof Error && reason.name === 'WordPaginationError')),
          });
        }
      })();
    }
  }, [requests]);

  return pages;
}
