import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import type { FileVersion, ImageContent } from '../src/lib/storage';

const require = createRequire(import.meta.url);
const editorPath = resolve('src/editors/image/ImageEditor.tsx');
const fixture: ImageContent = {
  kind: 'image', imageDataUrl: 'data:image/png;base64,fixture', mimeType: 'image/png',
  width: 200, height: 100, filter: 'grayscale(100%) brightness(150%)',
  rotation: 90, flipX: true, flipY: true, zoom: 150,
  comments: [{ id: 'note', author: 'Author', text: 'Original note', createdAt: 1, resolved: false }],
};

type Node = { type?: unknown; props?: Record<string, any> };

function createEditor(content: ImageContent, versions: FileVersion[] = []) {
  let index = 0;
  const values: any[] = [];
  let close: () => Promise<boolean>;
  let saved: ImageContent | undefined;
  let snapshot: ImageContent | undefined;
  const hooks = {
    useState(initial: any) {
      const slot = index++;
      if (!(slot in values)) values[slot] = typeof initial === 'function' ? initial() : initial;
      return [values[slot], (next: any) => { values[slot] = typeof next === 'function' ? next(values[slot]) : next; }];
    },
    useRef(initial: any) {
      const slot = index++;
      if (!(slot in values)) values[slot] = { current: initial };
      return values[slot];
    },
    useEffect() {}, useLayoutEffect() {}, useCallback: (fn: any) => fn, useMemo: (fn: any) => fn(),
  };
  const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
  const module = { exports: {} as { default: (props: any) => Node } };
  const compiled = transformSync(readFileSync(editorPath, 'utf8'), { loader: 'tsx', format: 'cjs', jsx: 'automatic' }).code;
  runInNewContext(compiled, {
    module, exports: module.exports, Date, console,
    require(name: string) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => key });
      if (name.endsWith('/Authentication')) return { useAccount: () => ({ user: { uid: 'test-account' }, login: async () => ({ uid: 'test-account' }) }) };
      if (name.endsWith('/storage')) return { useWorkspace: () => ({ listVersions: async () => versions, deleteVersion: async () => {} }) };
      if (name.endsWith('/ui')) return { useUi: () => ({ toast() {} }) };
      if (name.endsWith('/documentCloser')) return { useDocumentCloser: (fn: typeof close) => { close = fn; } };
      if (name.endsWith('/accountSnapshots')) return { saveAccountSnapshot: async ({ content: value }: { content: ImageContent }) => { snapshot = value; return { version: { id: 'snapshot', content: value } }; } };
      if (name.endsWith('/imageFormats')) return { formatFileSize: () => '1 KB', formatResolution: () => '', formatAspectRatio: () => '' };
      if (name.endsWith('.css')) return {};
      if (name.endsWith('/SuiteLogo')) return { SuiteLogo: 'SuiteLogo' };
      if (name === './ImagePrintDialog') return { ImagePrintDialog: 'ImagePrintDialog' };
      return require(resolve('src/editors/image', name));
    },
  });
  const props = {
    meta: { id: 'image', name: 'image.png', size: 1024 }, content,
    onSave: async (_meta: unknown, value: ImageContent) => { saved = value; return true; }, onRename() {}, onBack() {},
  };
  const render = () => { index = 0; return module.exports.default(props); };
  return { render, close: () => close(), saved: () => saved!, snapshot: () => snapshot! };
}

function nodes(tree: unknown): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  const node = tree as Node;
  return [node, ...nodes(node.props?.children)];
}

function button(tree: Node, text: string) {
  const found = nodes(tree).find((node) => node.type === 'button' && nodes(node).some((child) => child.props?.children === text));
  assert.ok(found, `Missing button ${text}`);
  return found.props!;
}

test('opening and saving an image retains stored filters and transformations', async () => {
  const editor = createEditor(fixture);
  editor.render();
  await editor.close();
  assert.equal(editor.saved().filter, fixture.filter);
  assert.equal(editor.saved().rotation, fixture.rotation);
  assert.equal(editor.saved().flipX, fixture.flipX);
  assert.equal(editor.saved().flipY, fixture.flipY);
});

test('image snapshot retains filters, transformations and comments', async () => {
  const editor = createEditor(fixture);
  const tree = editor.render();
  const historyButton = nodes(tree).find((node) => node.type === 'button' && node.props?.onClick?.name === 'handleOpenHistory');
  assert.ok(historyButton);
  await historyButton.props!.onClick();
  const snapshotButton = nodes(editor.render()).find((node) => node.type === 'button' && node.props?.onClick?.name === 'handleCreateSnapshot');
  assert.ok(snapshotButton);
  await snapshotButton.props!.onClick();
  assert.equal(editor.snapshot().filter, fixture.filter);
  assert.equal(editor.snapshot().rotation, fixture.rotation);
  assert.equal(editor.snapshot().flipY, fixture.flipY);
  assert.deepEqual(editor.snapshot().comments, fixture.comments);
});

test('restoring an image snapshot replaces filters, transformations and comments', async () => {
  const original = { ...fixture, filter: 'none', rotation: 0, flipX: false, flipY: false, comments: [] };
  const version: FileVersion = { id: 'version', fileId: 'image', timestamp: 1, label: 'Earlier image', content: fixture };
  const editor = createEditor(original, [version]);
  const tree = editor.render();
  const historyButton = nodes(tree).find((node) => node.type === 'button' && node.props?.onClick?.name === 'handleOpenHistory');
  assert.ok(historyButton);
  await historyButton.props!.onClick();
  button(editor.render(), 'Khôi phục').onClick();
  editor.render();
  await editor.close();
  assert.equal(editor.saved().filter, fixture.filter);
  assert.equal(editor.saved().rotation, fixture.rotation);
  assert.equal(editor.saved().flipX, fixture.flipX);
  assert.equal(editor.saved().flipY, fixture.flipY);
  assert.deepEqual(editor.saved().comments, fixture.comments);
});

test('editing a restored brightness control replaces its old value without compounding it', async () => {
  const editor = createEditor(fixture);
  const initial = editor.render();
  const adjustTab = nodes(initial).find((node) => node.type === 'button' && node.props?.onClick?.toString().includes('"adjust"'));
  assert.ok(adjustTab);
  adjustTab.props!.onClick();
  const slider = nodes(editor.render()).find((node) => node.type === 'input' && node.props?.type === 'range' && node.props?.value === 150);
  assert.ok(slider);
  slider.props!.onChange({ target: { value: '175' } });
  editor.render();
  await editor.close();
  assert.equal(editor.saved().filter, 'grayscale(100%) brightness(175%)');
  const reopened = createEditor(editor.saved());
  reopened.render();
  await reopened.close();
  assert.equal(reopened.saved().filter, editor.saved().filter);
});

test('restoring an old snapshot with no transforms resets current edits', async () => {
  const old: ImageContent = { kind: 'image', imageDataUrl: fixture.imageDataUrl, mimeType: fixture.mimeType, width: 200, height: 100 };
  const version: FileVersion = { id: 'old', fileId: 'image', timestamp: 1, label: 'Old image', content: old };
  const editor = createEditor(fixture, [version]);
  const historyButton = nodes(editor.render()).find((node) => node.type === 'button' && node.props?.onClick?.name === 'handleOpenHistory');
  await historyButton!.props!.onClick();
  button(editor.render(), 'Khôi phục').onClick();
  editor.render();
  await editor.close();
  assert.equal(editor.saved().filter, 'none');
  assert.equal(editor.saved().rotation, 0);
  assert.equal(editor.saved().flipX, false);
  assert.equal(editor.saved().flipY, false);
  assert.equal(editor.saved().comments?.length, 0);
});
