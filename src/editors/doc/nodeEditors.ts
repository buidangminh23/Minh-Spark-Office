import type { Node as PMNode } from '@tiptap/pm/model';
import type { DocCtx } from './DocContext';

export type NodeEditor = (ctx: DocCtx, node: PMNode, pos: number) => boolean;

export const NODE_EDITORS: Record<string, NodeEditor> = {};
