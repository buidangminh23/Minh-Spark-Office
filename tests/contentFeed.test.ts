import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { contentUrl, readContentManifest } from '../src/lib/contentFeed.ts';
import {
  activateMosCatalog, buildPresetSession, bundledMosBank, currentMosCatalog,
  examSetsForSelection, prepareMosCatalog, projectById,
} from '../src/lib/mos/grader.ts';

test('an installed client can open a new MOS exam, regrade its seed, and reopen the validated feed offline', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(feed));
  const globals = globalThis as unknown as { window?: unknown; location?: unknown };
  const previousWindow = globals.window;
  const previousLocation = globals.location;
  globals.window = { __TAURI_INTERNALS__: {} };
  globals.location = { hostname: 'tauri.localhost', origin: 'http://tauri.localhost' };
  t.after(() => {
    globals.window = previousWindow;
    globals.location = previousLocation;
    activateMosCatalog(bundledMosBank);
  });
  assert.match(contentUrl('/content/mos-v1.json'), /^https:\/\/raw\.githubusercontent\.com\/.+office-content-v1\/content\/mos-v1\.json$/);
  const feed = structuredClone(currentMosCatalog());
  const next = Math.max(...feed.exams) + 1;
  feed.exams.push(next);
  for (const suites of Object.values(feed.titles)) {
    for (const titles of Object.values(suites)) titles[next] = { ...titles[1], vi: 'Đề bổ sung' };
  }
  const newProject = `word-2019-e${next}-p1`;
  feed.seeds.word.push({ ...feed.seeds.word[0], slug: 'extra-scenario', rawHeading: 'Đề mới trực tuyến' });
  feed.assignments[newProject] = 'extra-scenario';
  feed.overrides[newProject] = { title: 'Dự án mới' };
  const online = await readContentManifest('mos-v1', prepareMosCatalog);
  assert.ok(online);
  activateMosCatalog(online);
  assert.equal(examSetsForSelection('word', '2019', 'associate').at(-1)?.title, 'Đề bổ sung');
  const session = buildPresetSession('certiport-exam', { track: 'word', version: '2019', level: 'associate', examNumber: next });
  const project = projectById(session.projectIds[0]);
  assert.ok(project?.kind === 'doc');
  assert.equal(project.title, 'Dự án mới');
  const doc = project.createStarter();
  assert.match(JSON.stringify(doc), /Đề mới trực tuyến/);
  for (const task of project.tasks) {
    assert.equal(task.check(doc).passed, false);
    task.applySampleSolution?.(doc);
    assert.equal(task.check(doc).passed, true);
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({ schema: 99 }));
  assert.equal((await readContentManifest('mos-v1', prepareMosCatalog))?.catalog.exams.at(-1), next);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.equal((await readContentManifest('mos-v1', prepareMosCatalog))?.catalog.exams.at(-1), next);
});
