import type { JSONContent } from '@tiptap/react';
import JSZip from 'jszip';
import { basePage, type DocContent, type FileContent, type SheetContent, type SlideContent } from '../storage';
import { domainsForTrack } from './grader';
import type { MosLevel, MosProject, MosTask, MosTrackId, MosVersion } from './types';

export type ParsedQuestionItem = {
  title: string;
  instruction: string;
  copyTokens: string[];
};

export type ParsedQuestionDoc = {
  scenario: string;
  tasks: ParsedQuestionItem[];
};

export type ImportedExamGroup = {
  id: string;
  label: string;
  projects: MosProject[];
};

export type ImportedMosPack = {
  id: string;
  name: string;
  track: MosTrackId;
  version: MosVersion;
  level: MosLevel;
  groups: ImportedExamGroup[];
  projects: MosProject[];
  warnings: string[];
};

type RawPackEntry = {
  path: string;
  name: string;
  readBuffer: () => Promise<ArrayBuffer>;
};

const QUESTION_FILE_RE = /(b[oộ]\s*c[aâ]u\s*h[oỏ]i|c[aâ]u\s*h[oỏ]i|question|tasks?|de\s*bai|huong\s*dan|instruction|overview|yeu\s*cau)/i;
const OFFICE_EXT_RE = /\.(docx|xlsx|xlsm|pptx)$/i;
const TEXT_EXT_RE = /\.(txt|md)$/i;

function normalizePath(raw: string): string {
  return raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
}

function foldAscii(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function extractCopyTokens(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const re = /[“"']([^“”"'\n]{2,72})[”"']/g;
  let match: RegExpExecArray | null = re.exec(text);
  while (match) {
    const token = match[1].trim();
    if (token.length >= 2 && !seen.has(token)) {
      seen.add(token);
      found.push(token);
    }
    match = re.exec(text);
  }
  return found.slice(0, 6);
}

export function parseMosQuestionsText(rawText: string, projectNumber = 1): ParsedQuestionDoc {
  const cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!cleaned) {
    return {
      scenario: `Thực hành trực tiếp trên tệp dự án ${projectNumber}.`,
      tasks: [
        {
          title: 'Hoàn thiện yêu cầu dự án',
          instruction: 'Mở tệp dự án phía trên và thực hiện đầy đủ các thao tác theo đề thi.',
          copyTokens: [],
        },
      ],
    };
  }

  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  const taskStartRe = /^(?:task|c[aâ]u(?:\s*h[oỏ]i)?|nhi[eệ]m\s*v[uụ]|y[eê]u\s*c[aầ]u)\s*(\d+)\s*[:.)-]\s*(.*)$/i;
  const numberedRe = /^(\d{1,2})\s*[.)]\s+(.+)$/;

  const scenarioLines: string[] = [];
  const rawTasks: Array<{ num: string; lines: string[] }> = [];

  for (const line of lines) {
    const explicit = taskStartRe.exec(line);
    if (explicit) {
      rawTasks.push({ num: explicit[1], lines: explicit[2] ? [explicit[2].trim()] : [] });
      continue;
    }
    const numbered = numberedRe.exec(line);
    if (numbered && Number(numbered[1]) <= 15 && (rawTasks.length > 0 || Number(numbered[1]) === 1)) {
      rawTasks.push({ num: numbered[1], lines: [numbered[2].trim()] });
      continue;
    }
    if (rawTasks.length === 0) {
      scenarioLines.push(line);
    } else {
      rawTasks[rawTasks.length - 1].lines.push(line);
    }
  }

  const tasks: ParsedQuestionItem[] = rawTasks
    .map((entry, idx) => {
      const instruction = entry.lines.join(' ').replace(/\s+/g, ' ').trim();
      if (!instruction) return null;
      const firstSentence = instruction.split(/[.!?](?:\s|$)/)[0]?.trim() ?? '';
      const title = firstSentence.length >= 6 && firstSentence.length <= 68
        ? firstSentence
        : `Task ${entry.num || idx + 1}`;
      return {
        title,
        instruction,
        copyTokens: extractCopyTokens(instruction),
      };
    })
    .filter((item): item is ParsedQuestionItem => Boolean(item));

  if (tasks.length === 0) {
    const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const scenario = paragraphs.length > 1 ? paragraphs[0] : `Thực hành đề thi nhập ngoài — Project ${projectNumber}.`;
    const bodyItems = paragraphs.length > 1 ? paragraphs.slice(1) : paragraphs;
    return {
      scenario,
      tasks: bodyItems.slice(0, 10).map((instruction, idx) => ({
        title: `Task ${idx + 1}`,
        instruction,
        copyTokens: extractCopyTokens(instruction),
      })),
    };
  }

  const scenario = scenarioLines.join(' ').replace(/\s+/g, ' ').trim()
    || `Dự án ${projectNumber} nhập từ bộ đề MOS bên ngoài. Thực hiện lần lượt từng Task bên dưới trực tiếp trên tệp đề.`;

  return { scenario, tasks };
}

async function extractDocxPlainText(buffer: ArrayBuffer): Promise<string> {
  try {
    const mammothMod = await import('mammoth');
    const fn = typeof mammothMod.extractRawText === 'function'
      ? mammothMod.extractRawText
      : mammothMod.default?.extractRawText;
    if (typeof fn === 'function') {
      const result = await fn({ arrayBuffer: buffer });
      if (result.value && result.value.trim()) return result.value;
    }
  } catch {
  }
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return '';
  return xml
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<w:tab[^>]*\/>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function detectVersionFromPath(paths: string[], fallback: MosVersion): MosVersion {
  const joined = paths.join(' ');
  if (/\b2016\b|77-72[5-9]/i.test(joined)) return '2016';
  if (/\b2019\b|mo-[123]0[01]/i.test(joined)) return '2019';
  if (/\b365\b|mo-[123]1[01]/i.test(joined)) return '365';
  return fallback;
}

function detectLevelFromPath(paths: string[], fallback: MosLevel): MosLevel {
  const joined = paths.join(' ');
  if (/\bexpert\b|mo-[123][01]1|77-72[68]/i.test(joined)) return 'expert';
  return fallback;
}

function detectTrackFromEntries(entries: RawPackEntry[], fallback: MosTrackId): MosTrackId {
  const counts: Record<MosTrackId, number> = { word: 0, excel: 0, powerpoint: 0 };
  for (const entry of entries) {
    if (QUESTION_FILE_RE.test(entry.name)) continue;
    const lower = entry.name.toLowerCase();
    if (lower.endsWith('.pptx')) counts.powerpoint += 3;
    else if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) counts.excel += 2;
    else if (lower.endsWith('.docx')) counts.word += 2;
  }
  const joined = entries.map((e) => e.path).join(' ').toLowerCase();
  if (/\b(pp2016|pp2019|pp365|powerpoint|ppt)\b/.test(joined) && counts.powerpoint > 0) return 'powerpoint';
  if (/\b(word|doc)\b/.test(joined) && counts.word > 0) return 'word';
  if (/\b(excel|xls)\b/.test(joined) && counts.excel > 0) return 'excel';
  const best = (Object.entries(counts) as Array<[MosTrackId, number]>).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : fallback;
}

function extractSearchableContent(content: FileContent): string {
  if (content.kind === 'doc') {
    const raw: unknown = content.json;
    const body = typeof raw === 'string' ? raw.replace(/<[^>]+>/g, ' ') : JSON.stringify(raw);
    return foldAscii(`${body} ${content.page.header} ${content.page.footer} ${content.page.watermark ?? ''} ${JSON.stringify(content.page.properties ?? {})}`);
  }
  if (content.kind === 'sheet') {
    return foldAscii(JSON.stringify(content.workbook.sheets));
  }
  if (content.kind === 'slide') {
    return foldAscii(JSON.stringify(content.presentation));
  }
  return '';
}

function buildImportedTaskCheck(
  starterFingerprint: string,
  starterSearchText: string,
  item: ParsedQuestionItem,
): MosTask['check'] {
  const tokenTargets = item.copyTokens.filter((token) => {
    const folded = foldAscii(token);
    return folded.length >= 3 && !starterSearchText.includes(folded);
  });

  return (content: FileContent) => {
    const currentFingerprint = JSON.stringify(content);
    const modified = currentFingerprint !== starterFingerprint;
    if (tokenTargets.length > 0) {
      const text = extractSearchableContent(content);
      const matched = tokenTargets.filter((token) => text.includes(foldAscii(token)));
      if (matched.length === tokenTargets.length) {
        return { passed: true, detail: `Đã phát hiện nội dung yêu cầu (${matched.join(', ')}).` };
      }
      if (modified && matched.length > 0) {
        return { passed: true, detail: `Đã cập nhật tệp và khớp từ khoá “${matched[0]}”.` };
      }
      return {
        passed: false,
        detail: `Chưa tìm thấy chuỗi yêu cầu: ${tokenTargets.map((t) => `“${t}”`).join(', ')}.`,
      };
    }
    return modified
      ? { passed: true, detail: 'Đã ghi nhận thay đổi trên tệp dự án nhập ngoài (đối chiếu thủ công với đề gốc).' }
      : { passed: false, detail: 'Tệp dự án chưa có thay đổi nào so với bản gốc.' };
  };
}

async function convertStarterEntry(entry: RawPackEntry, track: MosTrackId): Promise<FileContent> {
  const buffer = await entry.readBuffer();
  if (track === 'word') {
    const { importDocxFull } = await import('../docxImport');
    const imported = await importDocxFull(buffer).catch(async () => {
      const { importDocx } = await import('../docxConvert');
      return { html: await importDocx(buffer), page: basePage() };
    });
    const docContent: DocContent = {
      kind: 'doc',
      json: imported.html as unknown as JSONContent,
      page: imported.page,
      comments: [],
    };
    return docContent;
  }
  if (track === 'excel') {
    const { importSpreadsheet } = await import('../xlsxConvert');
    const workbook = await importSpreadsheet(buffer, entry.name);
    const sheetContent: SheetContent = {
      kind: 'sheet',
      workbook,
      printSettings: { orientation: 'portrait', paperSize: 'A4', margins: 'normal', fitToPage: false, showGridlines: true },
    };
    return sheetContent;
  }
  const { importFromPptx } = await import('../pptxImport');
  const presentation = await importFromPptx(buffer, entry.name);
  const slideContent: SlideContent = { kind: 'slide', presentation };
  return slideContent;
}

function starterMatchesTrack(name: string, track: MosTrackId): boolean {
  const lower = name.toLowerCase();
  if (track === 'word') return lower.endsWith('.docx');
  if (track === 'excel') return lower.endsWith('.xlsx') || lower.endsWith('.xlsm');
  return lower.endsWith('.pptx');
}

function parseFolderKeys(relPath: string): { examLabel: string; projectKey: string; projectOrder: number; projectLabel: string } {
  const parts = relPath.split('/').filter(Boolean);
  const dirParts = parts.slice(0, -1);
  let examLabel = 'Exam 1';
  let projectLabel = 'Project 1';
  let projectOrder = 1;

  for (const part of dirParts) {
    const examMatch = /(?:exam|de|đề|test|bo\s*de)\s*[-_#]?\s*(\d+)/i.exec(part);
    if (examMatch) examLabel = `Exam ${examMatch[1]}`;
    const projMatch = /(?:project|du\s*an|dự\s*án|bai|bài)\s*[-_#]?\s*(\d+)/i.exec(part);
    if (projMatch) {
      projectOrder = Number(projMatch[1]);
      projectLabel = `Project ${projMatch[1]}`;
    }
  }

  const projectDir = dirParts.length > 0 ? dirParts.join('/') : 'root';
  return { examLabel, projectKey: `${examLabel}::${projectDir}`, projectOrder, projectLabel };
}

async function collectEntriesFromFiles(files: File[]): Promise<{ packName: string; entries: RawPackEntry[] }> {
  const entries: RawPackEntry[] = [];
  let packName = 'Bộ đề MOS nhập ngoài';

  if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
    const zipFile = files[0];
    packName = zipFile.name.replace(/\.zip$/i, '');
    const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;
      const clean = normalizePath(relativePath);
      const name = clean.split('/').pop() ?? clean;
      if (!name || name.startsWith('~$') || name.startsWith('.') || clean.includes('__MACOSX/')) return;
      if (OFFICE_EXT_RE.test(name) || TEXT_EXT_RE.test(name)) {
        entries.push({ path: clean, name, readBuffer: () => zipEntry.async('arraybuffer') });
      }
    });
    return { packName, entries };
  }

  const firstPath = (files[0] as File & { webkitRelativePath?: string })?.webkitRelativePath ?? '';
  if (firstPath.includes('/')) {
    packName = firstPath.split('/')[0] || packName;
  } else if (files.length > 0) {
    packName = files[0].name.replace(/\.[^.]+$/, '');
  }

  for (const file of files) {
    const rel = normalizePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
    const name = rel.split('/').pop() ?? file.name;
    if (!name || name.startsWith('~$') || name.startsWith('.') || rel.includes('__MACOSX/')) continue;
    if (OFFICE_EXT_RE.test(name) || TEXT_EXT_RE.test(name)) {
      entries.push({ path: rel, name, readBuffer: () => file.arrayBuffer() });
    }
  }
  return { packName, entries };
}

export async function importMosExamPack(
  files: File[],
  defaults: { track: MosTrackId; version: MosVersion; level: MosLevel },
): Promise<ImportedMosPack> {
  const { packName, entries } = await collectEntriesFromFiles(files);
  if (entries.length === 0) {
    throw new Error('Không tìm thấy tệp Office (.docx, .xlsx, .pptx) hoặc câu hỏi hợp lệ trong bộ đề đã chọn.');
  }

  const paths = entries.map((e) => e.path);
  const track = detectTrackFromEntries(entries, defaults.track);
  const version = detectVersionFromPath(paths, defaults.version);
  const level = detectLevelFromPath(paths, defaults.level);
  const warnings: string[] = [];

  const buckets = new Map<string, { examLabel: string; projectOrder: number; projectLabel: string; files: RawPackEntry[] }>();
  for (const entry of entries) {
    const meta = parseFolderKeys(entry.path);
    const existing = buckets.get(meta.projectKey);
    if (existing) {
      existing.files.push(entry);
    } else {
      buckets.set(meta.projectKey, {
        examLabel: meta.examLabel,
        projectOrder: meta.projectOrder,
        projectLabel: meta.projectLabel,
        files: [entry],
      });
    }
  }

  const sortedBuckets = [...buckets.values()].sort((a, b) =>
    a.examLabel.localeCompare(b.examLabel, undefined, { numeric: true }) || a.projectOrder - b.projectOrder,
  );

  const trackDomains = domainsForTrack(track);
  const stamp = Date.now().toString(36);
  const groupMap = new Map<string, MosProject[]>();

  let runningIndex = 0;
  for (const bucket of sortedBuckets) {
    const questionFile = bucket.files.find((f) => QUESTION_FILE_RE.test(f.name) && (f.name.toLowerCase().endsWith('.docx') || TEXT_EXT_RE.test(f.name)));
    const candidateStarters = bucket.files.filter((f) => f !== questionFile && starterMatchesTrack(f.name, track));
    const starterEntry = candidateStarters[0];
    if (!starterEntry) continue;

    runningIndex += 1;
    let starterContent: FileContent;
    try {
      starterContent = await convertStarterEntry(starterEntry, track);
    } catch {
      warnings.push(`Bỏ qua tệp lỗi định dạng: ${starterEntry.path}`);
      continue;
    }

    let parsedDoc: ParsedQuestionDoc;
    if (questionFile) {
      try {
        const buf = await questionFile.readBuffer();
        const rawText = questionFile.name.toLowerCase().endsWith('.docx')
          ? await extractDocxPlainText(buf)
          : new TextDecoder().decode(buf);
        parsedDoc = parseMosQuestionsText(rawText, bucket.projectOrder);
      } catch {
        warnings.push(`Không đọc được tệp câu hỏi: ${questionFile.name}`);
        parsedDoc = parseMosQuestionsText('', bucket.projectOrder);
      }
    } else {
      parsedDoc = parseMosQuestionsText('', bucket.projectOrder);
    }

    const starterFingerprint = JSON.stringify(starterContent);
    const starterSearchText = extractSearchableContent(starterContent);
    const projectId = `imported-${track}-${stamp}-${runningIndex}`;
    const baseTitle = starterEntry.name.replace(/\.[^.]+$/, '');
    const tasks: MosTask<FileContent>[] = parsedDoc.tasks.map((item, idx) => ({
      id: `${projectId}-t${idx + 1}`,
      domainId: trackDomains[idx % trackDomains.length]?.id ?? trackDomains[0].id,
      title: item.title,
      titleEn: item.title,
      instruction: item.instruction,
      instructionEn: item.instruction,
      copyTokens: item.copyTokens,
      ribbonPath: `Đề nhập ngoài · ${bucket.examLabel} / ${bucket.projectLabel}`,
      hint: `Thực hiện trực tiếp yêu cầu trên tệp “${starterEntry.name}”. Đánh dấu Mark Completed khi hoàn tất.`,
      points: 20,
      check: buildImportedTaskCheck(starterFingerprint, starterSearchText, item),
    }));

    const project = {
      id: projectId,
      track,
      level,
      kind: starterContent.kind,
      order: bucket.projectOrder || runningIndex,
      title: `${bucket.projectLabel} · ${baseTitle}`,
      titleEn: `${bucket.projectLabel} · ${baseTitle}`,
      fileName: starterEntry.name,
      scenario: parsedDoc.scenario,
      scenarioEn: parsedDoc.scenario,
      minutes: 8,
      difficulty: 'Trung bình' as const,
      createStarter: () => structuredClone(starterContent),
      tasks,
    } as MosProject;

    const existingGroup = groupMap.get(bucket.examLabel) ?? [];
    existingGroup.push(project);
    groupMap.set(bucket.examLabel, existingGroup);
  }

  const groups: ImportedExamGroup[] = [...groupMap.entries()].map(([label, projects], idx) => ({
    id: `${stamp}-g${idx + 1}`,
    label,
    projects: projects.sort((a, b) => a.order - b.order),
  }));

  const allProjects = groups.flatMap((g) => g.projects);
  if (allProjects.length === 0) {
    throw new Error('Không tìm thấy dự án MOS phù hợp (.docx / .xlsx / .pptx) trong tệp hoặc thư mục đã chọn.');
  }

  return {
    id: `pack-${stamp}`,
    name: packName,
    track,
    version,
    level,
    groups,
    projects: allProjects,
    warnings,
  };
}
