import { EXCEL_SOLUTIONS } from './excelSolutions';
import { PPT_SOLUTIONS } from './pptSolutions';
import type { MosInlineSolution, MosProject, MosTask, MosTaskSolution } from './types';
import { WORD_SOLUTIONS, type RawSolutionEntry } from './wordSolutions';

const ALL_SOLUTIONS: Record<string, RawSolutionEntry> = {
  ...WORD_SOLUTIONS,
  ...EXCEL_SOLUTIONS,
  ...PPT_SOLUTIONS,
};

export function registerMosSolutions(entries: Record<string, MosInlineSolution>): void {
  Object.assign(ALL_SOLUTIONS, entries);
}

export function hasAuthoredSolution(task: Pick<MosTask, 'id' | 'solution'>): boolean {
  return Boolean(task.solution || ALL_SOLUTIONS[task.id]);
}

export function solutionForTask(
  task: Pick<MosTask, 'id' | 'ribbonPath' | 'hint' | 'copyTokens' | 'solution'>,
  project?: Pick<MosProject, 'fileName'>,
): MosTaskSolution {
  const entry = task.solution ?? ALL_SOLUTIONS[task.id];
  if (entry) {
    return {
      ribbonPath: task.ribbonPath,
      steps: entry.steps,
      formulaOrValue: entry.formulaOrValue ?? task.copyTokens?.[0],
      shortcut: entry.shortcut,
      examTrap: entry.examTrap,
      verifyTip: entry.verifyTip,
    };
  }
  const fileLabel = project?.fileName ?? 'tệp đề thi';
  const token = task.copyTokens?.[0];
  return {
    ribbonPath: task.ribbonPath,
    steps: [
      `Mở tệp “${fileLabel}” ở khung soạn thảo phía trên.`,
      `Thực hiện theo chỉ dẫn: ${task.hint}`,
      token ? `Sao chép chính xác chuỗi “${token}” bằng nút Click-to-Copy để tránh lỗi chính tả.` : 'Đối chiếu lại vị trí và giá trị yêu cầu trước khi đánh dấu hoàn thành.',
    ],
    formulaOrValue: token,
    verifyTip: 'Bấm “Kiểm tra câu” (hoặc đánh dấu Mark Completed) sau khi hoàn tất thao tác.',
  };
}

export function totalAuthoredSolutions(projects?: ReadonlyArray<MosProject>): number {
  if (projects) {
    return projects.reduce((sum, project) => sum + project.tasks.filter((task) => hasAuthoredSolution(task)).length, 0);
  }
  return Object.keys(ALL_SOLUTIONS).length;
}
