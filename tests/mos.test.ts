import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocumentCloseRegistry } from '../src/lib/documentCloser.ts';
import { drillsForTrack } from '../src/lib/mos/drills.ts';
import {
  ALL_MOS_PROJECTS,
  buildPresetSession,
  examCodeFor,
  gradeExamAttempt,
  gradeProject,
  MOS_MAX_SCORE,
  projectsForTrack,
} from '../src/lib/mos/grader.ts';
import { emptyProgress, recordMosAttempt, recordMosDrill, trackReadiness } from '../src/lib/mos/progress.ts';
import { emptySheet } from '../src/lib/workbookBasics.ts';
import type { DocContent, SheetContent, SlideContent } from '../src/lib/storage.ts';

test('every MOS starter project starts with 0 passed tasks so nothing passes accidentally', () => {
  assert.equal(ALL_MOS_PROJECTS.length, 12);
  for (const project of ALL_MOS_PROJECTS) {
    const starter = project.createStarter();
    const graded = gradeProject(project, starter);
    assert.equal(graded.totalCount, 5, `${project.id} must have 5 tasks`);
    assert.equal(
      graded.passedCount,
      0,
      `${project.id} starter had unexpected passes: ${graded.tasks.filter((t) => t.passed).map((t) => t.taskId).join(', ')}`,
    );
  }
});

test('MOS Word Associate + Expert projects grade accurately to 1000/1000 when solved', () => {
  const projects = projectsForTrack('word', 'expert');
  assert.equal(projects.length, 4);

  const d1 = projects[0].createStarter() as DocContent;
  d1.page.orientation = 'landscape';
  d1.page.margins = { top: 48, right: 48, bottom: 48, left: 48 };
  d1.page.watermark = 'CONFIDENTIAL';
  d1.page.properties = { subject: 'Hội nghị Xanh 2026', keywords: 'MOS, Word' };
  d1.json = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Tổng quan chương trình' }] },
      { type: 'tableOfContents', attrs: { levels: 3, showPages: true } },
    ],
  };

  const d2 = projects[1].createStarter() as DocContent;
  d2.page.columns = 2;
  d2.page.header = 'Minh Spark Academy';
  d2.page.pageNumbers = true;
  d2.page.themeId = 'ion';
  d2.page.pageBorder = 'single';
  d2.json = {
    type: 'doc',
    content: [
      {
        type: 'table',
        content: Array.from({ length: 4 }, () => ({
          type: 'tableRow',
          content: Array.from({ length: 3 }, () => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] })),
        })),
      },
      { type: 'paragraph', content: [{ type: 'footnote', attrs: { text: 'Microsoft Office Specialist', kind: 'foot' } }] },
    ],
  };

  const d3 = projects[2].createStarter() as DocContent;
  d3.page.lineNumbers = true;
  d3.page.citationStyle = 'ieee';
  d3.page.spacingId = 'open';
  d3.comments = [{ id: 'c1', author: 'Minh', text: 'Đạt chuẩn', createdAt: 1, resolved: false }];
  d3.json = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Mọi nhân sự mới phải tuân thủ quy định ' },
          { type: 'text', text: 'bắt buộc', marks: [{ type: 'highlight', attrs: { color: '#fff59d' } }] },
        ],
      },
      { type: 'pageBreak', attrs: { kind: 'page' } },
      {
        type: 'orderedList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bước 1' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bước 2' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bước 3' }] }] },
        ],
      },
    ],
  };

  const d4 = projects[3].createStarter() as DocContent;
  d4.page.differentFirstPage = true;
  d4.page.header = 'Luận văn 2026';
  d4.page.sources = [{ id: 's1', type: 'book', authors: 'Nguyen A', title: 'Office AI', year: '2026' }];
  d4.json = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'footnote', attrs: { text: 'Ghi chú cuối tài liệu', kind: 'end' } }] },
      { type: 'paragraph', content: [{ type: 'indexEntry', attrs: { term: 'MOS' } }] },
      { type: 'bibliography', attrs: {} },
      { type: 'docIndex', attrs: {} },
      { type: 'textBox', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tóm tắt' }] }] },
    ],
  };

  const config = buildPresetSession('certiport-exam', { track: 'word', version: '365', level: 'expert' });
  const attempt = gradeExamAttempt({
    config,
    contentsByProjectId: {
      [projects[0].id]: d1,
      [projects[1].id]: d2,
      [projects[2].id]: d3,
      [projects[3].id]: d4,
    },
    durationSec: 1200,
  });

  assert.equal(attempt.score, MOS_MAX_SCORE);
  assert.equal(attempt.passed, true);
  assert.equal(attempt.passedTasks, 20);
  assert.equal(attempt.examCode, 'MO-111');
});

test('MOS Excel Associate + Expert projects grade formulas and print layout accurately', () => {
  const projects = projectsForTrack('excel', 'expert');
  assert.equal(projects.length, 4);

  const e1 = projects[0].createStarter() as SheetContent;
  const s1 = e1.workbook.sheets[e1.workbook.sheetOrder[0]];
  s1.name = 'DoanhThu';
  s1.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 5 }];
  for (let i = 0; i < 6; i++) s1.cellData[i + 2][5] = { f: `=D${i + 3}*E${i + 3}` };
  s1.cellData[8][5] = { f: '=SUM(F3:F8)' };
  s1.cellData[10][5] = { f: '=AVERAGE(F3:F8)' };
  s1.cellData[11][5] = { f: '=MAX(F3:F8)' };
  s1.freeze = { xSplit: 0, ySplit: 2, startRow: 2, startColumn: 0 };

  const e2 = projects[1].createStarter() as SheetContent;
  const s2 = e2.workbook.sheets[e2.workbook.sheetOrder[0]];
  for (let i = 0; i < 6; i++) {
    s2.cellData[i + 2][5] = { f: `=AVERAGE(D${i + 3}:E${i + 3})` };
    s2.cellData[i + 2][6] = { f: `=IF(F${i + 3}>=700,"Đạt","Chưa đạt")` };
  }
  s2.cellData[2][8] = { f: '=COUNTIF(F3:F8,">=700")' };
  s2.cellData[3][8] = { f: '=SUMIF(C3:C8,"MOS-A",F3:F8)' };
  const added = emptySheet('TongHop');
  e2.workbook.sheetOrder.push(added.id);
  e2.workbook.sheets[added.id] = added;

  const e3 = projects[2].createStarter() as SheetContent;
  const s3 = e3.workbook.sheets[e3.workbook.sheetOrder[0]];
  for (let i = 0; i < 5; i++) {
    const row = i + 3;
    s3.cellData[i + 2][1] = { f: `=LEFT(A${row},2)` };
    s3.cellData[i + 2][5] = { f: `=D${row}-E${row}` };
    s3.cellData[i + 2][6] = { f: `=IF(F${row}<20,"Nhập thêm","Ổn định")` };
    s3.cellData[i + 2][7] = { f: `=VLOOKUP(B${row},BangGia!$A$2:$B$5,2,FALSE)`, s: { n: { pattern: '#,##0' } } };
  }
  e3.printSettings = { orientation: 'landscape', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true };

  const e4 = projects[3].createStarter() as SheetContent;
  const s4 = e4.workbook.sheets[e4.workbook.sheetOrder[0]];
  s4.cellData[2][7] = { f: '=SUMIFS(E3:E10,B3:B10,"Miền Bắc",C3:C10,"Đạt")' };
  s4.cellData[3][7] = { f: '=COUNTIFS(B3:B10,"Miền Nam",E3:E10,">=100000000")' };
  s4.cellData[4][7] = { f: '=INDEX(A3:A10,MATCH(MAX(E3:E10),E3:E10,0))' };
  for (let i = 0; i < 8; i++) {
    const row = i + 3;
    s4.cellData[i + 2][5] = { f: `=IF(AND(D${row}>=90,E${row}>=100000000),"Thưởng cao","Tiêu chuẩn")` };
  }
  e4.printSettings = { orientation: 'landscape', paperSize: 'A4', margins: 'normal', fitToPage: true, showGridlines: true };

  const config = buildPresetSession('certiport-exam', { track: 'excel', version: '2019', level: 'expert' });
  const attempt = gradeExamAttempt({
    config,
    contentsByProjectId: {
      [projects[0].id]: e1,
      [projects[1].id]: e2,
      [projects[2].id]: e3,
      [projects[3].id]: e4,
    },
    durationSec: 1500,
  });

  assert.equal(attempt.score, MOS_MAX_SCORE);
  assert.equal(attempt.passedTasks, 20);
  assert.equal(attempt.examCode, 'MO-201');
});

test('MOS PowerPoint Associate + Advanced projects grade accurately to 1000/1000', () => {
  const projects = projectsForTrack('powerpoint', 'expert');
  assert.equal(projects.length, 4);

  const p1 = projects[0].createStarter() as SlideContent;
  p1.presentation.themeId = 'sapphire-modern';
  p1.presentation.slides.push({
    id: 'extra-s5',
    layout: 'comparison',
    background: { type: 'solid', value: '#fff' },
    elements: [],
    notes: '',
    transition: { type: 'fade', duration: 1.2 },
  });
  p1.presentation.slides[2].elements.push({ id: 'tbl1', type: 'table', x: 10, y: 25, width: 80, height: 50, tableRows: 3, tableCols: 3 });
  for (const s of p1.presentation.slides) s.transition = { type: 'fade', duration: 1.2 };
  p1.presentation.headerFooter = { showSlideNumber: true, showFooter: true, footerText: 'Office 23 MOS' };

  const p2 = projects[1].createStarter() as SlideContent;
  p2.presentation.aspectRatio = '4:3';
  p2.presentation.slides[1].elements.push({ id: 'ch1', type: 'chart', x: 10, y: 25, width: 70, height: 55, chartType: 'column' });
  p2.presentation.slides[2].elements.push({ id: 'sm1', type: 'smartart', x: 10, y: 25, width: 75, height: 50, smartArtType: 'process' });
  p2.presentation.slides[0].elements[0].animation = { type: 'fade-in', duration: 0.5, delay: 0 };
  p2.presentation.slides[0].notes = 'Giới thiệu mục tiêu tăng trưởng doanh thu năm 2026.';
  p2.presentation.slides[3].hidden = true;

  const p3 = projects[2].createStarter() as SlideContent;
  const conclusion = p3.presentation.slides.splice(2, 1)[0];
  p3.presentation.slides.push(conclusion);
  p3.presentation.slides[1].elements.push({ id: 'sh1', type: 'shape', shapeType: 'rect', x: 60, y: 50, width: 25, height: 20 });
  p3.presentation.slides[0].elements[0].link = { kind: 'url', url: 'https://office.minhspark.com' };
  p3.presentation.showSettings = { loop: true };
  p3.presentation.slides[0].comments = [{ id: 'cm1', author: 'Minh', text: 'Kiểm duyệt đạt', createdAt: 1 }];

  const p4 = projects[3].createStarter() as SlideContent;
  p4.presentation.slideMaster = { enabled: true, showSlideNumber: true, footerText: 'Triển lãm 2026' };
  p4.presentation.slides[0].transition.advanceAfterSeconds = 5;
  p4.presentation.slides[1].transition.advanceAfterSeconds = 5;
  p4.presentation.customShows = [{ id: 'cs1', name: 'VIP', slideIds: ['p4-s1', 'p4-s2'] }];
  p4.presentation.slides[1].elements[0].animation = { type: 'fade-in', duration: 0.6, delay: 0 };
  p4.presentation.slides[1].elements[1].animation = { type: 'fly-in', duration: 0.6, delay: 0.2 };
  p4.presentation.sections = [{ id: 'sec1', name: 'Mở đầu' }];

  const config = buildPresetSession('certiport-exam', { track: 'powerpoint', version: '2016', level: 'expert' });
  const attempt = gradeExamAttempt({
    config,
    contentsByProjectId: {
      [projects[0].id]: p1,
      [projects[1].id]: p2,
      [projects[2].id]: p3,
      [projects[3].id]: p4,
    },
    durationSec: 1100,
  });

  assert.equal(attempt.score, MOS_MAX_SCORE);
  assert.equal(attempt.passedTasks, 20);
  assert.equal(attempt.examCode, '77-729+');
});

test('exam codes, presets, drills, and progress persistence work across all formats', () => {
  assert.equal(examCodeFor('word', '365', 'associate'), 'MO-110');
  assert.equal(examCodeFor('excel', '2016', 'associate'), '77-727');
  assert.equal(examCodeFor('powerpoint', '2019', 'associate'), 'MO-300');

  assert.equal(drillsForTrack('word').length, 8);
  assert.equal(drillsForTrack('excel').length, 8);
  assert.equal(drillsForTrack('powerpoint').length, 8);

  const domainCfg = buildPresetSession('domain-focus', {
    track: 'excel',
    version: '365',
    level: 'associate',
    domainIds: ['excel-formulas'],
  });
  assert.equal(domainCfg.allowHints, true);
  assert.equal(domainCfg.allowLiveCheck, true);
  assert.ok((domainCfg.focusTaskIds?.length ?? 0) >= 5);

  const sprintCfg = buildPresetSession('speed-sprint', {
    track: 'word',
    version: '365',
    level: 'associate',
  });
  assert.equal(sprintCfg.timeLimitSec, 900);
  assert.equal(sprintCfg.allowHints, false);

  const attempt = gradeExamAttempt({
    config: sprintCfg,
    contentsByProjectId: {},
    durationSec: 120,
  });
  let prog = emptyProgress();
  prog = recordMosAttempt(prog, attempt);
  assert.equal(prog.attempts.length, 1);
  assert.equal(prog.failedTaskIds.length, 5);
  assert.equal(prog.bestMockScore.word, 0);

  prog = recordMosDrill(prog, { track: 'word', mode: 'practice', correct: 7, total: 8, completedAt: 100 });
  assert.equal(prog.drillStats.word?.correct, 7);
  const ready = trackReadiness(prog, 'word');
  assert.equal(ready.totalTasks, 20);
  assert.equal(ready.weakTaskIds.length, 20);
});

test('document close registry keeps a LIFO stack so embedded MOS editors restore parent tabs closer', async () => {
  const reg = createDocumentCloseRegistry();
  const calls: string[] = [];
  const offParent = reg.register(async () => { calls.push('parent'); return true; });
  const offChild = reg.register(async () => { calls.push('mos-editor'); return true; });

  assert.equal(await reg.save(false), true);
  assert.deepEqual(calls, ['mos-editor']);

  offChild();
  assert.equal(await reg.save(false), true);
  assert.deepEqual(calls, ['mos-editor', 'parent']);

  offParent();
  assert.equal(await reg.save(false, true), true);
});
