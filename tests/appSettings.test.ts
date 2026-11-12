import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { DEFAULT_SETTINGS, getSettings, resetSettings, setSettings, subscribeSettings } from '../src/lib/appSettings';
import { tooltipFor } from '../src/lib/appChrome';
import { mergeFormatting, pasteModeFor, shellClasses } from '../src/editors/doc/docSettings';
import { buildMarks } from '../src/editors/doc/formattingMarks';
import { currentAuthorInitials, currentAuthorName } from '../src/lib/currentAuthor';

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'inline*' },
    text: { group: 'inline' },
    hardBreak: { group: 'inline', inline: true },
  },
});

const sampleDoc = () => schema.node('doc', null, [
  schema.node('paragraph', null, [schema.text('a b\tc'), schema.node('hardBreak'), schema.text('d e')]),
]);

test('settings start at defaults, merge patches and notify subscribers', () => {
  resetSettings();
  assert.deepEqual(getSettings(), DEFAULT_SETTINGS);
  let calls = 0;
  const stop = subscribeSettings(() => { calls += 1; });
  setSettings({ docZoom: 125, homeApps: { ...DEFAULT_SETTINGS.homeApps, pdf: false } });
  assert.equal(getSettings().docZoom, 125);
  assert.equal(getSettings().homeApps.pdf, false);
  assert.equal(getSettings().homeApps.doc, true);
  assert.equal(calls, 1);
  resetSettings(['docZoom']);
  assert.equal(getSettings().docZoom, DEFAULT_SETTINGS.docZoom);
  assert.equal(getSettings().homeApps.pdf, false);
  stop();
  resetSettings();
});

test('tooltips follow the chosen ScreenTip style', () => {
  const title = 'Hiện/ẩn ký hiệu định dạng (Ctrl+*)';
  assert.equal(tooltipFor(title, { tooltips: 'full', tooltipShortcuts: true }), title);
  assert.equal(tooltipFor(title, { tooltips: 'full', tooltipShortcuts: false }), 'Hiện/ẩn ký hiệu định dạng');
  assert.equal(tooltipFor('Chèn bảng — tạo bảng mới', { tooltips: 'short', tooltipShortcuts: true }), 'Chèn bảng');
  assert.equal(tooltipFor(title, { tooltips: 'none', tooltipShortcuts: true }), '');
});

test('paste mode separates internal copies from other programs', () => {
  const settings = { ...DEFAULT_SETTINGS, pasteSame: 'keep' as const, pasteOther: 'text' as const };
  assert.equal(pasteModeFor('<p data-pm-slice="1 1 []">x</p>', settings), 'keep');
  assert.equal(pasteModeFor('<p style="color:red">x</p>', settings), 'text');
  assert.equal(mergeFormatting('<p style="color:red" class="x"><span style="font-size:20px"><b>Đậm</b></span></p>'), '<p><b>Đậm</b></p>');
});

test('formatting marks decorate only the requested characters', () => {
  const doc = sampleDoc();
  assert.equal(buildMarks(doc, { spaces: false, tabs: false, breaks: false }).find().length, 0);
  const spaces = buildMarks(doc, { spaces: true, tabs: false, breaks: false }).find();
  assert.equal(spaces.length, 2);
  assert.ok(spaces.every((decoration) => (decoration as unknown as { type: { attrs: { class: string } } }).type.attrs.class === 'fm-space'));
  assert.equal(buildMarks(doc, { spaces: false, tabs: true, breaks: false }).find().length, 1);
  assert.equal(buildMarks(doc, { spaces: false, tabs: false, breaks: true }).find().length, 1);
  assert.equal(buildMarks(doc, { spaces: true, tabs: true, breaks: true }).find().length, 4);
});

test('editor shell classes reflect display and print options', () => {
  const classes = shellClasses({ ...DEFAULT_SETTINGS, markParagraphs: true, docHighlight: false, printDrawings: false, miniToolbar: false });
  for (const name of ['mark-paras', 'no-highlight', 'print-no-ink', 'no-mini-toolbar']) assert.ok(classes.includes(name), name);
  assert.equal(shellClasses(DEFAULT_SETTINGS).includes('mark-paras'), false);
});

test('comment author uses the personalised name and initials', () => {
  resetSettings();
  assert.equal(currentAuthorName(), 'Người dùng');
  setSettings({ userName: 'Bùi Đăng Minh' });
  assert.equal(currentAuthorName(), 'Bùi Đăng Minh');
  assert.equal(currentAuthorInitials(), 'ĐM');
  setSettings({ initials: 'bm' });
  assert.equal(currentAuthorInitials(), 'BM');
  resetSettings();
});
