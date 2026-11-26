import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocumentCloseRegistry } from '../src/lib/documentCloser.ts';
import { drillsForTrack } from '../src/lib/mos/drills.ts';
import { extractCopyTokens, parseMosQuestionsText } from '../src/lib/mos/examPackImport.ts';
import {
  ALL_MOS_PROJECTS,
  buildPresetSession,
  examCodeFor,
  examSetsForSelection,
  gradeExamAttempt,
  gradeProject,
  MOS_EXAM_NUMBERS,
  MOS_MAX_SCORE,
  MOS_VERSIONS,
  projectsForExam,
  projectsForTrack,
  projectsForVersion,
  versionMeta,
} from '../src/lib/mos/grader.ts';
import {
  clearMosDraft,
  emptyProgress,
  examSetReadiness,
  loadMosDraft,
  recordMosAttempt,
  recordMosDrill,
  saveMosDraft,
  trackReadiness,
  versionTrackReadiness,
} from '../src/lib/mos/progress.ts';
import { hasAuthoredSolution, solutionForTask, totalAuthoredSolutions } from '../src/lib/mos/solutions.ts';
import { emptySheet } from '../src/lib/workbookBasics.ts';
import type { DocContent, FileContent, SheetContent, SlideContent } from '../src/lib/storage.ts';

test('all complete MOS exams across 2016, 2019 and 365 have bilingual text, solutions, and starters score 0/5', () => {
  const examsPerSelection = MOS_EXAM_NUMBERS.length;
  const totalProjects = 3 * MOS_VERSIONS.length * examsPerSelection * (7 + 5);
  assert.equal(ALL_MOS_PROJECTS.length, totalProjects);
  assert.equal(totalAuthoredSolutions(), 180);
  assert.equal(totalAuthoredSolutions(ALL_MOS_PROJECTS), totalProjects * 5);

  const projectIds = new Set<string>();
  const taskIds = new Set<string>();

  for (const track of ['word', 'excel', 'powerpoint'] as const) {
    assert.equal(projectsForTrack(track, 'associate').length, 7);
    assert.equal(projectsForTrack(track, 'expert').length, 5);
    assert.equal(projectsForTrack(track).length, 12);

    for (const version of ['2016', '2019', '365'] as const) {
      assert.equal(projectsForVersion(track, version, 'associate').length, examsPerSelection * 7);
      assert.equal(projectsForVersion(track, version, 'expert').length, examsPerSelection * 5);
      assert.equal(projectsForVersion(track, version).length, examsPerSelection * 12);

      for (const level of ['associate', 'expert'] as const) {
        const sets = examSetsForSelection(track, version, level);
        assert.equal(sets.length, examsPerSelection);
        for (const examNum of MOS_EXAM_NUMBERS) {
          const examProjects = projectsForExam(track, version, level, examNum);
          assert.equal(examProjects.length, level === 'associate' ? 7 : 5);
          const examTitles = new Set(examProjects.map((p) => p.title));
          const examFiles = new Set(examProjects.map((p) => p.fileName));
          assert.equal(examTitles.size, examProjects.length, `${track} ${version} ${level} Exam ${examNum} has duplicate project titles`);
          assert.equal(examFiles.size, examProjects.length, `${track} ${version} ${level} Exam ${examNum} has duplicate project filenames`);
        }
      }
    }
  }

  for (const project of ALL_MOS_PROJECTS) {
    assert.ok(!projectIds.has(project.id), `duplicate project id: ${project.id}`);
    projectIds.add(project.id);
    assert.ok(project.titleEn && project.titleEn.length > 0, `${project.id} missing titleEn`);
    assert.ok(project.scenarioEn && project.scenarioEn.length > 0, `${project.id} missing scenarioEn`);
    const starter = project.createStarter();
    const graded = gradeProject(project, starter);
    assert.equal(graded.totalCount, 5, `${project.id} must have 5 tasks`);
    for (const task of project.tasks) {
      assert.ok(!taskIds.has(task.id), `duplicate task id: ${task.id}`);
      taskIds.add(task.id);
      assert.ok(task.titleEn && task.instructionEn, `${task.id} missing English translation`);
      assert.ok(hasAuthoredSolution(task), `${task.id} missing authored solution`);
      const sol = solutionForTask(task, project);
      assert.ok(sol.steps.length >= 3, `${task.id} solution must have >= 3 steps`);
      assert.ok(sol.verifyTip.length >= 8, `${task.id} solution missing verifyTip`);
    }
    assert.equal(
      graded.passedCount,
      0,
      `${project.id} starter had unexpected passes: ${graded.tasks.filter((t) => t.passed).map((t) => t.taskId).join(', ')}`,
    );
  }
  assert.equal(projectIds.size, totalProjects);
  assert.equal(taskIds.size, totalProjects * 5);
});

test('all MOS exams have distinct task instructions independent of exam labels and project order', () => {
  const examByContent = new Map<string, string>();
  for (const track of ['word', 'excel', 'powerpoint'] as const) {
    for (const { id: version } of MOS_VERSIONS) {
      for (const level of ['associate', 'expert'] as const) {
        for (const exam of examSetsForSelection(track, version, level)) {
          const projects = exam.projects.map((project) =>
            JSON.stringify(project.tasks.map((task) => task.instruction.trim()).sort()),
          );
          const content = JSON.stringify(projects.sort());
          assert.ok(!examByContent.has(content), `${exam.id} repeats the tasks of ${examByContent.get(content)}`);
          examByContent.set(content, exam.id);
        }
      }
    }
  }
  assert.equal(examByContent.size, 3 * MOS_VERSIONS.length * 2 * MOS_EXAM_NUMBERS.length);
});

test('Excel Expert requires the exact title merge, thousands format on every required cell, and an added worksheet', () => {
  let checked = 0;
  for (const project of ALL_MOS_PROJECTS) {
    if (project.kind !== 'sheet' || project.level !== 'expert') continue;
    for (const task of project.tasks) {
      if (!task.copyTokens?.includes('A1:H1') || !task.instruction.includes('#,##0')) continue;
      const content = project.createStarter();
      const { workbook } = content;
      const mainSheet = workbook.sheets[workbook.sheetOrder[0]];
      const merge = { startRow: 0, endRow: 0, startColumn: 0, endColumn: 7 };
      mainSheet.mergeData = [merge];
      workbook.styles.thousands = { n: { pattern: '#,##0' } };
      for (let row = 2; row <= 7; row++) {
        const cell = mainSheet.cellData[row][5];
        mainSheet.cellData[row][5] = { ...cell, s: 'thousands' };
      }
      const sheetName = task.copyTokens[0];
      assert.equal(task.check(content).passed, false, `${task.id}: missing worksheet`);
      const existingName = mainSheet.name;
      mainSheet.name = sheetName;
      assert.equal(task.check(content).passed, false, `${task.id}: renamed the existing worksheet`);
      mainSheet.name = existingName;
      const added = emptySheet(sheetName);
      workbook.sheetOrder.push(added.id);
      workbook.sheets[added.id] = added;
      assert.equal(task.check(content).passed, true, `${task.id}: complete answer with a shared number style`);

      for (const [endColumn, endRow] of [[6, 0], [8, 0], [7, 1]]) {
        mainSheet.mergeData = [{ ...merge, endColumn, endRow }];
        assert.equal(task.check(content).passed, false, `${task.id}: incorrect merged extent (${endColumn}, ${endRow})`);
      }
      mainSheet.mergeData = [merge];
      for (let row = 2; row <= 7; row++) {
        const cell = mainSheet.cellData[row][5];
        delete cell.s;
        assert.equal(task.check(content).passed, false, `${task.id}: missing format in F${row + 1}`);
        cell.s = { n: { pattern: row % 2 === 0 ? '0' : '#,##0.00' } };
        assert.equal(task.check(content).passed, false, `${task.id}: wrong format in F${row + 1}`);
        cell.s = 'thousands';
      }
      for (const text of [task.title, task.titleEn, task.instruction, task.instructionEn]) {
        assert.ok(text?.includes('F3:F8'), `${task.id}: inconsistent advertised range`);
      }
      checked++;
    }
  }
  assert.ok(checked >= 35);
});

test('all newly authored MOS 2016, 2019, and 365 exams solve cleanly to 1000/1000 with strict version boundaries', () => {
  for (const track of ['word', 'excel', 'powerpoint'] as const) {
    for (const version of ['2016', '2019', '365'] as const) {
      for (const level of ['associate', 'expert'] as const) {
        for (const examNumber of MOS_EXAM_NUMBERS) {
          if (version === '365' && examNumber === 1) continue;
          const examProjects = projectsForExam(track, version, level, examNumber);
          const solvedByProject: Record<string, FileContent> = {};

          for (const project of examProjects) {
            const working = project.createStarter();
            for (const task of project.tasks) {
              if (version === '2016' && track === 'excel') {
                const upper = `${task.instruction} ${task.instructionEn ?? ''}`.toUpperCase();
                assert.ok(!upper.includes('XLOOKUP'), `${task.id} leaked XLOOKUP into Excel 2016`);
                assert.ok(!upper.includes('MAXIFS'), `${task.id} leaked MAXIFS into Excel 2016`);
                assert.ok(!upper.includes('TEXTJOIN'), `${task.id} leaked TEXTJOIN into Excel 2016`);
              }
              if (version === '2016' && track === 'powerpoint') {
                const upper = `${task.instruction} ${task.instructionEn ?? ''}`.toUpperCase();
                assert.ok(!upper.includes('MORPH'), `${task.id} leaked Morph into PowerPoint 2016`);
              }
              assert.equal(typeof task.applySampleSolution, 'function', `${task.id} missing applySampleSolution`);
              (task.applySampleSolution as (c: FileContent) => void)(working);
            }
            solvedByProject[project.id] = working;
          }

          const config = buildPresetSession('certiport-exam', { track, version, level, examNumber });
          const attempt = gradeExamAttempt({
            config,
            contentsByProjectId: solvedByProject,
            durationSec: 1800,
          });
          assert.equal(
            attempt.score,
            MOS_MAX_SCORE,
            `${track} ${version} ${level} Exam ${examNumber} failed tasks: ${attempt.projects.flatMap((p) => p.tasks.filter((t) => !t.passed).map((t) => `${t.taskId}(${t.detail})`)).join('; ')}`,
          );
          assert.equal(attempt.passedTasks, level === 'associate' ? 35 : 25);
          assert.equal(attempt.examNumber, examNumber);
        }
      }
    }
  }
});

test('MOS Word Associate full 7-project exam (35 tasks) grades to 1000/1000', () => {
  const projects = projectsForTrack('word', 'associate');
  assert.equal(projects.length, 7);

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
  d4.page.size = 'Letter';
  d4.page.pageColor = '#f0f7ff';
  d4.page.footer = 'Hotline 1900 2026';
  d4.json = {
    type: 'doc',
    content: [
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tính năng 1' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tính năng 2' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tính năng 3' }] }] },
        ],
      },
      {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Giảm ' },
              { type: 'text', text: '28%', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' tiền điện.' },
            ],
          },
        ],
      },
    ],
  };

  const d5 = projects[4].createStarter() as DocContent;
  d5.page.styleSet = 'modern';
  d5.json = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: 'justify', lineHeight: 1.5 },
        content: [
          { type: 'text', text: 'Sự kiện kết nối trực tiếp tại ' },
          { type: 'text', text: 'Career Portal', marks: [{ type: 'link', attrs: { href: 'https://office.minhspark.com' } }] },
        ],
      },
      { type: 'horizontalRule' },
      { type: 'textBox', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lưu ý ứng viên' }] }] },
      {
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mang CV bản in' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Chuẩn bị portfolio' }] }] },
        ],
      },
    ],
  };

  const d6 = projects[5].createStarter() as DocContent;
  d6.page.properties = { author: 'Ban Truyền thông', company: 'Minh Spark' };
  d6.page.hyphenate = true;
  d6.json = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { dropCap: 'dropped' },
        content: [
          { type: 'text', text: 'Quý IV ra mắt ' },
          { type: 'text', text: 'Office 23', marks: [{ type: 'italic' }] },
        ],
      },
      { type: 'paragraph', content: [{ type: 'bookmark', attrs: { name: 'SuKienCuoiNam' } }] },
    ],
  };

  const d7 = projects[6].createStarter() as DocContent;
  d7.page.colorsId = 'blue';
  d7.page.fontsId = 'modern';
  d7.page.pageNumberFormat = 'roman';
  d7.json = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2, keepNext: true }, content: [{ type: 'text', text: 'Công thức tính công suất điện' }] },
      { type: 'paragraph', content: [{ type: 'equation', attrs: { latex: 'P = U \\cdot I' } }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'H' },
          { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
          { type: 'text', text: 'O' },
        ],
      },
    ],
  };

  const config = buildPresetSession('certiport-exam', { track: 'word', version: '365', level: 'associate' });
  const attempt = gradeExamAttempt({
    config,
    contentsByProjectId: {
      [projects[0].id]: d1,
      [projects[1].id]: d2,
      [projects[2].id]: d3,
      [projects[3].id]: d4,
      [projects[4].id]: d5,
      [projects[5].id]: d6,
      [projects[6].id]: d7,
    },
    durationSec: 1800,
  });

  assert.equal(attempt.score, MOS_MAX_SCORE);
  assert.equal(attempt.passedTasks, 35);
  assert.equal(attempt.examCode, 'MO-110');
});

test('MOS Word Expert full 5-project exam (25 tasks) grades to 1000/1000', () => {
  const projects = projectsForTrack('word', 'expert');
  assert.equal(projects.length, 5);

  const w1 = projects[0].createStarter() as DocContent;
  w1.page.differentFirstPage = true;
  w1.page.header = 'Luận văn 2026';
  w1.page.sources = [{ id: 's1', type: 'book', authors: 'Nguyen A', title: 'Office AI', year: '2026' }];
  w1.json = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'footnote', attrs: { text: 'Ghi chú cuối tài liệu', kind: 'end' } }] },
      { type: 'paragraph', content: [{ type: 'indexEntry', attrs: { term: 'MOS' } }] },
      { type: 'bibliography', attrs: {} },
      { type: 'docIndex', attrs: {} },
      { type: 'textBox', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tóm tắt' }] }] },
    ],
  };

  const w2 = projects[1].createStarter() as DocContent;
  w2.page.mirrorMargins = true;
  w2.page.differentOddEven = true;
  w2.page.headerEven = 'Sổ tay Vận hành';
  w2.page.pageNumberStart = 3;
  w2.json = {
    type: 'doc',
    content: [
      { type: 'tableOfContents', attrs: { levels: 2, showPages: true } },
      { type: 'heading', attrs: { level: 2, pageBreakBefore: true }, content: [{ type: 'text', text: 'Quy trình sao lưu định kỳ' }] },
    ],
  };

  const w3 = projects[2].createStarter() as DocContent;
  w3.page.watermark = 'MẬT';
  w3.page.pageBorder = 'single';
  w3.page.citationStyle = 'chicago';
  w3.comments = [
    { id: 'c1', author: 'A', text: 'Rà soát điều 1', createdAt: 1, resolved: false },
    { id: 'c2', author: 'B', text: 'Rà soát điều 2', createdAt: 2, resolved: false },
  ];
  w3.json = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Bên sử dụng dịch vụ: Công ty Minh Spark Corp.' }] },
      {
        type: 'table',
        content: Array.from({ length: 4 }, () => ({
          type: 'tableRow',
          content: Array.from({ length: 4 }, () => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'X' }] }] })),
        })),
      },
    ],
  };

  const w4 = projects[3].createStarter() as DocContent;
  w4.page.orientation = 'landscape';
  w4.page.columns = 3;
  w4.page.spacingId = 'compact';
  w4.json = {
    type: 'doc',
    content: [
      { type: 'figureList', attrs: {} },
      { type: 'paragraph', content: [{ type: 'equation', attrs: { latex: 'x = 1' } }] },
      { type: 'pageBreak', attrs: { kind: 'page' } },
    ],
  };

  const w5 = projects[4].createStarter() as DocContent;
  w5.page.effect = 'shadow';
  w5.page.properties = { keywords: 'HoSoNangLuc, MOS' };
  w5.json = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'HỒ SƠ NĂNG LỰC CÔNG TY MINH SPARK' }] },
      { type: 'pageBreak', attrs: { kind: 'page' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'Link', marks: [{ type: 'link', attrs: { href: 'https://office.minhspark.com' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'A' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'B' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'C' }] },
      {
        type: 'table',
        content: Array.from({ length: 3 }, () => ({
          type: 'tableRow',
          content: Array.from({ length: 3 }, () => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'NV' }] }] })),
        })),
      },
    ],
  };

  const config = buildPresetSession('certiport-exam', { track: 'word', version: '365', level: 'expert' });
  const attempt = gradeExamAttempt({
    config,
    contentsByProjectId: {
      [projects[0].id]: w1,
      [projects[1].id]: w2,
      [projects[2].id]: w3,
      [projects[3].id]: w4,
      [projects[4].id]: w5,
    },
    durationSec: 1400,
  });

  assert.equal(attempt.score, MOS_MAX_SCORE);
  assert.equal(attempt.passedTasks, 25);
  assert.equal(attempt.examCode, 'MO-111');
});

test('MOS Excel Associate (7 projects) and Expert (5 projects) both grade to 1000/1000', () => {
  const assoc = projectsForTrack('excel', 'associate');
  assert.equal(assoc.length, 7);

  const e1 = assoc[0].createStarter() as SheetContent;
  const s1 = e1.workbook.sheets[e1.workbook.sheetOrder[0]];
  s1.name = 'DoanhThu';
  s1.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 5 }];
  for (let i = 0; i < 6; i++) s1.cellData[i + 2][5] = { f: `=D${i + 3}*E${i + 3}` };
  s1.cellData[8][5] = { f: '=SUM(F3:F8)' };
  s1.cellData[10][5] = { f: '=AVERAGE(F3:F8)' };
  s1.cellData[11][5] = { f: '=MAX(F3:F8)' };
  s1.freeze = { xSplit: 0, ySplit: 2, startRow: 2, startColumn: 0 };

  const e2 = assoc[1].createStarter() as SheetContent;
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

  const e3 = assoc[2].createStarter() as SheetContent;
  const s3 = e3.workbook.sheets[e3.workbook.sheetOrder[0]];
  for (let i = 0; i < 5; i++) {
    const row = i + 3;
    s3.cellData[i + 2][1] = { f: `=LEFT(A${row},2)` };
    s3.cellData[i + 2][5] = { f: `=D${row}-E${row}` };
    s3.cellData[i + 2][6] = { f: `=IF(F${row}<20,"Nhập thêm","Ổn định")` };
    s3.cellData[i + 2][7] = { f: `=VLOOKUP(B${row},BangGia!$A$2:$B$5,2,FALSE)`, s: { n: { pattern: '#,##0' } } };
  }
  e3.printSettings = { orientation: 'landscape', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true };

  const e4 = assoc[3].createStarter() as SheetContent;
  const s4 = e4.workbook.sheets[e4.workbook.sheetOrder[0]];
  for (let i = 0; i < 5; i++) {
    s4.cellData[i + 2][4] = { f: `=C${i + 3}*D${i + 3}` };
    s4.cellData[i + 2][6] = { f: `=E${i + 3}+F${i + 3}` };
  }
  s4.cellData[8][1] = { f: '=MIN(G3:G7)' };
  s4.cellData[9][1] = { f: '=COUNTA(A3:A7)' };
  s4.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 6 }];
  e4.printSettings = { orientation: 'landscape', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: false };

  const e5 = assoc[4].createStarter() as SheetContent;
  const s5 = e5.workbook.sheets[e5.workbook.sheetOrder[0]];
  for (let i = 0; i < 4; i++) {
    const r = i + 3;
    s5.cellData[i + 2][2] = { f: `=PROPER(A${r}&" "&B${r})` };
    s5.cellData[i + 2][4] = { f: `=UPPER(D${r})` };
    s5.cellData[i + 2][5] = { f: `=LEN(D${r})` };
  }
  s5.freeze = { xSplit: 1, ySplit: 0, startRow: 0, startColumn: 1 };
  s5.name = 'DanhBa';

  const e6 = assoc[5].createStarter() as SheetContent;
  const s6 = e6.workbook.sheets[e6.workbook.sheetOrder[0]];
  for (let i = 0; i < 4; i++) {
    const r = i + 3;
    s6.cellData[i + 2][3] = { f: `=B${r}-C${r}` };
    s6.cellData[i + 2][4] = { f: `=C${r}/B${r}`, s: { n: { pattern: '0.0%' } } };
  }
  s6.cellData[6][1] = { f: '=SUM(B3:B6)' };
  s6.cellData[6][2] = { f: '=SUM(C3:C6)' };
  s6.cellData[6][3] = { f: '=SUM(D3:D6)' };
  e6.printSettings = { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: true, showGridlines: true };

  const e7 = assoc[6].createStarter() as SheetContent;
  const s7 = e7.workbook.sheets[e7.workbook.sheetOrder[0]];
  for (let i = 0; i < 5; i++) {
    const r = i + 3;
    s7.cellData[i + 2][3] = { f: `=C${r}*5%` };
    s7.cellData[i + 2][4] = { f: `=C${r}-D${r}` };
  }
  s7.cellData[8][1] = { f: '=SUMIF(B3:B7,"Online",C3:C7)' };
  s7.cellData[9][1] = { f: '=COUNTIF(B3:B7,"Online")' };
  s7.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 4 }];
  s7.freeze = { xSplit: 0, ySplit: 2, startRow: 2, startColumn: 0 };

  const assocAttempt = gradeExamAttempt({
    config: buildPresetSession('certiport-exam', { track: 'excel', version: '365', level: 'associate', examNumber: 1 }),
    contentsByProjectId: {
      [assoc[0].id]: e1,
      [assoc[1].id]: e2,
      [assoc[2].id]: e3,
      [assoc[3].id]: e4,
      [assoc[4].id]: e5,
      [assoc[5].id]: e6,
      [assoc[6].id]: e7,
    },
    durationSec: 2100,
  });
  assert.equal(assocAttempt.score, MOS_MAX_SCORE);
  assert.equal(assocAttempt.passedTasks, 35);
  assert.equal(assocAttempt.examCode, 'MO-210');

  const expert = projectsForTrack('excel', 'expert');
  assert.equal(expert.length, 5);

  const x1 = expert[0].createStarter() as SheetContent;
  const xs1 = x1.workbook.sheets[x1.workbook.sheetOrder[0]];
  xs1.cellData[2][7] = { f: '=SUMIFS(E3:E10,B3:B10,"Miền Bắc",C3:C10,"Đạt")' };
  xs1.cellData[3][7] = { f: '=COUNTIFS(B3:B10,"Miền Nam",E3:E10,">=100000000")' };
  xs1.cellData[4][7] = { f: '=INDEX(A3:A10,MATCH(MAX(E3:E10),E3:E10,0))' };
  for (let i = 0; i < 8; i++) xs1.cellData[i + 2][5] = { f: `=IF(AND(D${i + 3}>=90,E${i + 3}>=100000000),"Thưởng cao","Tiêu chuẩn")` };
  x1.printSettings = { orientation: 'landscape', paperSize: 'A4', margins: 'normal', fitToPage: true, showGridlines: true };

  const x2 = expert[1].createStarter() as SheetContent;
  const xs2 = x2.workbook.sheets[x2.workbook.sheetOrder[0]];
  for (let i = 0; i < 4; i++) {
    const r = i + 3;
    xs2.cellData[i + 2][1] = { f: `=MID(A${r},4,2)` };
    xs2.cellData[i + 2][3] = { f: `=IFERROR(VLOOKUP(B${r},DanhMuc!$A$2:$B$4,2,FALSE),0)`, s: { n: { pattern: '#,##0' } } };
    xs2.cellData[i + 2][4] = { f: `=C${r}*D${r}`, s: { n: { pattern: '#,##0' } } };
    xs2.cellData[i + 2][5] = { f: `=IF(D${r}=0,"Thiếu giá","Hợp lệ")` };
  }

  const x3 = expert[2].createStarter() as SheetContent;
  const xs3 = x3.workbook.sheets[x3.workbook.sheetOrder[0]];
  for (let i = 0; i < 5; i++) {
    const r = i + 3;
    xs3.cellData[i + 2][3] = { f: `=B${r}-C${r}` };
    xs3.cellData[i + 2][4] = { f: `=D${r}/B${r}`, s: { n: { pattern: '0.0%' } } };
    xs3.cellData[i + 2][5] = { f: `=RANK(D${r},$D$3:$D$7)` };
  }
  xs3.cellData[8][1] = { f: '=AVERAGEIF(D3:D7,">100000000")' };
  xs3.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 5 }];

  const x4 = expert[3].createStarter() as SheetContent;
  const xs4 = x4.workbook.sheets[x4.workbook.sheetOrder[0]];
  for (let i = 0; i < 4; i++) {
    const r = i + 3;
    xs4.cellData[i + 2][4] = { f: `=IF(OR(C${r}>=8.5,D${r}>=8.5),"Ưu tiên","Tiêu chuẩn")` };
    xs4.cellData[i + 2][5] = { f: `=ROUND(AVERAGE(C${r}:D${r}),1)` };
  }
  xs4.cellData[7][1] = { f: '=COUNTBLANK(C3:D6)' };
  const hrNote = emptySheet('GhiChuHR');
  x4.workbook.sheetOrder.push(hrNote.id);
  x4.workbook.sheets[hrNote.id] = hrNote;
  xs4.freeze = { xSplit: 1, ySplit: 2, startRow: 2, startColumn: 1 };

  const x5 = expert[4].createStarter() as SheetContent;
  const xs5 = Object.values(x5.workbook.sheets).find((s) => s.name === 'TongHop6Thang')!;
  for (let i = 0; i < 3; i++) {
    const r = i + 3;
    xs5.cellData[i + 2][1] = { f: `=Quy1!B${r}` };
    xs5.cellData[i + 2][2] = { f: `=Quy2!B${r}` };
    xs5.cellData[i + 2][3] = { f: `=SUM(B${r}:C${r})` };
    xs5.cellData[i + 2][4] = { f: `=(C${r}-B${r})/B${r}` };
  }
  xs5.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 4 }];
  x5.printSettings = { orientation: 'landscape', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true };

  const expertAttempt = gradeExamAttempt({
    config: buildPresetSession('certiport-exam', { track: 'excel', version: '365', level: 'expert', examNumber: 1 }),
    contentsByProjectId: {
      [expert[0].id]: x1,
      [expert[1].id]: x2,
      [expert[2].id]: x3,
      [expert[3].id]: x4,
      [expert[4].id]: x5,
    },
    durationSec: 1700,
  });
  assert.equal(expertAttempt.score, MOS_MAX_SCORE);
  assert.equal(expertAttempt.passedTasks, 25);
  assert.equal(expertAttempt.examCode, 'MO-211');
});

test('MOS PowerPoint Associate (7 projects) and Expert (5 projects) both grade to 1000/1000', () => {
  const assoc = projectsForTrack('powerpoint', 'associate');
  assert.equal(assoc.length, 7);

  const p1 = assoc[0].createStarter() as SlideContent;
  p1.presentation.themeId = 'sapphire-modern';
  p1.presentation.slides.push({ id: 'extra-s5', layout: 'comparison', background: { type: 'solid', value: '#fff' }, elements: [], notes: '', transition: { type: 'fade', duration: 1.2 } });
  p1.presentation.slides[2].elements.push({ id: 'tbl1', type: 'table', x: 10, y: 25, width: 80, height: 50, tableRows: 3, tableCols: 3 });
  for (const s of p1.presentation.slides) s.transition = { type: 'fade', duration: 1.2 };
  p1.presentation.headerFooter = { showSlideNumber: true, showFooter: true, footerText: 'Office 23 MOS' };

  const p2 = assoc[1].createStarter() as SlideContent;
  p2.presentation.aspectRatio = '4:3';
  p2.presentation.slides[1].elements.push({ id: 'ch1', type: 'chart', x: 10, y: 25, width: 70, height: 55, chartType: 'column' });
  p2.presentation.slides[2].elements.push({ id: 'sm1', type: 'smartart', x: 10, y: 25, width: 75, height: 50, smartArtType: 'process' });
  p2.presentation.slides[0].elements[0].animation = { type: 'fade-in', duration: 0.5, delay: 0 };
  p2.presentation.slides[0].notes = 'Giới thiệu mục tiêu tăng trưởng doanh thu năm 2026.';
  p2.presentation.slides[3].hidden = true;

  const p3 = assoc[2].createStarter() as SlideContent;
  const conclusion = p3.presentation.slides.splice(2, 1)[0];
  p3.presentation.slides.push(conclusion);
  p3.presentation.slides[1].elements.push({ id: 'sh1', type: 'shape', shapeType: 'rect', x: 60, y: 50, width: 25, height: 20 });
  p3.presentation.slides[0].elements[0].link = { kind: 'url', url: 'https://office.minhspark.com' };
  p3.presentation.showSettings = { loop: true };
  p3.presentation.slides[0].comments = [{ id: 'cm1', author: 'Minh', text: 'Kiểm duyệt đạt', createdAt: 1 }];

  const p4 = assoc[3].createStarter() as SlideContent;
  p4.presentation.themeId = 'sunset-gradient';
  p4.presentation.slides.splice(3, 1);
  p4.presentation.slides[1].elements.push({ id: 'p4-txt', type: 'text', x: 10, y: 70, width: 50, height: 10, text: 'Arabica Đà Lạt' });
  for (const s of p4.presentation.slides) s.transition = { type: 'wipe', duration: 0.8 };
  p4.presentation.headerFooter = { showDate: true, hideOnTitle: true };

  const p5 = assoc[4].createStarter() as SlideContent;
  p5.presentation.slides.push({ id: 'p5-sec', layout: 'section', background: { type: 'solid', value: '#fff' }, elements: [], notes: '', transition: { type: 'none', duration: 0.5 } });
  p5.presentation.slides[0].background = { type: 'gradient', value: 'linear-gradient(135deg, #0ea5e9, #1d4ed8)' };
  p5.presentation.slides[1].elements.push(
    { id: 'sh-a', type: 'shape', shapeType: 'rect', x: 10, y: 60, width: 20, height: 15 },
    { id: 'sh-b', type: 'shape', shapeType: 'arrow-right', x: 35, y: 60, width: 20, height: 15 },
  );
  p5.presentation.slides[1].transition = { type: 'reveal', duration: 1.5 };
  p5.presentation.slides[2].notes = 'Nhấn mạnh trải nghiệm đêm đèn lồng tại phố cổ Hội An.';

  const p6 = assoc[5].createStarter() as SlideContent;
  p6.presentation.themeId = 'nordic-steel';
  p6.presentation.sections = [{ id: 'sec-1', name: 'Tổng quan' }];
  p6.presentation.slides[1].elements.push({ id: 't-s2', type: 'table', x: 10, y: 25, width: 80, height: 50, tableRows: 3, tableCols: 3 });
  p6.presentation.slides[2].elements.push({ id: 'sm-s3', type: 'smartart', x: 10, y: 25, width: 80, height: 50, smartArtType: 'process' });
  p6.presentation.slides[1].elements[0].animation = { type: 'fade-in', duration: 0.5, delay: 0 };
  p6.presentation.slides[2].elements[0].animation = { type: 'fly-in', duration: 0.5, delay: 0 };
  p6.presentation.headerFooter = { showFooter: true, footerText: 'Khóa 2026' };

  const p7 = assoc[6].createStarter() as SlideContent;
  p7.presentation.themeId = 'midnight-dark';
  const teamSlide = p7.presentation.slides.splice(3, 1)[0];
  p7.presentation.slides.splice(1, 0, teamSlide);
  p7.presentation.slides[3].elements.push({ id: 'ch-arr', type: 'chart', x: 10, y: 25, width: 80, height: 55, chartType: 'line' });
  p7.presentation.slides[0].transition = { type: 'morph', duration: 1 };
  p7.presentation.slides[1].transition = { type: 'zoom', duration: 1 };
  p7.presentation.slides[4].hidden = true;
  p7.presentation.slides[0].comments = [{ id: 'cm-p7', author: 'Minh', text: 'Chuẩn bị vòng Series A', createdAt: 1 }];

  const assocAttempt = gradeExamAttempt({
    config: buildPresetSession('certiport-exam', { track: 'powerpoint', version: '365', level: 'associate', examNumber: 1 }),
    contentsByProjectId: {
      [assoc[0].id]: p1,
      [assoc[1].id]: p2,
      [assoc[2].id]: p3,
      [assoc[3].id]: p4,
      [assoc[4].id]: p5,
      [assoc[5].id]: p6,
      [assoc[6].id]: p7,
    },
    durationSec: 1600,
  });
  assert.equal(assocAttempt.score, MOS_MAX_SCORE);
  assert.equal(assocAttempt.passedTasks, 35);
  assert.equal(assocAttempt.examCode, 'MO-310');

  const expert = projectsForTrack('powerpoint', 'expert');
  assert.equal(expert.length, 5);

  const px1 = expert[0].createStarter() as SlideContent;
  px1.presentation.slideMaster = { enabled: true, showSlideNumber: true, footerText: 'Triển lãm 2026' };
  px1.presentation.slides[0].transition.advanceAfterSeconds = 5;
  px1.presentation.slides[1].transition.advanceAfterSeconds = 5;
  px1.presentation.customShows = [{ id: 'cs1', name: 'VIP', slideIds: ['px1-s1', 'px1-s2'] }];
  px1.presentation.slides[1].elements[0].animation = { type: 'fade-in', duration: 0.6, delay: 0 };
  px1.presentation.slides[1].elements[1].animation = { type: 'fly-in', duration: 0.6, delay: 0.2 };
  px1.presentation.sections = [{ id: 'sec1', name: 'Mở đầu' }];

  const px2 = expert[1].createStarter() as SlideContent;
  px2.presentation.sections = [{ id: 's1', name: 'Tài chính' }, { id: 's2', name: 'Chiến lược' }];
  px2.presentation.slideMaster = { enabled: true, headerText: 'HĐQT Q4', footerText: 'Nội bộ' };
  px2.presentation.slides[1].elements.push({ id: 'c2', type: 'chart', x: 10, y: 25, width: 70, height: 50, chartType: 'bar' });
  px2.presentation.slides[2].elements.push({ id: 't3', type: 'table', x: 10, y: 25, width: 70, height: 50, tableRows: 3, tableCols: 3 });
  px2.presentation.watermark = { enabled: true, text: 'CONFIDENTIAL', opacity: 0.2 };
  px2.presentation.showSettings = { showType: 'kiosk', loop: true };

  const px3 = expert[2].createStarter() as SlideContent;
  px3.presentation.themeId = 'midnight-dark';
  px3.presentation.aspectRatio = '16:10';
  for (const s of px3.presentation.slides) s.transition = { type: 'morph', duration: 1.2 };
  px3.presentation.slides[1].elements[0].animations = [
    { id: 'a1', type: 'fade-in', category: 'entrance', duration: 0.5, delay: 0, trigger: 'after-previous', order: 1 },
  ];
  px3.presentation.slides[0].elements[0].link = { kind: 'url', url: 'https://office.minhspark.com/keynote' };
  px3.presentation.handoutMaster = { slidesPerPage: 6, header: 'Keynote 2027' };

  const px4 = expert[3].createStarter() as SlideContent;
  px4.presentation.slides.push(
    { id: 'px4-s5', layout: 'comparison', background: { type: 'solid', value: '#fff' }, elements: [], notes: '', transition: { type: 'fade', duration: 0.8, advanceAfterSeconds: 4 } },
    { id: 'px4-s6', layout: 'section', background: { type: 'solid', value: '#fff' }, elements: [], notes: '', transition: { type: 'fade', duration: 0.8, advanceAfterSeconds: 4 } },
  );
  px4.presentation.slides[1].elements.push(
    { id: 'sm4', type: 'smartart', x: 10, y: 25, width: 40, height: 40, smartArtType: 'cycle' },
    { id: 'sh4', type: 'shape', shapeType: 'rect', x: 55, y: 25, width: 30, height: 20, link: { kind: 'url', url: 'https://office.minhspark.com/security' } },
  );
  for (const s of px4.presentation.slides) s.transition = { type: 'fade', duration: 0.8, advanceAfterSeconds: 4 };
  px4.presentation.slides[2].hidden = true;
  px4.presentation.slides[3].hidden = true;
  px4.presentation.slides[0].notes = 'Lời dẫn giảng viên giới thiệu mục tiêu khoá đào tạo an ninh mạng.';
  px4.presentation.slides[1].notes = 'Nhắc học viên kiểm tra tên miền thực trong phần header email.';
  px4.presentation.customShows = [{ id: 'cs4', name: 'Rút gọn', slideIds: ['px4-s1', 'px4-s2', 'px4-s5'] }];

  const px5 = expert[4].createStarter() as SlideContent;
  px5.presentation.themeId = 'emerald-executive';
  px5.presentation.slides[0].background = { type: 'gradient', value: 'linear-gradient(120deg, #064e3b, #059669)' };
  px5.presentation.slides[1].elements.push({ id: 't5', type: 'table', x: 10, y: 25, width: 80, height: 50, tableRows: 3, tableCols: 3 });
  px5.presentation.slides[2].elements.push({ id: 'c5', type: 'chart', x: 10, y: 25, width: 80, height: 50, chartType: 'column' });
  px5.presentation.slides[3].elements.push({ id: 'sm5', type: 'smartart', x: 10, y: 25, width: 80, height: 50, smartArtType: 'process' });
  px5.presentation.slides[0].elements[0].animation = { type: 'fade-in', duration: 0.5, delay: 0 };
  px5.presentation.slides[1].elements[0].animation = { type: 'fly-in', duration: 0.5, delay: 0 };
  px5.presentation.slides[2].elements[0].animation = { type: 'zoom-in', duration: 0.5, delay: 0 };
  px5.presentation.slideMaster = { enabled: true, showSlideNumber: true, footerText: 'ESG 2026' };
  px5.presentation.showSettings = { loop: true, useTimings: true };
  px5.presentation.slides[0].comments = [
    { id: 'cm5-1', author: 'Minh', text: 'Kiểm tra số liệu Scope 1', createdAt: 1 },
    { id: 'cm5-2', author: 'Lan', text: 'Đã đối chiếu kiểm toán', createdAt: 2 },
  ];

  const expertAttempt = gradeExamAttempt({
    config: buildPresetSession('certiport-exam', { track: 'powerpoint', version: '365', level: 'expert', examNumber: 1 }),
    contentsByProjectId: {
      [expert[0].id]: px1,
      [expert[1].id]: px2,
      [expert[2].id]: px3,
      [expert[3].id]: px4,
      [expert[4].id]: px5,
    },
    durationSec: 1450,
  });
  assert.equal(expertAttempt.score, MOS_MAX_SCORE);
  assert.equal(expertAttempt.passedTasks, 25);
  assert.equal(expertAttempt.examCode, 'MO-310+');
});

test('version profiles, drills, draft persistence, and external exam question parser work cleanly', () => {
  assert.equal(MOS_VERSIONS.length, 3);
  assert.equal(versionMeta('2019').projectFormat, 'slash');
  assert.equal(versionMeta('2019').submitLabel, 'Grade Project');
  assert.equal(versionMeta('2016').projectFormat, 'of');
  assert.equal(versionMeta('365').submitLabel, 'Submit Project');

  assert.equal(examCodeFor('word', '365', 'associate'), 'MO-110');
  assert.equal(examCodeFor('word', '2016', 'associate'), '77-725');
  assert.equal(examCodeFor('excel', '2016', 'expert'), '77-728');
  assert.equal(examCodeFor('powerpoint', '2019', 'associate'), 'MO-300');

  assert.equal(drillsForTrack('word', 'associate').length, 8);
  assert.equal(drillsForTrack('word', 'expert').length, 12);
  assert.equal(drillsForTrack('excel', 'expert').length, 12);
  assert.equal(drillsForTrack('powerpoint', 'expert').length, 12);
  assert.equal(drillsForTrack('excel', 'associate', '365').length, 9);
  assert.equal(drillsForTrack('excel', 'expert', '2019').length, 14);

  const rawQuestions = [
    'Project 1: Bicycles Overview — Prepare the cycling shop brochure.',
    'Task 1: Change the page margins to Narrow and add a watermark "DRAFT 2016".',
    'Task 2: Apply Heading 1 style to "Mountain Bikes" and insert a hyperlink to "https://bicycles.example.com".',
    'Câu 3: Chèn bảng 3 cột 4 dòng vào cuối tài liệu.',
  ].join('\n');
  const parsed = parseMosQuestionsText(rawQuestions, 1);
  assert.equal(parsed.tasks.length, 3);
  assert.ok(parsed.scenario.includes('Bicycles Overview'));
  assert.deepEqual(parsed.tasks[0].copyTokens, ['DRAFT 2016']);
  assert.deepEqual(parsed.tasks[1].copyTokens, ['Mountain Bikes', 'https://bicycles.example.com']);
  assert.deepEqual(extractCopyTokens('Nhập “Office 23 MOS” và "ESG 2026"'), ['Office 23 MOS', 'ESG 2026']);

  const store = new Map<string, string>();
  const prevStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    },
  });
  try {
    const cfg = buildPresetSession('certiport-exam', { track: 'word', version: '2019', level: 'associate', lang: 'en' });
    assert.equal(cfg.projectIds.length, 7);
    assert.equal(cfg.lang, 'en');
    const saved = saveMosDraft('u-test', {
      config: cfg,
      projectIndex: 2,
      activeTab: 3,
      elapsedSec: 420,
      completedTasks: { 'w1-t1': true },
      reviewTasks: { 'w2-t1': true },
      docs: {} as Record<string, FileContent>,
      savedAt: 123456,
    });
    assert.equal(saved, true);
    const loaded = loadMosDraft('u-test');
    assert.equal(loaded?.projectIndex, 2);
    assert.equal(loaded?.activeTab, 3);
    assert.equal(loaded?.config.version, '2019');
    clearMosDraft('u-test');
    assert.equal(loadMosDraft('u-test'), null);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: prevStorage });
  }

  let prog = emptyProgress();
  const sprint = buildPresetSession('speed-sprint', { track: 'word', version: '2016', level: 'associate' });
  prog = recordMosAttempt(prog, gradeExamAttempt({ config: sprint, contentsByProjectId: {}, durationSec: 120 }));
  prog = recordMosDrill(prog, { track: 'word', mode: 'practice', correct: 10, total: 12, completedAt: 100 });
  assert.equal(prog.drillStats.word?.correct, 10);
  const ready = trackReadiness(prog, 'word', 'associate');
  assert.equal(ready.totalTasks, 35);
  assert.equal(ready.weakTaskIds.length, 35);

  const e2Cfg = buildPresetSession('certiport-exam', { track: 'excel', version: '2019', level: 'associate', examNumber: 2 });
  const e2Attempt = gradeExamAttempt({ config: e2Cfg, contentsByProjectId: {}, durationSec: 300 });
  prog = recordMosAttempt(prog, { ...e2Attempt, score: 860, passed: true });
  assert.equal(examSetReadiness(prog, 'excel', '2019', 'associate', 2).bestMock, 860);
  assert.equal(examSetReadiness(prog, 'excel', '2019', 'associate', 1).bestMock, null);
  assert.equal(versionTrackReadiness(prog, 'excel', '2019', 'associate').totalTasks, 35 * MOS_EXAM_NUMBERS.length);
  assert.equal(versionTrackReadiness(prog, 'excel', '2019', 'associate').bestMock, 860);
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

test('app dialogs, popovers, busy overlay and toasts stay above the MOS exam runner', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../src/components/mos/mos.css', import.meta.url), 'utf8');
  const runnerZ = Number(/\.mos-runner\s*\{[^}]*?z-index:\s*(\d+)/.exec(css)?.[1]);
  assert.ok(runnerZ > 0);
  for (const selector of ['dialog-backdrop', 'sheet-popover-backdrop', 'sheet-popover', 'busy-overlay', 'toasts']) {
    const prefix = `body:has(.mos-runner) .${selector} { z-index: `;
    const at = css.indexOf(prefix);
    assert.ok(at >= 0, selector);
    assert.ok(Number.parseInt(css.slice(at + prefix.length), 10) > runnerZ, selector);
  }
});
