import type { DocContent, FileContent, SheetContent, SlideContent } from '../storage';

export type MosTrackId = 'word' | 'excel' | 'powerpoint';
export type MosVersion = '365' | '2019' | '2016';
export type MosLevel = 'associate' | 'expert';
export type MosMode = 'training' | 'exam';
export type MosLang = 'vi' | 'en';
export type MosExamFormat =
  | 'certiport-exam'
  | 'guided-training'
  | 'speed-sprint'
  | 'domain-focus'
  | 'single-project'
  | 'weak-review'
  | 'custom';

export type MosSessionConfig = {
  track: MosTrackId;
  version: MosVersion;
  level: MosLevel;
  format: MosExamFormat;
  mode: MosMode;
  lang: MosLang;
  projectIds: string[];
  timeLimitSec: number | null;
  allowHints: boolean;
  allowLiveCheck: boolean;
  passingScore: number;
  focusDomainIds?: string[];
  focusTaskIds?: string[];
  label: string;
};

export type MosDomain = {
  id: string;
  track: MosTrackId;
  code: string;
  name: string;
  nameEn: string;
};

export type MosTaskCheckResult = {
  passed: boolean;
  detail: string;
};

export type MosTaskSolution = {
  ribbonPath: string;
  steps: string[];
  formulaOrValue?: string;
  shortcut?: string;
  examTrap?: string;
  verifyTip: string;
};

export type MosTask<C extends FileContent = FileContent> = {
  id: string;
  domainId: string;
  title: string;
  titleEn?: string;
  instruction: string;
  instructionEn?: string;
  copyTokens?: string[];
  ribbonPath: string;
  hint: string;
  points: number;
  check: (content: C) => MosTaskCheckResult;
};

export type MosProjectBase<K extends 'doc' | 'sheet' | 'slide', C extends FileContent> = {
  id: string;
  track: MosTrackId;
  level: MosLevel;
  kind: K;
  order: number;
  title: string;
  titleEn?: string;
  fileName: string;
  scenario: string;
  scenarioEn?: string;
  minutes: number;
  difficulty: 'Cơ bản' | 'Trung bình' | 'Nâng cao';
  createStarter: () => C;
  tasks: MosTask<C>[];
};

export type MosWordProject = MosProjectBase<'doc', DocContent>;
export type MosExcelProject = MosProjectBase<'sheet', SheetContent>;
export type MosPptProject = MosProjectBase<'slide', SlideContent>;
export type MosProject = MosWordProject | MosExcelProject | MosPptProject;

export type MosTrackMeta = {
  id: MosTrackId;
  examCode: string;
  title: string;
  subtitle: string;
  editorKind: 'doc' | 'sheet' | 'slide';
  appName: string;
  examMinutes: number;
  passingScore: number;
  accent: string;
  officeColor: string;
  supportsExpert: boolean;
};

export type MosVersionMeta = {
  id: MosVersion;
  label: string;
  short: string;
  uiSummary: string;
  submitLabel: string;
  projectFormat: 'slash' | 'of';
};

export type MosTaskGrade = {
  taskId: string;
  projectId: string;
  domainId: string;
  title: string;
  passed: boolean;
  earnedPoints: number;
  maxPoints: number;
  detail: string;
};

export type MosDomainScore = {
  domainId: string;
  code: string;
  name: string;
  passedCount: number;
  totalCount: number;
  percent: number;
};

export type MosProjectGrade = {
  projectId: string;
  projectTitle: string;
  fileName: string;
  passedCount: number;
  totalCount: number;
  tasks: MosTaskGrade[];
};

export type MosAttemptRecord = {
  id: string;
  track: MosTrackId;
  version: MosVersion;
  level: MosLevel;
  format: MosExamFormat;
  formatLabel: string;
  mode: MosMode;
  examCode: string;
  passingScore: number;
  projectIds: string[];
  score: number;
  passed: boolean;
  passedTasks: number;
  totalTasks: number;
  durationSec: number;
  completedAt: number;
  domains: MosDomainScore[];
  projects: MosProjectGrade[];
};

export type MosDrillQuestion = {
  id: string;
  track: MosTrackId;
  level: MosLevel;
  domainId: string;
  prompt: string;
  options: [string, string, string, string];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
};

export type MosDrillMode = 'practice' | 'timed';

export type MosDrillSummary = {
  track: MosTrackId;
  mode: MosDrillMode;
  correct: number;
  total: number;
  completedAt: number;
};

export type MosSavedDraft = {
  config: MosSessionConfig;
  projectIndex: number;
  activeTab: 'overview' | number;
  elapsedSec: number;
  completedTasks: Record<string, boolean>;
  reviewTasks: Record<string, boolean>;
  docs: Record<string, FileContent>;
  savedAt: number;
};

export type MosProgress = {
  attempts: MosAttemptRecord[];
  passedTaskIds: string[];
  failedTaskIds: string[];
  bestMockScore: Partial<Record<MosTrackId, number>>;
  drillStats: Partial<Record<MosTrackId, { correct: number; total: number; runs: number; lastAt: number }>>;
};
