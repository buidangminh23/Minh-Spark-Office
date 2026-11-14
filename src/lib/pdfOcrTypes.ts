export type EditablePdfLine = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: 'sans' | 'serif';
  bold: boolean;
  color: [number, number, number];
};

export type EditablePdfPage = {
  pageIndex: number;
  width: number;
  height: number;
  lines: EditablePdfLine[];
};

export type EditablePdfPageInput = EditablePdfPage & { background: Uint8Array };
