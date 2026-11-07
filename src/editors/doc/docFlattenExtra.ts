import type { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';

export type FlattenExtra = (node: JSONContent, editor: Editor) => JSONContent[];

export const FLATTEN_EXTRA: Record<string, FlattenExtra> = {};
