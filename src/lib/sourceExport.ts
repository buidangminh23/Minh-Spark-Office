import type { PresentationData } from './slideTypes';
import { contentSignature, loadSourceFile, type SourceFile } from './sourceFiles';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const docSignature = (json: unknown, page: unknown) => contentSignature({ json, page });

export async function unchangedDocx(id: string, json: unknown, page: unknown): Promise<Blob | null> {
  const source = await loadSourceFile(id);
  if (!source?.signature || source.signature !== docSignature(json, page)) return null;
  return new Blob([source.bytes as BlobPart], { type: DOCX_MIME });
}

const presentationFrame = (presentation: PresentationData) => contentSignature({ ...presentation, slides: [] });

export const presentationStamp = (presentation: PresentationData): Pick<SourceFile, 'signature' | 'parts'> => ({
  signature: contentSignature(presentation),
  parts: [presentationFrame(presentation), ...presentation.slides.map((slide) => contentSignature(slide))],
});

export async function buildPptxKeepingSource(
  id: string | undefined,
  presentation: PresentationData,
  build: (presentation: PresentationData) => Promise<Uint8Array>,
): Promise<Uint8Array> {
  const source = id ? await loadSourceFile(id) : undefined;
  if (!source?.signature || !source.parts?.length) return build(presentation);
  if (source.signature === contentSignature(presentation)) return source.bytes;
  const generated = await build(presentation);
  const [frame, ...slides] = source.parts;
  if (frame !== presentationFrame(presentation)) return generated;
  try {
    const { mergePresentation, planSlides } = await import('./pptxPreserve');
    return await mergePresentation(source.bytes, generated, planSlides(slides, presentation.slides.map((slide) => contentSignature(slide))));
  } catch (error) {
    console.warn('Original slides could not be kept:', error);
    return generated;
  }
}
