import { MOS_EXAM_NUMBERS, projectsForExam, projectsForTrack, projectsForVersion } from './grader';
import type {
  MosAttemptRecord,
  MosDrillSummary,
  MosExamNumber,
  MosLevel,
  MosProgress,
  MosProject,
  MosSavedDraft,
  MosTrackId,
  MosVersion,
} from './types';

const STORAGE_PREFIX = 'office23-mos-progress';
const DRAFT_PREFIX = 'office23-mos-draft';
const MAX_ATTEMPTS = 60;

export function emptyProgress(): MosProgress {
  return {
    attempts: [],
    passedTaskIds: [],
    failedTaskIds: [],
    bestMockScore: {},
    bestExamScore: {},
    drillStats: {},
  };
}

function storageKey(uid: string | null): string {
  return `${STORAGE_PREFIX}:${uid ?? 'guest'}`;
}

function draftKey(uid: string | null): string {
  return `${DRAFT_PREFIX}:${uid ?? 'guest'}`;
}

export function examScoreKey(
  version: MosVersion,
  track: MosTrackId,
  level: MosLevel,
  examNumber?: MosExamNumber,
): string {
  return examNumber ? `${version}:${track}:${level}:${examNumber}` : `${version}:${track}:${level}`;
}

export function loadMosProgress(uid: string | null): MosProgress {
  if (typeof localStorage === 'undefined') return emptyProgress();
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<MosProgress>;
    return {
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      passedTaskIds: Array.isArray(parsed.passedTaskIds) ? parsed.passedTaskIds : [],
      failedTaskIds: Array.isArray(parsed.failedTaskIds) ? parsed.failedTaskIds : [],
      bestMockScore: parsed.bestMockScore && typeof parsed.bestMockScore === 'object' ? parsed.bestMockScore : {},
      bestExamScore: parsed.bestExamScore && typeof parsed.bestExamScore === 'object' ? parsed.bestExamScore : {},
      drillStats: parsed.drillStats && typeof parsed.drillStats === 'object' ? parsed.drillStats : {},
    };
  } catch {
    return emptyProgress();
  }
}

export function saveMosProgress(uid: string | null, progress: MosProgress): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(progress));
  } catch {
    return;
  }
}

export function saveMosDraft(uid: string | null, draft: MosSavedDraft): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(draftKey(uid), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadMosDraft(uid: string | null): MosSavedDraft | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(draftKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MosSavedDraft>;
    if (!parsed.config || !Array.isArray(parsed.config.projectIds) || parsed.config.projectIds.length === 0) return null;
    return {
      config: parsed.config,
      projectIndex: typeof parsed.projectIndex === 'number' ? parsed.projectIndex : 0,
      activeTab: parsed.activeTab === 'overview' || typeof parsed.activeTab === 'number' ? parsed.activeTab : 0,
      elapsedSec: typeof parsed.elapsedSec === 'number' ? parsed.elapsedSec : 0,
      completedTasks: parsed.completedTasks && typeof parsed.completedTasks === 'object' ? parsed.completedTasks : {},
      reviewTasks: parsed.reviewTasks && typeof parsed.reviewTasks === 'object' ? parsed.reviewTasks : {},
      docs: parsed.docs && typeof parsed.docs === 'object' ? parsed.docs : {},
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearMosDraft(uid: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(draftKey(uid));
  } catch {
    return;
  }
}

export function recordMosAttempt(current: MosProgress, attempt: MosAttemptRecord): MosProgress {
  const passedSet = new Set(current.passedTaskIds);
  const failedSet = new Set(current.failedTaskIds);
  for (const project of attempt.projects) {
    for (const task of project.tasks) {
      if (task.passed) {
        passedSet.add(task.taskId);
        failedSet.delete(task.taskId);
      } else {
        failedSet.add(task.taskId);
      }
    }
  }
  const bestMockScore = { ...current.bestMockScore };
  const bestExamScore = { ...(current.bestExamScore ?? {}) };
  if (attempt.mode === 'exam') {
    bestMockScore[attempt.track] = Math.max(bestMockScore[attempt.track] ?? 0, attempt.score);
    const vKey = examScoreKey(attempt.version, attempt.track, attempt.level);
    bestExamScore[vKey] = Math.max(bestExamScore[vKey] ?? 0, attempt.score);
    if (attempt.examNumber) {
      const eKey = examScoreKey(attempt.version, attempt.track, attempt.level, attempt.examNumber);
      bestExamScore[eKey] = Math.max(bestExamScore[eKey] ?? 0, attempt.score);
    }
  }
  return {
    ...current,
    attempts: [attempt, ...current.attempts].slice(0, MAX_ATTEMPTS),
    passedTaskIds: [...passedSet],
    failedTaskIds: [...failedSet],
    bestMockScore,
    bestExamScore,
  };
}

export function recordMosDrill(current: MosProgress, summary: MosDrillSummary): MosProgress {
  const prev = current.drillStats[summary.track];
  return {
    ...current,
    drillStats: {
      ...current.drillStats,
      [summary.track]: {
        correct: (prev?.correct ?? 0) + summary.correct,
        total: (prev?.total ?? 0) + summary.total,
        runs: (prev?.runs ?? 0) + 1,
        lastAt: summary.completedAt || Date.now(),
      },
    },
  };
}

function summarizePool(progress: MosProgress, projects: ReadonlyArray<MosProject>, bestMock: number | null) {
  const allIds = projects.flatMap((p) => p.tasks.map((t) => t.id));
  const passedSet = new Set(progress.passedTaskIds);
  const failedSet = new Set(progress.failedTaskIds);
  const passedTasks = allIds.filter((id) => passedSet.has(id)).length;
  const failedFirst = allIds.filter((id) => failedSet.has(id));
  const unpassed = allIds.filter((id) => !passedSet.has(id) && !failedSet.has(id));
  const weakTaskIds = [...failedFirst, ...unpassed];
  const totalTasks = allIds.length;
  return {
    passedTasks,
    totalTasks,
    percent: totalTasks > 0 ? Math.round((passedTasks / totalTasks) * 100) : 0,
    bestMock,
    weakTaskIds,
  };
}

export function trackReadiness(progress: MosProgress, track: MosTrackId, level?: MosLevel) {
  const projects = projectsForTrack(track, level);
  return summarizePool(progress, projects, progress.bestMockScore[track] ?? null);
}

export function examSetReadiness(
  progress: MosProgress,
  track: MosTrackId,
  version: MosVersion,
  level: MosLevel,
  examNumber: MosExamNumber,
) {
  const projects = projectsForExam(track, version, level, examNumber);
  const key = examScoreKey(version, track, level, examNumber);
  const bestMock = progress.bestExamScore?.[key] ?? null;
  return summarizePool(progress, projects, bestMock);
}

export function versionTrackReadiness(
  progress: MosProgress,
  track: MosTrackId,
  version: MosVersion,
  level: MosLevel,
) {
  const projects = projectsForVersion(track, version, level);
  const key = examScoreKey(version, track, level);
  const bestMock = progress.bestExamScore?.[key] ?? null;
  const base = summarizePool(progress, projects, bestMock);
  const passedSet = new Set(progress.passedTaskIds);
  const completedExams = MOS_EXAM_NUMBERS.filter((examNumber) => {
    const examProjects = projectsForExam(track, version, level, examNumber);
    return examProjects.length > 0 && examProjects.every((p) => p.tasks.every((t) => passedSet.has(t.id)));
  }).length;
  return {
    ...base,
    completedExams,
  };
}
