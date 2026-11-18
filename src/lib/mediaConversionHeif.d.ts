declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  type ImageFrame = import('./mediaConversionFrames').ImageFrame;
  type HeifImage = {
    get_width(): number;
    get_height(): number;
    display(frame: ImageFrame, callback: (result: ImageFrame | null) => void): void;
    free(): void;
  };
  export default function createHeifModule(): Promise<{
    HeifDecoder: new () => { decoder: unknown; decode(bytes: Uint8Array): HeifImage[] };
    heif_context_free(context: unknown): void;
    heif_js_context_get_list_of_top_level_image_IDs(context: unknown): ArrayLike<number>;
  }>;
}
