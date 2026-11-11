const editorLoaders = {
  doc: () => import('../editors/doc/DocEditor'),
  sheet: () => import('../editors/sheet/SheetEditor'),
  pdf: () => import('../editors/pdf/PdfEditor'),
  slide: () => import('../editors/slide/SlideEditor'),
  image: () => import('../editors/image/ImageEditor'),
};

export type EditorKind = keyof typeof editorLoaders;
type LoadedEditors = { [K in EditorKind]?: Awaited<ReturnType<(typeof editorLoaders)[K]>>['default'] };

const HOVER_DWELL_MS = 150;

export const loadedEditors: LoadedEditors = {};

export const loadEditor = async (kind: EditorKind) => {
  const module = await editorLoaders[kind]();
  (loadedEditors as Record<EditorKind, unknown>)[kind] = module.default;
};

export const preloadEditor = (kind: EditorKind) => {
  if (loadedEditors[kind]) return;
  void loadEditor(kind).catch(() => undefined);
};

let hoverTimer: ReturnType<typeof setTimeout> | undefined;

export const editorIntentHandlers = (kind: EditorKind) => ({
  onPointerEnter: () => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => preloadEditor(kind), HOVER_DWELL_MS);
  },
  onPointerLeave: () => clearTimeout(hoverTimer),
  onPointerDown: () => {
    clearTimeout(hoverTimer);
    preloadEditor(kind);
  },
});
