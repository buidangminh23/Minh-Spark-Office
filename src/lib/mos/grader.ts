import type { FileContent } from '../storage';
import { MOS_EXCEL_PROJECTS } from './excelProjects';
import { MOS_PPT_PROJECTS } from './pptProjects';
import type {
  MosAttemptRecord,
  MosDomain,
  MosDomainScore,
  MosExamFormat,
  MosLevel,
  MosProject,
  MosProjectGrade,
  MosSessionConfig,
  MosTaskGrade,
  MosTrackId,
  MosTrackMeta,
  MosVersion,
} from './types';
import { MOS_WORD_PROJECTS } from './wordProjects';

export const MOS_MAX_SCORE = 1000;
export const MOS_PASSING_SCORE = 700;

export const MOS_VERSIONS: ReadonlyArray<{ id: MosVersion; label: string; short: string }> = [
  { id: '365', label: 'Microsoft 365 Apps', short: 'MOS 365' },
  { id: '2019', label: 'Office 2019', short: 'MOS 2019' },
  { id: '2016', label: 'Office 2016', short: 'MOS 2016' },
];

export const MOS_LEVELS: ReadonlyArray<{ id: MosLevel; label: string; detail: string }> = [
  { id: 'associate', label: 'Associate', detail: 'Chuẩn năng lực phổ thông (3 dự án)' },
  { id: 'expert', label: 'Expert / Chuyên sâu', detail: 'Đầy đủ + dự án chuyên sâu (4 dự án)' },
];

export const MOS_FORMAT_LABELS: Record<MosExamFormat, string> = {
  'certiport-exam': 'Thi thử chuẩn Certiport',
  'guided-training': 'Luyện tập có hướng dẫn',
  'speed-sprint': 'Thi nhanh tốc độ',
  'domain-focus': 'Luyện theo miền kỹ năng',
  'single-project': 'Thực hành dự án lẻ',
  'weak-review': 'Ôn lại câu chưa đạt',
  custom: 'Đề thi tuỳ chỉnh',
};

const EXAM_CODES: Record<MosVersion, Record<MosTrackId, Record<MosLevel, string>>> = {
  '365': {
    word: { associate: 'MO-110', expert: 'MO-111' },
    excel: { associate: 'MO-210', expert: 'MO-211' },
    powerpoint: { associate: 'MO-310', expert: 'MO-310+' },
  },
  '2019': {
    word: { associate: 'MO-100', expert: 'MO-101' },
    excel: { associate: 'MO-200', expert: 'MO-201' },
    powerpoint: { associate: 'MO-300', expert: 'MO-300+' },
  },
  '2016': {
    word: { associate: '77-725', expert: '77-726' },
    excel: { associate: '77-727', expert: '77-728' },
    powerpoint: { associate: '77-729', expert: '77-729+' },
  },
};

export function examCodeFor(track: MosTrackId, version: MosVersion, level: MosLevel): string {
  return EXAM_CODES[version][track][level];
}

export const MOS_TRACKS: ReadonlyArray<MosTrackMeta> = [
  {
    id: 'word',
    examCode: 'MO-110 / MO-100',
    title: 'MOS Word',
    subtitle: 'Thực hành trực tiếp trên 23 Docs',
    editorKind: 'doc',
    appName: '23 Docs',
    examMinutes: 50,
    passingScore: MOS_PASSING_SCORE,
    accent: '#2563eb',
    supportsExpert: true,
  },
  {
    id: 'excel',
    examCode: 'MO-210 / MO-200',
    title: 'MOS Excel',
    subtitle: 'Thực hành trực tiếp trên 23 Sheets',
    editorKind: 'sheet',
    appName: '23 Sheets',
    examMinutes: 50,
    passingScore: MOS_PASSING_SCORE,
    accent: '#16a34a',
    supportsExpert: true,
  },
  {
    id: 'powerpoint',
    examCode: 'MO-310 / MO-300',
    title: 'MOS PowerPoint',
    subtitle: 'Thực hành trực tiếp trên 23 Slides',
    editorKind: 'slide',
    appName: '23 Slides',
    examMinutes: 50,
    passingScore: MOS_PASSING_SCORE,
    accent: '#ea580c',
    supportsExpert: true,
  },
];

export const MOS_DOMAINS: ReadonlyArray<MosDomain> = [
  { id: 'word-manage', track: 'word', code: '1.0', name: 'Quản lý tài liệu & Thiết lập trang' },
  { id: 'word-format', track: 'word', code: '2.0', name: 'Định dạng văn bản, đoạn văn & kiểu' },
  { id: 'word-tables', track: 'word', code: '3.0', name: 'Bảng biểu, danh sách & đối tượng' },
  { id: 'word-refs', track: 'word', code: '4.0', name: 'Tham chiếu, mục lục & kiểm duyệt' },
  { id: 'excel-manage', track: 'excel', code: '1.0', name: 'Quản lý sổ tính & trang tính' },
  { id: 'excel-format', track: 'excel', code: '2.0', name: 'Định dạng dữ liệu, gộp ô & in ấn' },
  { id: 'excel-formulas', track: 'excel', code: '3.0', name: 'Công thức thống kê & tính có điều kiện' },
  { id: 'excel-lookup', track: 'excel', code: '4.0', name: 'Hàm logic, chuỗi & tra cứu nâng cao' },
  { id: 'ppt-manage', track: 'powerpoint', code: '1.0', name: 'Quản lý bài thuyết trình & trang chiếu' },
  { id: 'ppt-content', track: 'powerpoint', code: '2.0', name: 'Chèn bảng, biểu đồ, SmartArt & hình' },
  { id: 'ppt-motion', track: 'powerpoint', code: '3.0', name: 'Hiệu ứng chuyển tiếp & hoạt hình' },
  { id: 'ppt-deliver', track: 'powerpoint', code: '4.0', name: 'Trình chiếu, Slide Master & kiểm duyệt' },
];

export const ALL_MOS_PROJECTS: ReadonlyArray<MosProject> = [
  ...MOS_WORD_PROJECTS,
  ...MOS_EXCEL_PROJECTS,
  ...MOS_PPT_PROJECTS,
];

export function trackMeta(track: MosTrackId): MosTrackMeta {
  return MOS_TRACKS.find((item) => item.id === track) ?? MOS_TRACKS[0];
}

export function domainsForTrack(track: MosTrackId): MosDomain[] {
  return MOS_DOMAINS.filter((item) => item.track === track);
}

export function projectsForTrack(track: MosTrackId, level?: MosLevel): MosProject[] {
  const list = ALL_MOS_PROJECTS.filter((project) => project.track === track);
  if (level === 'associate') return list.filter((project) => project.level === 'associate');
  return list;
}

export function projectById(id: string): MosProject | undefined {
  return ALL_MOS_PROJECTS.find((project) => project.id === id);
}

export function buildPresetSession(
  format: Exclude<MosExamFormat, 'custom'>,
  options: {
    track: MosTrackId;
    version: MosVersion;
    level: MosLevel;
    projectId?: string;
    domainIds?: string[];
    weakTaskIds?: string[];
  },
): MosSessionConfig {
  const { track, version, level } = options;
  const available = projectsForTrack(track, level);
  const allTrack = projectsForTrack(track);

  if (format === 'certiport-exam') {
    return {
      track,
      version,
      level,
      format,
      mode: 'exam',
      projectIds: available.map((p) => p.id),
      timeLimitSec: (level === 'expert' ? 50 : 50) * 60,
      allowHints: false,
      allowLiveCheck: false,
      passingScore: MOS_PASSING_SCORE,
      label: `${MOS_FORMAT_LABELS[format]} (${examCodeFor(track, version, level)})`,
    };
  }

  if (format === 'guided-training') {
    return {
      track,
      version,
      level,
      format,
      mode: 'training',
      projectIds: available.map((p) => p.id),
      timeLimitSec: null,
      allowHints: true,
      allowLiveCheck: true,
      passingScore: MOS_PASSING_SCORE,
      label: `${MOS_FORMAT_LABELS[format]} (${available.length} dự án)`,
    };
  }

  if (format === 'speed-sprint') {
    const picked = (options.projectId ? projectById(options.projectId) : available[0]) ?? available[0];
    return {
      track,
      version,
      level,
      format,
      mode: 'exam',
      projectIds: [picked.id],
      timeLimitSec: 15 * 60,
      allowHints: false,
      allowLiveCheck: false,
      passingScore: MOS_PASSING_SCORE,
      label: `Thi nhanh 15 phút · ${picked.title}`,
    };
  }

  if (format === 'domain-focus') {
    const selectedDomains = options.domainIds && options.domainIds.length > 0 ? options.domainIds : [domainsForTrack(track)[0].id];
    const domainSet = new Set(selectedDomains);
    const matching = allTrack.filter((project) => project.tasks.some((task) => domainSet.has(task.domainId)));
    const focusTasks = matching.flatMap((p) => p.tasks.filter((t) => domainSet.has(t.domainId)).map((t) => t.id));
    return {
      track,
      version,
      level,
      format,
      mode: 'training',
      projectIds: matching.map((p) => p.id),
      timeLimitSec: null,
      allowHints: true,
      allowLiveCheck: true,
      passingScore: MOS_PASSING_SCORE,
      focusDomainIds: selectedDomains,
      focusTaskIds: focusTasks,
      label: `Luyện miền kỹ năng (${focusTasks.length} câu)`,
    };
  }

  if (format === 'weak-review') {
    const weakSet = new Set(options.weakTaskIds ?? []);
    const matching = allTrack.filter((project) => project.tasks.some((task) => weakSet.has(task.id)));
    const targetProjects = matching.length > 0 ? matching : [available[0]];
    const targetTaskIds = matching.length > 0
      ? targetProjects.flatMap((p) => p.tasks.filter((t) => weakSet.has(t.id)).map((t) => t.id))
      : undefined;
    return {
      track,
      version,
      level,
      format,
      mode: 'training',
      projectIds: targetProjects.map((p) => p.id),
      timeLimitSec: null,
      allowHints: true,
      allowLiveCheck: true,
      passingScore: MOS_PASSING_SCORE,
      focusTaskIds: targetTaskIds,
      label: targetTaskIds ? `Ôn lại câu chưa đạt (${targetTaskIds.length} câu)` : 'Ôn luyện dự án ưu tiên',
    };
  }

  const single = (options.projectId ? projectById(options.projectId) : available[0]) ?? available[0];
  return {
    track,
    version,
    level,
    format: 'single-project',
    mode: 'training',
    projectIds: [single.id],
    timeLimitSec: null,
    allowHints: true,
    allowLiveCheck: true,
    passingScore: MOS_PASSING_SCORE,
    label: single.title,
  };
}

export function tasksForProjectInSession(project: MosProject, focusTaskIds?: string[]) {
  if (!focusTaskIds || focusTaskIds.length === 0) return project.tasks;
  const set = new Set(focusTaskIds);
  const filtered = project.tasks.filter((t) => set.has(t.id));
  return filtered.length > 0 ? filtered : project.tasks;
}

export function gradeSingleTask(project: MosProject, taskId: string, content: FileContent): MosTaskGrade {
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task) {
    return {
      taskId,
      projectId: project.id,
      domainId: '',
      title: '',
      passed: false,
      earnedPoints: 0,
      maxPoints: 0,
      detail: 'Không tìm thấy nhiệm vụ cần chấm.',
    };
  }
  const result = (task.check as (c: FileContent) => { passed: boolean; detail: string })(content);
  return {
    taskId: task.id,
    projectId: project.id,
    domainId: task.domainId,
    title: task.title,
    passed: result.passed,
    earnedPoints: result.passed ? task.points : 0,
    maxPoints: task.points,
    detail: result.detail,
  };
}

export function gradeProject(project: MosProject, content: FileContent, focusTaskIds?: string[]): MosProjectGrade {
  const selectedTasks = tasksForProjectInSession(project, focusTaskIds);
  const tasks = selectedTasks.map((task) => gradeSingleTask(project, task.id, content));
  const passedCount = tasks.filter((item) => item.passed).length;
  return {
    projectId: project.id,
    projectTitle: project.title,
    fileName: project.fileName,
    passedCount,
    totalCount: tasks.length,
    tasks,
  };
}

export function gradeExamAttempt(params: {
  config: MosSessionConfig;
  contentsByProjectId: Record<string, FileContent>;
  durationSec: number;
}): MosAttemptRecord {
  const { config, contentsByProjectId, durationSec } = params;
  const targetProjects = config.projectIds
    .map((id) => projectById(id))
    .filter((item): item is MosProject => Boolean(item));

  const projects = targetProjects.map((project) => {
    const content = contentsByProjectId[project.id] ?? project.createStarter();
    return gradeProject(project, content, config.focusTaskIds);
  });

  const allTasks = projects.flatMap((p) => p.tasks);
  const earned = allTasks.reduce((sum, t) => sum + t.earnedPoints, 0);
  const max = allTasks.reduce((sum, t) => sum + t.maxPoints, 0);
  const score = max > 0 ? Math.round((earned / max) * MOS_MAX_SCORE) : 0;
  const passedTasks = allTasks.filter((t) => t.passed).length;
  const totalTasks = allTasks.length;

  const trackDomains = domainsForTrack(config.track);
  const domains: MosDomainScore[] = trackDomains
    .map((domain) => {
      const matched = allTasks.filter((task) => task.domainId === domain.id);
      if (matched.length === 0) return null;
      const domainPassed = matched.filter((task) => task.passed).length;
      return {
        domainId: domain.id,
        code: domain.code,
        name: domain.name,
        passedCount: domainPassed,
        totalCount: matched.length,
        percent: Math.round((domainPassed / matched.length) * 100),
      };
    })
    .filter((item): item is MosDomainScore => Boolean(item));

  return {
    id: `mos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    track: config.track,
    version: config.version,
    level: config.level,
    format: config.format,
    formatLabel: config.label,
    mode: config.mode,
    examCode: examCodeFor(config.track, config.version, config.level),
    passingScore: config.passingScore,
    projectIds: targetProjects.map((p) => p.id),
    score,
    passed: score >= config.passingScore,
    passedTasks,
    totalTasks,
    durationSec: Math.max(1, Math.round(durationSec)),
    completedAt: Date.now(),
    domains,
    projects,
  };
}
