declare module 'gifenc' {
  type Palette = number[][];
  export function quantize(data: Uint8ClampedArray, colors: number, options: { format: 'rgba4444'; oneBitAlpha: boolean; clearAlpha: boolean }): Palette;
  export function applyPalette(data: Uint8ClampedArray, palette: Palette, format: 'rgba4444'): Uint8Array;
  export function GIFEncoder(options: { auto: boolean }): {
    writeHeader(): void;
    writeFrame(indexes: Uint8Array, width: number, height: number, options: { first: boolean; palette: Palette; transparent: boolean; transparentIndex: number; delay: number; repeat: number; dispose: number }): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  };
}
