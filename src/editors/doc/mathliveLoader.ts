export interface MathfieldLike extends HTMLElement {
  value: string;
  executeCommand: (command: unknown) => boolean;
  mathVirtualKeyboardPolicy: string;
  smartFence: boolean;
}

type MathfieldConstructor = new () => MathfieldLike;

let loading: Promise<MathfieldConstructor> | null = null;

export function loadMathfield(): Promise<MathfieldConstructor> {
  loading ??= (async () => {
    const mod = await import('mathlive');
    await import('mathlive/fonts.css');
    mod.MathfieldElement.fontsDirectory = null;
    mod.MathfieldElement.soundsDirectory = null;
    return mod.MathfieldElement as unknown as MathfieldConstructor;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

export async function createMathfield(latex: string): Promise<MathfieldLike> {
  const Field = await loadMathfield();
  const field = new Field();
  field.smartFence = true;
  field.value = latex;
  return field;
}
