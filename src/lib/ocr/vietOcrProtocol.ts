import type { GrayImage } from './pagePrep';
import type { RecognizedPage } from './vietOcrEngine';

export type VietOcrRequest =
  | { type: 'recognize'; id: number; base: string; image: GrayImage }
  | { type: 'cancel'; id: number };

export type VietOcrResponse =
  | { type: 'download'; id: number; loaded: number; total: number }
  | { type: 'lines'; id: number; done: number; total: number }
  | { type: 'result'; id: number; page: RecognizedPage }
  | { type: 'error'; id: number; message: string; aborted: boolean };
