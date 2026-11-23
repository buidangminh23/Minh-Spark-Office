import { projectsForTrack } from './grader';
import type { MosAttemptRecord, MosDrillSummary, MosProgress, MosTrackId } from './types';

const STORAGE_PREFIX = 'office23-mos-progress';
const MAX_ATTEMPTS = 40;

export function emptyProgress(): MosProgress {
  return {
    attempts: [],
    passedTaskIds: [],
    failedTaskIds: [],
    bestMockScore: {},
    drillStats: {},
  };
}

function storageKey(uid: string | null): string {
  return `${STORAGE_PREFIX}:${uid ?? 'guest'}`;
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
  if (attempt.mode === 'exam') {
    bestMockScore[attempt.track] = Math.max(bestMockScore[attempt.track] ?? 0, attempt.score);
  }
  return {
    ...current,
    attempts: [attempt, ...current.attempts].slice(0, MAX_ATTEMPTS),
    passedTaskIds: [...passedSet],
    failedTaskIds: [...failedSet],
    bestMockScore,
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

export function trackReadiness(progress: MosProgress, track: MosTrackId): {
  passedTasks: number;
  totalTasks: number;
  percent: number;
  bestMock: number | null;
  weakTaskIds: string[];
} {
  const projects = projectsForTrack(track);
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
    bestMock: progress.bestMockScore[track] ?? null,
    weakTaskIds,
  };
}
