import type { PresentationData } from './slideTypes';
import { contentSignature, loadSourceFile, type SourceFile } from './sourceFiles';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const docSignature = (json: unknown, page: unknown) => contentSignature({ json, page });

type FlatDoc = { content?: unknown[] };

export async function docStamp(source: SourceFile, json: unknown, page: unknown, flat: FlatDoc): Promise<Pick<SourceFile, 'signature' | 'blocks'>> {
  const signature = docSignature(json, page);
  try {
    const { stampDocBlocks } = await import('./docxPreserve');
    const blocks = await stampDocBlocks(source.bytes, (flat.content ?? []) as never[]);
    return blocks ? { signature, blocks: { ...blocks, page: contentSignature(page) } } : { signature };
  } catch {
    return { signature };
  }
}

export async function docxKeepingSource(id: string, json: unknown, page: unknown, flat: FlatDoc, build: () => Promise<Blob>): Promise<Blob> {
  const source = await loadSourceFile(id);
  if (!source?.signature) return build();
  if (source.signature === docSignature(json, page)) return new Blob([source.bytes as BlobPart], { type: DOCX_MIME });
  const generated = await build();
  if (!source.blocks || source.blocks.page !== contentSignature(page)) return generated;
  try {
    const { mergeDocument } = await import('./docxPreserve');
    const merged = await mergeDocument(source.bytes, new Uint8Array(await generated.arrayBuffer()), source.blocks, (flat.content ?? []) as never[]);
    return new Blob([merged as BlobPart], { type: DOCX_MIME });
  } catch (error) {
    console.warn('Original document blocks could not be kept:', error);
    return generated;
  }
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
