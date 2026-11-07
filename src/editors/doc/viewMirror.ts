import type { MirrorPayload } from './ui/MirrorWindow';
import { newId, type DocCtx } from './DocContext';
import { styleSheetCss } from './docStyles';
import { pageDimensions } from './ui/Paper';

const mirrors = new Map<string, () => void>();

export const openMirrorChannel = (ctx: DocCtx) => {
  const channel = newId('w');
  const bus = new BroadcastChannel(`minh-docs-mirror-${channel}`);
  const dims = pageDimensions(ctx.page.size, ctx.page.orientation);
  const payload = (): MirrorPayload => {
    const clone = ctx.editor.view.dom.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.page-spacer, .page-spacer-row, .ProseMirror-widget').forEach((el) => el.remove());
    return {
      html: clone.innerHTML,
      css: styleSheetCss(ctx.page),
      title: ctx.title,
      width: dims.width,
      fontFamily: ctx.page.fontFamily,
      fontSize: ctx.page.fontSize,
      padding: `${ctx.page.margins.top}px ${ctx.page.margins.right}px ${ctx.page.margins.bottom}px ${ctx.page.margins.left}px`,
    };
  };
  let timer: ReturnType<typeof setTimeout> | null = null;
  const send = () => bus.postMessage(payload());
  const update = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(send, 250);
  };
  bus.onmessage = (event) => { if (event.data === 'ready') send(); };
  ctx.editor.on('update', update);
  mirrors.set(channel, () => {
    ctx.editor.off('update', update);
    bus.postMessage('closed');
    bus.close();
  });
  return channel;
};

export const disposeMirrors = () => {
  mirrors.forEach((dispose) => dispose());
  mirrors.clear();
};
